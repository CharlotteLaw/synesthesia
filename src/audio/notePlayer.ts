import * as Tone from "tone";

export const CHORD_MODES = ["Major", "Minor"] as const;
export type ChordMode = (typeof CHORD_MODES)[number];
export const CHORD_DEGREES = [1, 2, 3, 4, 5] as const;
export type ChordDegree = (typeof CHORD_DEGREES)[number];

type ChordDefinition = {
  numeral: string;
  name: string;
  notes: readonly string[];
};

const CHORDS: Record<ChordMode, readonly ChordDefinition[]> = {
  Major: [
    { numeral: "I", name: "C", notes: ["C3", "E3", "G3", "C4"] },
    { numeral: "ii", name: "Dm", notes: ["D3", "F3", "A3", "D4"] },
    { numeral: "iii", name: "Em", notes: ["E3", "G3", "B3", "E4"] },
    { numeral: "IV", name: "F", notes: ["F2", "A2", "C3", "F3"] },
    { numeral: "V", name: "G", notes: ["G2", "B2", "D3", "G3"] },
  ],
  Minor: [
    { numeral: "i", name: "Am", notes: ["A2", "C3", "E3", "A3"] },
    { numeral: "ii°", name: "Bdim", notes: ["B2", "D3", "F3", "B3"] },
    { numeral: "III", name: "C", notes: ["C3", "E3", "G3", "C4"] },
    { numeral: "iv", name: "Dm", notes: ["D3", "F3", "A3", "D4"] },
    { numeral: "v", name: "Em", notes: ["E3", "G3", "B3", "E4"] },
  ],
};

const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.22 }).toDestination();
const synth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.035, decay: 0.7, sustain: 0.55, release: 1.4 },
}).connect(reverb);

synth.volume.value = -9;

let heldChordKey: string | null = null;
let heldNotes: readonly string[] = [];

export async function enableAudio(): Promise<void> {
  await Tone.start();
}

export function getChordName(degree: ChordDegree, mode: ChordMode): string {
  return CHORDS[mode][degree - 1].name;
}

export function getChordNumeral(degree: ChordDegree, mode: ChordMode): string {
  return CHORDS[mode][degree - 1].numeral;
}

export function holdChord(degree: ChordDegree, mode: ChordMode): void {
  const chordKey = `${mode}:${degree}`;
  if (heldChordKey === chordKey) return;
  releaseChord();

  heldNotes = CHORDS[mode][degree - 1].notes;
  synth.triggerAttack([...heldNotes]);
  heldChordKey = chordKey;
}

export function releaseChord(): void {
  if (heldNotes.length === 0) return;

  synth.triggerRelease([...heldNotes]);
  heldNotes = [];
  heldChordKey = null;
}