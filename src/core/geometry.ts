// Pure guidance and coordinate maths shared by the Lens and the Node tests. No imports and no
// Lens globals, so the same file runs in both. The Lens keeps a byte-identical copy at
// Assets/Scripts/FindYourWayGeometry.ts.
//
// Map metres: x east, y up, z north. Headings: degrees clockwise from north.
// Building-local centimetres: the start sign at the origin, north along -Z, y up.

export interface XYZ {
  x: number;
  y: number;
  z: number;
}

export function headingOf(a: XYZ, b: XYZ): number | null {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (Math.abs(dx) < 1e-3 && Math.abs(dz) < 1e-3) return null;
  return (Math.atan2(dx, dz) * 180) / Math.PI;
}

export function wrap(deg: number): number {
  if (!isFinite(deg)) return 0;
  if (deg >= -180 && deg <= 180) return deg;
  const d = (deg + 180) % 360;
  const out = (d <= 0 ? d + 360 : d) - 180;
  return deg < 0 && out === 180 ? -180 : out;
}

// Signed yaw from the viewer's heading to the target (+ = to the right).
export function yawTo(user: XYZ, headingDeg: number, target: XYZ): number | null {
  const h = headingOf(user, target);
  if (h === null) return null;
  return wrap(h - headingDeg);
}

export function flatDistance(a: XYZ, b: XYZ): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// Given the route from the traveller onward ([closest point, next node, ...], e.g. from
// lineAhead with a long look-ahead), the next point where it bends by at least minTurnDeg,
// or its end.
export function nextTurnAlong(ahead: XYZ[], minTurnDeg: number = 25): XYZ | null {
  if (ahead.length < 2) return null;
  for (let i = 1; i < ahead.length - 1; i++) {
    const h1 = headingOf(ahead[i - 1], ahead[i]);
    const h2 = headingOf(ahead[i], ahead[i + 1]);
    if (h1 === null || h2 === null) continue;
    if (Math.abs(wrap(h2 - h1)) >= minTurnDeg) return ahead[i];
  }
  return ahead[ahead.length - 1];
}

// True when the turn arrow should show: the next turn is more than halfViewDeg off the
// viewer's heading and at least minDistance away.
export function turnOutOfView(user: XYZ, headingDeg: number, turn: XYZ | null, halfViewDeg: number,
    minDistance: number = 1.5): boolean {
  if (!turn || flatDistance(user, turn) < minDistance) return false;
  const yaw = yawTo(user, headingDeg, turn);
  return yaw !== null && Math.abs(yaw) > halfViewDeg;
}

// Map metres -> building-local cm. The origin is the start node (x, y and z), so a start sign
// on an upper floor is still at local height 0; liftCm raises the result (e.g. sign height).
export function mapToLocalCm(p: XYZ, origin: XYZ, liftCm: number = 0): XYZ {
  return { x: (p.x - origin.x) * 100, y: (p.y - origin.y) * 100 + liftCm, z: -(p.z - origin.z) * 100 };
}

// Building-local cm of the eyes -> map metres of the feet (the inverse of mapToLocalCm with
// liftCm = eyeHeightCm).
export function localCmToMap(local: XYZ, origin: XYZ, eyeHeightCm: number): XYZ {
  return { x: local.x / 100 + origin.x, y: (local.y - eyeHeightCm) / 100 + origin.y, z: origin.z - local.z / 100 };
}

// Below this horizontal length the view direction is (almost) straight up or down and has no
// usable heading.
export const MIN_FORWARD_XZ = 0.05;

// Yaw (radians, about +Y) that turns -Z toward the view direction projected on the floor:
// facing -Z is 0, facing -X is +PI/2. Looking straight down or up keeps lastYaw.
export function yawFromForward(fx: number, fz: number, lastYaw: number): number {
  if (Math.sqrt(fx * fx + fz * fz) < MIN_FORWARD_XZ) return lastYaw;
  return Math.atan2(-fx, -fz) + 0;
}

// The drawn line ends at the foot of a vertical lift segment (ridden with the floor button).
export function stopAtLift<T extends XYZ>(pts: T[]): T[] {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (Math.abs(b.y - a.y) > 1 && flatDistance(a, b) < 0.5) return pts.slice(0, i);
  }
  return pts;
}

// The drawn line stays on the traveller's floor: it ends at the foot of the next level change
// (lift, escalator, stairs or ramp: any segment that climbs or drops at least 0.5 m), where a
// short up/down marker shows instead of a line through the ceiling or floor. Standing on a
// sloped connection already (its first segment climbs and, when the traveller's floor height is
// given, the closest point is at least 0.25 m off it), the line is drawn up it and on; before
// that, or standing in a lift, only the marker shows. floorY: router.ts's TripAhead.floorY.
export function lineOnLevel<T extends XYZ>(pts: T[], floorY?: number): { line: T[]; marker: { at: T; up: boolean } | null } {
  // Still at the foot: the closest point is (nearly) on the traveller's floor.
  const atFoot = typeof floorY === "number" && pts.length > 1 && Math.abs(pts[0].y - floorY) < 0.25 && Math.abs(pts[1].y - floorY) >= 0.25;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (Math.abs(b.y - a.y) < 0.5) continue;
    if (i === 0 && flatDistance(a, b) >= 0.5 && !atFoot) continue;
    return { line: pts.slice(0, i + 1), marker: { at: a, up: b.y > a.y } };
  }
  return { line: pts, marker: null };
}
