import { loadRenderer } from "../../dist/esm/index.js"

const { Renderer, RESIZABLE } = loadRenderer()

import { writeFileSync } from 'fs';

const renderer = new Renderer();
if (!renderer.initialize(640, 360, "Synth Memory Demo")) {
  console.error('init failed'); process.exit(1);
}
renderer.setWindowState(RESIZABLE);
renderer.targetFPS = 60;

const audio = renderer.audio;

function writeString(buf, offset, str) {
  for (let i = 0; i < str.length; i++) buf.writeUInt8(str.charCodeAt(i), offset + i);
}

function floatTo16BitPCM(outputBuffer, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    outputBuffer.writeInt16LE(Math.floor(s * 0x7fff), offset);
  }
}

function generateSine(freq, sampleRate, durationSeconds, amp = 1.0) {
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const out = new Float32Array(sampleCount);
  const inc = (2 * Math.PI * freq) / sampleRate;
  let phase = 0;
  for (let i = 0; i < sampleCount; i++) {
    out[i] = Math.sin(phase) * amp;
    phase += inc;
    if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
  }
  return out;
}

function applyADSR(samples, sampleRate, attack=0.02, decay=0.05, sustainLevel=0.7, sustainTime=0.5, release=0.1) {
  const total = samples.length;
  const a = Math.floor(sampleRate * attack);
  const d = Math.floor(sampleRate * decay);
  let s = Math.floor(sampleRate * sustainTime);
  const r = Math.floor(sampleRate * release);
  const envTotal = a + d + s + r;
  if (envTotal > total) s = Math.max(0, s - (envTotal - total));
  for (let i = 0; i < total; i++) {
    let env = 1.0;
    if (i < a) env = i / Math.max(1, a);
    else if (i < a + d) env = 1.0 + (sustainLevel - 1.0) * ((i - a) / Math.max(1, d));
    else if (i < a + d + s) env = sustainLevel;
    else {
      const relIndex = i - (a + d + s);
      env = sustainLevel * (1.0 - (relIndex / Math.max(1, r)));
      if (env < 0) env = 0;
    }
    samples[i] *= env;
  }
}

function encodeWavStereoFromMono(floatSamples, sampleRate) {
  const numChannels = 2;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = floatSamples.length;
  const dataByteLen = sampleCount * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataByteLen);

  writeString(buffer, 0, 'RIFF');
  buffer.writeUInt32LE(36 + dataByteLen, 4);
  writeString(buffer, 8, 'WAVE');

  writeString(buffer, 12, 'fmt ');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  writeString(buffer, 36, 'data');
  buffer.writeUInt32LE(dataByteLen, 40);

  const interleaved = new Float32Array(sampleCount * numChannels);
  for (let i = 0, j = 0; i < sampleCount; i++) {
    const s = floatSamples[i];
    interleaved[j++] = s;
    interleaved[j++] = s;
  }

  floatTo16BitPCM(buffer, 44, interleaved);
  return buffer;
}

function createNoteWavBuffer(freq, duration = 0.6, sampleRate = 44100) {
  const mono = generateSine(freq, sampleRate, duration, 0.8);
  applyADSR(mono, sampleRate, 0.01, 0.06, 0.7, Math.max(0, duration - 0.18), 0.12);
  return encodeWavStereoFromMono(mono, sampleRate);
}

function normalizeExt(ext) {
  if (!ext) return '.wav';
  if (ext[0] !== '.') return '.' + ext;
  return ext;
}

// create notes
const noteA_buf = createNoteWavBuffer(440, 0.6);
const noteB_buf = createNoteWavBuffer(660, 0.55);
const noteC_buf = createNoteWavBuffer(880, 0.5);

// debug: optionally write a generated file to disk to inspect WAV header
try { writeFileSync('debug_noteA.wav', noteA_buf); } catch (e) {}

// IMPORTANT: pass extension with leading dot ('.wav')
const ext = normalizeExt('wav');

const hA = audio.loadSoundFromMemory(ext, noteA_buf);
const hB = audio.loadSoundFromMemory(ext, noteB_buf);
const hC = audio.loadSoundFromMemory(ext, noteC_buf);

console.log('handles', hA, hB, hC);

if (hA) audio.playSound(hA);
setTimeout(() => hB && audio.playSound(hB), 250);
setTimeout(() => hC && audio.playSound(hC), 480);

setTimeout(() => { audio.setMasterVolume(0.6); if (hA) audio.setSoundVolume(hA, 0.9); }, 900);
setTimeout(() => { if (hB) { audio.stopSound(hB); audio.unloadSound(hB); } }, 1600);
setTimeout(() => { if (hA) { audio.stopSound(hA); audio.unloadSound(hA); } if (hC) { audio.stopSound(hC); audio.unloadSound(hC); } audio.setMasterVolume(1.0); }, 2200);
setTimeout(() => { renderer.shutdown(); process.exit(0); }, 2400);

function Loop() {
  renderer.input.GetInput();
  if (renderer.step()) setImmediate(Loop);
  else renderer.shutdown();
}
Loop();

process.on('SIGINT', () => { renderer.shutdown(); process.exit(0); });
