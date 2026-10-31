# Synesthesia

Synesthesia is a browser-based hand-controlled chord instrument. It uses a webcam and MediaPipe hand tracking to turn finger counts into chords, with Tone.js generating the sound.

## What works now

- The app asks before turning on the camera.
- One through five raised fingers on either hand play chord degrees I through V in the selected key and Major/Minor scale.
- Left and right hands have independent voices, so they can play different chords at the same time. Releasing one hand does not release the other.
- On-screen chord pads also play the chords and support pointer and keyboard input.
- Common four-chord progression presets show the chord names in the selected key and scale, with a playable button for each step.
- The instrument screen has Key, Scale, and Sound controls grouped together.
- The Sound selector offers Warm pluck, Bright synth, and Airy bubbles.
- The instrument layout uses a wider camera view and workspace on larger screens.

## Current limitations

- Three synthesized sound styles are available: Warm pluck, Bright synth, and Airy bubbles. These are sound-inspired synth timbres, not sampled guitar or other realistic instruments.
- Hand gestures and the original chord pads play degrees I through V. Progression presets can also use degrees VI and VII; chord qualities such as seventh and suspended chords are not selectable.
- Fingers are currently used to play chords, not to change key, scale, or chord type.
- Hand tracking should be tested in the target browsers and lighting conditions, especially the left/right labels with the mirrored preview.

## What happens next

The next milestone is **gesture-based music setup**:

1. Add explicit **Setup** and **Play** modes so settings gestures cannot accidentally trigger chords.
2. Let the player choose Major/Minor and a chord type in Setup, with visible confirmation.
3. Keep the existing five-finger chord playing in Play, independently for each hand.
4. Keep on-screen controls as an accessible fallback.

The sound palette is implemented. A natural next step is to test the three presets on real devices, then build Setup / Play mode for hand-driven key, scale, and chord-type selection.

See the [design doc](./docs/design.md) for the fuller product status, proposed interaction, and acceptance checks. The exact Setup gesture mapping and the chord types to support still need product decisions and player testing.

## Run locally

```sh
npm install
npm run dev
```

Camera access requires browser permission and a secure context (localhost is supported).

## Validate

```sh
npm run build
npm run lint
```
