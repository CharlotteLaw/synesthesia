import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHORD_DEGREES,
  CHORD_KEYS,
  CHORD_MODES,
  SOUND_PRESETS,
  getChordName,
  getChordNumeral,
  holdChord,
  releaseChord,
  setSoundPreset,
} from "../audio/notePlayer";
import type { ChordDegree, ChordKey, ChordMode, SoundPreset } from "../audio/notePlayer";
import {
  getRaisedFingerCount,
} from "../vision/gestures";
import { startHandTracking } from "../vision/handTracker";
import type { HandSide, TrackedHand } from "../vision/handTracker";

type ProgressionPreset = {
  id: string;
  name: string;
  degrees: readonly ChordDegree[];
};

const MAJOR_PROGRESSION_PRESETS: readonly ProgressionPreset[] = [
  { id: "pop", name: "Pop", degrees: [1, 5, 6, 4] },
  { id: "emotional", name: "Emotional", degrees: [6, 4, 1, 5] },
  { id: "classic", name: "Classic", degrees: [1, 6, 4, 5] },
];

const MINOR_PROGRESSION_PRESETS: readonly ProgressionPreset[] = [
  { id: "minor-pop", name: "Minor pop", degrees: [1, 7, 6, 7] },
  { id: "emotional-minor", name: "Emotional minor", degrees: [1, 6, 3, 7] },
  { id: "minor-lift", name: "Minor lift", degrees: [1, 4, 6, 7] },
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
  const candidateSinceRefs = useRef<Record<HandSide, number>>({ left: 0, right: 0 });
  const activePadDegreeRef = useRef<ChordDegree | null>(null);
  const modeRef = useRef<ChordMode>("Major");
  const keyRef = useRef<ChordKey>("C");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Starting camera...");
  const [trackerReady, setTrackerReady] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [activeDegrees, setActiveDegrees] = useState<ChordDegree[]>([]);
  const [selectedMode, setSelectedMode] = useState<ChordMode>("Major");
  const [selectedKey, setSelectedKey] = useState<ChordKey>("C");
  const [selectedSound, setSelectedSound] = useState<SoundPreset>("Warm pluck");
  const [selectedProgressionId, setSelectedProgressionId] = useState("pop");
  const progressionPresets = selectedMode === "Major"
    ? MAJOR_PROGRESSION_PRESETS
    : MINOR_PROGRESSION_PRESETS;
  const selectedProgression = progressionPresets.find(
    (progression) => progression.id === selectedProgressionId,
  ) ?? progressionPresets[0];

  const chooseChordSettings = (mode: ChordMode, key: ChordKey) => {
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
    setStatus("Show your hand in frame");
  };

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

  const startPadChord = (degree: ChordDegree) => {
    holdChord(degree, modeRef.current, keyRef.current, "pad");
    activePadDegreeRef.current = degree;
    setActiveDegrees(getActiveChordDegrees(
      activeHandDegreesRef.current.left,
      activeHandDegreesRef.current.right,
      activePadDegreeRef.current,
    ));
    setStatus(`${getChordName(degree, modeRef.current, keyRef.current)} playing`);
  };

  const stopPadChord = () => {
    releaseChord("pad");
    activePadDegreeRef.current = null;
    setActiveDegrees(getActiveChordDegrees(
      activeHandDegreesRef.current.left,
      activeHandDegreesRef.current.right,
      activePadDegreeRef.current,
    ));
    const activeSide = activeHandDegreesRef.current.right ? "right" : "left";
    const activeHandDegree = activeHandDegreesRef.current[activeSide];
    setStatus(activeHandDegree
      ? `${activeSide === "left" ? "Left" : "Right"} hand: ${getChordName(activeHandDegree, modeRef.current, keyRef.current)} playing`
      : "Show your hand in frame");
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
    setHandDetected(hasHand);

    for (const side of ["left", "right"] as const) {
      const hand = hands.find((trackedHand) => trackedHand.side === side);
      const detectedCount = hand ? getRaisedFingerCount(hand.landmarks) : null;
      const detectedDegree =
        detectedCount && detectedCount <= CHORD_DEGREES.length
          ? detectedCount as ChordDegree
          : null;

      if (candidateDegreesRef.current[side] !== detectedDegree) {
        candidateDegreesRef.current[side] = detectedDegree;
        candidateSinceRefs.current[side] = timestamp;
      }

      if (
        timestamp - candidateSinceRefs.current[side] < 220 ||
        activeHandDegreesRef.current[side] === detectedDegree
      ) {
        continue;
      }

      activeHandDegreesRef.current[side] = detectedDegree;
      if (detectedDegree) {
        holdChord(detectedDegree, modeRef.current, keyRef.current, side);
        setActiveDegrees(getActiveChordDegrees(
          activeHandDegreesRef.current.left,
          activeHandDegreesRef.current.right,
          activePadDegreeRef.current,
        ));
        setStatus(`${side === "left" ? "Left" : "Right"} hand: ${getChordName(detectedDegree, modeRef.current, keyRef.current)} playing`);
      } else {
        releaseChord(side);
        setActiveDegrees(getActiveChordDegrees(
          activeHandDegreesRef.current.left,
          activeHandDegreesRef.current.right,
          activePadDegreeRef.current,
        ));
        if (activeHandDegreesRef.current.left === null && activeHandDegreesRef.current.right === null) {
          setStatus(activePadDegreeRef.current
            ? `${getChordName(activePadDegreeRef.current, modeRef.current, keyRef.current)} playing`
            : hasHand
              ? "Hand detected · raise 1–5 fingers with either hand"
              : "Show your hand in frame");
        } else {
          const activeSide = activeHandDegreesRef.current.right ? "right" : "left";
          const activeHandDegree = activeHandDegreesRef.current[activeSide];
          if (activeHandDegree) {
            setStatus(`${activeSide === "left" ? "Left" : "Right"} hand: ${getChordName(activeHandDegree, modeRef.current, keyRef.current)} playing`);
          }
        }
      }
    }
  }, []);

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
        setTrackerReady(true);
        setStatus("Show your hand in frame");
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
        {trackerReady && !handDetected && !error && (
          <div className="camera-hint">Show your hand in frame</div>
        )}
      </div>
      <div className="chord-settings">
        <label className="key-selector">
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
        <div className="mode-selector" role="group" aria-label="Scale mode">
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
        <label className="key-selector">
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
      </div>
      <p className="chord-instructions">Chord buttons <span>Press a button or raise 1–5 fingers with either hand</span></p>
      <div className="chord-keys" role="group" aria-label="Play chords">
        {CHORD_DEGREES.map((degree) => (
          <button
            key={degree}
            className="chord-key"
            type="button"
            aria-label={`${getChordName(degree, selectedMode, selectedKey)} chord, ${getChordNumeral(degree, selectedMode, selectedKey)} degree`}
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
            <span className="chord-name">{getChordName(degree, selectedMode, selectedKey)}</span>
            <span className="chord-degree">{getChordNumeral(degree, selectedMode, selectedKey)} chord</span>
          </button>
        ))}
      </div>
      <p className="chord-instructions progression-heading">
        Common progressions
        <span>Choose a pattern, then play its chords in order</span>
      </p>
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
            aria-label={`Step ${index + 1}: ${getChordName(degree, selectedMode, selectedKey)} chord, ${getChordNumeral(degree, selectedMode, selectedKey)} degree`}
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
            <span className="chord-name">{getChordName(degree, selectedMode, selectedKey)}</span>
            <span className="chord-degree">{getChordNumeral(degree, selectedMode, selectedKey)}</span>
          </button>
        ))}
      </div>
      <p className={error ? "camera-status camera-error" : "camera-status"} role="status">
        {error || status}
      </p>
    </div>
  );
}

export default Camera;