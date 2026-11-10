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
  return Math.hypot(
    first.x - second.x,
    first.y - second.y,
    first.z - second.z,
  );
}

function angleAtJoint(
  first: NormalizedLandmark,
  joint: NormalizedLandmark,
  last: NormalizedLandmark,
): number {
  const firstX = first.x - joint.x;
  const firstY = first.y - joint.y;
  const firstZ = first.z - joint.z;
  const lastX = last.x - joint.x;
  const lastY = last.y - joint.y;
  const lastZ = last.z - joint.z;
  const firstLength = Math.hypot(firstX, firstY, firstZ);
  const lastLength = Math.hypot(lastX, lastY, lastZ);
  if (firstLength === 0 || lastLength === 0) return 0;

  const cosine = Math.max(-1, Math.min(1,
    (firstX * lastX + firstY * lastY + firstZ * lastZ) / (firstLength * lastLength),
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
  if (
    landmarks.length < 21 ||
    landmarks.slice(0, 21).some(({ x, y, z }) =>
      !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)
    )
  ) {
    return null;
  }

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

  if (palmLength === 0) return null;

  for (const [mcpIndex, pipIndex, dipIndex, tipIndex] of FINGER_JOINTS) {
    if (
      angleAtJoint(landmarks[mcpIndex], landmarks[pipIndex], landmarks[dipIndex]) >= 145 &&
      angleAtJoint(landmarks[pipIndex], landmarks[dipIndex], landmarks[tipIndex]) >= 140 &&
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
  const thumbSide = axisLength > 0
    ? lateralPosition(thumbTip, wrist, palmAxisX, palmAxisY, axisLength) * indexSide
    : 0;
  const thumbIsSplayed = palmWidth > 0 && axisLength > 0 && indexSide !== 0 &&
    thumbSide < -palmWidth * 0.08;

  if (
    thumbIsSplayed &&
    angleAtJoint(landmarks[1], thumbMcp, thumbIp) >= 135 &&
    angleAtJoint(thumbMcp, thumbIp, thumbTip) >= 135 &&
    distanceBetween(thumbTip, landmarks[5]) >
      distanceBetween(thumbIp, landmarks[5]) + extensionThreshold
  ) {
    fingerCount += 1;
  }

  return fingerCount === 0 ? null : fingerCount;
}