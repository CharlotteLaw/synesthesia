import * as Tone from "tone";
import type { NoteName } from "../vision/gestures";

const synth = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: { attack: 0.015, decay: 0.08, sustain: 1, release: 0.35 },
}).toDestination();

synth.volume.value = -8;

let heldNote: NoteName | null = null;

export async function enableAudio(): Promise<void> {
  await Tone.start();
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