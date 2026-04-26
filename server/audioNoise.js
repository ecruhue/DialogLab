import fs from "fs";
import path from "path";

const NOISE_PROFILE_FILES = {
  street: "street.wav",
  "call-center": "call-center.wav",
};

const PROFILE_MIX_SETTINGS = {
  street: {
    speechGain: 0.88,
    noiseGain: 0.48,
    targetNoiseRms: 0.12,
  },
  "call-center": {
    speechGain: 1.04,
    noiseGain: 0.9,
    targetNoiseRms: 0.2,
  },
};

const VOICE_TO_PROFILE = {
  "en-gb-standard-a": "call-center",
  "en-gb-standard-b": "street",
  "en-gb-standard-c": "call-center",
  "en-gb-standard-d": "street",
  "en-us-neural2-f": "call-center",
  "en-us-neural2-j": "street",
};

function readChunkHeader(buffer, offset) {
  return {
    id: buffer.toString("ascii", offset, offset + 4),
    size: buffer.readUInt32LE(offset + 4),
    start: offset + 8,
  };
}

function parseWav(buffer) {
  if (buffer.length < 44) {
    throw new Error("Invalid WAV: file too small");
  }

  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Invalid WAV: missing RIFF/WAVE header");
  }

  let offset = 12;
  let fmt = null;
  let dataStart = -1;
  let dataSize = 0;
  let guard = 0;

  while (offset + 8 <= buffer.length && guard < 512) {
    guard += 1;
    const chunk = readChunkHeader(buffer, offset);

    if (chunk.start > buffer.length) {
      break;
    }

    const paddedSize = chunk.size + (chunk.size % 2);

    if (chunk.id === "fmt ") {
      if (chunk.size < 16) {
        throw new Error("Invalid WAV: fmt chunk too small");
      }

      if (chunk.start + 16 > buffer.length) {
        throw new Error("Invalid WAV: truncated fmt chunk");
      }

      fmt = {
        audioFormat: buffer.readUInt16LE(chunk.start),
        numChannels: buffer.readUInt16LE(chunk.start + 2),
        sampleRate: buffer.readUInt32LE(chunk.start + 4),
        bitsPerSample: buffer.readUInt16LE(chunk.start + 14),
      };
    } else if (chunk.id === "data") {
      dataStart = chunk.start;
      dataSize = Math.max(0, Math.min(chunk.size, buffer.length - dataStart));
      break;
    }

    const nextOffset = chunk.start + paddedSize;
    if (nextOffset <= offset) {
      break;
    }

    offset = nextOffset;
  }

  if (!fmt) {
    throw new Error("Invalid WAV: missing fmt chunk");
  }

  if (dataStart < 0 || dataSize <= 0) {
    throw new Error("Invalid WAV: missing data chunk");
  }

  // Support PCM and WAVE_FORMAT_EXTENSIBLE containers that still carry PCM data.
  if (fmt.audioFormat !== 1 && fmt.audioFormat !== 65534) {
    throw new Error(`Unsupported WAV: audio format ${fmt.audioFormat}`);
  }

  if (fmt.bitsPerSample !== 16) {
    throw new Error("Unsupported WAV: only 16-bit PCM is supported");
  }

  const bytesPerSample = fmt.bitsPerSample / 8;
  if (!Number.isFinite(bytesPerSample) || bytesPerSample <= 0) {
    throw new Error("Invalid WAV: invalid bytes per sample");
  }

  const frameSize = fmt.numChannels * bytesPerSample;
  if (!Number.isFinite(frameSize) || frameSize <= 0) {
    throw new Error("Invalid WAV: invalid frame size");
  }

  const frameCount = Math.floor(dataSize / frameSize);
  if (frameCount <= 0) {
    throw new Error("Invalid WAV: empty data frames");
  }

  if (frameCount > 20_000_000) {
    throw new Error("Invalid WAV: unreasonable frame count");
  }

  const mono = new Float32Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    const frameOffset = dataStart + i * frameSize;
    let sum = 0;
    for (let ch = 0; ch < fmt.numChannels; ch++) {
      const sample = buffer.readInt16LE(frameOffset + ch * bytesPerSample);
      sum += sample / 32768;
    }
    mono[i] = sum / fmt.numChannels;
  }

  return {
    sampleRate: fmt.sampleRate,
    samples: mono,
  };
}

function writeWavMono16(samples, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataLen = samples.length * bytesPerSample;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(dataLen + 36, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  header.writeUInt16LE(numChannels * bytesPerSample, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLen, 40);

  const pcm = Buffer.alloc(dataLen);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const intValue = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    pcm.writeInt16LE(intValue, i * bytesPerSample);
  }

  return Buffer.concat([header, pcm]);
}

function resampleLinear(samples, sourceRate, targetRate) {
  if (sourceRate === targetRate) {
    return samples;
  }

  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.round(samples.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(samples.length - 1, left + 1);
    const frac = sourceIndex - left;
    output[i] = samples[left] * (1 - frac) + samples[right] * frac;
  }

  return output;
}

