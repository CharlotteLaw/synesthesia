import * as Tone from "tone";

export const CHORD_MODES = ["Major", "Minor"] as const;
export type ChordMode = (typeof CHORD_MODES)[number];
export const CHORD_KEYS = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
] as const;
export type ChordKey = (typeof CHORD_KEYS)[number];
export const CHORD_DEGREES = [1, 2, 3, 4, 5] as const;
export type ChordDegree = (typeof CHORD_DEGREES)[number];

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
  ],
  Minor: [
    { numeral: "i", rootOffset: 0, quality: "m", intervals: [0, 3, 7] },
    { numeral: "ii°", rootOffset: 2, quality: "dim", intervals: [0, 3, 6] },
    { numeral: "III", rootOffset: 3, quality: "", intervals: [0, 4, 7] },
    { numeral: "iv", rootOffset: 5, quality: "m", intervals: [0, 3, 7] },
    { numeral: "v", rootOffset: 7, quality: "m", intervals: [0, 3, 7] },
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

let reverb: Tone.Reverb | null = null;
let synth: Tone.PolySynth<Tone.Synth> | null = null;

function canUseAudio(): boolean {
  return typeof window !== "undefined" && "AudioContext" in window;
}

function ensureSynth(): Tone.PolySynth<Tone.Synth> | null {
  if (!canUseAudio()) {
    return null;
  }

  if (!synth) {
    reverb = new Tone.Reverb({ decay: 2.5, wet: 0.22 }).toDestination();
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.035, decay: 0.7, sustain: 0.55, release: 1.4 },
    }).connect(reverb);
    synth.volume.value = -9;
  }

  return synth;
}

let heldChordKey: string | null = null;
let heldNotes: readonly string[] = [];

export async function enableAudio(): Promise<void> {
  if (!canUseAudio()) {
    return;
  }

  await Tone.start();
  ensureSynth();
}

export function getChordName(degree: ChordDegree, mode: ChordMode, key: ChordKey): string {
  const { definition, rootName } = getChord(degree, mode, key);
  return `${rootName}${definition.quality}`;
}

export function getChordNumeral(degree: ChordDegree, mode: ChordMode, key: ChordKey): string {
  return getChord(degree, mode, key).definition.numeral;
}

export function holdChord(degree: ChordDegree, mode: ChordMode, key: ChordKey): void {
  const synthInstance = ensureSynth();
  if (!synthInstance) {
    return;
  }

  const chordKey = `${key}:${mode}:${degree}`;
  if (heldChordKey === chordKey) return;
  releaseChord();

  const { definition, rootMidi } = getChord(degree, mode, key);
  const preferFlats = prefersFlatNotation(key, mode);
  heldNotes = [...definition.intervals.map((interval) => midiToNote(rootMidi + interval, preferFlats)), midiToNote(rootMidi + 12, preferFlats)];
  synthInstance.triggerAttack([...heldNotes]);
  heldChordKey = chordKey;
}

export function releaseChord(): void {
  if (heldNotes.length === 0 || !synth) return;

  synth.triggerRelease([...heldNotes]);
  heldNotes = [];
  heldChordKey = null;
}