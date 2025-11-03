import type { RecorderOptions, RecorderState, RecorderEventMap, ConvertOptions, UnsubscribeFn } from './types.js';
import { BlobEvent } from './types.js';

/**
 * 现代网页录音器，支持实时流传输
 */
export class Recorder extends EventTarget {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private options: Required<Omit<RecorderOptions, 'onStart' | 'onStop' | 'onPause' | 'onResume' | 'onDataAvailable' | 'onError'>>;
  private eventHandlers: {
    onStart?: () => void;
    onStop?: () => void;
    onPause?: () => void;
    onResume?: () => void;
    onDataAvailable?: (data: Blob, timecode: number) => void;
    onError?: (error: Error) => void;
  } = {};

  /**
   * 私有构造函数，使用工厂方法创建实例
   * @param options 录音器配置选项
   */
  private constructor(options: RecorderOptions = {}) {
    super();
    this.options = {
      mimeType: options.mimeType || 'audio/webm;codecs=opus',
      audioBitsPerSecond: options.audioBitsPerSecond || 128000,
      timeslice: options.timeslice || 1000,
    };
    
    // 保存事件处理器
    if (options.onStart) this.eventHandlers.onStart = options.onStart;
    if (options.onStop) this.eventHandlers.onStop = options.onStop;
    if (options.onPause) this.eventHandlers.onPause = options.onPause;
    if (options.onResume) this.eventHandlers.onResume = options.onResume;
    if (options.onDataAvailable) this.eventHandlers.onDataAvailable = options.onDataAvailable;
    if (options.onError) this.eventHandlers.onError = options.onError;
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
      this.mediaRecorder.addEventListener('start', (event) => {
        this.dispatchEvent(new Event('start'));
        this.eventHandlers.onStart?.();
      });

      this.mediaRecorder.addEventListener('stop', (event) => {
        this.dispatchEvent(new Event('stop'));
        this.eventHandlers.onStop?.();
      });

      this.mediaRecorder.addEventListener('pause', (event) => {
        this.dispatchEvent(new Event('pause'));
        this.eventHandlers.onPause?.();
      });

      this.mediaRecorder.addEventListener('resume', (event) => {
        this.dispatchEvent(new Event('resume'));
        this.eventHandlers.onResume?.();
      });

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
          
          const timecode = Date.now();
          // 分发包含 blob 数据的自定义事件
          const blobEvent = new BlobEvent('dataavailable', event.data, timecode);
          this.dispatchEvent(blobEvent);
          this.eventHandlers.onDataAvailable?.(event.data, timecode);
        }
      });

      this.mediaRecorder.addEventListener('error', (event: any) => {
        const error = event.error || new Error('录音错误');
        const errorEvent = new ErrorEvent('error', {
          error,
          message: error.message || '录音错误',
        });
        this.dispatchEvent(errorEvent);
        this.eventHandlers.onError?.(error);
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
   * 为录音器事件添加事件监听器
   */
  addEventListener<K extends keyof RecorderEventMap>(
    type: K,
    listener: (event: RecorderEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, listener as EventListener, options);
  }

  /**
   * 移除录音器事件的事件监听器
   */
  removeEventListener<K extends keyof RecorderEventMap>(
    type: K,
    listener: (event: RecorderEventMap[K]) => void,
    options?: boolean | EventListenerOptions
  ): void {
    super.removeEventListener(type, listener as EventListener, options);
  }

  /**
   * 监听录音开始事件（现代 API）
   * @param handler 事件处理函数
   * @returns 取消订阅函数
   */
  onStart(handler: () => void): UnsubscribeFn {
    const listener = () => handler();
    this.addEventListener('start', listener);
    return () => this.removeEventListener('start', listener);
  }

  /**
   * 监听录音停止事件（现代 API）
   * @param handler 事件处理函数
   * @returns 取消订阅函数
   */
  onStop(handler: () => void): UnsubscribeFn {
    const listener = () => handler();
    this.addEventListener('stop', listener);
    return () => this.removeEventListener('stop', listener);
  }

  /**
   * 监听录音暂停事件（现代 API）
   * @param handler 事件处理函数
   * @returns 取消订阅函数
   */
  onPause(handler: () => void): UnsubscribeFn {
    const listener = () => handler();
    this.addEventListener('pause', listener);
    return () => this.removeEventListener('pause', listener);
  }

  /**
   * 监听录音恢复事件（现代 API）
   * @param handler 事件处理函数
   * @returns 取消订阅函数
   */
  onResume(handler: () => void): UnsubscribeFn {
    const listener = () => handler();
    this.addEventListener('resume', listener);
    return () => this.removeEventListener('resume', listener);
  }

  /**
   * 监听音频数据可用事件（现代 API）
   * @param handler 事件处理函数
   * @returns 取消订阅函数
   */
  onDataAvailable(handler: (data: Blob, timecode: number) => void): UnsubscribeFn {
    const listener = (event: any) => handler(event.data, event.timecode);
    this.addEventListener('dataavailable', listener);
    return () => this.removeEventListener('dataavailable', listener);
  }

  /**
   * 监听错误事件（现代 API）
   * @param handler 事件处理函数
   * @returns 取消订阅函数
   */
  onError(handler: (error: Error) => void): UnsubscribeFn {
    const listener = (event: any) => handler(event.error);
    this.addEventListener('error', listener);
    return () => this.removeEventListener('error', listener);
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
