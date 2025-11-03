# recorder-es

A modern web audio recording library with real-time streaming support, built with TypeScript and ESM.

## Features

- 🎙️ **Simple API** - Easy-to-use interface for recording audio
- 📡 **Real-time Streaming** - Access audio stream for WebSocket transmission and real-time processing
- 🔄 **Full Control** - Start, stop, pause, and resume recording
- 📦 **Modern Stack** - TypeScript 5.9+, ESM modules, ES2020+ target
- 🎯 **Type Safety** - Full TypeScript support with comprehensive type definitions
- 🚀 **Zero Dependencies** (runtime) - Only uses browser APIs and mediabunny
- ⚡ **Lightweight** - Built with tsdown for optimized bundle size

## Installation

```bash
npm install recorder-es
```

## Usage

### Basic Recording

```typescript
import { Recorder } from 'recorder-es';

// Create a recorder instance
const recorder = new Recorder({
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 128000,
  timeslice: 1000, // Get data chunks every second
});

// Start recording
await recorder.start();

// Stop recording and get the audio blob
const audioBlob = await recorder.stop();

// Use the audio blob (e.g., create a download link)
const url = URL.createObjectURL(audioBlob);
const a = document.createElement('a');
a.href = url;
a.download = 'recording.webm';
a.click();
```

### Real-time Streaming (WebSocket Example)

Perfect for real-time transcription or audio processing:

```typescript
import { Recorder } from 'recorder-es';

const recorder = new Recorder({
  timeslice: 100, // Get data chunks every 100ms for low latency
});

// Listen for audio data chunks
recorder.addEventListener('dataavailable', (event) => {
  if (event.data.size > 0) {
    // Send audio chunk via WebSocket
    websocket.send(event.data);
  }
});

// Start recording
await recorder.start();

// The stream is also directly accessible
const stream = recorder.getStream();
if (stream) {
  // Use the MediaStream for other purposes
  // e.g., live audio visualization, processing, etc.
}
```

### Pause and Resume

```typescript
const recorder = new Recorder();

await recorder.start();

// Pause recording
recorder.pause();

// Resume recording
recorder.resume();

// Stop and get the complete recording
const audioBlob = await recorder.stop();
```

### Event Handling

```typescript
const recorder = new Recorder();

recorder.addEventListener('start', () => {
  console.log('Recording started');
});

recorder.addEventListener('stop', () => {
  console.log('Recording stopped');
});

recorder.addEventListener('pause', () => {
  console.log('Recording paused');
});

recorder.addEventListener('resume', () => {
  console.log('Recording resumed');
});

recorder.addEventListener('dataavailable', (event) => {
  console.log('Audio chunk received:', event.data.size, 'bytes');
});

recorder.addEventListener('error', (event) => {
  console.error('Recording error:', event.error);
});

await recorder.start();
```

### Check State

```typescript
const recorder = new Recorder();

console.log(recorder.state); // 'inactive'

await recorder.start();
console.log(recorder.state); // 'recording'

recorder.pause();
console.log(recorder.state); // 'paused'

recorder.resume();
console.log(recorder.state); // 'recording'
```

### Check MIME Type Support

```typescript
import { Recorder } from 'recorder-es';

// Check if a specific format is supported
if (Recorder.isTypeSupported('audio/webm;codecs=opus')) {
  console.log('Opus codec is supported');
}

if (Recorder.isTypeSupported('audio/mp4')) {
  console.log('MP4 audio is supported');
}
```

## API

### `Recorder`

#### Constructor

```typescript
new Recorder(options?: RecorderOptions)
```

#### Options

```typescript
interface RecorderOptions {
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
```

#### Properties

- `state: RecorderState` - Current state ('inactive' | 'recording' | 'paused')
- `stream: MediaStream | null` - Current audio stream (null when not recording)
- `mimeType: string` - MIME type being used for recording

#### Methods

- `async start(): Promise<void>` - Start recording
- `async stop(): Promise<Blob>` - Stop recording and return audio blob
- `pause(): void` - Pause recording
- `resume(): void` - Resume recording
- `getStream(): MediaStream | null` - Get the audio stream for real-time processing
- `dispose(): void` - Release all resources
- `static isTypeSupported(mimeType: string): boolean` - Check if MIME type is supported

#### Events

- `start` - Fired when recording starts
- `stop` - Fired when recording stops
- `pause` - Fired when recording is paused
- `resume` - Fired when recording resumes
- `dataavailable` - Fired when audio data becomes available
- `error` - Fired when an error occurs

## Real-world Examples

### Real-time Transcription

```typescript
import { Recorder } from 'recorder-es';

const recorder = new Recorder({ timeslice: 500 });
const ws = new WebSocket('wss://transcription-service.example.com');

recorder.addEventListener('dataavailable', (event) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(event.data);
  }
});

ws.addEventListener('message', (event) => {
  const transcription = JSON.parse(event.data);
  console.log('Transcription:', transcription.text);
});

await recorder.start();
```

### Voice Activity Detection

```typescript
import { Recorder } from 'recorder-es';

const recorder = new Recorder({ timeslice: 100 });
const audioContext = new AudioContext();

await recorder.start();
const stream = recorder.getStream();

if (stream) {
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function detectVoice() {
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    
    if (average > 50) {
      console.log('Voice detected!');
    }
    
    requestAnimationFrame(detectVoice);
  }
  
  detectVoice();
}
```

### Save Recording with Download

```typescript
import { Recorder } from 'recorder-es';

async function recordAndDownload(duration: number = 5000) {
  const recorder = new Recorder();
  
  await recorder.start();
  console.log('Recording started...');
  
  // Record for specified duration
  await new Promise(resolve => setTimeout(resolve, duration));
  
  const audioBlob = await recorder.stop();
  console.log('Recording stopped');
  
  // Create download
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

## Browser Support

This library uses the MediaRecorder API, which is supported in:

- Chrome 47+
- Firefox 25+
- Safari 14.1+
- Edge 79+

## License

MIT

## Based on

This library is built with inspiration from [mediabunny](https://mediabunny.dev/), a modern JavaScript media toolkit.