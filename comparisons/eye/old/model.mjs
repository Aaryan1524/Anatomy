// The eye, as numbers. Pure functions, no imports: build.mjs imports this
// module for the static drawing and inlines the same source into the page,
// so the picture, the motion and the readout all come from one model.
//
// Coordinates are millimetres in the horizontal meridian of a right eye:
// s runs along the optic axis toward what the eye looks at (0 = centre of
// the globe), n runs sideways, positive toward the nose.

export const EYE = {
  n: 1.336, // aqueous and vitreous
  R: 12.0, // outer sclera
  scleraIn: 11.25,
  choroidIn: 10.98,
  retinaIn: 10.73, // inner retina: the image surface
  apex: 13.12, // front of the cornea
  corneaR: 7.8, // outer corneal radius
  corneaInR: 6.6,
  corneaThick: 0.55,
  limbus: 5.85, // half-width of the cornea at the limbus
  Fc: 43.0, // corneal power, D
  d: 5.6, // cornea to lens principal plane, mm
  F0: 60.0, // relaxed eye, D
  iris: 9.6, // aperture stop plane, s
  lensBack: 5.92, // back pole of the lens (stays put)
  N: 6.0, // nodal point, s
  disc: { at: 4.5, width: 1.8 }, // optic disc: arc distance nasal of the fovea, width, mm (retina)
  ora: 7.2, // ora serrata, s
  maxAcc: 11.9, // Gullstrand: accommodated eye minus relaxed eye, D
};

const sq = (v) => v * v;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const DEG = Math.PI / 180;

export const cornealCentre = () => EYE.apex - EYE.corneaR;
export const lensPlane = () => EYE.apex - EYE.d;
// Accommodation A is counted the optometrist's way: the vergence (D) of the
// nearest target the eye now focuses, so a target at 25 cm needs A = 4.
// The lens power that does it comes from the two-surface model below; the
// whole eye's equivalent power rises a little more than A (60 to 64.8 D for
// A = 4), because the principal planes move with the lens.
export const reduction = () => 1 - (EYE.d / 1000 / EYE.n) * EYE.Fc;
const retinaDistance = () => (lensPlane() + EYE.retinaIn) / 1000;
export function lensPower(A) {
  const V1 = EYE.Fc - A;
  return EYE.n / retinaDistance() - V1 / (1 - (EYE.d / 1000 / EYE.n) * V1);
}
export const eyePower = (A) => {
  const FL = lensPower(A);
  return EYE.Fc + FL - (EYE.d / 1000 / EYE.n) * EYE.Fc * FL;
};
export const F0 = () => eyePower(0);

// Paraxial trace of one ray: height h (mm) at the cornea, target vergence L
// (D, negative for a near target), accommodation A (D).
export function trace(h, L, A) {
  const { n, Fc, d } = EYE;
  const V1 = L + Fc;
  const l1 = (n / V1) * 1000; // mm behind the cornea, where the ray would cross the axis
  const atIris = h * (1 - (EYE.apex - EYE.iris) / l1);
  const atLens = h * (1 - d / l1);
  const V2 = V1 / (1 - (d / 1000 / n) * V1) + lensPower(A);
  const focus = lensPlane() - (n / V2) * 1000; // s of the image
  return { atIris, atLens, focus };
}

// Height at the cornea of the ray that grazes the pupil edge.
export function entryHeight(pupil, L) {
  const V1 = L + EYE.Fc;
  const l1 = (EYE.n / V1) * 1000;
  return pupil / 2 / (1 - (EYE.apex - EYE.iris) / l1);
}

// s on the outer cornea at height h.
export const corneaAt = (h) => cornealCentre() + Math.sqrt(Math.max(0, sq(EYE.corneaR) - sq(h)));

// Where a line from p along direction u first meets the retina (inner retina sphere).
export function onRetina(p, u) {
  const r = EYE.retinaIn;
  const b = p[0] * u[0] + p[1] * u[1];
  const c = sq(p[0]) + sq(p[1]) - sq(r);
  const t = -b + Math.sqrt(Math.max(0, b * b - c));
  return [p[0] + u[0] * t, p[1] + u[1] * t];
}

// Arc distance along the retina from the fovea (back pole) to point q, signed nasal +.
export const arcFromFovea = (q) => Math.atan2(q[1], -q[0]) * EYE.retinaIn;

