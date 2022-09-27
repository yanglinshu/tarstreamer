# Tar Streamer
A rewrite version of [@Spedoske's](https://github.com/Spedoske) tar-stream-web for me to get familiar with Streams and nodejs environment.

# Usage
```typescript
import TarStreamer from 'tarstreamer';
let tar = new TarStreamer([{
    name: 'path_1/path_2/file',
    size: 4,
    content: '1234'
}]);

// tar.stream is a ReadableStream
console.log(tar.stream);
```