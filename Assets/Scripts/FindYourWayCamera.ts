// The demo take's camera (ROUND2.md R2-13): the simulated walk the preview's camera follows, smooth and
// elegant. Corners are rounded, every start and stop is eased, the heading looks a little ahead and turns
// at a capped rate, and an escalator is ridden straight along its axis at ride pace. A lift is a stop in
// front of its doors, facing them (the floor change is a dissolve in the edit). Pure logic shared by the
// Lens (Assets/Tests/FywDemoSupport.ts plays the poses) and the Node tests: no imports, no Lens globals;
// the Lens keeps a byte-identical copy at Assets/Scripts/FindYourWayCamera.ts.
// Map metres: x east, y up, z north. Headings: degrees clockwise from north.

export interface XYZ { x: number; y: number; z: number }
export interface CamPose extends XYZ { heading: number }

export const CAM = {
  dt: 1 / 30,
  walkSpeed: 1.8, // m/s, a brisk walk
  accel: 0.9, // m/s², starting and stopping
  cornerM: 1.6, // a corner is rounded over at most this far each side
  lookAheadM: 2.5, // the heading looks at the way this far ahead
  maxTurnDegS: 60, // never turns faster
  rideSpeed: 0.6, // an escalator's pace (m/s)
  rideRunM: 2.5, // stepping on in line with an escalator
  rideOffM: 1.2, // and off: short, so the view at the top is the floor ahead, not a wall up close
  liftStandM: 1.8, // standing this far in front of a lift's doors
  sampleM: 0.05,
};

function flat(a: XYZ, b: XYZ): number { return Math.hypot(b.x - a.x, b.z - a.z); }
function dist(a: XYZ, b: XYZ): number { return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); }
function headingOf(a: XYZ, b: XYZ): number | null { return flat(a, b) < 1e-6 ? null : (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI; }
function diff(a: number, b: number): number { return ((b - a + 540) % 360) - 180; }
function lerp(a: XYZ, b: XYZ, t: number): XYZ { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }; }