// The bundle that gets through the pupil, as two edge rays and where each meets
// the retina. Returns everything the drawing and the readout need.
export function bundle({ L, A, pupil }) {
  const h = entryHeight(pupil, L);
  const ray = trace(h, L, A);
  const sL = lensPlane();
  const edge = (sign) => {
    const a = [corneaAt(h), sign * h];
    const b = [EYE.iris, sign * ray.atIris];
    const c = [sL, sign * ray.atLens];
    const dir = [ray.focus - sL, -sign * ray.atLens];
    const len = Math.hypot(dir[0], dir[1]);
    const u = [dir[0] / len, dir[1] / len];
    const hit = onRetina(c, u);
    return { a, b, c, hit };
  };
  const retinaS = -EYE.retinaIn;
  const behind = retinaS - ray.focus; // > 0: focus lies behind the retina
  const blur = Math.abs(edge(1).hit[1] - edge(-1).hit[1]);
  return { h, focus: ray.focus, behind, blur, edges: [edge(1), edge(-1)] };
}

// Defocus in dioptres: what the eye still lacks to focus a target of vergence L.
export const defocus = (L, A) => -L - A;

// Pupil diameter from scene luminance (Moon & Spencer 1944), mm.
export const pupilFor = (luminance) => 4.9 - 3 * Math.tanh(0.4 * Math.log10(luminance));
// Retinal illuminance, trolands.
export const trolands = (luminance, pupil) => luminance * Math.PI * sq(pupil / 2);

// Chief ray of a point at angle theta (deg, temporal +) in the field: it passes
// the nodal point and meets the nasal retina at the same angle.
export function chief(theta) {
  const t = theta * DEG;
  const p = [EYE.N, 0];
  const u = [-Math.cos(t), Math.sin(t)];
  const hit = onRetina(p, u);
  const arc = arcFromFovea(hit);
  const half = EYE.disc.width / 2;
  const onDisc = Math.abs(arc - EYE.disc.at) <= half;
  return { hit, arc, onDisc, u };
}

// The blind spot's edges in the visual field (deg), solved from the disc on the retina.
export function blindSpan() {
  const angleFor = (arc) => {
    let lo = 0;
    let hi = 40;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (chief(mid).arc < arc) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const half = EYE.disc.width / 2;
  return { from: angleFor(EYE.disc.at - half), mid: angleFor(EYE.disc.at), to: angleFor(EYE.disc.at + half) };
}

// The lens in section for accommodation A: Gullstrand's relaxed lens (front
// radius 10, back 6, thickness 3.6) blended toward his accommodated one
// (5.33, 5.33, 4.0) by the share of his 11.9 D range that A uses.
export function lensShape(A, count = 28) {
  const a = clamp((eyePower(A) - eyePower(0)) / EYE.maxAcc, 0, 1);
  const Rf = 10 + (5.33 - 10) * a;
  const Rb = 6 + (5.33 - 6) * a;
  const T = 3.6 + 0.4 * a;
  const back = EYE.lensBack;
  const front = back + T;
  const sagF = (r) => Rf - Math.sqrt(Math.max(0, sq(Rf) - sq(r)));
  const sagB = (r) => Rb - Math.sqrt(Math.max(0, sq(Rb) - sq(r)));
  let lo = 0;
  let hi = Math.min(Rf, Rb);
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (front - sagF(mid) > back + sagB(mid)) lo = mid;
    else hi = mid;
  }
  const re = (lo + hi) / 2;
  // Round the equator: the last 12% of the radius blends both faces into a curve.
  const frontPts = [];
  const backPts = [];
  for (let i = 0; i <= count; i++) {
    const r = re * Math.sin((i / count) * (Math.PI / 2));
    frontPts.push([front - sagF(r), r]);
    backPts.push([back + sagB(r), r]);
  }
  const eq = [(front - sagF(re) + back + sagB(re)) / 2, re];
  return { Rf, Rb, T, front, back, re, eq, frontPts, backPts, sagF, sagB };
}

