import type { RecorderOptions, RecorderState, RecorderInstance, ConvertOptions, UnsubscribeFn } from './types.js';

/**
 * 创建录音器实例
 * @param options 录音器配置选项
 * @returns 录音器实例
 */
export function createRecorder(options: RecorderOptions = {}): RecorderInstance {
  // 内部状态
  let mediaRecorder: MediaRecorder | null = null;
  let audioStream: MediaStream | null = null;
  let chunks: Blob[] = [];
  
  // 配置选项
  const config = {
    mimeType: options.mimeType || 'audio/webm;codecs=opus',
    audioBitsPerSecond: options.audioBitsPerSecond || 128000,
    timeslice: options.timeslice || 1000,
  };
  
  // 事件处理器注册表
  const startHandlers = new Set<() => void>();
  const stopHandlers = new Set<() => void>();
  const pauseHandlers = new Set<() => void>();
  const resumeHandlers = new Set<() => void>();
  const dataAvailableHandlers = new Set<(data: Blob, timecode: number) => void>();
  const errorHandlers = new Set<(error: Error) => void>();
  
  // 注册配置中的事件处理器
  if (options.onStart) startHandlers.add(options.onStart);
  if (options.onStop) stopHandlers.add(options.onStop);
  if (options.onPause) pauseHandlers.add(options.onPause);
  if (options.onResume) resumeHandlers.add(options.onResume);
  if (options.onDataAvailable) dataAvailableHandlers.add(options.onDataAvailable);
  if (options.onError) errorHandlers.add(options.onError);
  
  /**
   * 清理资源
   */
  function cleanup(): void {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }
    mediaRecorder = null;
    chunks = [];
  }
  
  /**
   * 开始录音
   */
  async function start(): Promise<void> {
    if (mediaRecorder && getState() !== 'inactive') {
      throw new Error('录音器已处于活动状态');
    }
    
    try {
      // 请求麦克风访问权限
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 查找最佳支持的 MIME 类型
      let mimeType = config.mimeType;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        const fallbackTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'];
        for (const type of fallbackTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        }
      }
      
      // 创建 MediaRecorder
      mediaRecorder = new MediaRecorder(audioStream, {
        mimeType,
        audioBitsPerSecond: config.audioBitsPerSecond,
      });
      
      // 设置事件监听器
      mediaRecorder.addEventListener('start', () => {
        startHandlers.forEach(handler => handler());
      });
      
      mediaRecorder.addEventListener('stop', () => {
        stopHandlers.forEach(handler => handler());
      });
      
      mediaRecorder.addEventListener('pause', () => {
        pauseHandlers.forEach(handler => handler());
      });
      
      mediaRecorder.addEventListener('resume', () => {
        resumeHandlers.forEach(handler => handler());
      });
      
      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          const timecode = Date.now();
          dataAvailableHandlers.forEach(handler => handler(event.data, timecode));
        }
      });
      
      mediaRecorder.addEventListener('error', (event: any) => {
        const error = event.error || new Error('录音错误');
        errorHandlers.forEach(handler => handler(error));
      });
      
      // 使用 timeslice 开始录音以获取实时数据
      mediaRecorder.start(config.timeslice);
      chunks = [];
    } catch (error) {
      cleanup();
      throw error;
    }
  }
  
  /**
   * 停止录音
   */
  async function stop(): Promise<Blob> {
    if (!mediaRecorder || getState() === 'inactive') {
      throw new Error('录音器未处于活动状态');
    }
    
    return new Promise<Blob>((resolve, reject) => {
      const handleStop = () => {
        const blob = new Blob(chunks, { type: getMimeType() });
        cleanup();
        resolve(blob);
      };
      
      mediaRecorder!.addEventListener('stop', handleStop, { once: true });
      
      try {
        mediaRecorder!.stop();
      } catch (error) {
        mediaRecorder!.removeEventListener('stop', handleStop);
        reject(error);
      }
    });
  }
  
  /**
   * 暂停录音
   */
  function pause(): void {
    if (!mediaRecorder || getState() !== 'recording') {
      throw new Error('录音器未在录音中');
    }
    mediaRecorder.pause();
  }
  
  /**
   * 恢复录音
   */
  function resume(): void {
    if (!mediaRecorder || getState() !== 'paused') {
      throw new Error('录音器未处于暂停状态');
    }
    mediaRecorder.resume();
  }
  
  /**
   * 释放所有资源
   */
  function dispose(): void {
    if (mediaRecorder && getState() !== 'inactive') {
      mediaRecorder.stop();
    }
    cleanup();
  }
  
  /**
   * 获取当前状态
   */
  function getState(): RecorderState {
    if (!mediaRecorder) {
      return 'inactive';
    }
    return mediaRecorder.state;
  }
  
  /**
   * 获取 MIME 类型
   */
  function getMimeType(): string {
    return mediaRecorder?.mimeType || config.mimeType;
  }
  
  /**
   * 获取音频流
   */
  function getStream(): MediaStream | null {
    return audioStream;
  }
  
  // 返回录音器实例
  return {
    get state() {
      return getState();
    },
    get stream() {
      return getStream();
    },
    get mimeType() {
      return getMimeType();
    },
    start,
    stop,
    pause,
    resume,
    dispose,
    onStart: (handler) => {
      startHandlers.add(handler);
      return () => startHandlers.delete(handler);
    },
    onStop: (handler) => {
      stopHandlers.add(handler);
      return () => stopHandlers.delete(handler);
    },
    onPause: (handler) => {
      pauseHandlers.add(handler);
      return () => pauseHandlers.delete(handler);
    },
    onResume: (handler) => {
      resumeHandlers.add(handler);
      return () => resumeHandlers.delete(handler);
    },
    onDataAvailable: (handler) => {
      dataAvailableHandlers.add(handler);
      return () => dataAvailableHandlers.delete(handler);
    },
    onError: (handler) => {
      errorHandlers.add(handler);
      return () => errorHandlers.delete(handler);
    },
  };
}

/**
 * 检查浏览器是否支持指定的 MIME 类型
 * @param mimeType MIME 类型
 * @returns 是否支持
 */
export function isTypeSupported(mimeType: string): boolean {
  return MediaRecorder.isTypeSupported(mimeType);
}

/**
 * 将录音转换为指定格式
 * 使用 mediabunny 库进行格式转换
 * @param blob 原始录音 Blob
 * @param options 转换选项
 * @returns 返回转换后的音频 Blob 的 Promise
 */
export async function convertAudio(blob: Blob, options: ConvertOptions): Promise<Blob> {
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
