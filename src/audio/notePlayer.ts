import * as Tone from "tone";
import type { NoteName } from "../vision/gestures";

export const INSTRUMENTS = ["Piano", "Guitar", "Synth"] as const;
export type InstrumentName = (typeof INSTRUMENTS)[number];

const synth = new Tone.Synth({
  oscillator: { type: "triangle" },
  envelope: { attack: 0.005, decay: 0.22, sustain: 0.2, release: 0.45 },
}).toDestination();

synth.volume.value = -8;

let heldNote: NoteName | null = null;

export async function enableAudio(): Promise<void> {
  await Tone.start();
}

export function setInstrument(instrument: InstrumentName): void {
  if (heldNote !== null) {
    synth.triggerRelease();
    heldNote = null;
  }

  if (instrument === "Piano") {
    synth.set({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.22, sustain: 0.2, release: 0.45 },
    });
  } else if (instrument === "Guitar") {
    synth.set({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.003, decay: 0.28, sustain: 0.25, release: 0.3 },
    });
  } else {
    synth.set({
      oscillator: { type: "sine" },
      envelope: { attack: 0.015, decay: 0.08, sustain: 1, release: 0.35 },
    });
  }
}

export function holdNote(note: NoteName): void {
  if (heldNote === note) return;
  if (heldNote !== null) synth.triggerRelease();

  synth.triggerAttack(note);
  heldNote = note;
}

export function releaseNote(): void {
  if (heldNote === null) return;

  synth.triggerRelease();
  heldNote = null;
}