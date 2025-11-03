# recorder-es

基于 TypeScript 和 ESM 构建的现代网页录音库，支持实时流传输和多种格式转换。

## 特性

- 🎙️ **简洁的 API** - 函数式 API，使用 `createRecorder()` 创建实例，与 Vue 等现代框架完美兼容
- 📡 **实时流传输** - 支持 WebSocket 传输和实时音频处理
- 🔄 **完整控制** - 开始、停止、暂停和恢复录音
- 🎵 **格式转换** - 基于 mediabunny 支持转换为 MP4、WAV、MP3、OGG、FLAC 等格式
- 📦 **现代技术栈** - TypeScript 5.9+、ESM 模块、ES2020+ 目标
- 🎯 **类型安全** - 完整的 TypeScript 类型定义支持
- ✨ **现代化事件处理** - 配置回调和 `onXxx` 方法（返回清理函数），无需使用 `addEventListener`
- 🌲 **优化摇树** - 函数式设计，最大化tree-shaking效果
- ⚡ **轻量级** - 仅 7.15 KB（gzip: 2.18 KB），使用 tsdown 打包

## 安装

```bash
npm install recorder-es
```

## 使用方法

### 基础录音

```typescript
import { createRecorder } from 'recorder-es';

// 使用 createRecorder 函数创建录音器实例
const recorder = createRecorder({
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
import { createRecorder, convertAudio } from 'recorder-es';

// 录制音频
const recorder = createRecorder();
await recorder.start();
const webmBlob = await recorder.stop();

// 转换为 MP4 格式
const mp4Blob = await convertAudio(webmBlob, {
  format: 'mp4',
  audioBitsPerSecond: 128000,
});

// 转换为 WAV 格式
const wavBlob = await convertAudio(webmBlob, {
  format: 'wav',
});

// 转换为 MP3 格式
const mp3Blob = await convertAudio(webmBlob, {
  format: 'mp3',
  audioBitsPerSecond: 192000,
});
```

### 现代化事件处理

**方式一：配置时传入回调函数（推荐）**

```typescript
import { createRecorder } from 'recorder-es';

const recorder = createRecorder({
  timeslice: 100,
  onStart: () => {
    console.log('录音已开始');
  },
  onDataAvailable: (data, timecode) => {
    // 实时处理音频数据
    websocket.send(data);
  },
  onStop: () => {
    console.log('录音已停止');
  },
  onError: (error) => {
    console.error('录音错误:', error);
  },
});

await recorder.start();
```

**方式二：使用 onXxx 方法（返回清理函数）**

```typescript
const recorder = createRecorder({ timeslice: 100 });

// 使用 on 方法，自动返回清理函数
const unsubscribe = recorder.onDataAvailable((data, timecode) => {
  websocket.send(data);
});

await recorder.start();

// 不再需要时，调用清理函数
unsubscribe();
```

### 实时流传输（WebSocket 示例）

适用于实时转译或音频处理场景：

```typescript
import { createRecorder } from 'recorder-es';

// 使用配置回调的方式（最简洁）
const recorder = createRecorder({
  timeslice: 100, // 每 100ms 获取数据块，实现低延迟
  onDataAvailable: (data, timecode) => {
    // 通过 WebSocket 发送音频块
    if (websocket.readyState === WebSocket.OPEN) {
      websocket.send(data);
    }
  },
});

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
const recorder = createRecorder();

await recorder.start();

// 暂停录音
recorder.pause();

// 恢复录音
recorder.resume();

// 停止并获取完整录音
const audioBlob = await recorder.stop();
```

### 在 Vue 中使用

工厂模式和现代化的事件处理使得在 Vue 等现代框架中使用更加方便：

**方式一：使用配置回调（推荐）**

```vue
<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { createRecorder } from 'recorder-es';

const recorder = ref<Recorder | null>(null);
const isRecording = ref(false);
const audioChunks = ref<Blob[]>([]);

const startRecording = async () => {
  audioChunks.value = [];
  
  recorder.value = createRecorder({
    timeslice: 1000,
    onStart: () => {
      isRecording.value = true;
      console.log('录音已开始');
    },
    onDataAvailable: (data, timecode) => {
      audioChunks.value.push(data);
      console.log('收到音频块:', data.size, '字节');
    },
    onStop: () => {
      isRecording.value = false;
      console.log('录音已停止');
    },
    onError: (error) => {
      console.error('录音错误:', error);
    },
  });
  
  await recorder.value.start();
};

const stopRecording = async () => {
  if (recorder.value) {
    const blob = await recorder.value.stop();
    recorder.value.dispose();
    recorder.value = null;
    
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
    <p>已收到 {{ audioChunks.length }} 个音频块</p>
  </div>
</template>
```

**方式二：使用 onXxx 方法**

