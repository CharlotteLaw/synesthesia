import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type HandSide = "left" | "right";

export type TrackedHand = {
  landmarks: NormalizedLandmark[];
  side: HandSide | null;
};

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export async function startHandTracking(
  video: HTMLVideoElement,
  onHands: (hands: TrackedHand[], timestamp: number) => void,
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
      const timestamp = performance.now();
      const result = landmarker.detectForVideo(video, timestamp);
      const hands = result.landmarks.map((landmarks, index): TrackedHand => {
        const label = result.handedness[index]?.[0]?.categoryName;

        return {
          landmarks,
          // MediaPipe labels assume a mirrored input; the camera stream itself is not mirrored.
          side: label === "Left" ? "right" : label === "Right" ? "left" : null,
        };
      });
      onHands(hands, timestamp);
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