# recorder-es

基于 TypeScript 和 ESM 构建的现代网页录音库，支持实时流传输和多种格式转换。

## 特性

- 🎙️ **简洁的 API** - 使用工厂模式创建录音器实例，与 Vue 等现代框架完美兼容
- 📡 **实时流传输** - 支持 WebSocket 传输和实时音频处理
- 🔄 **完整控制** - 开始、停止、暂停和恢复录音
- 🎵 **格式转换** - 基于 mediabunny 支持转换为 MP4、WAV、MP3、OGG、FLAC 等格式
- 📦 **现代技术栈** - TypeScript 5.9+、ESM 模块、ES2020+ 目标
- 🎯 **类型安全** - 完整的 TypeScript 类型定义支持
- ⚡ **轻量级** - 使用 tsdown 打包，优化包大小

## 安装

```bash
npm install recorder-es
```

## 使用方法

### 基础录音

```typescript
import { Recorder } from 'recorder-es';

// 使用工厂方法创建录音器实例
const recorder = Recorder.create({
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 128000,
  timeslice: 1000, // 每秒获取数据块
});

// 开始录音
await recorder.start();

// 停止录音并获取音频 blob
const audioBlob = await recorder.stop();

// 使用音频 blob（例如创建下载链接）
const url = URL.createObjectURL(audioBlob);
const a = document.createElement('a');
a.href = url;
a.download = 'recording.webm';
a.click();
```

### 格式转换

```typescript
import { Recorder } from 'recorder-es';

// 录制音频
const recorder = Recorder.create();
await recorder.start();
const webmBlob = await recorder.stop();

// 转换为 MP4 格式
const mp4Blob = await Recorder.convert(webmBlob, {
  format: 'mp4',
  audioBitsPerSecond: 128000,
});

// 转换为 WAV 格式
const wavBlob = await Recorder.convert(webmBlob, {
  format: 'wav',
});

// 转换为 MP3 格式
const mp3Blob = await Recorder.convert(webmBlob, {
  format: 'mp3',
  audioBitsPerSecond: 192000,
});
```

### 实时流传输（WebSocket 示例）

适用于实时转译或音频处理场景：

```typescript
import { Recorder } from 'recorder-es';

const recorder = Recorder.create({
  timeslice: 100, // 每 100ms 获取数据块，实现低延迟
});

// 监听音频数据块
recorder.addEventListener('dataavailable', (event) => {
  if (event.data.size > 0) {
    // 通过 WebSocket 发送音频块
    websocket.send(event.data);
  }
});

// 开始录音
await recorder.start();

// 也可以直接访问音频流
const stream = recorder.stream;
if (stream) {
  // 将 MediaStream 用于其他用途
  // 例如：实时音频可视化、处理等
}
```

### 暂停和恢复

```typescript
const recorder = Recorder.create();

await recorder.start();

// 暂停录音
recorder.pause();

// 恢复录音
recorder.resume();

// 停止并获取完整录音
const audioBlob = await recorder.stop();
```

### 事件处理

```typescript
const recorder = Recorder.create();

recorder.addEventListener('start', () => {
  console.log('录音已开始');
});

recorder.addEventListener('stop', () => {
  console.log('录音已停止');
});

recorder.addEventListener('pause', () => {
  console.log('录音已暂停');
});

recorder.addEventListener('resume', () => {
  console.log('录音已恢复');
});

recorder.addEventListener('dataavailable', (event) => {
  console.log('收到音频块:', event.data.size, '字节');
});

recorder.addEventListener('error', (event) => {
  console.error('录音错误:', event.error);
});

await recorder.start();
```

### 在 Vue 中使用

工厂模式使得在 Vue 等现代框架中使用更加方便：

```vue
<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { Recorder } from 'recorder-es';

const recorder = ref<Recorder | null>(null);
const isRecording = ref(false);

const startRecording = async () => {
  recorder.value = Recorder.create({
    timeslice: 1000,
  });
  
  await recorder.value.start();
  isRecording.value = true;
};

const stopRecording = async () => {
  if (recorder.value) {
    const blob = await recorder.value.stop();
    recorder.value.dispose();
    recorder.value = null;
    isRecording.value = false;
    
    // 处理录音结果
    console.log('录音完成', blob);
  }
};

onUnmounted(() => {
  recorder.value?.dispose();
});
</script>

<template>
  <div>
    <button @click="startRecording" :disabled="isRecording">
      开始录音
    </button>
    <button @click="stopRecording" :disabled="!isRecording">
      停止录音
    </button>
  </div>
</template>
```

### 检查状态

