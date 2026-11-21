// audio.js — every sound in Ember Thief, synthesised with WebAudio.
//
// No audio files are shipped: footsteps, pebble clicks, the alarm
// sting and the win arpeggio are all built from oscillators and
// filtered noise at run time. The engine stays silent until the
// player first interacts with the page (browsers require a gesture),
// and every call is a no-op when sound is unavailable.

/** Create the sound engine. Call ensureStarted() from a user gesture. */
export function createSoundEngine() {
  let context = null;
  let master = null;
  let muted = false;

  function ensureContext() {
    if (context) return context;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
    return context;
  }

  /** Start (or resume) audio. Safe to call from any click or keypress. */
  function ensureStarted() {
    const ctx = ensureContext();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  /** A short burst of filtered noise, the building block of footsteps. */
  function noiseBurst({ duration, frequency, gain, when = 0 }) {
    const ctx = ensureContext();
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter).connect(amp).connect(master);
    source.start(t);
  }

  /** A single sine note with a quick decay, for chimes and stings. */
  function tone({ frequency, duration, gain, type = 'sine', when = 0 }) {
    const ctx = ensureContext();
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(amp).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  return {
    ensureStarted,

    /** Toggle sound on/off; returns the new muted state. */
    toggleMute() {
      muted = !muted;
      return muted;
    },

    /** A footstep. `loudness` 0..1 (sneaking is quieter and softer). */
    footstep(loudness) {
      noiseBurst({ duration: 0.07, frequency: 320 + loudness * 500, gain: 0.05 + loudness * 0.22 });
    },

    /**
     * A guard's footstep, heard from `distancePx` away: closer guards
     * sound louder and lower, so the player can judge where one is.
     */
    guardFootstep(distancePx) {
      const closeness = Math.max(0, 1 - distancePx / 340);
      if (closeness <= 0.02) return;
      noiseBurst({
        duration: 0.09,
        frequency: 260 + closeness * 240,
        gain: 0.04 + closeness * 0.3,
      });
    },

    /** The clink of a thrown pebble landing. */
    pebble() {
      tone({ frequency: 1900, duration: 0.09, gain: 0.12, type: 'triangle' });
      tone({ frequency: 1250, duration: 0.12, gain: 0.08, type: 'triangle', when: 0.03 });
    },

    /** The bright chime of picking up an ember shard. */
    pickup() {
      tone({ frequency: 660, duration: 0.16, gain: 0.16 });
      tone({ frequency: 990, duration: 0.22, gain: 0.14, when: 0.07 });
    },

    /** The two-note sting when a guard spots the thief. */
    alarm() {
      tone({ frequency: 220, duration: 0.28, gain: 0.2, type: 'sawtooth' });
      tone({ frequency: 311, duration: 0.34, gain: 0.2, type: 'sawtooth', when: 0.12 });
    },

    /** A soft "hmm?" blip when a guard grows suspicious. */
    suspicious() {
      tone({ frequency: 392, duration: 0.12, gain: 0.1, type: 'triangle' });
    },

    /** The low thud of being caught. */
    caught() {
      tone({ frequency: 110, duration: 0.4, gain: 0.22, type: 'sawtooth' });
      tone({ frequency: 82, duration: 0.5, gain: 0.18, type: 'sawtooth', when: 0.1 });
    },

    /** The moon gate opening: a rising shimmer. */
    gateOpen() {
      tone({ frequency: 523, duration: 0.3, gain: 0.12 });
      tone({ frequency: 659, duration: 0.3, gain: 0.12, when: 0.09 });
      tone({ frequency: 784, duration: 0.4, gain: 0.12, when: 0.18 });
    },

    /** The win arpeggio at the end of the third level. */
    win() {
      [523, 659, 784, 1047, 1319].forEach((freq, i) => {
        tone({ frequency: freq, duration: 0.4, gain: 0.14, when: i * 0.11 });
      });
    },
  };
}
