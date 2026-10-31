import * as Tone from "tone";

export const CHORD_MODES = ["Major", "Minor"] as const;
export type ChordMode = (typeof CHORD_MODES)[number];
export const CHORD_KEYS = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
] as const;
export type ChordKey = (typeof CHORD_KEYS)[number];
export const CHORD_DEGREES = [1, 2, 3, 4, 5] as const;
export type ChordDegree = (typeof CHORD_DEGREES)[number] | 6 | 7;
export const SOUND_PRESETS = ["Warm pluck", "Bright synth", "Airy bubbles"] as const;
export type SoundPreset = (typeof SOUND_PRESETS)[number];

type ChordDefinition = {
  numeral: string;
  rootOffset: number;
  quality: "" | "m" | "dim";
  intervals: readonly [number, number, number];
};

const CHORDS: Record<ChordMode, readonly ChordDefinition[]> = {
  Major: [
    { numeral: "I", rootOffset: 0, quality: "", intervals: [0, 4, 7] },
    { numeral: "ii", rootOffset: 2, quality: "m", intervals: [0, 3, 7] },
    { numeral: "iii", rootOffset: 4, quality: "m", intervals: [0, 3, 7] },
    { numeral: "IV", rootOffset: 5, quality: "", intervals: [0, 4, 7] },
    { numeral: "V", rootOffset: 7, quality: "", intervals: [0, 4, 7] },
    { numeral: "vi", rootOffset: 9, quality: "m", intervals: [0, 3, 7] },
    { numeral: "vii°", rootOffset: 11, quality: "dim", intervals: [0, 3, 6] },
  ],
  Minor: [
    { numeral: "i", rootOffset: 0, quality: "m", intervals: [0, 3, 7] },
    { numeral: "ii°", rootOffset: 2, quality: "dim", intervals: [0, 3, 6] },
    { numeral: "III", rootOffset: 3, quality: "", intervals: [0, 4, 7] },
    { numeral: "iv", rootOffset: 5, quality: "m", intervals: [0, 3, 7] },
    { numeral: "v", rootOffset: 7, quality: "m", intervals: [0, 3, 7] },
    { numeral: "VI", rootOffset: 8, quality: "", intervals: [0, 4, 7] },
    { numeral: "VII", rootOffset: 10, quality: "", intervals: [0, 4, 7] },
  ],
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const FLAT_KEYS: readonly ChordKey[] = ["F", "Db", "Eb", "Gb", "Ab", "Bb"];
const FLAT_MINOR_KEYS: readonly ChordKey[] = ["C", "G"];

function prefersFlatNotation(key: ChordKey, mode: ChordMode): boolean {
  return FLAT_KEYS.includes(key) || (mode === "Minor" && FLAT_MINOR_KEYS.includes(key));
}

function getChord(degree: ChordDegree, mode: ChordMode, key: ChordKey): {
  definition: ChordDefinition;
  rootMidi: number;
  rootName: string;
} {
  const definition = CHORDS[mode][degree - 1];
  const keyIndex = CHORD_KEYS.indexOf(key);
  const rootIndex = keyIndex + definition.rootOffset;
  const noteNames = prefersFlatNotation(key, mode) ? FLAT_NOTE_NAMES : NOTE_NAMES;

  return {
    definition,
    rootMidi: 48 + rootIndex,
    rootName: noteNames[rootIndex % noteNames.length],
  };
}

function midiToNote(midi: number, preferFlats = false): string {
  const noteNames = preferFlats ? FLAT_NOTE_NAMES : NOTE_NAMES;
  const noteName = noteNames[midi % noteNames.length];
  const octave = Math.floor(midi / noteNames.length) - 1;
  return `${noteName}${octave}`;
}

export type ChordVoice = "left" | "right" | "pad";

let reverb: Tone.Reverb | null = null;
const synths: Partial<Record<ChordVoice, Tone.PolySynth<Tone.Synth>>> = {};
const heldChords = new Map<ChordVoice, { key: string; notes: readonly string[] }>();
let selectedSound: SoundPreset = "Warm pluck";

function applySoundPreset(synth: Tone.PolySynth<Tone.Synth>, preset: SoundPreset): void {
  switch (preset) {
    case "Warm pluck":
      synth.set({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.012, decay: 0.48, sustain: 0.12, release: 0.55 },
      });
      synth.volume.value = -9;
      if (reverb) reverb.wet.value = 0.18;
      break;
    case "Bright synth":
      synth.set({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.008, decay: 0.32, sustain: 0.38, release: 0.24 },
      });
      synth.volume.value = -13;
      if (reverb) reverb.wet.value = 0.1;
      break;
    case "Airy bubbles":
      synth.set({
        oscillator: { type: "sine" },
        envelope: { attack: 0.04, decay: 0.9, sustain: 0.08, release: 1.25 },
      });
      synth.volume.value = -10;
      if (reverb) reverb.wet.value = 0.32;
      break;
  }
}

function canUseAudio(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const audioContextFactory =
    window.AudioContext ??
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  return typeof audioContextFactory === "function";
}

function ensureSynth(voice: ChordVoice): Tone.PolySynth<Tone.Synth> | null {
  if (!canUseAudio()) {
    return null;
  }

  if (!reverb) {
    reverb = new Tone.Reverb({ decay: 2.5, wet: 0.22 }).toDestination();
  }

  if (!synths[voice]) {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.012, decay: 0.48, sustain: 0.12, release: 0.55 },
    }).connect(reverb);
    applySoundPreset(synth, selectedSound);
    synths[voice] = synth;
  }

  return synths[voice] ?? null;
}

export async function enableAudio(): Promise<void> {
  if (!canUseAudio()) {
    throw new Error("Audio is not supported in this browser.");
  }

  await Tone.start();
  ensureSynth("pad");
}

export function setSoundPreset(preset: SoundPreset): void {
  if (preset === selectedSound) return;

  releaseChord();
  selectedSound = preset;

  for (const synth of Object.values(synths)) {
    if (synth) applySoundPreset(synth, preset);
  }
}

export function getChordName(degree: ChordDegree, mode: ChordMode, key: ChordKey): string {
  const { definition, rootName } = getChord(degree, mode, key);
  return `${rootName}${definition.quality}`;
}

export function getChordNumeral(degree: ChordDegree, mode: ChordMode, key: ChordKey): string {
  return getChord(degree, mode, key).definition.numeral;
}

export function holdChord(
  degree: ChordDegree,
  mode: ChordMode,
  key: ChordKey,
  voice: ChordVoice = "pad",
): void {
  const synthInstance = ensureSynth(voice);
  if (!synthInstance) {
    return;
  }

  const chordKey = `${key}:${mode}:${degree}`;
  if (heldChords.get(voice)?.key === chordKey) return;
  releaseChord(voice);

  const { definition, rootMidi } = getChord(degree, mode, key);
  const preferFlats = prefersFlatNotation(key, mode);
  const notes = [...definition.intervals.map((interval) => midiToNote(rootMidi + interval, preferFlats)), midiToNote(rootMidi + 12, preferFlats)];
  synthInstance.triggerAttack([...notes]);
  heldChords.set(voice, { key: chordKey, notes });
}

export function releaseChord(voice?: ChordVoice): void {
  const voices = voice ? [voice] : [...heldChords.keys()];

  for (const activeVoice of voices) {
    const heldChord = heldChords.get(activeVoice);
    const synth = synths[activeVoice];
    if (!heldChord || !synth) continue;

    synth.triggerRelease([...heldChord.notes]);
    heldChords.delete(activeVoice);
  }
}