function alignNoiseToSpeech(noiseSamples, targetLength) {
  const output = new Float32Array(targetLength);

  if (noiseSamples.length === 0 || targetLength <= 0) {
    return output;
  }

  // Prefer trimming a segment that exactly matches speech duration.
  if (noiseSamples.length >= targetLength) {
    const maxStart = noiseSamples.length - targetLength;
    const start = maxStart > 0 ? Math.floor(Math.random() * (maxStart + 1)) : 0;
    const slice = noiseSamples.subarray(start, start + targetLength);
    output.set(slice);
    return output;
  }

  // If speech is longer than available noise, repeat noise to fill the duration.
  for (let i = 0; i < targetLength; i++) {
    output[i] = noiseSamples[i % noiseSamples.length];
  }

  return output;
}

function computeRms(samples) {
  if (!samples || samples.length === 0) {
    return 0;
  }

  const stride = Math.max(1, Math.floor(samples.length / 200000));
  let sum = 0;
  let count = 0;
  for (let i = 0; i < samples.length; i += stride) {
    const v = samples[i];
    sum += v * v;
    count += 1;
  }

  if (count === 0) {
    return 0;
  }

  return Math.sqrt(sum / count);
}

function normalizeNoiseRms(samples, targetRms) {
  const rms = computeRms(samples);
  if (!rms || !Number.isFinite(rms)) {
    return samples;
  }

  const rawScale = targetRms / rms;
  const scale = Math.max(0.2, Math.min(6, rawScale));
  if (Math.abs(scale - 1) < 0.01) {
    return samples;
  }

  const normalized = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    normalized[i] = samples[i] * scale;
  }

  return normalized;
}

function normalizePeak(samples, maxPeak = 0.98) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const absValue = Math.abs(samples[i]);
    if (absValue > peak) {
      peak = absValue;
    }
  }

  if (!peak || peak <= maxPeak) {
    return samples;
  }

  const scale = maxPeak / peak;
  const normalized = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    normalized[i] = samples[i] * scale;
  }

  return normalized;
}

function resolveNoiseProfile({ speakerName, voiceName, noiseProfile }) {
  const explicit = String(noiseProfile || "").trim().toLowerCase();
  if (explicit && NOISE_PROFILE_FILES[explicit]) {
    return explicit;
  }

  const normalizedSpeaker = String(speakerName || "").trim().toLowerCase();

  if (normalizedSpeaker === "bob") {
    return "street";
  }

  if (normalizedSpeaker === "alice") {
    return "call-center";
  }

  const normalizedVoice = String(voiceName || "").trim().toLowerCase();
  if (normalizedVoice && VOICE_TO_PROFILE[normalizedVoice]) {
    return VOICE_TO_PROFILE[normalizedVoice];
  }

  return null;
}

export async function addNoiseForSpeaker(speechWavBuffer, speakerName, options = {}) {
  const profile = resolveNoiseProfile({
    speakerName,
    voiceName: options.voiceName,
    noiseProfile: options.noiseProfile,
  });
  if (!profile) {
    return {
      audioBuffer: speechWavBuffer,
      profileApplied: "clean",
      mixed: false,
    };
  }

  const noiseFile = NOISE_PROFILE_FILES[profile];
  const noisePath = path.join(process.cwd(), "audio", "noise_profiles", noiseFile);

  if (!fs.existsSync(noisePath)) {
    console.warn(`[${new Date().toISOString()}] Batch TTS: Noise file missing for profile ${profile} at ${noisePath}; using clean audio`);
    return {
      audioBuffer: speechWavBuffer,
      profileApplied: `${profile}-missing`,
      mixed: false,
    };
  }

  try {
    const speech = parseWav(speechWavBuffer);
    const noiseBuffer = await fs.promises.readFile(noisePath);
    const noise = parseWav(noiseBuffer);

    const mixSettings = PROFILE_MIX_SETTINGS[profile] || PROFILE_MIX_SETTINGS.street;

    const noiseAtSpeechRate = resampleLinear(noise.samples, noise.sampleRate, speech.sampleRate);
    const alignedNoise = alignNoiseToSpeech(noiseAtSpeechRate, speech.samples.length);
    const normalizedNoise = normalizeNoiseRms(alignedNoise, mixSettings.targetNoiseRms);

    const mixed = new Float32Array(speech.samples.length);
    for (let i = 0; i < speech.samples.length; i++) {
      mixed[i] = speech.samples[i] * mixSettings.speechGain + normalizedNoise[i] * mixSettings.noiseGain;
    }

    const peakNormalizedMix = normalizePeak(mixed);

    return {
      audioBuffer: writeWavMono16(peakNormalizedMix, speech.sampleRate),
      profileApplied: profile,
      mixed: true,
    };
  } catch (error) {
    console.warn(`[${new Date().toISOString()}] Batch TTS: Noise mixing failed for speaker ${speakerName || "unknown"}; using clean audio`, error.message);
    return {
      audioBuffer: speechWavBuffer,
      profileApplied: `${profile}-fallback`,
      mixed: false,
    };
  }
}
