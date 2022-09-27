import { PaxExtendedHeader, PaxHeaderKeyword, TarEntryType, TarHeader } from './header';
import { ReadableBufferStream, ReadablePaddedStream } from './stream';
import { ConcatEncodedPath, ConcatReadableStream, Int64And } from './utils';

const MAX_PREFIX_LENGTH = 155 - 1;
const MAX_NAME_LENGTH = 100 - 1;

/**
 * Split a path into a prefix and a name. Return null if the path is too long.
 *
 * @param path - A path seperated by '/'.
 * @returns Prefix and name, null when failed.
 */
function encodePrefixAndName(path: string): [Uint8Array, Uint8Array] | null {
  const encoder = new TextEncoder();

  // Encode each name
  const encodedNames = path.split('/').map((name) => encoder.encode(name));

  // Prefix sum of the length of each name
  const prefixSum = new Array<number>(encodedNames.length).map((value, index, array) => {
    if (index === 0) {
      return encodedNames[index].length;
    } else {
      return array[index - 1] + encodedNames[index].length;
    }
  });

  // If there is only one path and it is too long
  if (prefixSum.length === 1 && prefixSum.length > MAX_NAME_LENGTH) {
    return null;
  }

  // If the whole path and its length is not too long
  if (prefixSum[prefixSum.length - 1] + prefixSum.length - 1 <= MAX_NAME_LENGTH) {
    // Use the whole path as name
    return [new Uint8Array(0), encoder.encode(path)];
  }

  for (let i = 1; i < encodedNames.length; i += 1) {
    const prefixLength = prefixSum[i - 1] + i - 1;
    const nameLength = prefixSum[prefixSum.length - 1] - prefixSum[i - 1] + encodedNames.length - i - 1;
    if (prefixLength <= MAX_PREFIX_LENGTH && nameLength <= MAX_NAME_LENGTH) {
      return [
        ConcatEncodedPath(encodedNames.slice(0, i), prefixLength),
        ConcatEncodedPath(encodedNames.slice(i), nameLength),
      ];
    }
  }
  return null;
}

/**
 * Tar header block.
 */
export class TarHeaderBlock {
  paxHeaders: PaxExtendedHeader[];
  name: Uint8Array;
  prefix: Uint8Array;
  mode: Uint8Array;
  uid: Uint8Array;
  gid: Uint8Array;
  size: Uint8Array;
  mtime: Uint8Array;
  typeflag: Uint8Array;
  linkname: Uint8Array;
  magic: Uint8Array;
  version: Uint8Array;
  uname: Uint8Array;
  gname: Uint8Array;
  devmajor: Uint8Array;
  devminor: Uint8Array;
  content: ReadableStream;

  constructor(header: TarHeader) {
    console.assert(header.name !== '');
    // Create dictionary is not supported.
    console.assert(!header.name.endsWith('/'));

    this.paxHeaders = [];
    const encoder = new TextEncoder();
    let prefixAndName = encodePrefixAndName(header.name);
    this.name = new Uint8Array(100);
    this.prefix = new Uint8Array(155);
    if (!prefixAndName) {
      // Encode failed
      this.paxHeaders.push(new PaxExtendedHeader(PaxHeaderKeyword.path, header.name));
      // name_prefix = '@PathCut/_pc_root/'
      const namePrefix = [
        0x40, 0x50, 0x61, 0x74, 0x68, 0x43, 0x75, 0x74, 0x2f, 0x5f, 0x70, 0x63, 0x5f, 0x72, 0x6f, 0x6f, 0x74, 0x2f,
      ];
      let encodedName = encoder.encode(header.name);
      encodedName = encodedName.slice(0, MAX_NAME_LENGTH - namePrefix.length);
      this.name.set(namePrefix);
      this.name.set(encodedName, namePrefix.length);
    } else {
      this.prefix.set(prefixAndName[0]);
      this.name.set(prefixAndName[1]);
    }

    this.mode = new Uint8Array(8);
    header.mode = header.mode || 0o777;
    console.assert(Number.isInteger(header.mode)); // Mode must be an integer
    this.mode.set(encoder.encode((header.mode & 0o7777777).toString(8).padStart(7, '0')));

    this.uid = new Uint8Array(8);
    header.uid = header.uid || 0;
    console.assert(Number.isInteger(header.uid)); // UID must be an integer
    this.uid.set(encoder.encode((header.uid & 0o7777777).toString(8).padStart(7, '0')));

    this.gid = new Uint8Array(8);
    header.gid = header.gid || 0;
    console.assert(Number.isInteger(header.gid)); // GID must be an integer
    this.gid.set(encoder.encode((header.gid & 0o7777777).toString(8).padStart(7, '0')));

    this.size = new Uint8Array(12);
    header.size = header.size || 0;
    console.assert(Number.isInteger(header.size)); // Size must be an integer
    this.size.set(encoder.encode((header.size & 0o777777777777).toString(8).padStart(11, '0')));
    if (header.size > 0o777777777777) {
      this.paxHeaders.push(new PaxExtendedHeader(PaxHeaderKeyword.size, header.size.toString()));
    }

    this.mtime = new Uint8Array(12);
    header.mtime = header.mtime || new Date(0);
    this.mtime.set(
      encoder.encode(
        Int64And(header.mtime.getTime() / 1000, 0o777777777777)
          .toString(8)
          .padStart(11, '0'),
      ),
    );

    this.typeflag = encoder.encode(header.typeflag || TarEntryType.REGTYPE);
    this.linkname = new Uint8Array(100);
    this.magic = new Uint8Array([0x75, 0x73, 0x74, 0x61, 0x72, 0x00]); // Ustar
    this.version = new Uint8Array([0x30, 0x30]); // 00

    this.uname = new Uint8Array(32);
    if (header.uname) {
      this.uname.set(encoder.encode(header.uname).slice(0, 31));
    }

    this.gname = new Uint8Array(32);
    if (header.gname) {
      this.gname.set(encoder.encode(header.gname).slice(0, 31));
    }

    this.devmajor = new Uint8Array(8);
    if (header.devmajor) {
      this.devmajor.set(encoder.encode(header.devmajor).slice(0, 7));
    }

    this.devminor = new Uint8Array(8);
    if (header.devminor) {
      this.devminor.set(encoder.encode(header.devminor).slice(0, 7));
    }

    if (header.content === undefined) {
      this.content = new ReadableBufferStream(new Uint8Array());
    } else if (header.content instanceof Uint8Array) {
      this.content = new ReadableBufferStream(header.content);
    } else {
      this.content = new ReadablePaddedStream(header.content);
    }
  }

