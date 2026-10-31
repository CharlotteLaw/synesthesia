# Synesthesia: product and interaction design

## What the app does today

Synesthesia is a browser-based hand-controlled chord instrument.

- The welcome screen asks before enabling the camera.
- The camera view uses MediaPipe hand landmarks and handedness labels to identify anatomical left and right hands.
- One through five raised fingers on either hand trigger the first through fifth chord in the current key and scale. Each hand has its own voice, so both hands can hold different chords at the same time; lowering one hand's fingers releases only that hand's chord.
- On-screen chord pads provide the same play action for pointer and keyboard users.
- Common four-chord progression presets are available for Major and Minor, with the chords transposed and named for the selected key. Each progression step can be played from its on-screen button.
- The player offers Warm pluck, Bright synth, and Airy bubbles synthesized Tone.js presets with a shared reverb effect. These are sound-inspired synth timbres, not sampled acoustic instruments.
- The camera screen has a key selector covering all twelve chromatic keys and Major/Minor scale buttons.
- Key, Scale, and Sound are presented together as peer settings.
- Chord names, Roman numerals, and triad intervals are generated for the selected key and scale.

## What is missing or limited

- **Finger-based setup:** Key and scale are selected with on-screen controls. Fingers currently play chord degrees only; they do not choose Major/Minor or a chord quality.
- **Sound selection:** The app has three synthesized sound presets. A realistic acoustic guitar is not available; Warm pluck is only string-like. Presets can be expanded or refined based on listening tests.
- **Chord vocabulary:** Hand gestures and the original five chord pads cover degrees I through V; progression presets can also use degrees VI and VII. Users cannot choose a separate chord quality such as seventh, suspended, or an alternate voicing.
- **Responsive workspace:** The instrument panel had a 780px maximum width, so it stayed narrow on larger displays.

## Next milestone: gesture-based music setup

### Goal

Let a player configure their musical choices using their hand, then play without accidentally changing those choices mid-performance.

### Proposed interaction

Keep the current five-finger chord-playing interaction as the default. Add an explicit **Setup / Play** control:

1. In **Setup**, show a clear prompt that hand gestures change settings rather than play notes.
2. Use a simple, visible gesture mapping to select Major or Minor and the available chord type. The exact mapping should be tested with players before it is treated as final; it must not conflict with the existing 1–5 chord-playing gestures.
3. Show the selected key, scale, and chord type in the interface and provide immediate visual confirmation after a gesture.
4. Return to **Play** mode to use one through five fingers for chord degrees, with the on-screen pads remaining available.
5. Keep existing key and scale controls usable as an accessible fallback.

### Acceptance checks

- A player can enter and leave Setup intentionally; playing gestures do not silently change settings.
- Major/Minor and each supported chord type can be selected and are visibly confirmed.
- Switching settings releases any currently held chord and the next played chord uses the new settings.
- One-to-five finger chord playing works independently for anatomical left and right hands; pointer/keyboard pads continue to work in Play mode.
- Hand identity is based on handedness labels, not detection order or screen position, and works with the mirrored camera preview.
- Gesture recognition is stable enough to avoid rapid accidental switching; show a prompt when no supported gesture is recognized.

## Sound palette

Add a **Sound** selector for a small, clearly named set of presets:

- **Warm pluck** — a soft, string-like sound as an initial acoustic-inspired option. Do not label it a realistic guitar unless a suitable sample/instrument is used.
- **Bright synth** — a crisp, punchy electronic tone for an EDM-inspired feel.
- **Airy bubbles** — a light, rounded bell/pluck tone with a softer attack and lingering, gentle ambience.

The selected sound applies consistently to both hands and chord pads. A later iteration can consider sampled acoustic guitar and more detailed sound controls.

### Acceptance checks

- The selected preset is visible and can be changed without changing key, scale, or chord.
- Each preset is audibly distinct at a comfortable volume and works for both sustained gestures and pad presses.
- Changing presets releases held notes and allows active hand gestures to trigger using the new sound; it does not leave stuck notes or create competing synths.
- Audio startup errors remain visible to the player.

## Current UI change

The instrument workspace now uses more of the available screen width, with a larger desktop maximum and a wide camera frame. The welcome panel remains intentionally narrower, and page gutters still adapt for small screens.

## Product decisions to confirm

- Which chord types should be available beyond the current scale-derived triads?
- Which gesture mapping feels easiest for selecting scale and chord type? Test the proposed Setup / Play separation before locking the mapping.
- Should the acoustic-inspired preset use a synthesized pluck first, or wait for a guitar sample/library?
