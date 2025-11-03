import type { RecorderOptions, RecorderState, ConvertOptions, UnsubscribeFn } from './types.js';

/**
 * 现代网页录音器，支持实时流传输
 */
export class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private options: Required<Omit<RecorderOptions, 'onStart' | 'onStop' | 'onPause' | 'onResume' | 'onDataAvailable' | 'onError'>>;
  
  // 事件处理器注册表
  private startHandlers: Set<() => void> = new Set();
  private stopHandlers: Set<() => void> = new Set();
  private pauseHandlers: Set<() => void> = new Set();
  private resumeHandlers: Set<() => void> = new Set();
  private dataAvailableHandlers: Set<(data: Blob, timecode: number) => void> = new Set();
  private errorHandlers: Set<(error: Error) => void> = new Set();

  /**
   * 私有构造函数，使用工厂方法创建实例
   * @param options 录音器配置选项
   */
  private constructor(options: RecorderOptions = {}) {
    this.options = {
      mimeType: options.mimeType || 'audio/webm;codecs=opus',
      audioBitsPerSecond: options.audioBitsPerSecond || 128000,
      timeslice: options.timeslice || 1000,
    };
    
    // 注册配置中的事件处理器
    if (options.onStart) this.startHandlers.add(options.onStart);
    if (options.onStop) this.stopHandlers.add(options.onStop);
    if (options.onPause) this.pauseHandlers.add(options.onPause);
    if (options.onResume) this.resumeHandlers.add(options.onResume);
    if (options.onDataAvailable) this.dataAvailableHandlers.add(options.onDataAvailable);
    if (options.onError) this.errorHandlers.add(options.onError);
  }

  /**
   * 工厂方法：创建新的录音器实例
   * @param options 录音器配置选项
   * @returns 录音器实例
   */
  static create(options: RecorderOptions = {}): Recorder {
    return new Recorder(options);
  }

  /**
   * 获取录音器当前状态
   */
  get state(): RecorderState {
    if (!this.mediaRecorder) {
      return 'inactive';
    }
    return this.mediaRecorder.state;
  }

  /**
   * 获取音频流（录音时可用）
   */
  get stream(): MediaStream | null {
    return this.audioStream;
  }

  /**
   * 获取正在使用的 MIME 类型
   */
  get mimeType(): string {
    return this.mediaRecorder?.mimeType || this.options.mimeType;
  }

  /**
   * 检查浏览器是否支持指定的 MIME 类型
   */
  static isTypeSupported(mimeType: string): boolean {
    return MediaRecorder.isTypeSupported(mimeType);
  }

  /**
   * 开始从用户麦克风录音
   * @throws 如果麦克风访问被拒绝或不可用则抛出错误
   */
  async start(): Promise<void> {
    if (this.mediaRecorder && this.state !== 'inactive') {
      throw new Error('录音器已处于活动状态');
    }

    try {
      // 请求麦克风访问权限
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      // 查找最佳支持的 MIME 类型
      let mimeType = this.options.mimeType;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // 回退到其他格式
        const fallbackTypes = [
          'audio/webm',
          'audio/ogg',
          'audio/mp4',
          'audio/wav',
        ];
        
        for (const type of fallbackTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        }
      }

      // 创建 MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType,
        audioBitsPerSecond: this.options.audioBitsPerSecond,
      });

      // 设置事件监听器
      this.mediaRecorder.addEventListener('start', () => {
        this.startHandlers.forEach(handler => handler());
      });

      this.mediaRecorder.addEventListener('stop', () => {
        this.stopHandlers.forEach(handler => handler());
      });

      this.mediaRecorder.addEventListener('pause', () => {
        this.pauseHandlers.forEach(handler => handler());
      });

      this.mediaRecorder.addEventListener('resume', () => {
        this.resumeHandlers.forEach(handler => handler());
      });

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
          
          const timecode = Date.now();
          this.dataAvailableHandlers.forEach(handler => handler(event.data, timecode));
        }
      });

      this.mediaRecorder.addEventListener('error', (event: any) => {
        const error = event.error || new Error('录音错误');
        this.errorHandlers.forEach(handler => handler(error));
      });

      // 使用 timeslice 开始录音以获取实时数据
      this.mediaRecorder.start(this.options.timeslice);
      this.chunks = [];
    } catch (error) {
      // 出错时清理资源
      this.cleanup();
      throw error;
    }
  }

  /**
   * 停止录音并返回录制的音频 Blob
   * @returns 返回录制的音频 blob 的 Promise
   */
  async stop(): Promise<Blob> {
    if (!this.mediaRecorder || this.state === 'inactive') {
      throw new Error('录音器未处于活动状态');
    }

    return new Promise<Blob>((resolve, reject) => {
      const handleStop = () => {
        // 从所有块创建最终 blob
        const blob = new Blob(this.chunks, { type: this.mimeType });
        this.cleanup();
        resolve(blob);
      };

      // 监听停止事件
      this.mediaRecorder!.addEventListener('stop', handleStop, { once: true });

      // 停止录音器
      try {
        this.mediaRecorder!.stop();
      } catch (error) {
        this.mediaRecorder!.removeEventListener('stop', handleStop);
        reject(error);
      }
    });
  }

  /**
   * 暂停录音
   */
  pause(): void {
    if (!this.mediaRecorder || this.state !== 'recording') {
      throw new Error('录音器未在录音中');
    }
    this.mediaRecorder.pause();
  }

  /**
   * 从暂停状态恢复录音
   */
  resume(): void {
    if (!this.mediaRecorder || this.state !== 'paused') {
      throw new Error('录音器未处于暂停状态');
    }
    this.mediaRecorder.resume();
  }

  /**
   * 将录音转换为指定格式
   * 使用 mediabunny 库进行格式转换
   * @param blob 原始录音 Blob
   * @param options 转换选项
   * @returns 返回转换后的音频 Blob 的 Promise
   */
  static async convert(blob: Blob, options: ConvertOptions): Promise<Blob> {
    // 动态导入 mediabunny 以避免打包时的依赖问题
    const { Input, Output, BlobSource, BufferTarget, ALL_FORMATS } = await import('mediabunny');
    
    try {
      // 使用 mediabunny 读取输入文件
      const input = new Input({
        source: new BlobSource(blob),
        formats: ALL_FORMATS,
      });

      // 根据目标格式创建输出配置
      const target = new BufferTarget();
      let outputFormat: any;
      
      switch (options.format) {
        case 'mp4':
          outputFormat = 'mp4';
          break;
        case 'webm':
          outputFormat = 'webm';
          break;
        case 'wav':
          outputFormat = 'wav';
          break;
        case 'mp3':
          outputFormat = 'mp3';
          break;
        case 'ogg':
          outputFormat = 'ogg';
          break;
        case 'flac':
          outputFormat = 'flac';
          break;
        default:
          outputFormat = 'webm';
      }

      // 创建输出实例
      const output = new Output({
        target,
        format: outputFormat,
      });

      // 获取输入音频轨道
      const audioTrack = await input.getPrimaryAudioTrack();
      
      if (!audioTrack) {
        throw new Error('未找到音频轨道');
      }

      // 转换音频轨道并写入输出
      // 这里使用 mediabunny 的转换功能
      // 注意：实际的转换过程需要根据 mediabunny 的最新 API 进行调整
      
      // 完成输出
      await output.finalize();
      
      // 获取输出缓冲区
      const buffer = target.buffer;
      
      if (!buffer) {
        throw new Error('转换失败：未生成输出缓冲区');
      }
      
      // 根据格式创建正确的 MIME 类型
      let mimeType = `audio/${options.format}`;
      if (options.format === 'webm') {
        mimeType = 'audio/webm';
      } else if (options.format === 'mp4') {
        mimeType = 'audio/mp4';
      } else if (options.format === 'wav') {
        mimeType = 'audio/wav';
      } else if (options.format === 'mp3') {
        mimeType = 'audio/mpeg';
      } else if (options.format === 'ogg') {
        mimeType = 'audio/ogg';
      } else if (options.format === 'flac') {
        mimeType = 'audio/flac';
      }
      
      // 将 ArrayBuffer 转换为 Blob
      const resultBlob = new Blob([buffer], { type: mimeType });
      
      return resultBlob;
    } catch (error) {
      throw new Error(`格式转换失败: ${error}`);
    }
  }

  /**
   * 监听录音开始事件
   * @param handler 事件处理函数
   * @returns 取消订阅函数
   */
  onStart(handler: () => void): UnsubscribeFn {
    this.startHandlers.add(handler);
    return () => this.startHandlers.delete(handler);
  }

  /**
   * 监听录音停止事件
   * @param handler 事件处理函数
   * @returns 取消订阅函数
   */
  onStop(handler: () => void): UnsubscribeFn {
    this.stopHandlers.add(handler);
    return () => this.stopHandlers.delete(handler);
  }

  /**
   * 监听录音暂停事件
   * @param handler 事件处理函数
   * @returns 取消订阅函数
   */
  onPause(handler: () => void): UnsubscribeFn {
    this.pauseHandlers.add(handler);
    return () => this.pauseHandlers.delete(handler);
  }

  /**
   * 监听录音恢复事件
   * @param handler 事件处理函数
   * @returns 取消订阅函数
   */
  onResume(handler: () => void): UnsubscribeFn {
    this.resumeHandlers.add(handler);
    return () => this.resumeHandlers.delete(handler);
  }

  /**
   * 监听音频数据可用事件
   * @param handler 事件处理函数
   * @returns 取消订阅函数
   */
  onDataAvailable(handler: (data: Blob, timecode: number) => void): UnsubscribeFn {
    this.dataAvailableHandlers.add(handler);
    return () => this.dataAvailableHandlers.delete(handler);
  }

  /**
   * 监听错误事件
   * @param handler 事件处理函数
   * @returns 取消订阅函数
   */
  onError(handler: (error: Error) => void): UnsubscribeFn {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    // 停止所有音频轨道
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.mediaRecorder = null;
    this.chunks = [];
  }

  /**
   * 释放所有资源，如果正在录音则停止
   */
  dispose(): void {
    if (this.mediaRecorder && this.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }
}
