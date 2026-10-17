import { useEffect, useRef, useState } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { holdNote, releaseNote } from "../audio/notePlayer";
import {
  getRaisedFingerNote,
  NOTE_NAMES,
  type NoteName,
} from "../vision/gestures";
import { startHandTracking } from "../vision/handTracker";

function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeHandNoteRef = useRef<NoteName | null>(null);
  const candidateNoteRef = useRef<NoteName | null>(null);
  const candidateSinceRef = useRef(0);
  const padHeldRef = useRef(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Starting camera...");
  const [activeNote, setActiveNote] = useState<NoteName | null>(null);

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
    setStatus("Ready to play");
  };

  const drawLandmarks = (hands: NormalizedLandmark[][]) => {
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

    if (padHeldRef.current) return;

    const detectedNote = hands[0] ? getRaisedFingerNote(hands[0]) : null;
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
      setStatus("Ready to play");
    }
  };

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
        setStatus("Hold up 1–5 fingers to sustain; make a fist to release");
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
  }, []);

  return (
    <div className="camera-shell">
      <div className="camera-view">
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} aria-hidden="true" />
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