import { paddingTo512n } from './utils';

/**
 * A readable stream padded to specific chunk size.
 */
export class ReadablePaddedStream extends ReadableStream {
  constructor(stream: ReadableStream, chunkSize = 512) {
    const reader = stream.getReader();
    let buffer = new Uint8Array();
    super({
      start(controller) {
        return (async () => {
          let { value, done } = await reader.read();
          if (done) {
            controller.close();
          } else {
            buffer = value;
          }
        })();
      },
      pull(controller) {
        return (async () => {
          // Round up to the nearest multiple of chunkSize
          if (buffer.length / chunkSize >= 1) {
            const batchSize = Math.floor(buffer.length / chunkSize);
            controller.enqueue(buffer.subarray(0, batchSize * chunkSize));
            buffer = buffer.subarray(batchSize * chunkSize);
            return;
          }

          let chunk = new Uint8Array();
          chunk.set(buffer);
          let offset = buffer.length;
          while (offset < chunkSize) {
            let { value, done } = await reader.read();
            // End of stream
            if (done) {
              if (offset !== 0) {
                controller.enqueue(chunk);
              }
              controller.close();
              return;
            }

            // Append the new chunk to the buffer
            const bufferSlice = value.subarray(0, chunkSize - offset);
            chunk.set(bufferSlice, offset);
            offset += bufferSlice.length;
            buffer = value.subarray(bufferSlice.length);
          }

          // Enqueue the remaining chunk
          if (offset !== 0) {
            controller.enqueue(chunk);
          }
        })();
      },
    });
  }
}

/**
 * A readable stream padded to a specific chunk size based on a buffer.
 */
export class ReadableBufferStream extends ReadableStream {
  constructor(buffer: Uint8Array, chunkSize = 512) {
    let offset = 0;
    super({
      start(controller) {
        if (offset === buffer.length) {
          controller.close();
        }
      },
      pull(controller) {
        controller.enqueue(paddingTo512n(buffer.subarray(offset, offset + chunkSize)));
        offset += chunkSize;
        if (offset >= buffer.length) {
          controller.close();
        }
      },
    });
  }
}
