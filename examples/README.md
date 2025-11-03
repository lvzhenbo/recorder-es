# Examples

This directory contains example usage of the recorder-es library.

## Files

### basic.html
A complete example showing:
- Starting and stopping recording
- Pause and resume functionality
- Displaying recorded audio
- Downloading recordings

### websocket.html
A demonstration of real-time audio streaming:
- Connecting to a WebSocket server (simulated for demo)
- Streaming audio chunks in real-time
- Monitoring data transmission
- Perfect for real-time transcription scenarios

## Running the Examples

To run these examples locally:

1. Build the library:
   ```bash
   npm run build
   ```

2. Serve the examples directory with a local server:
   ```bash
   npx serve .
   ```
   or
   ```bash
   python -m http.server 8000
   ```

3. Open your browser to:
   - http://localhost:8000/examples/basic.html
   - http://localhost:8000/examples/websocket.html

## Browser Requirements

These examples require:
- A modern browser with MediaRecorder API support
- Microphone access permissions
- HTTPS or localhost (for getUserMedia API)

## Notes

- The WebSocket example uses a simulated WebSocket for demonstration purposes
- In production, replace the MockWebSocket with a real WebSocket connection to your backend service
- For real-time transcription, connect to services like:
  - Google Cloud Speech-to-Text
  - AWS Transcribe
  - Azure Speech Services
  - Deepgram
  - AssemblyAI
