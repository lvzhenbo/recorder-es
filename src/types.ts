/**
 * 事件监听器清理函数
 */
export type UnsubscribeFn = () => void;

/**
 * 录音器状态
 */
export type RecorderState = 'inactive' | 'recording' | 'paused';

/**
 * 录音器实例接口
 */
export interface RecorderInstance {
  /**
   * 获取录音器当前状态
   */
  readonly state: RecorderState;
  
  /**
   * 获取音频流（录音时可用）
   */
  readonly stream: MediaStream | null;
  
  /**
   * 获取正在使用的 MIME 类型
   */
  readonly mimeType: string;
  
  /**
   * 开始录音
   */
  start(): Promise<void>;
  
  /**
   * 停止录音并返回音频 Blob
   */
  stop(): Promise<Blob>;
  
  /**
   * 暂停录音
   */
  pause(): void;
  
  /**
   * 恢复录音
   */
  resume(): void;
  
  /**
   * 释放所有资源
   */
  dispose(): void;
  
  /**
   * 监听录音开始事件
   */
  onStart(handler: () => void): UnsubscribeFn;
  
  /**
   * 监听录音停止事件
   */
  onStop(handler: () => void): UnsubscribeFn;
  
  /**
   * 监听录音暂停事件
   */
  onPause(handler: () => void): UnsubscribeFn;
  
  /**
   * 监听录音恢复事件
   */
  onResume(handler: () => void): UnsubscribeFn;
  
  /**
   * 监听音频数据可用事件
   */
  onDataAvailable(handler: (data: Blob, timecode: number) => void): UnsubscribeFn;
  
  /**
   * 监听错误事件
   */
  onError(handler: (error: Error) => void): UnsubscribeFn;
}

/**
 * 事件处理器类型
 */
export interface RecorderEventHandlers {
  /**
   * 录音开始时的回调
   */
  onStart?: () => void;

  /**
   * 录音停止时的回调
   */
  onStop?: () => void;

  /**
   * 录音暂停时的回调
   */
  onPause?: () => void;

  /**
   * 录音恢复时的回调
   */
  onResume?: () => void;

  /**
   * 音频数据可用时的回调
   */
  onDataAvailable?: (data: Blob, timecode: number) => void;

  /**
   * 发生错误时的回调
   */
  onError?: (error: Error) => void;
}

/**
 * 录音器配置选项
 */
export interface RecorderOptions extends RecorderEventHandlers {
  /**
   * 录音使用的音频 MIME 类型
   * @default 'audio/webm;codecs=opus'
   */
  mimeType?: string;

  /**
   * 目标音频比特率（每秒比特数）
   * @default 128000
   */
  audioBitsPerSecond?: number;

  /**
   * 切片音频数据的时间间隔（毫秒）
   * 用于实时流场景
   * @default 1000
   */
  timeslice?: number;
}

/**
 * 支持的输出格式
 */
export type OutputFormat = 'webm' | 'mp4' | 'wav' | 'mp3' | 'ogg' | 'flac';

/**
 * 格式转换选项
 */
export interface ConvertOptions {
  /**
   * 目标格式
   */
  format: OutputFormat;

  /**
   * 音频比特率（可选）
   */
  audioBitsPerSecond?: number;
}
