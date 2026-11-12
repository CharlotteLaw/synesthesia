import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHORD_DEGREES,
  CHORD_KEYS,
  CHORD_MODES,
  CHORD_TYPES,
  DEFAULT_METRONOME_BPM,
  METRONOME_MAX_BPM,
  METRONOME_MIN_BPM,
  SOUND_PRESETS,
  getChordName,
  getChordNumeral,
  holdChord,
  releaseChord,
  setMetronomeTempo,
  setSoundPreset,
  startMetronome,
  stopMetronome,
} from "../audio/notePlayer";
import type { ChordDegree, ChordKey, ChordMode, ChordType, SoundPreset } from "../audio/notePlayer";
import {
  getRaisedFingerCount,
} from "../vision/gestures";
import { startHandTracking } from "../vision/handTracker";
import type { HandSide, TrackedHand } from "../vision/handTracker";

type SessionMode = "setup" | "play";
const GESTURE_SAMPLE_WINDOW = 5;
const GESTURE_SAMPLE_THRESHOLD = 3;

type ProgressionPreset = {
  id: string;
  name: string;
  degrees: readonly ChordDegree[];
};

const MAJOR_PROGRESSION_PRESETS: readonly ProgressionPreset[] = [
  { id: "pop", name: "Pop", degrees: [1, 5, 6, 4] },
  { id: "emotional", name: "Emotional", degrees: [6, 4, 1, 5] },
  { id: "classic", name: "Classic", degrees: [1, 6, 4, 5] },
  { id: "singer-songwriter", name: "Singer-songwriter", degrees: [1, 4, 5, 4] },
  { id: "dreamy", name: "Dreamy", degrees: [1, 3, 4, 5] },
  { id: "modern-pop", name: "Modern pop", degrees: [4, 1, 5, 6] },
];

const MINOR_PROGRESSION_PRESETS: readonly ProgressionPreset[] = [
  { id: "minor-pop", name: "Minor pop", degrees: [1, 7, 6, 7] },
  { id: "emotional-minor", name: "Emotional minor", degrees: [1, 6, 3, 7] },
  { id: "minor-lift", name: "Minor lift", degrees: [1, 4, 6, 7] },
  { id: "dark", name: "Dark", degrees: [1, 6, 4, 5] },
  { id: "cinematic", name: "Cinematic", degrees: [1, 3, 6, 7] },
  { id: "dorian", name: "Dorian", degrees: [1, 4, 7, 3] },
];

function isChordKey(value: string): value is ChordKey {
  return CHORD_KEYS.some((key) => key === value);
}

function isSoundPreset(value: string): value is SoundPreset {
  return SOUND_PRESETS.some((sound) => sound === value);
}

function getActiveChordDegrees(
  left: ChordDegree | null,
  right: ChordDegree | null,
  pad: ChordDegree | null,
): ChordDegree[] {
  return [...new Set([left, right, pad].filter((degree): degree is ChordDegree => degree !== null))];
}

