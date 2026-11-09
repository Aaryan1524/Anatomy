// The eye as a pure model, shared by the build and the page (inlined with `export` stripped).
// Optics: Le Grand's full theoretical eye (relaxed and accommodated), in mm, traced exactly in the
// horizontal section through the optic axis. t runs back along the axis from the corneal apex,
// rho runs sideways (+ nasal; drawn by the kit this is a right eye). Pupil: De Groot & Gebhard (1952).

export const LEGRAND = {
  cornea: { t1: 0, R1: 7.8, t2: 0.55, R2: 6.5, n: 1.3771 },
  aqueous: 1.3374,
  lensN: [1.42, 1.427], // relaxed, accommodated
  vitreous: 1.336,
  relaxed: { t3: 3.6, R3: 10.2, t4: 7.6, R4: -6.0 },
  accommodated: { t3: 3.2, R3: 6.0, t4: 7.7, R4: -5.5 },
};

export const lerp = (a, b, x) => a + (b - a) * x;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function lensAt(a) {
  const { relaxed: r, accommodated: c } = LEGRAND;
  return {
    t3: lerp(r.t3, c.t3, a),
    R3: 1 / lerp(1 / r.R3, 1 / c.R3, a),
    t4: lerp(r.t4, c.t4, a),
    R4: 1 / lerp(1 / r.R4, 1 / c.R4, a),
    n: lerp(LEGRAND.lensN[0], LEGRAND.lensN[1], a),
  };
}

export function surfacesAt(a) {
  const { cornea: k, aqueous, vitreous } = LEGRAND;
  const L = lensAt(a);
  const lensN = L.n;
  return [
    { t: k.t1, R: k.R1, n0: 1, n1: k.n },
    { t: k.t2, R: k.R2, n0: k.n, n1: aqueous },
    { t: L.t3, R: L.R3, n0: aqueous, n1: lensN },
    { t: L.t4, R: L.R4, n0: lensN, n1: vitreous },
  ];
}

// Paraxial y-nu trace. objectT = -Infinity for a distant object. Returns the image position t.
export function paraxialImage(surfaces, objectT = -Infinity) {
  let y, nu;
  if (!isFinite(objectT)) { y = 1; nu = 0; } else { y = surfaces[0].t - objectT; nu = 1; }
  for (let i = 0; i < surfaces.length; i++) {
    const s = surfaces[i];
    nu = nu - y * (s.n1 - s.n0) / s.R;
    if (i < surfaces.length - 1) y = y + (nu / s.n1) * (surfaces[i + 1].t - s.t);
  }
  const last = surfaces[surfaces.length - 1];
  return last.t - (y * last.n1) / nu;
}

export function powerOf(surfaces) {
  let y = 1, nu = 0;
  for (let i = 0; i < surfaces.length; i++) {
    const s = surfaces[i];
    nu = nu - y * (s.n1 - s.n0) / s.R;
    if (i < surfaces.length - 1) y = y + (nu / s.n1) * (surfaces[i + 1].t - s.t);
  }
  return -nu * 1000; // dioptres (y0 = 1 mm)
}

// Anatomy around the optics. The photoreceptor surface is placed so that the relaxed eye is emmetropic.
export const RETINA_T = paraxialImage(surfacesAt(0));
export const GLOBE = (() => {
  const Rr = 11.0; // photoreceptor layer radius
  const c = RETINA_T - Rr; // centre of the globe on the axis
  const choroid = Rr + 0.25;
  const sclera = choroid + 0.9;
  const ilm = Rr - 0.25; // inner limiting membrane, inner face of the retina
  // limbus: where the corneal front sphere meets the outer sclera
  const R1 = LEGRAND.cornea.R1;
  const lt = (c * c - sclera * sclera) / (2 * (c - R1));
  const lp = Math.sqrt(R1 * R1 - (lt - R1) ** 2);
  // inner angle: corneal back sphere meets the inner sclera (choroid radius)
  const { t2, R2 } = LEGRAND.cornea;
  const c2 = t2 + R2;
  const at = (c * c - c2 * c2 - choroid * choroid + R2 * R2) / (2 * (c - c2));
  const ap = Math.sqrt(R2 * R2 - (at - c2) ** 2);
  const ora = 8.6; // ora serrata, t
  const oraPhi = Math.acos((ora - c) / Rr);
  return { c, Rr, choroid, sclera, ilm, limbus: [lt, lp], angle: [at, ap], ora, oraPhi };
})();

