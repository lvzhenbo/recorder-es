/**
 * Configuration options for the Recorder
 */
export interface RecorderOptions {
  /**
   * Audio MIME type to use for recording
   * @default 'audio/webm;codecs=opus'
   */
  mimeType?: string;

  /**
   * Target audio bitrate in bits per second
   * @default 128000
   */
  audioBitsPerSecond?: number;

  /**
   * Interval in milliseconds for slicing audio data
   * Used for real-time streaming scenarios
   * @default 1000
   */
  timeslice?: number;
}

/**
 * State of the recorder
 */
export type RecorderState = 'inactive' | 'recording' | 'paused';

/**
 * Event types supported by the recorder
 */
export interface RecorderEventMap {
  /**
   * Fired when recording starts
   */
  start: Event;

  /**
   * Fired when recording stops
   */
  stop: Event;

  /**
   * Fired when recording is paused
   */
  pause: Event;

  /**
   * Fired when recording resumes from pause
   */
  resume: Event;

  /**
   * Fired when audio data becomes available
   */
  dataavailable: BlobEvent;

  /**
   * Fired when an error occurs
   */
  error: ErrorEvent;
}

/**
 * Event containing audio data
 */
export interface BlobEvent extends Event {
  data: Blob;
  timecode: number;
}
