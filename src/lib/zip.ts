import { deflateRawSync } from 'zlib'

const _crcTable: number[] = []
function crcTable(): number[] {
  if (_crcTable.length) return _crcTable
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    _crcTable.push(c)
  }
  return _crcTable
}

function crc32(buf: Buffer): number {
  const t = crcTable()
  let crc = 0xFFFFFFFF
  for (const b of buf) crc = (crc >>> 8) ^ t[(crc ^ b) & 0xFF]
  return (crc ^ 0xFFFFFFFF) >>> 0
}

export interface ZipEntry { name: string; data: Buffer }

export function buildZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const localParts:   Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const { name, data } of entries) {
    const nameBytes  = Buffer.from(name, 'utf8')
    const compressed = deflateRawSync(data, { level: 6 })
    const crc        = crc32(data)
    const now        = new Date()
    const dosDate    = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
    const dosTime    = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)

    // Local file header
    const lfh = Buffer.alloc(30 + nameBytes.length)
    lfh.writeUInt32LE(0x04034b50, 0)
    lfh.writeUInt16LE(20, 4)
    lfh.writeUInt16LE(0, 6)
    lfh.writeUInt16LE(8, 8)        // DEFLATE
    lfh.writeUInt16LE(dosTime, 10)
    lfh.writeUInt16LE(dosDate, 12)
    lfh.writeUInt32LE(crc, 14)
    lfh.writeUInt32LE(compressed.length, 18)
    lfh.writeUInt32LE(data.length, 22)
    lfh.writeUInt16LE(nameBytes.length, 26)
    lfh.writeUInt16LE(0, 28)
    nameBytes.copy(lfh, 30)

    localParts.push(lfh, compressed)

    // Central directory entry
    const cde = Buffer.alloc(46 + nameBytes.length)
    cde.writeUInt32LE(0x02014b50, 0)
    cde.writeUInt16LE(20, 4)
    cde.writeUInt16LE(20, 6)
    cde.writeUInt16LE(0, 8)
    cde.writeUInt16LE(8, 10)
    cde.writeUInt16LE(dosTime, 12)
    cde.writeUInt16LE(dosDate, 14)
    cde.writeUInt32LE(crc, 16)
    cde.writeUInt32LE(compressed.length, 20)
    cde.writeUInt32LE(data.length, 24)
    cde.writeUInt16LE(nameBytes.length, 28)
    cde.writeUInt16LE(0, 30)
    cde.writeUInt16LE(0, 32)
    cde.writeUInt16LE(0, 34)
    cde.writeUInt16LE(0, 36)
    cde.writeUInt32LE(0o644 << 16, 38) // Unix permissions rw-r--r--
    cde.writeUInt32LE(offset, 42)
    nameBytes.copy(cde, 46)

    centralParts.push(cde)
    offset += lfh.length + compressed.length
  }

  const cdBuf   = Buffer.concat(centralParts)
  const cdStart = offset

  // End of central directory
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12)
  eocd.writeUInt32LE(cdStart, 16)
  eocd.writeUInt16LE(0, 20)

  const buf = Buffer.concat([...localParts, cdBuf, eocd])
  const ab  = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  return new Uint8Array(ab)
}