// The route as dense samples, corners rounded (a quadratic curve through the corner cut points); ride:
// whether the sample is on the escalator (between pts[rideFrom] and pts[rideTo]).
function samples(pts: XYZ[], ride?: { rideFrom: number; rideTo: number }): { p: XYZ; ride: boolean }[] {
  const out: { p: XYZ; ride: boolean }[] = [];
  const onRide = (seg: number) => !!ride && seg >= ride.rideFrom && seg < ride.rideTo;
  const cut: number[] = pts.map((_, i) => {
    if (i === 0 || i === pts.length - 1) return 0;
    if (ride && (i === ride.rideFrom || i === ride.rideTo)) return 0; // in line: no corner
    return Math.min(CAM.cornerM, dist(pts[i - 1], pts[i]) / 2, dist(pts[i], pts[i + 1]) / 2);
  });
  const push = (p: XYZ, r: boolean) => {
    if (out.length > 0 && dist(out[out.length - 1].p, p) < 1e-6) return;
    out.push({ p, ride: r });
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = dist(a, b);
    if (len < 1e-6) continue;
    const s0 = cut[i], s1 = len - cut[i + 1];
    const n = Math.max(1, Math.ceil((s1 - s0) / CAM.sampleM));
    for (let k = 0; k <= n; k++) push(lerp(a, b, (s0 + ((s1 - s0) * k) / n) / len), onRide(i));
    if (i + 1 < pts.length - 1 && cut[i + 1] > 0) {
      const c = pts[i + 1], next = pts[i + 2];
      const p0 = lerp(c, a, cut[i + 1] / len), p2 = lerp(c, next, cut[i + 1] / dist(c, next));
      const m = Math.max(2, Math.ceil((2 * cut[i + 1]) / CAM.sampleM));
      for (let k = 1; k < m; k++) {
        const t = k / m;
        const q = { x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p2.x, y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p2.y, z: (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * c.z + t * t * p2.z };
        push(q, false);
      }
    }
  }
  return out;
}

// The poses, one every CAM.dt, from standing at pts[0] facing startHeading to standing at the end facing
// along the last stretch. ride: pts[rideFrom] -> pts[rideTo] is an escalator.
export function planWalk(pts: XYZ[], startHeading: number, ride?: { rideFrom: number; rideTo: number }): CamPose[] {
  const sm = samples(pts, ride);
  if (sm.length < 2) return [{ ...pts[0], heading: startHeading }];
  const s: number[] = [0];
  for (let i = 1; i < sm.length; i++) s.push(s[i - 1] + dist(sm[i - 1].p, sm[i].p));
  const L = s[s.length - 1];
  // Speed at each sample: the pace cap, then eased by the acceleration both ways (rest at both ends).
  const v = sm.map((x) => (x.ride ? CAM.rideSpeed : CAM.walkSpeed));
  v[0] = 0;
  v[v.length - 1] = 0;
  for (let i = 1; i < v.length; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * CAM.accel * (s[i] - s[i - 1])));
  for (let i = v.length - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * CAM.accel * (s[i + 1] - s[i])));
  let j = 0;
  const at = (d: number): XYZ => {
    while (j < s.length - 2 && s[j + 1] < d) j++;
    while (j > 0 && s[j] > d) j--;
    const t = s[j + 1] > s[j] ? (d - s[j]) / (s[j + 1] - s[j]) : 0;
    return lerp(sm[j].p, sm[j + 1].p, Math.max(0, Math.min(1, t)));
  };
  const speedAt = (d: number): number => {
    let k = 0;
    while (k < s.length - 2 && s[k + 1] < d) k++;
    const t = s[k + 1] > s[k] ? (d - s[k]) / (s[k + 1] - s[k]) : 0;
    return v[k] + (v[k + 1] - v[k]) * Math.max(0, Math.min(1, t));
  };
  const lastDir = headingOf(sm[sm.length - 2].p, sm[sm.length - 1].p);
  const out: CamPose[] = [];
  let d = 0;
  let h = startHeading;
  const want = (dd: number): number => {
    if (dd >= L - 1e-6) return lastDir === null ? h : lastDir;
    const here = at(dd);
    const ahead = at(Math.min(L, dd + CAM.lookAheadM));
    const w = headingOf(here, ahead);
    return w === null ? (lastDir === null ? h : lastDir) : w;
  };
  const maxTurn = CAM.maxTurnDegS * CAM.dt;
  // Turn toward the way first while standing, when it points far off (no walking sideways).
  for (let guard = 0; guard < 600 && Math.abs(diff(h, want(0))) > 45; guard++) {
    out.push({ ...at(0), heading: h });
    h += Math.max(-maxTurn, Math.min(maxTurn, diff(h, want(0))));
  }
  for (let guard = 0; guard < 100000; guard++) {
    const p = at(d);
    out.push({ x: p.x, y: p.y, z: p.z, heading: h });
    if (d >= L - 1e-9) break;
    // Fall behind the speed profile rather than overshoot: the pace is the slower of here and the next step.
    const pace = Math.max(0.06, Math.min(speedAt(d), speedAt(Math.min(L, d + 0.02))));
    d = Math.min(L, d + pace * CAM.dt);
    h += Math.max(-maxTurn, Math.min(maxTurn, diff(h, want(d))));
  }
  // Standing at the end: settle the heading onto the last stretch.
  const end = at(L);
  for (let guard = 0; guard < 600 && lastDir !== null && Math.abs(diff(h, lastDir)) > 0.5; guard++) {
    h += Math.max(-maxTurn, Math.min(maxTurn, diff(h, lastDir)));
    out.push({ x: end.x, y: end.y, z: end.z, heading: h });
  }
  return out;
}

// An escalator ridden straight: on CAM.rideRunM before its foot and off CAM.rideOffM past its top, in line.
// planWalk(rideLine(foot, top), h, {rideFrom: 1, rideTo: 2}).
export function rideLine(foot: XYZ, top: XYZ): XYZ[] {
  const l = flat(foot, top);
  const ax = l > 1e-9 ? { x: (top.x - foot.x) / l, z: (top.z - foot.z) / l } : { x: 0, z: 1 };
  return [
    { x: foot.x - ax.x * CAM.rideRunM, y: foot.y, z: foot.z - ax.z * CAM.rideRunM },
    { ...foot },
    { ...top },
    { x: top.x + ax.x * CAM.rideOffM, y: top.y, z: top.z + ax.z * CAM.rideOffM },
  ];
}

// Where to stand for a lift: CAM.liftStandM in front of it on the side you come from, facing it.
export function liftApproach(lift: XYZ, from: XYZ): CamPose {
  const l = flat(lift, from);
  const u = l > 1e-9 ? { x: (from.x - lift.x) / l, z: (from.z - lift.z) / l } : { x: 0, z: -1 };
  const p = { x: lift.x + u.x * CAM.liftStandM, y: lift.y, z: lift.z + u.z * CAM.liftStandM };
  const h = headingOf(p, lift);
  return { ...p, heading: h === null ? 0 : h };
}
