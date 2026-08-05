/**
 * Best-effort audio duration extraction from the leading bytes of a file.
 *
 * No native metadata extractor exists in the project, so duration is derived
 * from container headers for the common lossless/lossy formats where the value
 * lives at the start of the stream (WAV, FLAC, MP3 with a Xing/VBRI header, M4A
 * MP4). Unsupported/malformed streams return null and the exact value is
 * captured later by the player on first playback (MediaStorage.persistPlaybackDuration).
 *
 * All readers are defensive: any unexpected byte layout returns null instead of
 * throwing, so a probe can never fail an import.
 */

function u32be(b: Uint8Array, o: number): number {
  return ((b[o] as number) << 24) | ((b[o + 1] as number) << 16) | ((b[o + 2] as number) << 8) | (b[o + 3] as number);
}

function u16le(b: Uint8Array, o: number): number {
  return (b[o] as number) | ((b[o + 1] as number) << 8);
}

function u32le(b: Uint8Array, o: number): number {
  return (b[o] as number) | ((b[o + 1] as number) << 8) | ((b[o + 2] as number) << 16) | ((b[o + 3] as number) << 24);
}

function ascii(b: Uint8Array, o: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(b[o + i] as number);
  return s;
}

/** RIFF/WAVE: duration = dataSize / byteRate. */
function probeWav(bytes: Uint8Array): number | null {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WAVE') return null;
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    const size = u32le(bytes, offset + 4);
    const data = offset + 8;
    if (id === 'fmt ' && size >= 16) {
      const channels = u16le(bytes, data + 2);
      const sampleRate = u32le(bytes, data + 4);
      const bitsPerSample = u16le(bytes, data + 14);
      if (channels > 0 && sampleRate > 0 && bitsPerSample > 0) {
        byteRate = sampleRate * channels * (bitsPerSample / 8);
      }
    } else if (id === 'data') {
      dataSize = size;
      if (byteRate > 0 && dataSize > 0) break;
    }
    offset = data + size + (size % 2);
  }
  if (byteRate <= 0 || dataSize <= 0) return null;
  return Math.round((dataSize / byteRate) * 1000);
}

/** FLAC: duration = totalSamples / sampleRate from the STREAMINFO block. */
function probeFlac(bytes: Uint8Array): number | null {
  if (bytes.length < 18 || ascii(bytes, 0, 4) !== 'fLaC') return null;
  let offset = 4;
  let guard = 0;
  while (offset + 4 <= bytes.length && guard++ < 32) {
    const header = bytes[offset] as number;
    const isLast = header & 0x80;
    const blockType = header & 0x7f;
    const length = ((bytes[offset + 1] as number) << 16) | ((bytes[offset + 2] as number) << 8) | (bytes[offset + 3] as number);
    if (blockType === 0) {
      const b = offset + 4;
      if (b + 18 > bytes.length) return null;
      const sampleRate = ((bytes[b + 10] as number) << 12) | ((bytes[b + 11] as number) << 4) | ((bytes[b + 12] as number) >> 4);
      const totalSamples =
        ((bytes[b + 13] as number) << 28) |
        ((bytes[b + 14] as number) << 20) |
        ((bytes[b + 15] as number) << 12) |
        ((bytes[b + 16] as number) << 4) |
        ((bytes[b + 17] as number) >> 4);
      if (sampleRate > 0 && totalSamples > 0) return Math.round((totalSamples / sampleRate) * 1000);
      return null;
    }
    if (isLast) break;
    offset = offset + 4 + length;
  }
  return null;
}

/** MP3: uses a Xing/Info (VBR/CRB) header with a frame count; duration = frames * samplesPerFrame / sampleRate. */
function probeMp3(bytes: Uint8Array): number | null {
  let offset = 0;
  if (ascii(bytes, 0, 3) === 'ID3') {
    if (bytes.length < 10) return null;
    const size =
      ((bytes[6] as number) & 0x7f) * 0x200000 +
      ((bytes[7] as number) & 0x7f) * 0x4000 +
      ((bytes[8] as number) & 0x7f) * 0x80 +
      ((bytes[9] as number) & 0x7f);
    offset = 10 + size;
  }
  if (offset + 4 > bytes.length || bytes[offset] !== 0xff || (bytes[offset + 1] as number) < 0xe0) return null;
  const header = bytes[offset + 1] as number;
  const versionBits = (header >> 3) & 0x03; // 0 = MPEG2.5, 2 = MPEG2, 3 = MPEG1
  const layerBits = (header >> 1) & 0x03;   // 1 = Layer III
  if (versionBits !== 3 || layerBits !== 1) return null; // MPEG1 Layer III only
  const sampleRateIndex = (bytes[offset + 2] as number >> 2) & 0x03;
  const SAMPLE_RATES = [44100, 48000, 32000];
  const sampleRate = SAMPLE_RATES[sampleRateIndex];
  if (!sampleRate) return null;

  const searchStart = offset;
  const searchEnd = Math.min(bytes.length - 4, offset + 1024);
  for (let i = searchStart; i <= searchEnd; i++) {
    const tag = ascii(bytes, i, 4);
    if (tag === 'Xing' || tag === 'Info') {
      const flags = u32be(bytes, i + 4);
      let frames = 0;
      if (flags & 0x1) frames = u32be(bytes, i + 8);
      if (frames > 0) return Math.round((frames * 1152) / sampleRate * 1000);
      return null;
    }
  }
  return null;
}

/** MP4/M4A: walks moov -> mvhd and returns duration/timescale. */
function probeM4a(bytes: Uint8Array): number | null {
  const findBox = (start: number, end: number, type: string): [number, number] | null => {
    let o = start;
    while (o + 8 <= end) {
      const size = u32be(bytes, o);
      if (ascii(bytes, o + 4, 4) === type) {
        return [o + 8, size > 0 ? size - 8 : end - o];
      }
      if (size === 0) break;
      if (size < 8) return null;
      o += size;
    }
    return null;
  };

  const ftyp = findBox(0, bytes.length, 'ftyp');
  const startAt = ftyp ? ftyp[0] + ftyp[1] : 4;
  const moov = findBox(startAt, bytes.length, 'moov');
  if (!moov) return null;
  const mvhd = findBox(moov[0], moov[0] + moov[1], 'mvhd');
  if (!mvhd) return null;
  const b = mvhd[0];
  if (mvhd[1] < 24 || b + 24 > bytes.length) return null;
  const version = bytes[b] as number;
  if (version === 0) {
    const timescale = u32be(bytes, b + 12);
    const duration = u32be(bytes, b + 16);
    if (timescale > 0) return Math.round((duration / timescale) * 1000);
  } else if (version === 1) {
    if (b + 32 > bytes.length) return null;
    const timescale = u32be(bytes, b + 20);
    const hi = u32be(bytes, b + 24);
    const lo = u32be(bytes, b + 28);
    const duration = hi * 0x100000000 + lo;
    if (timescale > 0) return Math.round((duration / timescale) * 1000);
  }
  return null;
}

/** Returns a best-effort duration in milliseconds, or null when unknown. */
export function probeAudioDurationMs(bytes: Uint8Array, fileName: string): number | null {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'wav':
    case 'wave':
      return probeWav(bytes);
    case 'flac':
      return probeFlac(bytes);
    case 'mp3':
    case 'mp2':
    case 'mp1':
    case 'mpga':
    case 'mpa':
    case 'mpeg3':
      return probeMp3(bytes);
    case 'm4a':
    case 'm4b':
    case 'm4p':
    case 'm4r':
    case 'mp4a':
      return probeM4a(bytes);
    default:
      return null;
  }
}