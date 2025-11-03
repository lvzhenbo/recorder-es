import type { RecorderOptions, RecorderState, RecorderEventMap } from './types.js';
import { BlobEvent } from './types.js';

/**
 * Modern web audio recorder with real-time streaming support
 */
export class Recorder extends EventTarget {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private options: Required<RecorderOptions>;

  /**
   * Creates a new Recorder instance
   * @param options Configuration options for the recorder
   */
  constructor(options: RecorderOptions = {}) {
    super();
    this.options = {
      mimeType: options.mimeType || 'audio/webm;codecs=opus',
      audioBitsPerSecond: options.audioBitsPerSecond || 128000,
      timeslice: options.timeslice || 1000,
    };
  }

  /**
   * Gets the current state of the recorder
   */
  get state(): RecorderState {
    if (!this.mediaRecorder) {
      return 'inactive';
    }
    return this.mediaRecorder.state;
  }

  /**
   * Gets the audio stream (available when recording)
   */
  get stream(): MediaStream | null {
    return this.audioStream;
  }

  /**
   * Gets the MIME type being used for recording
   */
  get mimeType(): string {
    return this.mediaRecorder?.mimeType || this.options.mimeType;
  }

  /**
   * Checks if a MIME type is supported by the browser
   */
  static isTypeSupported(mimeType: string): boolean {
    return MediaRecorder.isTypeSupported(mimeType);
  }

  /**
   * Starts recording audio from the user's microphone
   * @throws Error if microphone access is denied or not available
   */
  async start(): Promise<void> {
    if (this.mediaRecorder && this.state !== 'inactive') {
      throw new Error('Recorder is already active');
    }

    try {
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      // Find the best supported MIME type
      let mimeType = this.options.mimeType;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Fallback to other formats
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

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType,
        audioBitsPerSecond: this.options.audioBitsPerSecond,
      });

      // Set up event listeners
      this.mediaRecorder.addEventListener('start', (event) => {
        this.dispatchEvent(new Event('start'));
      });

      this.mediaRecorder.addEventListener('stop', (event) => {
        this.dispatchEvent(new Event('stop'));
      });

      this.mediaRecorder.addEventListener('pause', (event) => {
        this.dispatchEvent(new Event('pause'));
      });

      this.mediaRecorder.addEventListener('resume', (event) => {
        this.dispatchEvent(new Event('resume'));
      });

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
          
          // Dispatch custom event with blob data
          const blobEvent = new BlobEvent('dataavailable', event.data, Date.now());
          this.dispatchEvent(blobEvent);
        }
      });

      this.mediaRecorder.addEventListener('error', (event: any) => {
        const errorEvent = new ErrorEvent('error', {
          error: event.error,
          message: event.error?.message || 'Recording error',
        });
        this.dispatchEvent(errorEvent);
      });

      // Start recording with timeslice for real-time data
      this.mediaRecorder.start(this.options.timeslice);
      this.chunks = [];
    } catch (error) {
      // Clean up on error
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stops recording and returns the recorded audio as a Blob
   * @returns Promise that resolves with the recorded audio blob
   */
  async stop(): Promise<Blob> {
    if (!this.mediaRecorder || this.state === 'inactive') {
      throw new Error('Recorder is not active');
    }

    return new Promise<Blob>((resolve, reject) => {
      const handleStop = () => {
        // Create final blob from all chunks
        const blob = new Blob(this.chunks, { type: this.mimeType });
        this.cleanup();
        resolve(blob);
      };

      // Listen for stop event
      this.mediaRecorder!.addEventListener('stop', handleStop, { once: true });

      // Stop the recorder
      try {
        this.mediaRecorder!.stop();
      } catch (error) {
        this.mediaRecorder!.removeEventListener('stop', handleStop);
        reject(error);
      }
    });
  }

  /**
   * Pauses recording
   */
  pause(): void {
    if (!this.mediaRecorder || this.state !== 'recording') {
      throw new Error('Recorder is not recording');
    }
    this.mediaRecorder.pause();
  }

  /**
   * Resumes recording from pause
   */
  resume(): void {
    if (!this.mediaRecorder || this.state !== 'paused') {
      throw new Error('Recorder is not paused');
    }
    this.mediaRecorder.resume();
  }

  /**
   * Adds an event listener for recorder events
   */
  addEventListener<K extends keyof RecorderEventMap>(
    type: K,
    listener: (event: RecorderEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, listener as EventListener, options);
  }

  /**
   * Removes an event listener for recorder events
   */
  removeEventListener<K extends keyof RecorderEventMap>(
    type: K,
    listener: (event: RecorderEventMap[K]) => void,
    options?: boolean | EventListenerOptions
  ): void {
    super.removeEventListener(type, listener as EventListener, options);
  }

  /**
   * Cleans up resources
   */
  private cleanup(): void {
    // Stop all audio tracks
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.mediaRecorder = null;
    this.chunks = [];
  }

  /**
   * Releases all resources and stops recording if active
   */
  dispose(): void {
    if (this.mediaRecorder && this.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }
}
