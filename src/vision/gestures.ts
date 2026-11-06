import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const FINGER_JOINTS = [
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
] as const;

function distanceBetween(
  first: NormalizedLandmark,
  second: NormalizedLandmark,
): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function angleAtJoint(
  first: NormalizedLandmark,
  joint: NormalizedLandmark,
  last: NormalizedLandmark,
): number {
  const firstX = first.x - joint.x;
  const firstY = first.y - joint.y;
  const lastX = last.x - joint.x;
  const lastY = last.y - joint.y;
  const firstLength = Math.hypot(firstX, firstY);
  const lastLength = Math.hypot(lastX, lastY);
  if (firstLength === 0 || lastLength === 0) return 0;

  const cosine = Math.max(-1, Math.min(1,
    (firstX * lastX + firstY * lastY) / (firstLength * lastLength),
  ));
  return Math.acos(cosine) * (180 / Math.PI);
}

function lateralPosition(
  landmark: NormalizedLandmark,
  wrist: NormalizedLandmark,
  palmAxisX: number,
  palmAxisY: number,
  axisLength: number,
): number {
  const offsetX = landmark.x - wrist.x;
  const offsetY = landmark.y - wrist.y;
  return (palmAxisX * offsetY - palmAxisY * offsetX) / axisLength;
}

export function getRaisedFingerCount(
  landmarks: NormalizedLandmark[],
): number | null {
  if (landmarks.length < 21) return null;

  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const thumbMcp = landmarks[2];
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const palmLength = distanceBetween(wrist, middleMcp);
  const palmAxisX = middleMcp.x - wrist.x;
  const palmAxisY = middleMcp.y - wrist.y;
  const extensionThreshold = palmLength * 0.12;
  let fingerCount = 0;

  for (const [mcpIndex, pipIndex, dipIndex, tipIndex] of FINGER_JOINTS) {
    if (
      angleAtJoint(landmarks[mcpIndex], landmarks[pipIndex], landmarks[dipIndex]) >= 145 &&
      distanceBetween(landmarks[mcpIndex], landmarks[tipIndex]) >
        distanceBetween(landmarks[mcpIndex], landmarks[pipIndex]) + extensionThreshold
    ) {
      fingerCount += 1;
    }
  }

  const palmWidth = distanceBetween(landmarks[5], landmarks[17]);
  const axisLength = Math.hypot(palmAxisX, palmAxisY);
  const indexSide = axisLength > 0
    ? Math.sign(lateralPosition(landmarks[5], wrist, palmAxisX, palmAxisY, axisLength))
    : 0;
  const thumbIsSplayed = palmWidth > 0 && axisLength > 0 && indexSide !== 0 &&
    lateralPosition(thumbTip, wrist, palmAxisX, palmAxisY, axisLength) * indexSide >
      lateralPosition(landmarks[5], wrist, palmAxisX, palmAxisY, axisLength) * indexSide +
        palmWidth * 0.12;

  if (
    thumbIsSplayed &&
    angleAtJoint(thumbMcp, thumbIp, thumbTip) >= 145 &&
    distanceBetween(thumbTip, landmarks[5]) >
      distanceBetween(thumbIp, landmarks[5]) + extensionThreshold
  ) {
    fingerCount += 1;
  }

  return fingerCount === 0 ? null : fingerCount;
}