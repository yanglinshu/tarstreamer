import '../src/env';
import TarStreamer from '../src';
import { encodePrefixAndName } from '../src/compress';
import { ConcatReadableStream } from '../src/utils';
import fs from 'fs';

async function saveTarFile(name: string, stream: ReadableStream) {
  const reader = stream.getReader();
  await new Promise<void>((resolve, reject) => {
    fs.writeFile(name, new Uint8Array(), () => resolve());
  });
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    await new Promise<void>((resolve, reject) => {
      fs.appendFile(name, value, () => resolve());
    });
  }
}

class ReadableBufferStream extends ReadableStream {
  constructor(fill = '0', chunkCount = 1, chunkSize = 1024 * 1024) {
    let offset = 0;
    super({
      pull(controller) {
        controller.enqueue(new Uint8Array(chunkSize).fill(fill.charCodeAt(0), 0, chunkSize));
        offset += chunkSize;
        if (offset >= chunkCount * chunkSize) {
          controller.close();
        }
      },
    });
  }
}

test('Test split prefix and name', () => {
  const totalLength = (...args: string[]) => {
    args = args.filter((s) => s.length !== 0);
    return args.length + args.reduce((a, b) => a + b.length, 0) - 1;
  };
  const encoder = new TextEncoder();
  const MAX_PREFIX_LENGTH = 155 - 1;
  const MAX_NAME_LENGTH = 100 - 1;
  for (let i of [0, 1, 95, 96, 97, 98, 99, 100, 101, 150, 151, 152, 153, 154, 155]) {
    let pathI = 'a'.repeat(i);
    for (let j = 0; j <= 155; ++j) {
      let partJ = 'b'.repeat(j);
      let pathJ = pathI === '' || partJ === '' ? partJ : pathI + '/' + partJ;
      for (let k = 0; k <= 155; ++k) {
        let part_k = 'c'.repeat(k);
        let path_k = pathJ === '' || part_k === '' ? part_k : pathJ + '/' + part_k;
        if (path_k === '') {
          continue;
        }
        try {
          expect(encodePrefixAndName(path_k)).toStrictEqual(
            (() => {
              if (path_k.length <= MAX_NAME_LENGTH) {
                return [new Uint8Array(), encoder.encode(path_k)];
              }
              if (
                pathI.length !== 0 &&
                pathI.length <= MAX_PREFIX_LENGTH &&
                totalLength(partJ, part_k) <= MAX_NAME_LENGTH
              ) {
                return [encoder.encode(pathI), encoder.encode(partJ + '/' + part_k)];
              }
              if (totalLength(pathI, partJ) <= MAX_PREFIX_LENGTH && part_k.length <= MAX_NAME_LENGTH) {
                return [encoder.encode(pathI === '' ? partJ : pathI + '/' + partJ), encoder.encode(part_k)];
              }
              return null;
            })(),
          );
        } catch (e) {
          console.log(i, j, k);
          throw e;
        }
      }
    }
  }
});

test('Write big file with pax', () => {
  const tar = new TarStreamer([
    {
      name: '01234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789',
      size: 9 * 1024 * 1024 * 1024,
      mtime: new Date(0o14307600623 * 1000),
      content: new ReadableBufferStream('0', 9 * 1024),
    },
  ]);
  saveTarFile('1.tar', tar.stream as ReadableStream);
});

test('Write multiple files', () => {
  const encoder = new TextEncoder();
  const tar = new TarStreamer([{
    name: '1.txt',
    size: 5,
    mtime: new Date(0o14307600623 * 1000),
    content: encoder.encode('1.txt'),
  }, {
    name: '2.txt',
    size: 5,
    mtime: new Date(0o14307600623 * 1000),
    content: encoder.encode('2.txt'),
  }]);
  saveTarFile('2.tar', tar.stream as ReadableStream);
});


test('Write multiple files from streams (non-uniform blocks)', () => {
  const tar = new TarStreamer([{
    name: '1.txt',
    size: 511,
    mtime: new Date(0o14307600623 * 1000),
    content: new ReadableBufferStream('0',1, 511),
  }, {
    name: '2.txt',
    size: 513,
    mtime: new Date(0o14307600623 * 1000),
    content: new ReadableBufferStream('1',1, 513),
  }]);
  saveTarFile('2.tar', tar.stream as ReadableStream);
});

test('Write a file from non-uniform streams', () => {
  const tar = new TarStreamer([{
    name: '1.txt',
    size: 1024,
    mtime: new Date(0o14307600623 * 1000),
    content: ConcatReadableStream(new ReadableBufferStream('0',1, 511) , new ReadableBufferStream('1',1, 513)),
  }]);
  saveTarFile('3.tar', tar.stream as ReadableStream);
});

test('Write multiple files from streams', () => {
  const tar = new TarStreamer([{
    name: '1.txt',
    size: 512,
    mtime: new Date(0o14307600623 * 1000),
    content: new ReadableBufferStream('0',1, 512),
  }, {
    name: '2.txt',
    size: 512,
    mtime: new Date(0o14307600623 * 1000),
    content: new ReadableBufferStream('1',1, 512),
  }]);
  saveTarFile('4.tar', tar.stream as ReadableStream);
});