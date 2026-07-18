/**
 * Minimal, dependency-free 16-bit PCM WAV encoding.
 * Kept in the shared package so it can be unit tested in Node without an AudioContext.
 */

/** Clamp a float sample to [-1, 1] and convert to a 16-bit integer. */
export function floatTo16(sample: number): number {
  const s = Math.max(-1, Math.min(1, sample));
  return s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
}

/**
 * Conservative in-place normalization: only attenuates (never boosts) so quiet
 * jams stay quiet, and guarantees the peak never exceeds `targetPeak`.
 * Returns the original peak for diagnostics.
 */
export function normalizePeak(channels: Float32Array[], targetPeak = 0.95): number {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i] ?? 0);
      if (a > peak) peak = a;
    }
  }
  if (peak > targetPeak && peak > 0) {
    const scale = targetPeak / peak;
    for (const ch of channels) {
      for (let i = 0; i < ch.length; i++) ch[i] = (ch[i] ?? 0) * scale;
    }
  }
  return peak;
}

/** Encode channel data as a 16-bit PCM WAV file (RIFF). */
export function encodeWavPcm16(channels: Float32Array[], sampleRate = 44100): ArrayBuffer {
  const numChannels = channels.length;
  if (numChannels === 0) throw new Error("encodeWavPcm16: no channels");
  const frames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataLen = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataLen, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      view.setInt16(offset, floatTo16(channels[c]?.[i] ?? 0), true);
      offset += 2;
    }
  }
  return buffer;
}
