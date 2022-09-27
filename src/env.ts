/**
 * Initialize essential global variable ReadableStream.
 *
 * @remarks
 * This is a workaround for the issue of ReadableStream not being defined in the global scope.
 */
function initEnv() {
  if (!globalThis.ReadableStream) {
    try {
      const { emitWarning } = require('node:process'); // In Node.js environment
      try {
        process.emitWarning = () => { }; // disable warning
        Object.assign(globalThis, require('node:stream/web')); // Use Node.js built-in ReadableStream
        process.emitWarning = emitWarning;
      } catch (error) {
        process.emitWarning = emitWarning;
        throw error;
      }
    } catch (error) {
      Object.assign(globalThis, require('web-streams-polyfill/dist/ponyfill.es2018.js')); // Use web-streams-polyfill
    }
  }
}

initEnv(); // Initialize global variable ReadableStream
