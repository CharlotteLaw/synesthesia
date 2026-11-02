# Synesthesia: product and interaction design

## What the app does today

Synesthesia is a browser-based hand-controlled chord instrument.

- The welcome screen asks before enabling the camera.
- The camera view uses MediaPipe hand landmarks and handedness labels to identify anatomical left and right hands.
- One through five raised fingers on either hand trigger the first through fifth chord in the current key and scale. Each hand has its own voice, so both hands can hold different chords at the same time; lowering one hand's fingers releases only that hand's chord.
- On-screen chord pads provide the same play action for pointer and keyboard users. Players choose either the chord-pad surface or progression-step surface at a time.
- Six four-chord progression presets are available for Major and Minor, with the chords transposed and named for the selected key. Each progression step can be played from its on-screen button.
- Triad, seventh, suspended-second, suspended-fourth, and add-nine chord types can be selected and are used consistently by hand gestures, pads, and progressions.
- Setup and Play modes separate settings gestures from playing. In Setup, one finger selects Major, two selects Minor, three/four step backward/forward through keys, and five cycles chord types.
- The player offers Warm pluck, Bright synth, and Airy bubbles synthesized Tone.js presets with a shared reverb effect. These are sound-inspired synth timbres, not sampled acoustic instruments.
- The camera screen has a key selector covering all twelve chromatic keys and Major/Minor scale buttons.
- Key, Scale, and Sound are presented together as peer settings.
- Chord names, Roman numerals, and intervals are generated for the selected key, scale, and chord type.

## What is missing or limited

- **Gesture testing:** Setup gestures are implemented, but their mapping still needs testing with players for clarity and reliability.
- **Sound selection:** The app has three synthesized sound presets. A realistic acoustic guitar is not available; Warm pluck is only string-like. Presets can be expanded or refined based on listening tests.
- **Chord vocabulary:** The app supports triad, seventh, sus2, sus4, and add9 voicings. Hand gestures and chord pads cover degrees I through V; progression presets can also use degrees VI and VII.
- **Responsive workspace:** The instrument panel had a 780px maximum width, so it stayed narrow on larger displays.

## Next milestone: gesture-based music setup

### Goal

Let a player configure their musical choices using their hand, then play without accidentally changing those choices mid-performance.

### Current interaction

Keep the current five-finger chord-playing interaction as the default. Add an explicit **Setup / Play** control:

1. In **Setup**, hand gestures change settings rather than play notes.
2. One finger selects Major, two selects Minor, three/four step backward/forward through keys, and five cycles the chord type.
3. The selected key, scale, and chord type are visible, and status text confirms changes.
4. Return to **Play** mode to use one through five fingers for chord degrees.
5. Key, scale, and chord type controls remain available as an accessible fallback.
6. Choose either the chord-pad surface or the progression-step surface so those two pad-based play surfaces are not displayed together.

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

- Does the current gesture mapping feel easy to learn for selecting scale, key, and chord type?
- Are the five chord types and six progression presets per scale useful, or should the available palette be adjusted?
- Should the acoustic-inspired preset use a synthesized pluck first, or wait for a guitar sample/library?
