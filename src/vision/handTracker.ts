import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export async function startHandTracking(
  video: HTMLVideoElement,
  onLandmarks: (landmarks: NormalizedLandmark[][]) => void,
): Promise<() => void> {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL },
    runningMode: "VIDEO",
    numHands: 2,
  });

  let active = true;
  let animationFrame = 0;
  let lastVideoTime = -1;

  const detectFrame = () => {
    if (!active) return;

    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.currentTime !== lastVideoTime
    ) {
      lastVideoTime = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now());
      onLandmarks(result.landmarks);
    }

    animationFrame = requestAnimationFrame(detectFrame);
  };

  detectFrame();

  return () => {
    active = false;
    cancelAnimationFrame(animationFrame);
    landmarker.close();
  };
}