function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraViewRef = useRef<HTMLDivElement>(null);
  const activeHandDegreesRef = useRef<Record<HandSide, ChordDegree | null>>({
    left: null,
    right: null,
  });
  const candidateDegreesRef = useRef<Record<HandSide, ChordDegree | null>>({
    left: null,
    right: null,
  });
  const gestureHistoryRef = useRef<Record<HandSide, Array<number | null>>>({
    left: [],
    right: [],
  });
  const candidateSinceRefs = useRef<Record<HandSide, number>>({ left: 0, right: 0 });
  const activePadDegreeRef = useRef<ChordDegree | null>(null);
  const modeRef = useRef<ChordMode>("Major");
  const keyRef = useRef<ChordKey>("C");
  const chordTypeRef = useRef<ChordType>("Triad");
  const sessionModeRef = useRef<SessionMode>("play");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Starting camera...");
  const [activeDegrees, setActiveDegrees] = useState<ChordDegree[]>([]);
  const [modeState, setModeState] = useState<SessionMode>("play");
  const [selectedMode, setSelectedMode] = useState<ChordMode>("Major");
  const [selectedKey, setSelectedKey] = useState<ChordKey>("C");
  const [selectedSound, setSelectedSound] = useState<SoundPreset>("Warm pluck");
  const [selectedChordType, setSelectedChordType] = useState<ChordType>("Triad");
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [metronomeTempo, setMetronomeTempoState] = useState(DEFAULT_METRONOME_BPM);
  const [selectedProgressionId, setSelectedProgressionId] = useState("pop");
  const [playSource, setPlaySource] = useState<"chords" | "progression">("chords");
  const progressionPresets = selectedMode === "Major"
    ? MAJOR_PROGRESSION_PRESETS
    : MINOR_PROGRESSION_PRESETS;
  const selectedProgression = progressionPresets.find(
    (progression) => progression.id === selectedProgressionId,
  ) ?? progressionPresets[0];
  const setupPrompt = "Setup mode: 1 finger = Major, 2 = Minor, 3/4 = previous/next key, 5 = next chord type. Switch to Play when ready.";

  const setStatusMessage = useCallback((nextStatus: string) => {
    setStatus((currentStatus) => (
      currentStatus === nextStatus ? currentStatus : nextStatus
    ));
  }, []);

  const chooseChordSettings = useCallback((mode: ChordMode, key: ChordKey) => {
    if (modeRef.current === mode && keyRef.current === key) return;

    modeRef.current = mode;
    keyRef.current = key;
    setSelectedMode(mode);
    setSelectedKey(key);
    activeHandDegreesRef.current = { left: null, right: null };
    candidateDegreesRef.current = { left: null, right: null };
    candidateSinceRefs.current = { left: 0, right: 0 };
    activePadDegreeRef.current = null;
    releaseChord();
    setActiveDegrees([]);
    setStatusMessage(sessionModeRef.current === "setup"
      ? `Setup: ${mode} ${key} selected`
      : "Camera ready");
  }, [setStatusMessage]);

  const switchMode = useCallback((nextMode: SessionMode) => {
    if (nextMode === sessionModeRef.current) return;

    sessionModeRef.current = nextMode;
    setModeState(nextMode);
    activeHandDegreesRef.current = { left: null, right: null };
    candidateDegreesRef.current = { left: null, right: null };
    candidateSinceRefs.current = { left: 0, right: 0 };
    activePadDegreeRef.current = null;
    releaseChord();
    setActiveDegrees([]);
    setStatusMessage(nextMode === "setup"
      ? setupPrompt
      : "Play mode: raise 1–5 fingers with either hand or press a chord button");
  }, [setStatusMessage, setupPrompt]);

  const advanceKey = useCallback((direction: "next" | "previous") => {
    const currentIndex = CHORD_KEYS.indexOf(keyRef.current);
    const nextIndex = direction === "next"
      ? (currentIndex + 1) % CHORD_KEYS.length
      : (currentIndex - 1 + CHORD_KEYS.length) % CHORD_KEYS.length;
    const nextKey = CHORD_KEYS[nextIndex];
    chooseChordSettings(modeRef.current, nextKey);
  }, [chooseChordSettings]);

  const chooseChordType = useCallback((chordType: ChordType) => {
    if (chordTypeRef.current === chordType) return;

    chordTypeRef.current = chordType;
    setSelectedChordType(chordType);
    activeHandDegreesRef.current = { left: null, right: null };
    candidateDegreesRef.current = { left: null, right: null };
    candidateSinceRefs.current = { left: 0, right: 0 };
    activePadDegreeRef.current = null;
    releaseChord();
    setActiveDegrees([]);
    setStatusMessage(sessionModeRef.current === "setup"
      ? `Setup: ${chordType} chords selected.`
      : `${chordType} chords selected.`);
  }, [setStatusMessage]);

  const applySetupGesture = useCallback((detectedDegree: ChordDegree) => {
    if (detectedDegree === 1) {
      chooseChordSettings("Major", keyRef.current);
      setStatus("Setup: Major selected. Switch to Play to start playing chords.");
      return;
    }

    if (detectedDegree === 2) {
      chooseChordSettings("Minor", keyRef.current);
      setStatus("Setup: Minor selected. Switch to Play to start playing chords.");
      return;
    }

    if (detectedDegree === 3) {
      advanceKey("previous");
      setStatus(`Setup: key set to ${keyRef.current}.`);
      return;
    }

    if (detectedDegree === 4) {
      advanceKey("next");
      setStatus(`Setup: key set to ${keyRef.current}.`);
      return;
    }

    if (detectedDegree === 5) {
      const currentIndex = CHORD_TYPES.indexOf(chordTypeRef.current);
      const nextType = CHORD_TYPES[(currentIndex + 1) % CHORD_TYPES.length];
      chooseChordType(nextType);
    }
  }, [advanceKey, chooseChordSettings, chooseChordType]);

  const chooseSound = (sound: SoundPreset) => {
    if (sound === selectedSound) return;

    setSoundPreset(sound);
    setSelectedSound(sound);
    activeHandDegreesRef.current = { left: null, right: null };
    candidateDegreesRef.current = { left: null, right: null };
    candidateSinceRefs.current = { left: 0, right: 0 };
    activePadDegreeRef.current = null;
    setActiveDegrees([]);
    setStatus(`${sound} sound selected`);
  };

  const changeMetronomeTempo = (tempo: number) => {
    if (
      !Number.isInteger(tempo) ||
      tempo < METRONOME_MIN_BPM ||
      tempo > METRONOME_MAX_BPM
    ) {
      return;
    }

    setMetronomeTempoState(tempo);
    setMetronomeTempo(tempo);
  };

  const toggleMetronome = async () => {
    if (metronomeEnabled) {
      stopMetronome();
      setMetronomeEnabled(false);
      setStatus("Metronome stopped");
      return;
    }

    try {
      await startMetronome(metronomeTempo);
      setMetronomeEnabled(true);
      setStatus(`Metronome playing at ${metronomeTempo} BPM`);
    } catch (err) {
      console.error("Could not start metronome:", err);
      setStatus(`Metronome unavailable: ${
        err instanceof Error ? err.message : "Could not start audio."
      }`);
    }
  };

  const switchPlaySource = (source: "chords" | "progression") => {
    if (source === playSource) return;

    releaseChord("pad");
    activePadDegreeRef.current = null;
    setActiveDegrees(getActiveChordDegrees(
      activeHandDegreesRef.current.left,
      activeHandDegreesRef.current.right,
      null,
    ));
    setPlaySource(source);
  };

  const startPadChord = (degree: ChordDegree) => {
    if (modeState === "setup") {
      setStatus("Setup mode: switch to Play to trigger chords.");
      return;
    }

    holdChord(degree, modeRef.current, keyRef.current, "pad", chordTypeRef.current);
    activePadDegreeRef.current = degree;
    setActiveDegrees(getActiveChordDegrees(
      activeHandDegreesRef.current.left,
      activeHandDegreesRef.current.right,
      activePadDegreeRef.current,
    ));
    setStatus(`${getChordName(degree, modeRef.current, keyRef.current, chordTypeRef.current)} playing`);
  };

  const stopPadChord = () => {
    releaseChord("pad");
    activePadDegreeRef.current = null;
    setActiveDegrees(getActiveChordDegrees(
      activeHandDegreesRef.current.left,
      activeHandDegreesRef.current.right,
      activePadDegreeRef.current,
    ));
    if (modeState === "setup") {
      setStatus("Setup mode: choose a key and scale, then switch to Play.");
      return;
    }
    const activeSide = activeHandDegreesRef.current.right ? "right" : "left";
    const activeHandDegree = activeHandDegreesRef.current[activeSide];
    setStatus(activeHandDegree
      ? `${activeSide === "left" ? "Left" : "Right"} hand: ${getChordName(activeHandDegree, modeRef.current, keyRef.current, chordTypeRef.current)} playing`
      : "Waiting for a hand");
  };

  const drawLandmarks = useCallback((hands: TrackedHand[], timestamp: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!video || !canvas || !context || !video.videoWidth) return;

    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#b7ff56";
    context.strokeStyle = "#142018";
    context.lineWidth = Math.max(2, canvas.width * 0.003);

    for (const hand of hands) {
      for (const landmark of hand.landmarks) {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        const radius = Math.max(4, canvas.width * 0.007);

        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }

      const indexTip = hand.landmarks[8];
      if (indexTip) {
        context.beginPath();
        context.arc(
          indexTip.x * canvas.width,
          indexTip.y * canvas.height,
          Math.max(12, canvas.width * 0.018),
          0,
          Math.PI * 2,
        );
        context.strokeStyle = "#b7ff56";
        context.lineWidth = Math.max(3, canvas.width * 0.004);
        context.stroke();
      }
    }

    const hasHand = hands.length > 0;

    for (const side of ["left", "right"] as const) {
      const hand = hands.find((trackedHand) => trackedHand.side === side);
      const sampledCount = hand ? getRaisedFingerCount(hand.landmarks) : null;
      const history = gestureHistoryRef.current[side];
      history.push(sampledCount);
      if (history.length > GESTURE_SAMPLE_WINDOW) history.shift();

      const countVotes = new Map<number | null, number>();
      for (const count of history) {
        countVotes.set(count, (countVotes.get(count) ?? 0) + 1);
      }
      const consensus = [...countVotes].find(
        ([, votes]) => votes >= GESTURE_SAMPLE_THRESHOLD,
      );
      const detectedCount = consensus
        ? consensus[0]
        : activeHandDegreesRef.current[side];
      const detectedDegree =
        detectedCount && detectedCount <= CHORD_DEGREES.length
          ? detectedCount as ChordDegree
          : null;

      if (candidateDegreesRef.current[side] !== detectedDegree) {
        candidateDegreesRef.current[side] = detectedDegree;
        candidateSinceRefs.current[side] = timestamp;
      }

      if (sessionModeRef.current === "setup") {
        if (detectedDegree === null) {
          if (activeHandDegreesRef.current[side] !== null) {
            activeHandDegreesRef.current[side] = null;
            setStatusMessage(setupPrompt);
          }
          if (hasHand && activeHandDegreesRef.current.left === null && activeHandDegreesRef.current.right === null) {
            setStatusMessage(setupPrompt);
          }
          continue;
        }

        if (
          timestamp - candidateSinceRefs.current[side] < 220 ||
          activeHandDegreesRef.current[side] === detectedDegree
        ) {
          continue;
        }

        activeHandDegreesRef.current[side] = detectedDegree;
        applySetupGesture(detectedDegree);
        continue;
      }

      if (
        timestamp - candidateSinceRefs.current[side] < 220 ||
        activeHandDegreesRef.current[side] === detectedDegree
      ) {
        continue;
      }

      activeHandDegreesRef.current[side] = detectedDegree;
      if (detectedDegree) {
        holdChord(detectedDegree, modeRef.current, keyRef.current, side, chordTypeRef.current);
        setActiveDegrees(getActiveChordDegrees(
          activeHandDegreesRef.current.left,
          activeHandDegreesRef.current.right,
          activePadDegreeRef.current,
        ));
        setStatus(`${side === "left" ? "Left" : "Right"} hand: ${getChordName(detectedDegree, modeRef.current, keyRef.current, chordTypeRef.current)} playing`);
      } else {
        releaseChord(side);
        setActiveDegrees(getActiveChordDegrees(
          activeHandDegreesRef.current.left,
          activeHandDegreesRef.current.right,
          activePadDegreeRef.current,
        ));
        if (activeHandDegreesRef.current.left === null && activeHandDegreesRef.current.right === null) {
          setStatus(activePadDegreeRef.current
            ? `${getChordName(activePadDegreeRef.current, modeRef.current, keyRef.current, chordTypeRef.current)} playing`
            : hasHand
              ? "Hand detected · raise 1–5 fingers with either hand"
              : "Waiting for a hand");
        } else {
          const activeSide = activeHandDegreesRef.current.right ? "right" : "left";
          const activeHandDegree = activeHandDegreesRef.current[activeSide];
          if (activeHandDegree) {
            setStatus(`${activeSide === "left" ? "Left" : "Right"} hand: ${getChordName(activeHandDegree, modeRef.current, keyRef.current, chordTypeRef.current)} playing`);
          }
        }
      }
    }
  }, [applySetupGesture, setStatusMessage, setupPrompt]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopTracking: (() => void) | undefined;
    let active = true;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();
        setStatus("Loading hand tracker...");

        const stop = await startHandTracking(video, drawLandmarks);
        if (!active) {
          stop();
          return;
        }

        stopTracking = stop;
        setStatus("Camera ready");
      } catch (err) {
        console.error("Camera error:", err);
        if (active) {
          setError(
            err instanceof Error ? err.message : "Could not start hand tracking.",
          );
        }
      }
    };

    startCamera();

    return () => {
      active = false;
      stopTracking?.();
      releaseChord();
      stopMetronome();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [drawLandmarks]);

  return (
    <div className="camera-shell">
      <div className="camera-view" ref={cameraViewRef}>
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
      <div className="chord-settings" role="group" aria-label="Instrument settings">
        <div className="mode-selector setting-card session-mode" role="group" aria-label="Session mode">
          <span className="settings-label">Mode</span>
          {(["setup", "play"] as const).map((sessionMode) => (
            <button
              key={sessionMode}
              className="mode-option"
              type="button"
              aria-pressed={modeState === sessionMode}
              onClick={() => switchMode(sessionMode)}
            >
              {sessionMode === "setup" ? "Setup" : "Play"}
            </button>
          ))}
        </div>
        {modeState === "setup" && (
          <p className="gesture-guide" aria-live="polite">
            Gesture guide: 1 = Major · 2 = Minor · 3/4 = previous/next key · 5 = next chord type
          </p>
        )}
        <label className="key-selector setting-card">
          <span>Key</span>
          <select
            value={selectedKey}
            onChange={(event) => {
              if (isChordKey(event.target.value)) {
                chooseChordSettings(selectedMode, event.target.value);
              }
            }}
          >
            {CHORD_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
        </label>
        <div className="mode-selector setting-card" role="group" aria-label="Scale mode">
          <span className="settings-label">Scale</span>
          {CHORD_MODES.map((mode) => (
            <button
              key={mode}
              className="mode-option"
              type="button"
              aria-pressed={selectedMode === mode}
              onClick={() => chooseChordSettings(mode, selectedKey)}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="mode-selector setting-card chord-type-setting" role="group" aria-label="Chord type">
          <span className="settings-label">Chord type</span>
          {CHORD_TYPES.map((chordType) => (
            <button
              key={chordType}
              className="mode-option"
              type="button"
              aria-pressed={selectedChordType === chordType}
              onClick={() => chooseChordType(chordType)}
            >
              {chordType}
            </button>
          ))}
        </div>
        <label className="key-selector setting-card">
          <span>Sound</span>
          <select
            value={selectedSound}
            onChange={(event) => {
              if (isSoundPreset(event.target.value)) {
                chooseSound(event.target.value);
              }
            }}
          >
            {SOUND_PRESETS.map((sound) => <option key={sound} value={sound}>{sound}</option>)}
          </select>
        </label>
        <div className="metronome-setting setting-card" role="group" aria-label="Metronome">
          <span className="settings-label">Metronome</span>
          <label className="tempo-control">
            <span>Tempo</span>
            <input
              type="number"
              min={METRONOME_MIN_BPM}
              max={METRONOME_MAX_BPM}
              step="1"
              value={metronomeTempo}
              aria-label="Metronome tempo in beats per minute"
              onChange={(event) => changeMetronomeTempo(Number(event.target.value))}
            />
            <span>BPM</span>
          </label>
          <input
            className="tempo-slider"
            type="range"
            min={METRONOME_MIN_BPM}
            max={METRONOME_MAX_BPM}
            step="1"
            value={metronomeTempo}
            aria-label="Adjust metronome tempo"
            onChange={(event) => changeMetronomeTempo(Number(event.target.value))}
          />
          <button
            className="mode-option metronome-toggle"
            type="button"
            aria-pressed={metronomeEnabled}
            onClick={() => void toggleMetronome()}
          >
            {metronomeEnabled ? "Stop" : "Start"}
          </button>
        </div>
      </div>
      <div className="mode-selector play-source-selector" role="group" aria-label="Play using">
        <span className="settings-label">Play using</span>
        <button
          className="mode-option"
          type="button"
          aria-pressed={playSource === "chords"}
          onClick={() => switchPlaySource("chords")}
        >
          Chord pads
        </button>
        <button
          className="mode-option"
          type="button"
          aria-pressed={playSource === "progression"}
          onClick={() => switchPlaySource("progression")}
        >
          Progressions
        </button>
      </div>
      <p className="chord-instructions">{modeState === "setup" ? "Setup controls" : playSource === "chords" ? "Chord buttons" : "Progression steps"} <span>{modeState === "setup" ? "Keep settings stable before you play" : playSource === "chords" ? "Press a button or raise 1–5 fingers with either hand" : "Choose a pattern, then play its steps one at a time"}</span></p>
      {playSource === "chords" ? (
        <div className="chord-keys" role="group" aria-label="Play chords">
          {CHORD_DEGREES.map((degree) => (
            <button
              key={degree}
              className="chord-key"
              type="button"
              aria-label={`${getChordName(degree, selectedMode, selectedKey, selectedChordType)} chord, ${getChordNumeral(degree, selectedMode, selectedKey, selectedChordType)} degree`}
              aria-pressed={activeDegrees.includes(degree)}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                startPadChord(degree);
              }}
              onPointerUp={stopPadChord}
              onPointerCancel={stopPadChord}
              onKeyDown={(event) => {
                if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                  event.preventDefault();
                  startPadChord(degree);
                }
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") stopPadChord();
              }}
              onBlur={stopPadChord}
            >
              <span className="chord-name">{getChordName(degree, selectedMode, selectedKey, selectedChordType)}</span>
              <span className="chord-degree">{getChordNumeral(degree, selectedMode, selectedKey, selectedChordType)} chord</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <label className="key-selector progression-selector">
            <span>Pattern</span>
            <select
              value={selectedProgression.id}
              onChange={(event) => setSelectedProgressionId(event.target.value)}
            >
              {progressionPresets.map((progression) => (
                <option key={progression.id} value={progression.id}>
                  {progression.name} · {progression.degrees.join("–")}
                </option>
              ))}
            </select>
          </label>
          <div className="chord-keys progression-keys" role="group" aria-label={`${selectedProgression.name} progression`}>
            {selectedProgression.degrees.map((degree, index) => (
              <button
                key={`${selectedProgression.id}-${index}`}
                className="chord-key"
                type="button"
                aria-label={`Step ${index + 1}: ${getChordName(degree, selectedMode, selectedKey, selectedChordType)} chord, ${getChordNumeral(degree, selectedMode, selectedKey, selectedChordType)} degree`}
                aria-pressed={activeDegrees.includes(degree)}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  startPadChord(degree);
                }}
                onPointerUp={stopPadChord}
                onPointerCancel={stopPadChord}
                onKeyDown={(event) => {
                  if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                    event.preventDefault();
                    startPadChord(degree);
                  }
                }}
                onKeyUp={(event) => {
                  if (event.key === " " || event.key === "Enter") stopPadChord();
                }}
                onBlur={stopPadChord}
              >
                <span className="chord-degree">Step {index + 1}</span>
                <span className="chord-name">{getChordName(degree, selectedMode, selectedKey, selectedChordType)}</span>
                <span className="chord-degree">{getChordNumeral(degree, selectedMode, selectedKey, selectedChordType)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <p className={error ? "camera-status camera-error" : "camera-status"} role="status">
        {error || status}
      </p>
    </div>
  );
}

export default Camera;