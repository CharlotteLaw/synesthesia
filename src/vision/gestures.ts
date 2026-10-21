import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const FINGER_JOINTS = [
  [8, 6],
  [12, 10],
  [16, 14],
  [20, 18],
] as const;

function distanceBetween(
  first: NormalizedLandmark,
  second: NormalizedLandmark,
): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function getRaisedFingerCount(
  landmarks: NormalizedLandmark[],
): number | null {
  if (landmarks.length < 21) return null;

  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  const thumbIp = landmarks[3];
  const palmLength = distanceBetween(landmarks[0], landmarks[9]);
  const extensionThreshold = palmLength * 0.12;
  let fingerCount = 0;

  for (const [tipIndex, pipIndex] of FINGER_JOINTS) {
    if (
      distanceBetween(landmarks[0], landmarks[tipIndex]) >
      distanceBetween(landmarks[0], landmarks[pipIndex]) + extensionThreshold
    ) {
      fingerCount += 1;
    }
  }

  const thumbTipExtension = distanceBetween(thumbTip, indexMcp);
  const thumbJointExtension = distanceBetween(thumbIp, indexMcp);
  if (thumbTipExtension > thumbJointExtension * 1.15) {
    fingerCount += 1;
  }

  return fingerCount === 0 ? null : fingerCount;
}