export const wallRho = (t, r = GLOBE.choroid) => Math.sqrt(Math.max(0, r * r - (t - GLOBE.c) ** 2));
export const onSphere = (phi, r) => [GLOBE.c + r * Math.cos(phi), r * Math.sin(phi)];

// Exact ray trace through the four surfaces to the photoreceptor sphere.
function hitCircle(p, d, ct, r) {
  const ox = p[0] - ct, oy = p[1];
  const b = ox * d[0] + oy * d[1];
  const cc = ox * ox + oy * oy - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const q = Math.sqrt(disc);
  const s = cc > 0 ? -b - q : -b + q; // outside: first hit; inside: exit
  return s > 1e-9 ? s : null;
}
function refract(d, nrm, n0, n1) {
  let N = nrm;
  let cosi = -(N[0] * d[0] + N[1] * d[1]);
  if (cosi < 0) { N = [-N[0], -N[1]]; cosi = -cosi; }
  const eta = n0 / n1;
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  const f = eta * cosi - Math.sqrt(k);
  return [eta * d[0] + f * N[0], eta * d[1] + f * N[1]];
}

// Returns { points, rhoAtStop, end, phi } or null. stopT: plane of the iris.
export function trace(p0, d0, surfaces, stopT) {
  const pts = [p0];
  let p = p0, d = d0, rhoAtStop = null;
  for (let i = 0; i < surfaces.length; i++) {
    const s = surfaces[i];
    const ct = s.t + s.R;
    const step = hitCircle(p, d, ct, Math.abs(s.R));
    if (step == null) return null;
    const q = [p[0] + d[0] * step, p[1] + d[1] * step];
    if (rhoAtStop == null && stopT <= q[0] && stopT >= p[0]) rhoAtStop = p[1] + d[1] * ((stopT - p[0]) / d[0]);
    const r = Math.abs(s.R);
    const nd = refract(d, [(q[0] - ct) / r, q[1] / r], s.n0, s.n1);
    if (!nd) return null;
    pts.push(q);
    p = q; d = nd;
  }
  if (rhoAtStop == null) rhoAtStop = p[1] + d[1] * ((stopT - p[0]) / d[0]);
  const step = hitCircle(p, d, GLOBE.c, GLOBE.Rr);
  if (step == null) return null;
  const end = [p[0] + d[0] * step, p[1] + d[1] * step];
  pts.push(end);
  return { points: pts, rhoAtStop, end, phi: Math.atan2(end[1], end[0] - GLOBE.c) };
}

// A ray from a source that reaches the iris plane at rho = want. Source: { angle } for a distant
// object (parallel rays) or { at: [t, rho] } for a near point. Rays start at t = startT.
export function aimRay(source, want, surfaces, stopT, startT = -8) {
  const make = (h) => {
    if (source.at) {
      const [ot, orho] = source.at;
      const dir = [1, h];
      const n = Math.hypot(dir[0], dir[1]);
      const d = [dir[0] / n, dir[1] / n];
      const s = (startT - ot) / d[0];
      return { p: [startT, orho + d[1] * s], d };
    }
    const d = [Math.cos(source.angle), Math.sin(source.angle)];
    return { p: [startT, h], d };
  };
  const rhoOf = (h) => { const { p, d } = make(h); const r = trace(p, d, surfaces, stopT); return r ? r.rhoAtStop : NaN; };
  let h0 = source.at ? 0 : -Math.tan(source.angle) * (stopT - startT) * 0.8;
  let h1 = source.at ? 0.5 / (stopT - source.at[0]) : h0 + 0.5;
  let r0 = rhoOf(h0) - want, r1 = rhoOf(h1) - want;
  for (let i = 0; i < 24 && Math.abs(r1) > 1e-7; i++) {
    const h2 = h1 - (r1 * (h1 - h0)) / (r1 - r0);
    h0 = h1; r0 = r1; h1 = h2; r1 = rhoOf(h1) - want;
  }
  const { p, d } = make(h1);
  return trace(p, d, surfaces, stopT);
}

// The stop sits on the front of the lens.
export const stopAt = (a) => lensAt(a).t3;

// Entrance pupil magnification: the cornea images the iris aperture larger by this factor.
export function pupilMagnification(a = 0) {
  const s = surfacesAt(a).slice(0, 2);
  const stop = stopAt(a);
  // height at the stop of a paraxial ray that enters parallel at height 1
  let y = 1, nu = 0;
  for (let i = 0; i < s.length; i++) {
    nu = nu - y * (s[i].n1 - s[i].n0) / s[i].R;
    const next = i < s.length - 1 ? s[i + 1].t : stop;
    y = y + (nu / s[i].n1) * (next - s[i].t);
  }
  return 1 / y;
}

