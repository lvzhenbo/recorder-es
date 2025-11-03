/**
 * recorder-es - 现代网页录音库
 * 
 * 基于 mediabunny 的现代网页录音库，具有以下特性：
 * - TypeScript 5.9+ 支持
 * - ESM 模块
 * - ES2020+ 目标
 * - 实时音频流传输支持
 * - 简洁直观的 API
 * - 支持多种音频格式转换
 * - 现代化的事件处理（支持 addEventListener 和 onXxx 方法）
 */

export { Recorder } from './recorder.js';
export { BlobEvent } from './types.js';
export type {
  RecorderOptions,
  RecorderState,
  RecorderEventMap,
  RecorderEventHandlers,
  OutputFormat,
  ConvertOptions,
  UnsubscribeFn,
} from './types.js';
