// Browser audio primitives for the live spoken session: a 16 kHz mono capture
// tap that emits 100 ms s16le frames, and a 24 kHz PCM player that schedules
// chunks on one monotonic timeline. Ported from the proven bench page
// ~/tmp/gemini-poc/gemini-live-lab.html (`submitFloats`, `playPcm`,
// `stopPlayback`, `WORKLET_SRC`) — see VOICE.md "Client requirements".

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
/** 100 ms of 16 kHz audio — the frame size the Live API is fed. */
const FRAME_SAMPLES = 1600;
/** Block size of the ScriptProcessorNode tap when AudioWorklet is unavailable. */
const SCRIPTPROCESSOR_BLOCK = 2048;
const WORKLET_NAME = "rehearse-live-tap";

// The tap runs on the audio thread, so the processor has to load from a Blob
// URL: Vite emits no separate worklet bundle that survives dev and build alike.
const WORKLET_SRC = [
  "class TapProcessor extends AudioWorkletProcessor {",
  "  process(inputs) {",
  "    const ch = inputs[0] && inputs[0][0];",
  "    if (ch && ch.length) this.port.postMessage(ch.slice(0));",
  "    return true;",
  "  }",
  "}",
  `registerProcessor("${WORKLET_NAME}", TapProcessor);`,
].join("\n");

export interface MicCapture {
  stop(): void;
}

export interface PcmPlayer {
  write(pcm16: Int16Array): void;
  stop(): void;
  readonly speaking: boolean;
}

/** getUserMedia -> AudioContext({sampleRate:16000}) -> AudioWorklet tap -> 100 ms s16le frames. */
export async function startMicCapture(onFrame: (pcm16: Int16Array) => void): Promise<MicCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

  try {
    const ctx = createContext(INPUT_RATE);
    await ctx.resume();

    const source = ctx.createMediaStreamSource(stream);
    const ratio = ctx.sampleRate / INPUT_RATE;
    let frame = new Int16Array(FRAME_SAMPLES);
    let filled = 0;

    const submitFloats = (floats: Float32Array) => {
      const usable = ratio === 1 ? floats.length : Math.floor(floats.length / ratio);
      for (let i = 0; i < usable; i++) {
        let sample = floats[i];
        if (ratio !== 1) {
          // Linear interpolation onto the 16 kHz grid: the context only honours
          // the requested rate where the browser allows it (Firefox does not).
          const position = i * ratio;
          const lower = Math.floor(position);
          const a = lower < floats.length ? floats[lower] : 0;
          const b = lower + 1 < floats.length ? floats[lower + 1] : a;
          sample = a + (b - a) * (position - lower);
        }
        const value = sample * 32767;
        frame[filled++] = value > 32767 ? 32767 : value < -32768 ? -32768 : value;
        if (filled === FRAME_SAMPLES) {
          // Hand over the whole 3200-byte frame and start the next buffer, so a
          // submitted frame is never mutated afterwards.
          onFrame(frame);
          frame = new Int16Array(FRAME_SAMPLES);
          filled = 0;
        }
      }
    };

    const tap = await createTap(ctx, submitFloats);
    // The graph only pulls audio through nodes that reach the destination, so
    // the tap has to be connected through this node or it never runs. Gain 0
    // keeps the microphone out of the speakers.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    source.connect(tap);
    tap.connect(sink);
    sink.connect(ctx.destination);

    let stopped = false;
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        filled = 0;
        for (const track of stream.getTracks()) track.stop();
        source.disconnect();
        tap.disconnect();
        sink.disconnect();
        void ctx.close().catch(() => {
          /* already closed */
        });
      },
    };
  } catch (error) {
    for (const track of stream.getTracks()) track.stop();
    throw error;
  }
}

/** 24 kHz PCM, scheduled AudioBufferSources, monotonic cursor so chunks never overlap or gap. */
export function createPcmPlayer(): PcmPlayer {
  const sources = new Set<AudioBufferSourceNode>();
  let cursor = 0;

  return {
    write(pcm16) {
      if (pcm16.length === 0) return;
      const ctx = outputContext();
      const buffer = ctx.createBuffer(1, pcm16.length, OUTPUT_RATE);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) channel[i] = pcm16[i] / 32768;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      // 30 ms of lead so a chunk is never scheduled in the past; after that the
      // cursor is what keeps consecutive chunks back to back.
      const startAt = Math.max(ctx.currentTime + 0.03, cursor);
      source.start(startAt);
      cursor = startAt + buffer.duration;
      sources.add(source);
      source.onended = () => {
        sources.delete(source);
      };
    },
    stop() {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          /* already ended */
        }
      }
      sources.clear();
      cursor = 0;
    },
    get speaking() {
      return outputCtx !== null && outputCtx.currentTime < cursor;
    },
  };
}

// One output AudioContext for the whole document. Unlike the mic capture it
// cannot be closed by stop(): an interruption flushes the queue mid-turn and
// the next turn is written to the same player, and closing/reopening a context
// per session would exhaust the browser's context budget.
let outputCtx: AudioContext | null = null;

function outputContext(): AudioContext {
  if (!outputCtx) outputCtx = createContext(OUTPUT_RATE);
  if (outputCtx.state === "suspended") void outputCtx.resume();
  return outputCtx;
}

function createContext(sampleRate: number): AudioContext {
  try {
    return new AudioContext({ sampleRate });
  } catch {
    // The browser refused the requested rate — take the device default and
    // resample in software (capture) or rely on the source node (playback).
    return new AudioContext();
  }
}

async function createTap(ctx: AudioContext, onFloats: (floats: Float32Array) => void): Promise<AudioNode> {
  if (ctx.audioWorklet) {
    const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: "application/javascript" }));
    try {
      await ctx.audioWorklet.addModule(url);
      const node = new AudioWorkletNode(ctx, WORKLET_NAME);
      node.port.onmessage = (event: MessageEvent<Float32Array>) => onFloats(event.data);
      return node;
    } catch {
      // Blob module blocked (CSP, or a browser without worklet support in this
      // context) — fall through to the ScriptProcessorNode tap.
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const node = ctx.createScriptProcessor(SCRIPTPROCESSOR_BLOCK, 1, 1);
  node.onaudioprocess = (event: AudioProcessingEvent) => onFloats(event.inputBuffer.getChannelData(0));
  return node;
}