// Accommodation (dioptres of object vergence brought into focus) for lens state a, and its inverse.
export function accommodationOf(a) {
  const surfaces = surfacesAt(a);
  let lo = 0, hi = 20; // vergence in dioptres
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const t = paraxialImage(surfaces, -1000 / mid);
    if (t > RETINA_T) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}
export const A_TABLE = Array.from({ length: 101 }, (_, i) => (i === 0 ? 0 : accommodationOf(i / 100)));
export function lensForAccommodation(A) {
  const top = A_TABLE[A_TABLE.length - 1];
  const v = clamp(A, 0, top);
  for (let i = 1; i < A_TABLE.length; i++) {
    if (A_TABLE[i] >= v) return (i - 1 + (v - A_TABLE[i - 1]) / (A_TABLE[i] - A_TABLE[i - 1])) / 100;
  }
  return 1;
}

// Where an object at vergence V (dioptres, 0 = far) is imaged, relative to the photoreceptors (mm, + behind).
export function focusError(a, V) {
  const t = paraxialImage(surfacesAt(a), V > 1e-6 ? -1000 / V : -Infinity);
  return t - RETINA_T;
}

// De Groot & Gebhard (1952): entrance pupil diameter (mm) for a field luminance L (cd/m2).
export const pupilOf = (L) => 7.175 * Math.exp(-0.00092 * (7.597 + Math.log10(L)) ** 3);
export const trolands = (L, D) => L * Math.PI * (D / 2) ** 2;

// The blind spot: the optic disc is centred 15.5 deg into the temporal field, on the horizontal meridian.
export const BLIND_ANGLE = 15.5;
export const DISC_WIDTH = 1.8; // mm
export const DISC = (() => {
  const s = surfacesAt(0);
  const ray = aimRay({ angle: (BLIND_ANGLE * Math.PI) / 180 }, 0, s, stopAt(0));
  const phi = ray.phi;
  return { phi, half: DISC_WIDTH / 2 / GLOBE.Rr, fromFovea: phi * GLOBE.Rr };
})();

// Lens outline in the section for lens state a: front cap, rounded equator, back cap.
export function lensShape(a) {
  const L = lensAt(a);
  const eqT = lerp(5.2, 5.33, a);
  const eqR = lerp(4.75, 4.42, a);
  const rb = 0.74 * eqR;
  const front = (r) => L.t3 + L.R3 - Math.sqrt(L.R3 * L.R3 - r * r);
  const back = (r) => L.t4 + L.R4 + Math.sqrt(L.R4 * L.R4 - r * r);
  const fSlope = rb / Math.sqrt(L.R3 * L.R3 - rb * rb); // dt/drho
  const bSlope = -rb / Math.sqrt(L.R4 * L.R4 - rb * rb);
  const herm = (p0, m0, p1, m1, n) => {
    const out = [];
    for (let i = 1; i <= n; i++) {
      const u = i / n, u2 = u * u, u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      out.push([h00 * p0[0] + h10 * m0[0] + h01 * p1[0] + h11 * m1[0], h00 * p0[1] + h10 * m0[1] + h01 * p1[1] + h11 * m1[1]]);
    }
    return out;
  };
  const half = (sign) => {
    const pts = [];
    const N = 14;
    for (let i = 0; i <= N; i++) { const r = (rb * i) / N; pts.push([front(r), sign * r]); }
    const F = [front(rb), sign * rb];
    const E = [eqT, sign * eqR];
    const B = [back(rb), sign * rb];
    const k = 1.9;
    const mF = [fSlope * k, sign * k];
    pts.push(...herm(F, mF, E, [k * 0.9, 0], 7));
    pts.push(...herm(E, [k * 0.9, 0], B, [-bSlope * k, -sign * k], 7));
    for (let i = N - 1; i >= 0; i--) { const r = (rb * i) / N; pts.push([back(r), sign * r]); }
    return pts;
  };
  const plus = half(1);
  const minus = half(-1);
  // closed loop: front pole -> +rho equator -> back pole -> -rho equator -> front pole
  const loop = [...plus, ...minus.slice(0, -1).reverse()];
  return {
    loop,
    plus,
    minus,
    eq: [eqT, eqR],
    eqFront: [lerp(front(rb), eqT, 0.55), eqR * 0.965],
    eqBack: [lerp(back(rb), eqT, 0.5), eqR * 0.97],
    front, back, t3: L.t3, t4: L.t4,
  };
}
