/**
 * Compute the length of a number in its decimal form.
 *
 * @param src - The source number.
 * @returns The length of the source number in its decimal form.
 */
export function lengthOf(src: number): number {
  return new String(src).length;
}

/**
 * Compute int64 and operation of two numbers.
 *
 * @param a - One of the two numbers.
 * @param b - One of the two numbers.
 * @returns Int64 and result of the two numbers.
 */
// https://stackoverflow.com/a/43666199
export function Int64And(a: number, b: number): number {
  const high = 0x80000000;
  const low = 0x7fffffff;
  const high1 = ~~(a / high);
  const high2 = ~~(b / high);
  const low1 = a & low;
  const low2 = b & low;
  const high3 = high1 & high2;
  const low3 = low1 & low2;
  return high3 * high + low3;
}

/**
 * Concatenate encoded paths with '/' as seperation.
 *
 * @param src - Encoded paths to be concatenated.
 * @param length - The length of the concatenated array.
 * @returns The concatenated array.
 */
// https://stackoverflow.com/a/59902638
export function ConcatEncodedPath(src: Uint8Array[], length: number): Uint8Array {
  const result = new Uint8Array(length);
  let offset = 0;
  for (let i = 0; i < src.length; i += 1) {
    result.set(src[i], offset);
    offset += src[i].length;
    if (i !== src.length - 1) {
      result.set([0x2f], offset);
      offset += 1;
    }
  }
  return result;
}

/**
 * Padding an array to a specific length.
 *
 * @param src - The source array.
 * @param length - The length after padding.
 * @returns The padded array.
 */
export function paddingTo(src: Uint8Array, length: number): Uint8Array {
  const result = new Uint8Array(length);
  result.set(src);
  return result;
}

/**
 * Padding an array to its nearest multiple of 512.
 *
 * @param src - The source array.
 * @returns The padded array.
 */
export function paddingTo512n(src: Uint8Array): Uint8Array {
  if (Buffer.length % 512 === 0) {
    return src;
  }
  return paddingTo(src, Math.ceil(src.length / 512) * 512);
}

/**
 * Concatenate two readable streams into one.
 *
 * @param first - The first readable stream.
 * @param second - The second readable stream.
 * @returns The concatenated readable stream.
 */
export function ConcatReadableStream(first: ReadableStream, second: ReadableStream): ReadableStream {
  const firstReader = first.getReader();
  const secondReader = second.getReader();
  let readOnSecond = false;
  return new ReadableStream({
    pull(controller) {
      return (async () => {
        if (!readOnSecond) {
          const { value, done } = await firstReader.read();
          if (!done) {
            controller.enqueue(value);
          }
          readOnSecond = done;
        } else {
          const { value, done } = await secondReader.read();
          if (done) {
            controller.close();
          } else {
            controller.enqueue(value);
          }
        }
      })();
    },
  });
}