  header(encoder: TextEncoder): Uint8Array {
    let buf = new Uint8Array(512);
    buf.set(this.name);
    buf.set(this.mode, 100);
    buf.set(this.uid, 108);
    buf.set(this.gid, 116);
    buf.set(this.size, 124);
    buf.set(this.mtime, 136);
    buf.set(this.typeflag, 156);
    buf.set(this.linkname, 157);
    buf.set(this.magic, 257);
    buf.set(this.version, 263);
    buf.set(this.uname, 265);
    buf.set(this.gname, 297);
    buf.set(this.devmajor, 329);
    buf.set(this.devminor, 337);
    buf.set(this.prefix, 345);
    let sum = Array.from(buf).reduce((a, b) => a + b, 0) + ' '.charCodeAt(0) * 8;
    buf.set(encoder.encode(sum.toString(8).padStart(6, '0')), 148);
    buf.set([0x00, 0x20], 154);
    return buf;
  }

  wholeBlock(): ReadableStream {
    return ConcatReadableStream(this.headerWithPax(), this.content);
  }

  headerWithPax(): ReadableStream {
    const encoder = new TextEncoder();
    const header = this.header(encoder);
    let paxBlockStream: null | ReadableStream = null;
    if (this.paxHeaders.length !== 0) {
      const totalSize = this.paxHeaders.reduce((a, b) => a + b.length(encoder), 0);
      const paxBuffer = new Uint8Array(totalSize);
      let offset = 0;
      for (const paxHeaderEntry of this.paxHeaders) {
        const buf = paxHeaderEntry.toUint8Array();
        paxBuffer.set(buf, offset);
        offset += buf.length;
      }
      paxBlockStream = new TarHeaderBlock({
        name: 'PaxHeader/@PaxHeader',
        size: totalSize,
        content: paxBuffer,
        typeflag: TarEntryType.EXTHEADER,
      }).wholeBlock();
    }
    if (paxBlockStream) {
      return ConcatReadableStream(paxBlockStream, new ReadableBufferStream(header));
    } else {
      return new ReadableBufferStream(header);
    }
  }
}

/**
 * Compressed tar archive stream.
 */
export class Tar {
  stream: ReadableStream;

  constructor(header: TarHeader[]) {
    console.assert(header.length > 0); // Tar must have at least one entry
    let streams = header.map((h) => new TarHeaderBlock(h).wholeBlock());
    this.stream = streams[0];
    for (let i = 1; i < streams.length; i++) {
      // Concatenate all streams
      this.stream = ConcatReadableStream(this.stream, streams[i]);
    }
    this.stream = ConcatReadableStream(this.stream, new ReadableBufferStream(new Uint8Array(1024))); // Two empty blocks
  }
}
