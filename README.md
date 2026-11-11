# Synesthesia

Synesthesia is a browser-based hand-controlled chord instrument. It uses a webcam and MediaPipe hand tracking to turn finger counts into chords, with Tone.js generating the sound.

## What works now

- The app asks before turning on the camera.
- One through five raised fingers on either hand play chord degrees I through V in the selected key and Major/Minor scale.
- Left and right hands have independent voices, so they can play different chords at the same time. Releasing one hand does not release the other.
- On-screen chord pads support pointer and keyboard input. Choose either chord pads or progression steps as the pad-playing surface; they are not shown together.
- Six four-chord progression presets are available for each scale, with playable buttons for individual steps.
- Triad, 7th, Sus2, Sus4, and Add9 chord types are available across hand gestures, pads, and progressions.
- Setup mode lets gestures select Major/Minor, step through keys, and cycle chord types without playing notes. Play mode retains the 1–5 finger chord controls.
- The instrument screen has Key, Scale, Chord type, and Sound controls grouped together.
- The Sound selector offers Warm pluck, Bright synth, and Airy bubbles.
- An optional metronome provides an accented four-beat bar and an adjustable tempo from 40 to 240 BPM.
- The instrument layout uses a wider camera view and workspace on larger screens.

## Current limitations

- Three synthesized sound styles are available: Warm pluck, Bright synth, and Airy bubbles. These are sound-inspired synth timbres, not sampled guitar or other realistic instruments.
- Hand gestures and chord pads play degrees I through V. Progression presets can also use degrees VI and VII.
- Hand tracking should be tested in the target browsers and lighting conditions, especially the left/right labels with the mirrored preview.

## What happens next

The next step is player testing: check whether the setup gestures and chord labels are easy to understand, and whether the expanded chord types and progression choices sound useful on real devices.

See the [design doc](./docs/design.md) for the fuller product status, interaction, and acceptance checks. The gesture mapping and expanded chord palette should be validated with players.

## Run locally

```sh
npm install
npm run dev
```

Run the gesture regression tests with:

```sh
npm test
```

Camera access requires browser permission and a secure context (localhost is supported).

## Validate

```sh
npm run build
npm run lint
```
