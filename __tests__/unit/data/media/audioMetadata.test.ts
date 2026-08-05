import { probeAudioDurationMs } from '@data/media/audioMetadata';

function u32le(v: number): [number, number, number, number] {
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
}
function ascii(buf: Uint8Array, str: string, offset: number): void {
  for (let i = 0; i < str.length; i++) buf[offset + i] = str.charCodeAt(i);
}
function pad(buf: Uint8Array, start: number, v: number): void {
  const arr = u32le(v);
  for (let i = 0; i < 4; i++) buf[start + i] = arr[i] as number;
}
/** Writes a value as big-endian at `start` (used where the probe reads u32/be). */
function padBe(buf: Uint8Array, start: number, v: number): void {
  buf[start] = (v >>> 24) & 0xff;
  buf[start + 1] = (v >>> 16) & 0xff;
  buf[start + 2] = (v >>> 8) & 0xff;
  buf[start + 3] = v & 0xff;
}

/** 5-second 16-bit stereo 44.1kHz WAV. */
function buildWav(): Uint8Array {
  const byteRate = 44100 * 2 * 2;
  const dataSize = byteRate * 5;
  const buf = new Uint8Array(44);
  ascii(buf, 'RIFF', 0);
  pad(buf, 4, 36);
  ascii(buf, 'WAVE', 8);
  ascii(buf, 'fmt ', 12);
  pad(buf, 16, 16);
  buf[20] = 1; buf[21] = 0;
  buf[22] = 2; buf[23] = 0;
  pad(buf, 24, 44100);
  pad(buf, 28, byteRate);
  buf[32] = 4; buf[33] = 0;
  buf[34] = 16; buf[35] = 0;
  ascii(buf, 'data', 36);
  pad(buf, 40, dataSize);
  return buf;
}

/** FLAC with STREAMINFO: 44.1kHz, total samples = 44100*3 (3 seconds). */
function buildFlac(): Uint8Array {
  const buf = new Uint8Array(4 + 4 + 34);
  ascii(buf, 'fLaC', 0);
  const header = 4; // not last, type 0 (STREAMINFO), length 34
  buf[4] = 0x00;
  buf[5] = 0; buf[6] = 0; buf[7] = 34;
  const b = header + 4;
  // min/max blocksize (16 bytes reserved)
  buf[b] = 0; buf[b + 1] = 0; buf[b + 2] = 0; buf[b + 3] = 0;
  buf[b + 4] = 0; buf[b + 5] = 0; buf[b + 6] = 0; buf[b + 7] = 0;
  // STREAMINFO 20-bit sample rate occupies bytes b+10..b+12 as the probe reads them.
  const sampleRate = 44100;
  buf[b + 10] = (sampleRate >>> 12) & 0xff;
  buf[b + 11] = (sampleRate >>> 4) & 0xff;
  buf[b + 12] = (sampleRate & 0xf) << 4;
  // totalSamples 44100*3 = 132300 (36-bit) at b+13..b+17
  const total = 132300;
  buf[b + 13] = (total >>> 28) & 0xff;
  buf[b + 14] = (total >>> 20) & 0xff;
  buf[b + 15] = (total >>> 12) & 0xff;
  buf[b + 16] = (total >>> 4) & 0xff;
  buf[b + 17] = (total & 0xf) << 4;
  return buf;
}

/** MP3 (MPEG1 Layer III) with an ID3v2 tag + Xing VBR header: 125 frames. */
function buildMp3(): Uint8Array {
  const tagSize = 10 + 12; // header + a small Xing block
  const buf = new Uint8Array(tagSize + 128);
  ascii(buf, 'ID3', 0);
  buf[3] = 3; buf[4] = 0; buf[5] = 0;
  const syncsafe = (12 >>> 21) & 0x7f;
  const ss2 = (12 >>> 14) & 0x7f;
  const ss3 = (12 >>> 7) & 0x7f;
  const ss4 = 12 & 0x7f;
  buf[6] = syncsafe; buf[7] = ss2; buf[8] = ss3; buf[9] = ss4;

  const frame = tagSize;
  // frame sync (MPEG1, Layer III, 44.1kHz)
  buf[frame] = 0xff;
  buf[frame + 1] = 0xfb; // 111 11 011: MPEG1 + LayerIII
  buf[frame + 2] = 0x90; // bitrate index 1001
  buf[frame + 3] = 0x00;

  // Xing header typically at frame + 36 for MPEG1 (17 side info + 19 sync); we search for it
  const xing = frame + 36 + 4;
  ascii(buf, 'Xing', xing);
  const flagsOff = xing + 4;
  // Frames-present flag (bit 0) is the low byte of the big-endian 32-bit flags.
  padBe(buf, flagsOff, 1);
  // Frame count is read big-endian by the probe (u32be).
  padBe(buf, flagsOff + 4, 125);
  return buf;
}

/** M4A: ftyp + moov -> mvhd (version 0), timescale 1000, duration 8000 (8s). */
function buildM4a(): Uint8Array {
  // ftyp box: size 24 (big-endian), major brand handled as a plain type box.
  const ftyp = new Uint8Array(24);
  padBe(ftyp, 0, 24);
  ascii(ftyp, 'ftyp', 4);
  // mvhd box: size 108, version 0, timescale/duration big-endian.
  const mvhd = new Uint8Array(108);
  padBe(mvhd, 0, 108);
  ascii(mvhd, 'mvhd', 4);
  mvhd[8] = 0; // version
  padBe(mvhd, 20, 1000); // timescale
  padBe(mvhd, 24, 8000); // duration
  // moov box: size = 8 + mvhd.length
  const moov = new Uint8Array(8 + mvhd.length);
  padBe(moov, 0, moov.length);
  ascii(moov, 'moov', 4);
  moov.set(mvhd, 8);

  const out = new Uint8Array(ftyp.length + moov.length);
  out.set(ftyp, 0);
  out.set(moov, ftyp.length);
  return out;
}

describe('probeAudioDurationMs', () => {
  it('reads WAV duration', () => {
    expect(probeAudioDurationMs(buildWav(), 'track.wav')).toBe(5000);
  });

  it('reads FLAC duration', () => {
    expect(probeAudioDurationMs(buildFlac(), 'song.flac')).toBe(3000);
  });

  it('reads MP3 Xing (VBR) duration', () => {
    expect(probeAudioDurationMs(buildMp3(), 'song.mp3')).toBe(Math.round((125 * 1152) / 44100 * 1000));
  });

  it('reads M4A duration from mvhd', () => {
    expect(probeAudioDurationMs(buildM4a(), 'voice.m4a')).toBe(8000);
  });

  it('returns null for unsupported or malformed input', () => {
    expect(probeAudioDurationMs(new Uint8Array([1, 2, 3]), 'song.ogg')).toBeNull();
    expect(probeAudioDurationMs(new Uint8Array(), 'empty.wav')).toBeNull();
    expect(probeAudioDurationMs(buildWav().subarray(0, 8), 'cut.wav')).toBeNull();
    expect(probeAudioDurationMs(new Uint8Array(64), 'garbage.mp3')).toBeNull();
    expect(probeAudioDurationMs(new Uint8Array(64), 'clip.aac')).toBeNull();
  });
});