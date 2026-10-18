import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  holdNote,
  INSTRUMENTS,
  releaseNote,
  setInstrument,
} from "../audio/notePlayer";
import type { InstrumentName } from "../audio/notePlayer";
import {
  getRaisedFingerNote,
  NOTE_NAMES,
  type NoteName,
} from "../vision/gestures";
import { startHandTracking } from "../vision/handTracker";

function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraViewRef = useRef<HTMLDivElement>(null);
  const instrumentPickerRef = useRef<HTMLDivElement>(null);
  const instrumentToggleRef = useRef<HTMLButtonElement>(null);
  const instrumentOptionsRef = useRef<HTMLDivElement>(null);
  const activeHandNoteRef = useRef<NoteName | null>(null);
  const candidateNoteRef = useRef<NoteName | null>(null);
  const candidateSinceRef = useRef(0);
  const padHeldRef = useRef(false);
  const pinchActiveRef = useRef(false);
  const instrumentMenuOpenRef = useRef(false);
  const hoveredInstrumentRef = useRef<InstrumentName | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Starting camera...");
  const [trackerReady, setTrackerReady] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [activeNote, setActiveNote] = useState<NoteName | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentName>("Piano");
  const [instrumentMenuOpen, setInstrumentMenuOpen] = useState(false);
  const [hoveredInstrument, setHoveredInstrument] = useState<InstrumentName | null>(null);

  const updateHoveredInstrument = useCallback((instrument: InstrumentName | null) => {
    if (hoveredInstrumentRef.current === instrument) return;
    hoveredInstrumentRef.current = instrument;
    setHoveredInstrument(instrument);
  }, []);

  const toggleInstrumentMenu = useCallback(() => {
    const nextOpen = !instrumentMenuOpenRef.current;
    instrumentMenuOpenRef.current = nextOpen;
    setInstrumentMenuOpen(nextOpen);
    updateHoveredInstrument(null);
    if (nextOpen) {
      releaseNote();
      activeHandNoteRef.current = null;
      candidateNoteRef.current = null;
      setActiveNote(null);
    }
  }, [updateHoveredInstrument]);

  const chooseInstrument = useCallback((instrument: InstrumentName) => {
    setInstrument(instrument);
    setSelectedInstrument(instrument);
    instrumentMenuOpenRef.current = false;
    setInstrumentMenuOpen(false);
    updateHoveredInstrument(null);
  }, [updateHoveredInstrument]);

  const startPadNote = (note: NoteName) => {
    padHeldRef.current = true;
    activeHandNoteRef.current = null;
    holdNote(note);
    setActiveNote(note);
    setStatus(`${note} playing`);
  };

  const stopPadNote = () => {
    if (!padHeldRef.current) return;

    padHeldRef.current = false;
    activeHandNoteRef.current = null;
    candidateNoteRef.current = null;
    candidateSinceRef.current = performance.now();
    releaseNote();
    setActiveNote(null);
    setStatus("Show your hand in frame");
  };

  const drawLandmarks = useCallback((hands: NormalizedLandmark[][]) => {
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

    if (!hand) {
      pinchActiveRef.current = false;
      updateHoveredInstrument(null);
    }
    if (hand && !padHeldRef.current) {
      const viewBounds = cameraViewRef.current?.getBoundingClientRect();
      const indexTip = hand[8];
      const thumbTip = hand[4];
      const palmLength = Math.hypot(hand[0].x - hand[9].x, hand[0].y - hand[9].y);
      const isPinching = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y) < palmLength * 0.3;
      const justPinched = isPinching && !pinchActiveRef.current;
      const pointerX = viewBounds ? viewBounds.left + (1 - indexTip.x) * viewBounds.width : 0;
      const pointerY = viewBounds ? viewBounds.top + indexTip.y * viewBounds.height : 0;
      const pickerBounds = instrumentPickerRef.current?.getBoundingClientRect();
      const insidePicker = Boolean(
        pickerBounds &&
          pointerX >= pickerBounds.left &&
          pointerX <= pickerBounds.right &&
          pointerY >= pickerBounds.top &&
          pointerY <= pickerBounds.bottom,
      );
      const toggleBounds = instrumentToggleRef.current?.getBoundingClientRect();
      const insideToggle = Boolean(
        toggleBounds &&
          pointerX >= toggleBounds.left &&
          pointerX <= toggleBounds.right &&
          pointerY >= toggleBounds.top &&
          pointerY <= toggleBounds.bottom,
      );
      const optionButtons = Array.from(
        instrumentOptionsRef.current?.querySelectorAll<HTMLButtonElement>(".instrument-option") ?? [],
      );
      const hoveredButton = optionButtons.find((button) => {
        const bounds = button.getBoundingClientRect();
        return (
          pointerX >= bounds.left &&
          pointerX <= bounds.right &&
          pointerY >= bounds.top &&
          pointerY <= bounds.bottom
        );
      });
      const targetInstrument = hoveredButton?.dataset.instrument as InstrumentName | undefined;
      updateHoveredInstrument(targetInstrument ?? null);

      if (justPinched && targetInstrument) {
        chooseInstrument(targetInstrument);
      } else if (justPinched && insideToggle) {
        toggleInstrumentMenu();
      }

      pinchActiveRef.current = isPinching;
      if (insidePicker) return;
    }

    if (padHeldRef.current) return;

    const detectedNote = hand ? getRaisedFingerNote(hand) : null;
    if (hasHand && !detectedNote) {
      setStatus("Hand detected · raise 1–5 fingers");
    } else if (!hasHand) {
      setStatus("Show your hand in frame");
    }
    const now = performance.now();

    if (candidateNoteRef.current !== detectedNote) {
      candidateNoteRef.current = detectedNote;
      candidateSinceRef.current = now;
    }

    if (now - candidateSinceRef.current < 120) return;
    if (activeHandNoteRef.current === detectedNote) return;

    activeHandNoteRef.current = detectedNote;
    if (detectedNote) {
      holdNote(detectedNote);
      setActiveNote(detectedNote);
      setStatus(`${detectedNote} playing`);
    } else {
      releaseNote();
      setActiveNote(null);
      setStatus(hasHand ? "Hand detected · raise 1–5 fingers" : "Show your hand in frame");
    }
  }, [chooseInstrument, toggleInstrumentMenu, updateHoveredInstrument]);

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
      releaseNote();
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
        <div className="camera-instrument-picker" ref={instrumentPickerRef}>
          <button
            className="instrument-toggle"
            ref={instrumentToggleRef}
            type="button"
            aria-expanded={instrumentMenuOpen}
            aria-controls="camera-instrument-options"
            onClick={toggleInstrumentMenu}
          >
            {selectedInstrument}
            <span aria-hidden="true">{instrumentMenuOpen ? "⌄" : "⌃"}</span>
          </button>
          <div
            className="instrument-options"
            id="camera-instrument-options"
            ref={instrumentOptionsRef}
            role="group"
            aria-label="Choose instrument"
            hidden={!instrumentMenuOpen}
          >
            {INSTRUMENTS.map((instrument) => (
              <button
                key={instrument}
                className="instrument-option"
                type="button"
                data-instrument={instrument}
                aria-current={hoveredInstrument === instrument ? "true" : undefined}
                aria-pressed={selectedInstrument === instrument}
                onClick={() => chooseInstrument(instrument)}
              >
                {instrument}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="note-keys" role="group" aria-label="Play notes">
        {NOTE_NAMES.map((note) => (
          <button
            key={note}
            className="note-key"
            type="button"
            aria-pressed={activeNote === note}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              startPadNote(note);
            }}
            onPointerUp={stopPadNote}
            onPointerCancel={stopPadNote}
            onKeyDown={(event) => {
              if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                event.preventDefault();
                startPadNote(note);
              }
            }}
            onKeyUp={(event) => {
              if (event.key === " " || event.key === "Enter") stopPadNote();
            }}
            onBlur={stopPadNote}
          >
            {note}
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