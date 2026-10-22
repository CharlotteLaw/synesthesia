import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  CHORD_DEGREES,
  CHORD_KEYS,
  CHORD_MODES,
  getChordName,
  getChordNumeral,
  holdChord,
  releaseChord,
} from "../audio/notePlayer";
import type { ChordDegree, ChordKey, ChordMode } from "../audio/notePlayer";
import {
  getRaisedFingerCount,
} from "../vision/gestures";
import { startHandTracking } from "../vision/handTracker";

function isChordKey(value: string): value is ChordKey {
  return CHORD_KEYS.some((key) => key === value);
}

function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraViewRef = useRef<HTMLDivElement>(null);
  const activeHandDegreeRef = useRef<ChordDegree | null>(null);
  const candidateDegreeRef = useRef<ChordDegree | null>(null);
  const candidateSinceRef = useRef(0);
  const padHeldRef = useRef(false);
  const modeRef = useRef<ChordMode>("Major");
  const keyRef = useRef<ChordKey>("C");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Starting camera...");
  const [trackerReady, setTrackerReady] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [activeDegree, setActiveDegree] = useState<ChordDegree | null>(null);
  const [selectedMode, setSelectedMode] = useState<ChordMode>("Major");
  const [selectedKey, setSelectedKey] = useState<ChordKey>("C");

  const chooseChordSettings = (mode: ChordMode, key: ChordKey) => {
    if (modeRef.current === mode && keyRef.current === key) return;

    modeRef.current = mode;
    keyRef.current = key;
    setSelectedMode(mode);
    setSelectedKey(key);
    padHeldRef.current = false;
    activeHandDegreeRef.current = null;
    candidateDegreeRef.current = null;
    candidateSinceRef.current = 0;
    releaseChord();
    setActiveDegree(null);
    setStatus("Show your hand in frame");
  };

  const startPadChord = (degree: ChordDegree) => {
    padHeldRef.current = true;
    activeHandDegreeRef.current = null;
    holdChord(degree, modeRef.current, keyRef.current);
    setActiveDegree(degree);
    setStatus(`${getChordName(degree, modeRef.current, keyRef.current)} playing`);
  };

  const stopPadChord = () => {
    if (!padHeldRef.current) return;

    padHeldRef.current = false;
    activeHandDegreeRef.current = null;
    candidateDegreeRef.current = null;
    candidateSinceRef.current = performance.now();
    releaseChord();
    setActiveDegree(null);
    setStatus("Show your hand in frame");
  };

  const drawLandmarks = useCallback((hands: NormalizedLandmark[][], timestamp: number) => {
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

    const hand = hands[0];
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#b7ff56";
    context.strokeStyle = "#142018";
    context.lineWidth = Math.max(2, canvas.width * 0.003);

    for (const landmarks of hands) {
      for (const landmark of landmarks) {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        const radius = Math.max(4, canvas.width * 0.007);

        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
    }

    if (hand?.[8]) {
      context.beginPath();
      context.arc(
        hand[8].x * canvas.width,
        hand[8].y * canvas.height,
        Math.max(12, canvas.width * 0.018),
        0,
        Math.PI * 2,
      );
      context.strokeStyle = "#b7ff56";
      context.lineWidth = Math.max(3, canvas.width * 0.004);
      context.stroke();
    }

    const hasHand = Boolean(hand);
    setHandDetected(hasHand);

    if (padHeldRef.current) return;

    const detectedCount = hand ? getRaisedFingerCount(hand) : null;
    const detectedDegree = detectedCount as ChordDegree | null;
    if (hasHand && !detectedDegree) {
      setStatus("Hand detected · raise 1–5 fingers to play chords");
    } else if (!hasHand) {
      setStatus("Show your hand in frame");
    }
    const now = timestamp;

    if (candidateDegreeRef.current !== detectedDegree) {
      candidateDegreeRef.current = detectedDegree;
      candidateSinceRef.current = now;
    }

    if (now - candidateSinceRef.current < 220) return;
    if (activeHandDegreeRef.current === detectedDegree) return;

    activeHandDegreeRef.current = detectedDegree;
    if (detectedDegree) {
      holdChord(detectedDegree, modeRef.current, keyRef.current);
      setActiveDegree(detectedDegree);
      setStatus(`${getChordName(detectedDegree, modeRef.current, keyRef.current)} playing`);
    } else {
      releaseChord();
      setActiveDegree(null);
      setStatus(hasHand ? "Hand detected · raise 1–5 fingers to play chords" : "Show your hand in frame");
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
      </div>
      <p className="chord-instructions">Chord buttons <span>Press a button or raise 1–5 fingers</span></p>
      <div className="chord-keys" role="group" aria-label="Play chords">
        {CHORD_DEGREES.map((degree) => (
          <button
            key={degree}
            className="chord-key"
            type="button"
            aria-label={`${getChordName(degree, selectedMode, selectedKey)} chord, ${getChordNumeral(degree, selectedMode, selectedKey)} degree`}
            aria-pressed={activeDegree === degree}
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
      <p className={error ? "camera-status camera-error" : "camera-status"} role="status">
        {error || status}
      </p>
    </div>
  );
}

export default Camera;