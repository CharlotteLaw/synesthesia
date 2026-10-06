import { useEffect, useRef, useState } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { startHandTracking } from "../vision/handTracker";

function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Starting camera...");

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
        setStatus("Show your hand to the camera");
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
      <p className={error ? "camera-status camera-error" : "camera-status"} role="status">
        {error || status}
      </p>
    </div>
  );
}

export default Camera;