// Lens outline as a closed polygon in (s, n), round the equator.
export function lensOutline(A, count = 28) {
  const L = lensShape(A, count);
  const pull = 0.4; // equator rounding, mm
  const upper = [];
  const lower = [];
  const n = L.frontPts.length;
  for (let i = 0; i < n; i++) {
    const [sf, r] = L.frontPts[i];
    const sb = L.backPts[i][0];
    const t = r / L.re;
    const ease = Math.max(0, (t - 0.72) / 0.28);
    const shrink = pull * ease * ease;
    upper.push([sf + shrink * 0.25, r - shrink * 0.6]);
    lower.push([sb - shrink * 0.25, r - shrink * 0.6]);
  }
  const side = (sign) => [...upper.map(([s, r]) => [s, sign * r]), ...lower.slice().reverse().map(([s, r]) => [s, sign * r])];
  // From the front pole down the nasal side, round the equator, along the back
  // to the back pole, then up the temporal side back to the front pole.
  const nasal = side(1);
  const temporal = side(-1).reverse();
  let points = [...nasal, ...temporal.slice(1, -1)];
  for (let pass = 0; pass < 2; pass++) {
    const next = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    points = next;
  }
  return { points, shape: L };
}

// Ciliary body (one side, sign +1 nasal), for accommodation A: the muscle
// contracts, so the ring of processes moves in toward the lens and forward.
export function ciliary(A, sign = 1) {
  const a = clamp((eyePower(A) - eyePower(0)) / EYE.maxAcc, 0, 1);
  const wall = (s) => Math.sqrt(sq(EYE.scleraIn) - sq(s));
  const angle = corneoscleralAngle();
  const root = [angle[0] - 0.08, angle[1] - 0.05];
  const tip = [8.95 + 0.25 * a, 5.78 - 0.55 * a];
  const pts = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const s = angle[0] + (EYE.ora - angle[0]) * (i / steps);
    pts.push([s, wall(s)]);
  }
  const plana = Math.sqrt(sq(EYE.choroidIn) - sq(EYE.ora));
  const inner = [
    [EYE.ora, plana],
    [8.0, Math.sqrt(sq(EYE.choroidIn - 0.15) - 64) - 0.05 - 0.15 * a],
    [8.55 + 0.15 * a, 6.55 - 0.45 * a],
    tip,
    [tip[0] + 0.35, tip[1] - 0.12],
    [9.6, 5.32],
    root,
  ];
  const flip = ([s, r]) => [s, sign * r];
  return { outline: [...pts, ...inner].map(flip), processes: [inner[2], inner[3], inner[4]].map(flip), tip: flip(tip), root: flip(root) };
}

// Where the inner cornea meets the inner sclera (the chamber angle).
export function corneoscleralAngle() {
  const ci = EYE.apex - EYE.corneaThick - EYE.corneaInR;
  const R = EYE.scleraIn;
  const x = (sq(R) - sq(EYE.corneaInR) + sq(ci)) / (2 * ci);
  return [x, Math.sqrt(sq(R) - sq(x))];
}

// The iris (one side) for pupil diameter p: a wedge from the root to the
// pupil margin, resting on the front of the lens at the margin; it thickens
// as it gathers up when the pupil opens.
export function iris(p, A, sign = 1) {
  const L = lensShape(A);
  const root = ciliary(A).root;
  const m = p / 2;
  const width = root[1] - m;
  const thick = clamp(0.35 + 1.4 / Math.max(width, 0.8), 0.55, 1.1);
  const backAt = (r) => Math.max(L.front - L.sagF(Math.min(r, L.re)) + 0.06, EYE.iris - 0.25);
  const back = [];
  const front = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = m + width * t;
    const bulge = Math.sin(Math.PI * Math.min(1, t * 1.4)) * thick * 0.7;
    const bs = backAt(r) + (root[0] - 0.45 - backAt(r)) * t * t;
    back.push([bs, r]);
    front.push([bs + 0.26 + bulge, r]);
  }
  const tipFront = [back[0][0] + 0.13, m - 0.04];
  const poly = [...back, root, ...front.slice().reverse(), tipFront];
  return { outline: poly.map(([s, r]) => [s, sign * r]), margin: [back[0][0], sign * m] };
}

// Accommodation dynamics: latency, then a critically damped response
// (10-90 % in about 0.6 s, peak about 8 D/s for a 4 D step); relaxing is slower.
export const ACC = { latency: 0.36, omegaUp: 5.6, omegaDown: 4.2 };
// Pupil dynamics: constriction is quick, dilation takes several seconds.
export const PUPIL = { latencyIn: 0.24, tauIn: 0.32, latencyOut: 0.3, tauOut: 1.6, nearMiosis: 0.1 };

export const LIGHT = { bright: 1000, dim: 0.1 };
export const NEAR = 0.25; // m