```vue
<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { createRecorder, type RecorderInstance, type UnsubscribeFn } from 'recorder-es';

const recorder = ref<RecorderInstance | null>(null);
const isRecording = ref(false);
const unsubscribes = ref<UnsubscribeFn[]>([]);

const startRecording = async () => {
  recorder.value = createRecorder({ timeslice: 1000 });
  
  // 使用 on 方法注册事件，并保存清理函数
  unsubscribes.value = [
    recorder.value.onStart(() => {
      isRecording.value = true;
    }),
    recorder.value.onDataAvailable((data, timecode) => {
      console.log('收到音频块:', data.size, '字节');
    }),
    recorder.value.onStop(() => {
      isRecording.value = false;
    }),
  ];
  
  await recorder.value.start();
};

const stopRecording = async () => {
  if (recorder.value) {
    const blob = await recorder.value.stop();
    
    // 清理所有事件监听
    unsubscribes.value.forEach(fn => fn());
    unsubscribes.value = [];
    
    recorder.value.dispose();
    recorder.value = null;
    
    console.log('录音完成', blob);
  }
};

onUnmounted(() => {
  unsubscribes.value.forEach(fn => fn());
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
const recorder = createRecorder();

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
import { isTypeSupported } from 'recorder-es';

// 检查是否支持特定格式
if (isTypeSupported('audio/webm;codecs=opus')) {
  console.log('支持 Opus 编码');
}

if (isTypeSupported('audio/mp4')) {
  console.log('支持 MP4 音频');
}
```

## API

### 核心函数

#### `createRecorder(options?: RecorderOptions): RecorderInstance`

创建录音器实例的函数。

```typescript
import { createRecorder } from 'recorder-es';

const recorder = createRecorder({
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 128000,
  timeslice: 1000,
  onStart: () => console.log('开始'),
  onDataAvailable: (data, timecode) => { /* 处理数据 */ },
});
```

#### `isTypeSupported(mimeType: string): boolean`

检查浏览器是否支持指定的 MIME 类型。

```typescript
import { isTypeSupported } from 'recorder-es';

if (isTypeSupported('audio/webm;codecs=opus')) {
  // 支持
}
```

#### `convertAudio(blob: Blob, options: ConvertOptions): Promise<Blob>`

将录音转换为指定格式。

```typescript
import { convertAudio } from 'recorder-es';

const mp3Blob = await convertAudio(webmBlob, {
  format: 'mp3',
  audioBitsPerSecond: 192000,
});
```

### RecorderOptions（配置选项）

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

  // 现代化的事件处理器（可选）
  onStart?: () => void;
  onStop?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onDataAvailable?: (data: Blob, timecode: number) => void;
  onError?: (error: Error) => void;
}
```

### RecorderInstance（录音器实例）

#### 属性

- `state: RecorderState` - 当前状态 ('inactive' | 'recording' | 'paused')
- `stream: MediaStream | null` - 当前音频流（未录音时为 null）
- `mimeType: string` - 正在使用的 MIME 类型

#### 方法

- `async start(): Promise<void>` - 开始录音
- `async stop(): Promise<Blob>` - 停止录音并返回音频 blob
- `pause(): void` - 暂停录音
- `resume(): void` - 恢复录音
- `dispose(): void` - 释放所有资源

#### 事件方法

每个方法都返回一个清理函数 `UnsubscribeFn`，调用它可以取消事件监听：

- `onStart(handler: () => void): UnsubscribeFn` - 监听录音开始事件
- `onStop(handler: () => void): UnsubscribeFn` - 监听录音停止事件
- `onPause(handler: () => void): UnsubscribeFn` - 监听录音暂停事件
- `onResume(handler: () => void): UnsubscribeFn` - 监听录音恢复事件
- `onDataAvailable(handler: (data: Blob, timecode: number) => void): UnsubscribeFn` - 监听音频数据可用事件
- `onError(handler: (error: Error) => void): UnsubscribeFn` - 监听错误事件

#### 转换选项

```typescript
interface ConvertOptions {
  format: 'webm' | 'mp4' | 'wav' | 'mp3' | 'ogg' | 'flac';
  audioBitsPerSecond?: number;
}
```

## 实际应用示例

### 实时转译

**使用现代化的配置回调（推荐）：**

```typescript
import { createRecorder } from 'recorder-es';

const ws = new WebSocket('wss://transcription-service.example.com');

const recorder = createRecorder({
  timeslice: 500,
  onDataAvailable: (data, timecode) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  },
});

ws.addEventListener('message', (event) => {
  const transcription = JSON.parse(event.data);
  console.log('转译结果:', transcription.text);
});

await recorder.start();
```

**使用 onXxx 方法：**

```typescript
const recorder = createRecorder({ timeslice: 500 });
const ws = new WebSocket('wss://transcription-service.example.com');

const unsubscribe = recorder.onDataAvailable((data, timecode) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(data);
  }
});

ws.addEventListener('message', (event) => {
  const transcription = JSON.parse(event.data);
  console.log('转译结果:', transcription.text);
});

await recorder.start();

// 不需要时清理
// unsubscribe();
```

### 语音活动检测

```typescript
import { createRecorder } from 'recorder-es';

const recorder = createRecorder({ timeslice: 100 });
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
import { createRecorder } from 'recorder-es';

async function recordAndDownload(duration: number = 5000) {
  const recorder = createRecorder();
  
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
import { createRecorder } from 'recorder-es';

async function recordAndConvert() {
  const recorder = createRecorder();
  
  await recorder.start();
  console.log('录音中...');
  
  // 录制 5 秒
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const webmBlob = await recorder.stop();
  console.log('录音完成，开始转换...');
  
  // 转换为 MP3
  const mp3Blob = await convertAudio(webmBlob, {
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