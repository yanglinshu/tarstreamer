import { lengthOf } from './utils';

/* A tar archive consists of a series of file objects, hence the popular term tarball, referencing how a tarball 
   collects objects of all kinds that stick to its surface. Each file object includes any file data, and is preceded by
   a 512-byte header record. The file data is written unaltered except that its length is rounded up to a multiple of 
   512 bytes. The original tar implementation did not care about the contents of the padding bytes, and left the buffer
   data unaltered, but most modern tar implementations fill the extra space with zeros.  */

/* The fields of header blocks:
   All strings are stored as ISO 646 (approximately ASCII) strings. Fields are numeric unless otherwise noted below; 
   numbers are ISO 646. Representations of octal numbers, with leading zeros as needed. 
   
   Linkname is only valid when typeflag==LNKTYPE. It doesn't use prefix; files that are links to pathnames >100 chars 
   long can not be stored in a tar archive. If typeflag=={LNKTYPE,SYMTYPE,DIRTYPE} then size must be 0. 
   
   Devmajor and devminor are only valid for typeflag=={BLKTYPE,CHRTYPE}. 
   
   Chksum contains the sum of all 512 bytes in the header block, treating each byte as an 8-bit unsigned value and 
   treating the 8 bytes of chksum as blank characters.

   Uname and gname are used in preference to uid and gid, if those names exist locally.

   Field Name   Byte Offset     Length in Bytes Field Type
   name         0               100             NUL-terminated if NUL fits
   mode         100             8
   uid          108             8
   gid          116             8
   size         124             12
   mtime        136             12
   chksum       148             8
   typeflag     156             1               see below
   linkname     157             100             NUL-terminated if NUL fits
   magic        257             6               must be TMAGIC (NUL term.)
   version      263             2               must be TVERSION
   uname        265             32              NUL-terminated
   gname        297             32              NUL-terminated
   devmajor     329             8
   devminor     337             8
   prefix       345             155             NUL-terminated if NUL fits
   
   If the first character of prefix is '\0', the file name is name; otherwise, it is prefix/name. 
   Files whose pathnames don't fit in that length can not be stored in a tar archive.  */

/**
 * Keywords of Pax extended header.
 */
export enum PaxHeaderKeyword {
  size = 'size',
  path = 'path',
}

/**
 * Pax extended header.
 */
export class PaxExtendedHeader {
  constructor(private keyword: PaxHeaderKeyword, private value: string) {}

  public length(encoder: TextEncoder): number {
    const fieldLength = this.keyword.length + encoder.encode(this.value).length + 3;
    // + 3 for '=' + '\n' + ' '

    const contentLength = lengthOf(fieldLength);

    // Make sure the length of the whole encoded field equals the length of the field + the length of the field length
    if (lengthOf(lengthOf(contentLength) + fieldLength) !== lengthOf(contentLength)) {
      return contentLength + fieldLength + 1;
    } else {
      return contentLength + fieldLength;
    }
  }

  public toUint8Array(): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(`${this.length(encoder)} ${this.keyword}=${this.value}\n`);
  }
}

/**
 * Entry type of a tar header.
 */
export enum TarEntryType {
  REGTYPE = '0', // Regular file
  LINKTYPE = '1', // Hard link
  SYMTYPE = '2', // Symbolic link
  CHRTYPE = '3', // Character special
  BLKTYPE = '4', // Block special
  DIRTYPE = '5', // Directory
  FIFOTYPE = '6', // FIFO special
  CONTTYPE = '7', // Reserved
  EXTHEADER = 'x', // Extended header
  GEXTHEADER = 'g', // Global extended header
}

/**
 * Tar header interface.
 */
export interface TarHeader {
  name: string;
  mode?: number;
  uid?: number;
  gid?: number;
  size: number;
  mtime?: Date;
  typeflag?: TarEntryType;
  linkname?: string;
  uname?: string;
  gname?: string;
  devmajor?: string;
  devminor?: string;
  content?: Uint8Array | ReadableStream;
}