```typescript
const recorder = Recorder.create();

console.log(recorder.state); // 'inactive'

await recorder.start();
console.log(recorder.state); // 'recording'

recorder.pause();
console.log(recorder.state); // 'paused'

recorder.resume();
console.log(recorder.state); // 'recording'
```

### 检查 MIME 类型支持

```typescript
import { Recorder } from 'recorder-es';

// 检查是否支持特定格式
if (Recorder.isTypeSupported('audio/webm;codecs=opus')) {
  console.log('支持 Opus 编码');
}

if (Recorder.isTypeSupported('audio/mp4')) {
  console.log('支持 MP4 音频');
}
```

## API

### `Recorder`

#### 工厂方法

```typescript
Recorder.create(options?: RecorderOptions): Recorder
```

#### 配置选项

```typescript
interface RecorderOptions {
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
```

#### 属性

- `state: RecorderState` - 当前状态 ('inactive' | 'recording' | 'paused')
- `stream: MediaStream | null` - 当前音频流（未录音时为 null）
- `mimeType: string` - 正在使用的 MIME 类型

#### 方法

- `static create(options?: RecorderOptions): Recorder` - 创建录音器实例（工厂方法）
- `async start(): Promise<void>` - 开始录音
- `async stop(): Promise<Blob>` - 停止录音并返回音频 blob
- `pause(): void` - 暂停录音
- `resume(): void` - 恢复录音
- `dispose(): void` - 释放所有资源
- `static isTypeSupported(mimeType: string): boolean` - 检查是否支持 MIME 类型
- `static async convert(blob: Blob, options: ConvertOptions): Promise<Blob>` - 转换音频格式

#### 转换选项

```typescript
interface ConvertOptions {
  format: 'webm' | 'mp4' | 'wav' | 'mp3' | 'ogg' | 'flac';
  audioBitsPerSecond?: number;
}
```

#### 事件

- `start` - 录音开始时触发
- `stop` - 录音停止时触发
- `pause` - 录音暂停时触发
- `resume` - 录音恢复时触发
- `dataavailable` - 音频数据可用时触发
- `error` - 发生错误时触发

## 实际应用示例

### 实时转译

```typescript
import { Recorder } from 'recorder-es';

const recorder = Recorder.create({ timeslice: 500 });
const ws = new WebSocket('wss://transcription-service.example.com');

recorder.addEventListener('dataavailable', (event) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(event.data);
  }
});

ws.addEventListener('message', (event) => {
  const transcription = JSON.parse(event.data);
  console.log('转译结果:', transcription.text);
});

await recorder.start();
```

### 语音活动检测

```typescript
import { Recorder } from 'recorder-es';

const recorder = Recorder.create({ timeslice: 100 });
const audioContext = new AudioContext();

await recorder.start();
const stream = recorder.stream;

if (stream) {
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function detectVoice() {
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    
    if (average > 50) {
      console.log('检测到语音！');
    }
    
    requestAnimationFrame(detectVoice);
  }
  
  detectVoice();
}
```

### 保存录音并下载

```typescript
import { Recorder } from 'recorder-es';

async function recordAndDownload(duration: number = 5000) {
  const recorder = Recorder.create();
  
  await recorder.start();
  console.log('录音已开始...');
  
  // 录制指定时长
  await new Promise(resolve => setTimeout(resolve, duration));
  
  const audioBlob = await recorder.stop();
  console.log('录音已停止');
  
  // 创建下载
  const url = URL.createObjectURL(audioBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recording-${Date.now()}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

recordAndDownload();
```

### 录音并转换格式

```typescript
import { Recorder } from 'recorder-es';

async function recordAndConvert() {
  const recorder = Recorder.create();
  
  await recorder.start();
  console.log('录音中...');
  
  // 录制 5 秒
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const webmBlob = await recorder.stop();
  console.log('录音完成，开始转换...');
  
  // 转换为 MP3
  const mp3Blob = await Recorder.convert(webmBlob, {
    format: 'mp3',
    audioBitsPerSecond: 192000,
  });
  
  console.log('转换完成！');
  
  // 下载 MP3 文件
  const url = URL.createObjectURL(mp3Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recording-${Date.now()}.mp3`;
  a.click();
  URL.revokeObjectURL(url);
}

recordAndConvert();
```

## 浏览器支持

本库使用 MediaRecorder API，支持以下浏览器：

- Chrome 47+
- Firefox 25+
- Safari 14.1+
- Edge 79+

格式转换功能基于 [mediabunny](https://mediabunny.dev/)，需要现代浏览器支持。

## 许可证

MIT

## 技术栈

本库基于以下优秀的开源项目构建：
- [mediabunny](https://mediabunny.dev/) - 现代 JavaScript 媒体工具包
- [tsdown](https://tsdown.dev/) - 优雅的库打包工具