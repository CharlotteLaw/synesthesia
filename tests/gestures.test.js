import assert from "node:assert/strict";
import test from "node:test";
import { getRaisedFingerCount } from "../src/vision/gestures.ts";

function handWithFourRaisedFingers(thumbTip, thumbIp) {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (index, x, y) => {
    landmarks[index] = { x, y, z: 0 };
  };

  set(0, 0.5, 0.9);
  set(1, 0.53, 0.82);
  set(2, 0.57, 0.74);
  set(3, thumbIp.x, thumbIp.y);
  set(4, thumbTip.x, thumbTip.y);
  set(5, 0.4, 0.62);
  set(6, 0.4, 0.5);
  set(7, 0.4, 0.38);
  set(8, 0.4, 0.26);
  set(9, 0.5, 0.55);
  set(10, 0.5, 0.43);
  set(11, 0.5, 0.31);
  set(12, 0.5, 0.19);
  set(13, 0.6, 0.57);
  set(14, 0.6, 0.45);
  set(15, 0.6, 0.33);
  set(16, 0.6, 0.21);
  set(17, 0.7, 0.63);
  set(18, 0.7, 0.53);
  set(19, 0.7, 0.43);
  set(20, 0.7, 0.33);
  return landmarks;
}

test("a folded-in thumb does not turn four raised fingers into five", () => {
  const landmarks = handWithFourRaisedFingers(
    { x: 0.48, y: 0.68 },
    { x: 0.54, y: 0.68 },
  );

  assert.equal(getRaisedFingerCount(landmarks), 4);
});

test("a splayed, extended thumb adds the fifth finger", () => {
  const landmarks = handWithFourRaisedFingers(
    { x: 0.73, y: 0.66 },
    { x: 0.64, y: 0.7 },
  );

  assert.equal(getRaisedFingerCount(landmarks), 5);
});
