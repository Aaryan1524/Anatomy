// The human eye, cut through its horizontal meridian, on a specimen stand.
// node figures/eye/build.mjs            -> figures/eye/eye.html (dark)
// node figures/eye/build.mjs --light    -> figures/eye/eye-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../kit/iso-kit.mjs";
import * as G from "../../../kit/lathe.mjs";
import { kitScript } from "../../../scripts/inline-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "eye-light.html" : "eye.html";

const WIDTH = 600;
const HEIGHT = 400;
const U = 10; // world units per mm
const { c: GC, Rr, choroid: RCH, sclera: RS, ilm: RILM, limbus: [LT, LP], angle: [AT, AP], ora: ORA, oraPhi: ORA_PHI } = M.GLOBE;
const DISC = M.DISC;
const NERVE = { r: 1.6, pia: 1.85, dura: 2.35, end: RS + 8.6 };
const RAY_START = -8;

// The stand, below the cut plane z = 0.
const BASE = { x: -95, y: -110, w: 400, d: 232, r: 12 };
const BASE_TOP = -150;
const BASE_H = 10;
const FOOT_H = 6;
// three claws hold the globe: each ends in a ball that touches the sclera below the equator
const CLAW_TILT = (42 * Math.PI) / 180; // contact, measured from straight down
const CLAW_BALL = 4.5;
const CLAWS = [45, 165, 285].map((deg) => {
  const psi = (deg * Math.PI) / 180;
  const reach = RS * 10 + CLAW_BALL;
  return { psi, ball: [GC * 10 + reach * Math.sin(CLAW_TILT) * Math.cos(psi), reach * Math.sin(CLAW_TILT) * Math.sin(psi), -reach * Math.cos(CLAW_TILT)] };
});
const CUP_TOP = -RS * 10 * 0.62;

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, BASE_TOP - BASE_H - FOOT_H, BASE_TOP),
    [RAY_START * U, -32, 0],
    [RAY_START * U, 32, 0],
    [GC * U - RS * U, 0, 0],
    [GC * U + RS * U, 0, 0],
    [GC * U, -RS * U, 0],
    [GC * U, RS * U, 0],
    [GC * U, RS * U * 0.7, -RS * U * 0.7],
    ...[1, -1].map((side) => {
      const u = [Math.cos(DISC.phi), Math.sin(DISC.phi)];
      return [(GC + u[0] * NERVE.end - u[1] * side * NERVE.dura) * U, (u[1] * NERVE.end + u[0] * side * NERVE.dura) * U, 0];
    }),
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 99, elevation: 50 },
);

const at = (point) => k.iso(point, P);
const W = ([t, r], z = 0) => at([t * U, r * U, z]);
const poly = (pts, closed = true) => k.pathOf(pts.map((p) => W(p)), closed);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const arc = (r, a0, a1, n = 64) => Array.from({ length: n + 1 }, (_, i) => M.onSphere(a0 + ((a1 - a0) * i) / n, r));
const nerveAt = (s, w) => [GC + Math.cos(DISC.phi) * s - Math.sin(DISC.phi) * w, Math.sin(DISC.phi) * s + Math.cos(DISC.phi) * w];

function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of pts.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  const ring = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return ring.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1; return [x + ((x - cx) / d) * 0.35, y + ((y - cy) / d) * 0.35]; });
}
const clipped = (id, points, inner) => `<clipPath id="${id}"><path d="${k.pathOf(hull(points.map(at)), true)}"/></clipPath><g clip-path="url(#${id})">${inner}</g>`;

// ---------- stand ----------
function stand() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, BASE_TOP - BASE_H - FOOT_H, BASE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 24))) {
    out.push(S(k.cylinder(x, y, 8, BASE_TOP - BASE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, BASE_TOP - BASE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BASE, BASE_TOP - BASE_H, BASE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BASE, BASE_TOP - 4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 6), BASE_TOP, P), { tone: "lo" }));
  const screws = k.corners(BASE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, BASE_TOP, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, BASE_TOP])), { size: 0.5 }));
  // millimetre scale along the optic axis, zero under the corneal apex
  const strip = { x: -6, y: BASE.y + BASE.d - 22, w: 312, d: 10, r: 1.2 };
  out.push(S(k.slabOf(strip, BASE_TOP, 0.8, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(0, 300, 10, 5, strip.y + 0.8, BASE_TOP + 0.8, [2.6, 5], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.lineOnTop([0, strip.y + 0.8], [0, strip.y + 7.4], BASE_TOP + 0.8, P), { tone: "hi" }));
  out.push(D([at([strip.x + 3, strip.y + 5, BASE_TOP + 0.8]), at([strip.x + strip.w - 3, strip.y + 5, BASE_TOP + 0.8])], { size: 0.45 }));
  // label plate at the back corner
  const plate = { x: BASE.x + 16, y: BASE.y + BASE.d - 70, w: 62, d: 34, r: 2 };
  out.push(S(k.slabOf(plate, BASE_TOP, 1, P, 4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 2.2), BASE_TOP + 1, P, 4), { tone: "faint" }));
  out.push(L([0.55, 0.8, 0.4].map((len, i) => k.lineOnTop([plate.x + 9, plate.y + 10 + i * 7], [plate.x + 9 + len * (plate.w - 18), plate.y + 10 + i * 7], BASE_TOP + 1, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([plate.x + 4.5, plate.y + 4.5, BASE_TOP + 1]), at([plate.x + plate.w - 4.5, plate.y + plate.d - 4.5, BASE_TOP + 1])], { size: 0.45 }));
  // claw feet: a screwed boss on the base for each claw
  for (const c of CLAWS) {
    const [x, y] = c.ball;
    out.push(S(k.cylinder(x, y, 10, BASE_TOP, 3, P, 32, 0.5), { tone: "mid" }));
    out.push(D([at([x, y, BASE_TOP + 3])], { size: 0.5, tone: "mid" }));
  }
  return out.join("");
}

// ---------- the lower half of the eye, below the cut ----------
const GLOBE_C = [GC * U, 0, 0];
function claw(c) {
  const [x, y, z] = c.ball;
  const out = [];
  out.push(S(k.cylinder(x, y, 5.4, BASE_TOP + 3, 6, P, 24), { tone: "mid", inner: L(k.sideArc(x, y, 5.4, BASE_TOP + 6, P, 16), { tone: "faint" }) }));
  out.push(S(k.cylinder(x, y, 2.6, BASE_TOP + 9, z - BASE_TOP - 9, P, 20), { tone: "mid", crease: "none", inner: L(k.sideArc(x, y, 2.6, (BASE_TOP + z) / 2, P, 12), { tone: "faint" }) }));
  out.push(S(G.sphereOf(c.ball, CLAW_BALL, P, { steps: 32 }), { tone: "mid" }));
  return out.join("");
}
const nearClaw = (c) => { const v = k.towardViewer(P); return Math.cos(c.psi) * v[0] + Math.sin(c.psi) * v[1] > 0; };
function bodies() {
  const out = [];
  for (const c of CLAWS) if (!nearClaw(c)) out.push(claw(c));
  const nu = [Math.cos(DISC.phi), Math.sin(DISC.phi), 0];
  const np = [-Math.sin(DISC.phi), Math.cos(DISC.phi), 0];
  // optic nerve in its dural sheath, from inside the sclera to the cut end
  const F = G.frameAlong(GLOBE_C, nu);
  const s0 = (RS - 1.2) * U, s1 = NERVE.end * U, rr = NERVE.dura * U;
  const nervePts = [];
  for (let i = 0; i <= 24; i++) for (const s of [s0, s1]) {
    const b = (Math.PI * i) / 24;
    nervePts.push([GLOBE_C[0] + nu[0] * s + rr * (np[0] * Math.cos(b)), GLOBE_C[1] + nu[1] * s + rr * (np[1] * Math.cos(b)), -rr * Math.sin(b)]);
  }
  out.push(clipped("ey-nerve-clip", nervePts, S(G.disc(s0, s1, rr, F, P), { tone: "hi" })));
  // globe: the sclera below the cut
  const gl = [];
  for (let i = 0; i <= 12; i++) for (let j = 0; j < 48; j++) {
    const a = (Math.PI / 2) * (i / 12), b = (2 * Math.PI * j) / 48;
    gl.push([GLOBE_C[0] + RS * U * Math.sin(a) * Math.cos(b), RS * U * Math.sin(a) * Math.sin(b), -RS * U * Math.cos(a)]);
  }
  out.push(`<path class="iso-halo" d="${k.pathOf(hull(gl.map((p) => at([p[0], p[1], BASE_TOP]))), true)}" style="filter:blur(6px);opacity:.5"/>`);
  out.push(clipped("ey-globe-clip", gl, S(G.sphereOf(GLOBE_C, RS * U, P, { steps: 96 }), { tone: "hi" })));
  // cornea: the front cap below the cut
  const R1 = M.LEGRAND.cornea.R1;
  const cap = [];
  for (let i = 0; i <= 16; i++) for (let j = 0; j <= 24; j++) {
    const t = (LT * i) / 16, r = Math.sqrt(Math.max(0, R1 * R1 - (R1 - t) ** 2)), b = (Math.PI * j) / 24;
    cap.push([t * U, r * U * Math.cos(b), -r * U * Math.sin(b)]);
  }
  const V = G.viewOf(P);
  const limbus = [];
  for (let j = 0; j <= 60; j++) {
    const b = (Math.PI * j) / 60;
    const p = [LT * U, LP * U * Math.cos(b), -LP * U * Math.sin(b)];
    const n = G.unit3([p[0] - R1 * U, p[1], p[2]]);
    if (G.dot3(n, V) > 0.01) limbus.push(at(p));
  }
  out.push(clipped("ey-cornea-clip", cap, S(G.sphereOf([R1 * U, 0, 0], R1 * U, P, { steps: 72 }), { tone: "hi", inner: "" })));
  out.push(L(k.pathOf(limbus), { tone: "lo" }));
  for (const c of CLAWS) if (nearClaw(c)) out.push(claw(c));
  return out.join("");
}

// ---------- the cut face ----------
const corneaFront = (r) => M.LEGRAND.cornea.R1 - Math.sqrt(M.LEGRAND.cornea.R1 ** 2 - r * r);
const corneaBack = (r) => M.LEGRAND.cornea.t2 + M.LEGRAND.cornea.R2 - Math.sqrt(M.LEGRAND.cornea.R2 ** 2 - r * r);
const span = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
const PSI_L = Math.atan2(LP, LT - GC);
const DURA_ANG = Math.asin(NERVE.dura / RS);
const CUP = (w) => RILM + 0.4 * Math.max(0, 1 - (w / 0.9) ** 2) ** 2 - 0.05 * Math.exp(-(((Math.abs(w) - 0.74) / 0.12) ** 2)) * Math.max(0, 1 - (w / 0.9) ** 2);

function silhouette() {
  const pts = span(-LP, LP, 40).map((r) => [corneaFront(r), r]);
  pts.push(...arc(RS, PSI_L, DISC.phi + DURA_ANG, 40).slice(1));
  pts.push(nerveAt(NERVE.end, NERVE.dura), nerveAt(NERVE.end, -NERVE.dura));
  pts.push(...arc(RS, DISC.phi - DURA_ANG, -PSI_L, 120));
  return pts;
}
const innerFovea = (phi) => {
  const x = phi * Rr; // mm from the foveola
  return RILM + 0.17 * Math.exp(-((x / 0.5) ** 2)) - 0.07 * Math.exp(-(((Math.abs(x) - 1.4) / 0.6) ** 2));
};
function band(r0, r1, a0, a1, inner = null) {
  const n = Math.max(8, Math.round(Math.abs(a1 - a0) * 60));
  const outer = arc(r1, a0, a1, n);
  const inside = span(a1, a0, n).map((a) => M.onSphere(a, inner ? inner(a) : r0));
  return [...outer, ...inside];
}
function section() {
  const out = [];
  const sil = silhouette();
  out.push(`<path class="ey-face ey-sclera" d="${poly(sil)}"/>`);
  // the cavity: aqueous in front, vitreous behind
  const cavity = [...span(-AP, AP, 40).map((r) => [corneaBack(r), r]), ...arc(RCH, Math.atan2(AP, AT - GC), -Math.atan2(AP, AT - GC), 160).slice(1)];
  out.push(`<path class="ey-face ey-vitreous" d="${poly(cavity)}"/>`);
  // cornea, between its two surfaces and the limbus
  const cornea = [...span(-LP, LP, 40).map((r) => [corneaFront(r), r]), [AT, AP], ...span(AP, -AP, 40).map((r) => [corneaBack(r), r]), [AT, -AP]];
  out.push(`<path class="ey-face ey-cornea" d="${poly(cornea)}"/>`);
  out.push(L(poly([[LT, LP], [AT, AP]], false) + poly([[LT, -LP], [AT, -AP]], false), { tone: "lo" }));
  // corneal epithelium and endothelium, limbus to limbus
  const epi = span(-LP * 0.985, LP * 0.985, 40).map((r) => [corneaFront(r) + 0.06, r]);
  out.push(L(poly([[LT, -LP], ...epi, [LT, LP]], false), { tone: "faint" }));
  // canal of Schlemm and the scleral spur at each angle
  for (const s of [1, -1]) {
    const c = [AT + 0.25, s * (AP + 0.42)];
    out.push(L(poly(Array.from({ length: 16 }, (_, i) => [c[0] + 0.14 * Math.cos((i / 16) * 2 * Math.PI), c[1] + 0.07 * Math.sin((i / 16) * 2 * Math.PI)])), { tone: "lo" }));
  }
  // choroid and retina, ora serrata to ora serrata, open at the optic disc
  const dA = DISC.half;
  for (const [a0, a1] of [[-ORA_PHI, DISC.phi - dA], [DISC.phi + dA, ORA_PHI]]) {
    out.push(`<path class="ey-face ey-choroid" d="${poly(band(Rr, RCH, a0, a1))}"/>`);
    out.push(`<path class="ey-face ey-retina" d="${poly(band(Rr, Rr, a0, a1, innerFovea))}"/>`);
  }
  // photoreceptor rim and inner limiting membrane lines are the band outlines
  for (const [a0, a1] of [[-ORA_PHI, DISC.phi - dA], [DISC.phi + dA, ORA_PHI]]) {
    out.push(L(poly(band(Rr, Rr, a0, a1, innerFovea)), { tone: "mid" }));
    out.push(L(poly(band(Rr, RCH, a0, a1)), { tone: "lo" }));
  }
  // rods and cones: a row standing on the pigment layer, none on the disc
  const marks = [];
  for (const [a0, a1] of [[-ORA_PHI, DISC.phi - dA], [DISC.phi + dA, ORA_PHI]]) {
    const n = Math.floor(((a1 - a0) * Rr) / 0.16);
    for (let i = 1; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const fov = Math.exp(-(((a * Rr) / 0.9) ** 2));
      marks.push(poly([M.onSphere(a, Rr), M.onSphere(a, Rr - 0.075 - 0.04 * fov)], false));
    }
  }
  out.push(L(marks.join(""), { tone: "lo" }));
  // optic nerve head and nerve: through the scleral canal, out to the cut end
  const nerve = [];
  for (const w of span(-0.9, 0.9, 30)) nerve.push(nerveAt(CUP(w), w));
  nerve.push(nerveAt(RCH, 0.9), nerveAt(RS - 0.15, NERVE.r), nerveAt(NERVE.end, NERVE.r), nerveAt(NERVE.end, -NERVE.r), nerveAt(RS - 0.15, -NERVE.r), nerveAt(RCH, -0.9));
  // pia and subarachnoid space: closed thin bands either side of the nerve
  for (const s of [1, -1]) {
    const sp = [nerveAt(RS - 0.15, s * NERVE.r), nerveAt(NERVE.end, s * NERVE.r), nerveAt(NERVE.end, s * NERVE.pia), nerveAt(RS + 0.25, s * NERVE.pia)];
    out.push(`<path class="ey-face ey-csf" d="${poly(sp)}"/>`, L(poly(sp), { tone: "lo" }));
  }
  out.push(`<path class="ey-face ey-nerve" d="${poly(nerve)}"/>`, L(poly(nerve), { tone: "mid" }));
  out.push(`<g data-case-part="blindspot">${L(poly(span(-0.9, 0.9, 30).map((w) => nerveAt(CUP(w), w)), false), { tone: "mid" })}</g>`);
  // lamina cribrosa: plates across the canal
  for (const s of span(RCH + 0.18, RS - 0.35, 4)) {
    const w = 0.9 + ((NERVE.r - 0.9) * (s - RCH)) / (RS - 0.15 - RCH);
    out.push(L(poly([nerveAt(s, -w), nerveAt(s, w)], false), { tone: "lo" }));
  }
  // central retinal artery and vein, from the cut end up to the floor of the cup
  for (const w of [-0.16, 0.16]) out.push(L(poly([nerveAt(NERVE.end, w), nerveAt(CUP(w), w)], false), { tone: "lo" }));
  // hyaloid (Cloquet's) canal, from the back of the lens to the disc
  out.push(`<path data-part="hyaloid" class="iso-line" data-tone="faint" d=""/>`);
  out.push(L(poly(sil), { tone: "hi" }));
  return out.join("");
}
const lerpPt = (a, b, x) => [a[0] + (b[0] - a[0]) * x, a[1] + (b[1] - a[1]) * x];

const css = `
.iso{--ey-sclera:#202020;--ey-cornea:#1a1a1a;--ey-vitreous:#161616;--ey-choroid:#0b0b0b;--ey-retina:#262626;--ey-nerve:#242424;--ey-csf:#0e0e0e;--ey-iris:#0c0c0c;--ey-ciliary:#191919;--ey-muscle:#151515;--ey-lens:#2b2b2b}
.iso[data-theme="light"]{--ey-sclera:#ffffff;--ey-cornea:#f7f7f5;--ey-vitreous:#ededea;--ey-choroid:#c9c9c5;--ey-retina:#fbfbf9;--ey-nerve:#fafaf8;--ey-csf:#dadad6;--ey-iris:#cfcfcb;--ey-ciliary:#e4e4e0;--ey-muscle:#d9d9d5;--ey-lens:#ffffff}
.ey-face{stroke:none}
.ey-sclera{fill:var(--ey-sclera)}.ey-cornea{fill:var(--ey-cornea)}.ey-vitreous{fill:var(--ey-vitreous)}.ey-choroid{fill:var(--ey-choroid)}
.ey-retina{fill:var(--ey-retina)}.ey-nerve{fill:var(--ey-nerve)}.ey-csf{fill:var(--ey-csf)}.ey-iris{fill:var(--ey-iris)}
.ey-ciliary{fill:var(--ey-ciliary)}.ey-muscle{fill:var(--ey-muscle)}.ey-lens{fill:var(--ey-lens)}
.ey-beam{stroke:none}
.ey-stage{outline:none;touch-action:pan-y}
.ey-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
`;

const axisA = W([RAY_START, 0]), axisB = W([RAY_START + 6, 0]);
const dotDir = [Math.cos((M.BLIND_ANGLE * Math.PI) / 180), Math.sin((M.BLIND_ANGLE * Math.PI) / 180)];
const dotA = W([RAY_START, 0]), dotB = W([RAY_START + 6 * dotDir[0], 6 * dotDir[1]]);
const grad = (id, [x1, y1], [x2, y2], peak, colour = "var(--anatomy-lit)") =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}">${[0, 0.25, 0.5, 0.75, 1].map((o) => `<stop offset="${o}" stop-opacity="${(peak * o * o * (3 - 2 * o)).toFixed(3)}" style="stop-color:${colour}"/>`).join("")}</linearGradient>`;
const defs = `<defs>${grad("ey-ray", axisA, axisB, 1)}${grad("ey-fill", axisA, axisB, 0.13)}${grad("ey-ray-dot", dotA, dotB, 1, "var(--anatomy-change, var(--anatomy-lit))")}${grad("ey-fill-dot", dotA, dotB, 0.13, "var(--anatomy-change, var(--anatomy-lit))")}</defs>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A human right eye cut through its horizontal meridian and seen from above and in front, resting on a specimen stand with a millimetre scale. Light enters through the cornea, passes the pupil in the iris, is focused by the lens hung from the ciliary body by zonule fibres, and lands on the retina at the fovea. The optic nerve leaves 4.5 mm to the nasal side, where the optic disc has no photoreceptors.",
  body: [
    defs,
    stand(),
    bodies(),
    section(),
    `<g data-part="ciliary" data-case-part="near"></g>`,
    `<g data-part="lens" data-case-part="near"></g>`,
    `<g data-part="iris" data-case-part="dim"></g>`,
    `<g data-part="zonules" data-case-part="near"></g>`,
    `<path data-part="signal" class="iso-line" data-tone="mid" data-flow="" d=""/>`,
    `<g data-part="rays"></g>`,
    `<g data-part="spot"></g>`,
  ],
});

const model = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
${model}
const P = ${JSON.stringify(P)};
const U = ${U};
const NERVE = ${JSON.stringify(NERVE)};
const RAY_START = ${RAY_START};
const L_BRIGHT = 5000, L_DIM = 0.5;
const W = ([t, r]) => iso([t * U, r * U, 0], P);
const poly = (pts, closed = true) => pathOf(pts.map(W), closed);
const span = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
const nerveAt = (s, w) => [GLOBE.c + Math.cos(DISC.phi) * s - Math.sin(DISC.phi) * w, Math.sin(DISC.phi) * s + Math.cos(DISC.phi) * w];
const CUP = ${CUP.toString().replace("RILM", "GLOBE.ilm")};

const stage = document.querySelector(".ey-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const ref = { ciliary: part("ciliary"), lens: part("lens"), iris: part("iris"), zonules: part("zonules"), rays: part("rays"), spot: part("spot"), signal: part("signal"), hyaloid: part("hyaloid") };
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const now = () => performance.now() / 1000;

// ----- dynamics: closed-form segments with latency, chained, so any instant can be evaluated -----
function constant(x) { return { at: () => [x, 0] }; }
function firstOrder(prev, t0, target, lat, tau) {
  const seg = { prev, t0, target, lat, tau };
  seg.at = (t) => {
    if (t < t0 + lat && seg.prev) return seg.prev.at(t);
    const x0 = seg.x0 ?? (seg.x0 = seg.prev ? seg.prev.at(t0 + lat)[0] : target);
    const e = tau > 1e-6 ? Math.exp(-Math.max(0, t - t0 - lat) / tau) : 0;
    return [target + (x0 - target) * e, tau > 1e-6 ? -((x0 - target) * e) / tau : 0];
  };
  return seg;
}
function damped(prev, t0, target, lat, w) {
  const seg = { prev, t0, target, lat, w };
  seg.at = (t) => {
    if (t < t0 + lat && seg.prev) return seg.prev.at(t);
    if (!seg.s0) seg.s0 = seg.prev ? seg.prev.at(t0 + lat) : [target, 0];
    if (w > 1e3) return [target, 0];
    const [x0, v0] = seg.s0, u = Math.max(0, t - t0 - lat);
    const c1 = x0 - target, c2 = v0 + w * c1, e = Math.exp(-w * u);
    return [target + (c1 + c2 * u) * e, (c2 - w * (c1 + c2 * u)) * e];
  };
  return seg;
}
const prune = (seg, t) => { if (seg.prev && t >= seg.t0 + seg.lat) { if (seg.x0 === undefined && seg.s0 === undefined) { seg.at(t); } seg.prev = null; } };

// controls (the stimulus) and the eye's responses
const ctl = { V: 0, L: L_BRIGHT, dot: 0 };
let acc = constant(0), pupil = constant(pupilOf(L_BRIGHT)), dotSeg = constant(0), glow = constant(Math.log10(L_BRIGHT));
let topic = "rest";
function setControls(next, t) {
  const calm = still.matches;
  for (const s of [acc, pupil, dotSeg, glow]) prune(s, t);
  if (next.V !== undefined && next.V !== ctl.V) { ctl.V = next.V; acc = damped(acc, t, next.V, calm ? 0 : 0.35, calm ? 1e9 : 7.5); }
  if (next.L !== undefined && next.L !== ctl.L) {
    ctl.L = next.L;
    const want = pupilOf(next.L), from = pupil.at(t)[0];
    const dilate = want > from;
    pupil = firstOrder(pupil, t, want, calm ? 0 : dilate ? 0.4 : 0.25, calm ? 0 : dilate ? 2.0 : 0.55);
    glow = firstOrder(glow, t, Math.log10(next.L), 0, calm ? 0 : 0.12);
  }
  if (next.dot !== undefined && next.dot !== ctl.dot) { ctl.dot = next.dot; dotSeg = firstOrder(dotSeg, t, next.dot, 0, calm ? 0 : 0.3); }
}

// ----- drawing -----
const M0 = pupilMagnification(0);
const REST = (() => {
  const sh = lensShape(0);
  const cil = ciliaryOf(0);
  return zonuleEnds(sh, cil).map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
})();
function ciliaryOf(a) {
  const side = (s) => {
    const wall = span(3.3, GLOBE.ora, 28).map((t) => [t, s * wallRho(t)]);
    const Pp = [lerp(5.05, 4.88, a), s * lerp(5.62, 5.2, a)];
    const Q2 = [5.85, s * lerp(6.4, 6.08, a)];
    const Q3 = [4.4, s * lerp(5.62, 5.3, a)];
    const inner = [[GLOBE.ora, s * (wallRho(GLOBE.ora) - 0.12)], [7.4, s * (wallRho(7.4) - 0.2)], [6.6, s * (wallRho(6.6) - 0.32)], Q2, [5.45, s * lerp(5.95, 5.6, a)], Pp, Q3, [3.95, s * (wallRho(3.95) - lerp(0.45, 0.62, a))], [3.62, s * (wallRho(3.62) - 0.34)]];
    const muscle = [...span(3.55, 6.8, 12).map((t) => [t, s * (wallRho(t) - 0.04)]), [5.3, s * (wallRho(5.3) - lerp(0.42, 0.6, a))], [lerp(4.45, 4.3, a), s * (wallRho(4.45) - lerp(0.95, 1.3, a))], [3.8, s * (wallRho(3.8) - 0.3)]];
    return { body: [...wall, ...inner], muscle, P: Pp, Q2, Q3 };
  };
  return [side(1), side(-1)];
}
function zonuleEnds(sh, cil) {
  const out = [];
  cil.forEach((c, i) => {
    const half = i === 0 ? sh.plus : sh.minus;
    out.push([c.Q3, half[18]], [c.P, half[21]], [c.Q2, half[24]]);
  });
  return out;
}
function zonulePath(a, b, rest) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (d >= rest - 1e-4) return poly([a, b], false);
  const s = Math.sqrt((3 * d * (rest - d)) / 8);
  const n = [(b[1] - a[1]) / d, -(b[0] - a[0]) / d];
  const sign = n[0] > 0 ? 1 : -1; // bow backwards, toward the vitreous
  const m = [(a[0] + b[0]) / 2 + n[0] * s * 2 * sign, (a[1] + b[1]) / 2 + n[1] * s * 2 * sign];
  const pts = span(0, 1, 10).map((u) => [(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * m[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * m[1] + u * u * b[1]]);
  return poly(pts, false);
}
function irisOf(sh, ri) {
  return [1, -1].map((s) => {
    const fr = (r) => sh.front(r);
    const root = [3.34, s * 5.42], rootP = [3.66, s * 5.7];
    const gather = clamp((5.2 - ri) / 4.4, 0, 1); // a constricted pupil spreads the iris thin
    const mA = [fr(ri) - 0.34, s * ri], mP = [fr(ri) - 0.025, s * ri];
    const coll = ri + 0.36 * (5.42 - ri);
    const collA = [lerp(mA[0], root[0], 0.36) - lerp(0.42, 0.22, gather), s * coll];
    const back = span(ri, ri + 0.55, 4).map((r) => [fr(r) - 0.025 - (r - ri) * 0.1, s * r]);
    return [root, collA, mA, mP, ...back.slice(1), rootP];
  });
}
let lastA = -1, lastR = -1;
function drawEye(a, ri) {
  if (Math.abs(a - lastA) < 1e-5 && Math.abs(ri - lastR) < 1e-5) return;
  lastA = a; lastR = ri;
  const sh = lensShape(a);
  const cil = ciliaryOf(a);
  ref.ciliary.innerHTML = cil.map((c) => '<path class="ey-face ey-ciliary" d="' + poly(c.body) + '"/>' + lineSvg(poly(c.body), { tone: "lo" }) + '<path class="ey-face ey-muscle" d="' + poly(c.muscle) + '"/>' + lineSvg(poly(c.muscle), { tone: "lo" }) + (a > 0.004 ? '<g opacity="' + Math.min(1, a / 0.6).toFixed(3) + '">' + lineSvg(poly(c.muscle), { tone: "hi" }) + '</g>' : "")).join("");
  const mid = (sh.t3 + sh.t4) / 2;
  const nucleus = sh.loop.map(([t, r]) => [mid + (t - mid) * 0.6, r * 0.62]);
  ref.lens.innerHTML = '<path class="ey-face ey-lens" d="' + poly(sh.loop) + '"/>' + lineSvg(poly(nucleus), { tone: "faint" }) + lineSvg(poly(sh.loop), { tone: "hi" });
  ref.iris.innerHTML = irisOf(sh, ri).map((p) => '<path class="ey-face ey-iris" d="' + poly(p) + '"/>' + lineSvg(poly(p), { tone: "mid" })).join("");
  ref.zonules.innerHTML = lineSvg(zonuleEnds(sh, cil).map(([p, q], i) => zonulePath(p, q, REST[i])).join(""), { tone: "lo" });
  const back = [sh.t4, 0], disc = nerveAt(CUP(0), 0);
  const pts = span(0, 1, 16).map((u) => [lerp(back[0], disc[0], u), lerp(0, disc[1], u) + 0.55 * Math.sin(Math.PI * u) * (1 - u)]);
  ref.hyaloid.setAttribute("d", poly(pts, false));
}

// rays: exact trace, aimed at fractions of the iris aperture
const FRACTIONS = [-0.92, -0.62, -0.31, 0, 0.31, 0.62, 0.92];
function cupHit(p, q) {
  // first crossing of segment p->q with the optic cup surface
  const cup = span(-0.9, 0.9, 30).map((w) => nerveAt(CUP(w), w));
  for (let i = 1; i < cup.length; i++) {
    const a = cup[i - 1], b = cup[i];
    const d1 = [q[0] - p[0], q[1] - p[1]], d2 = [b[0] - a[0], b[1] - a[1]];
    const den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 1e-12) continue;
    const s = ((a[0] - p[0]) * d2[1] - (a[1] - p[1]) * d2[0]) / den;
    const u = ((a[0] - p[0]) * d1[1] - (a[1] - p[1]) * d1[0]) / den;
    if (s >= 0 && s <= 1 && u >= 0 && u <= 1) return [p[0] + d1[0] * s, p[1] + d1[1] * s];
  }
  return null;
}
function bundle(source, a, ri, toDisc) {
  const s = surfacesAt(a), stop = stopAt(a);
  const rays = FRACTIONS.map((f) => aimRay(source, f * ri, s, stop, RAY_START)).filter(Boolean);
  if (toDisc) for (const r of rays) {
    const n = r.points.length, hit = cupHit(r.points[n - 2], r.points[n - 1]);
    if (hit) { r.points[n - 1] = hit; r.end = hit; }
  }
  return rays;
}
function beamSvg(rays, ray, fill, alpha) {
  if (rays.length < 2) return "";
  const first = rays[0].points, last = rays[rays.length - 1].points;
  const shape = '<path class="ey-beam" style="fill:url(#' + fill + ')" d="' + poly([...first, ...[...last].reverse()]) + '"/>';
  const lines = rays.map((r) => '<path class="iso-line" data-tone="lit" data-free="start" style="stroke:url(#' + ray + ');stroke-width:.5" d="' + poly(r.points, false) + '"/>').join("");
  return '<g opacity="' + alpha.toFixed(3) + '">' + shape + lines + '</g>';
}
const SIGNAL = (() => {
  const pts = span(0, DISC.phi - DISC.half * 0.6, 24).map((phi) => onSphere(phi, GLOBE.ilm + 0.08));
  const mouth = nerveAt(CUP(0.35) + 0.05, 0.35);
  pts.push(mouth, nerveAt(GLOBE.sclera, 0.5), nerveAt(NERVE.end, 0.5));
  return poly(pts, false);
})();
ref.signal.setAttribute("d", SIGNAL);

// ----- state at an instant -----
function stateAt(t) {
  const A = Math.max(0, acc.at(t)[0]);
  const a = lensForAccommodation(A);
  const Dent = pupil.at(t)[0];
  const ri = Dent / 2 / pupilMagnification(a);
  const dot = clamp(dotSeg.at(t)[0], 0, 1);
  const lg = glow.at(t)[0];
  return { A, a, Dent, ri, dot, lg, err: focusError(a, ctl.V) };
}
const fmt = (x) => (x >= 100 ? Math.round(x).toLocaleString("en-US") : x >= 10 ? x.toFixed(1) : x.toFixed(1));
const distText = (V) => (V < 0.02 ? "far" : 1000 / V >= 1000 ? (1 / V).toFixed(1) + " m" : Math.round(100 / V) + " cm");
const focusText = (err) => (Math.abs(err) < 0.02 ? "sharp on fovea" : "focus " + Math.abs(err).toFixed(2) + " mm " + (err > 0 ? "behind" : "in front of") + " retina");
function readoutOf(s) {
  if (topic === "blindspot" && s.dot > 0.5) return "dot " + BLIND_ANGLE.toFixed(1) + "\\u00b0 \\u00b7 {{on disc}}, " + DISC.fromFovea.toFixed(1) + " mm off fovea \\u00b7 {{not seen}}";
  if (topic === "near") return distText(ctl.V) + " \\u00b7 {{+" + s.A.toFixed(1) + " D}} \\u00b7 {{" + focusText(s.err) + "}}";
  if (topic === "dim") return fmt(ctl.L) + " cd/m\\u00b2 \\u00b7 pupil {{" + s.Dent.toFixed(1) + " mm}} \\u00b7 {{" + fmt(trolands(ctl.L, s.Dent)) + " td}}";
  return distText(ctl.V) + " \\u00b7 " + fmt(ctl.L) + " cd/m\\u00b2 \\u00b7 pupil " + s.Dent.toFixed(1) + " mm \\u00b7 " + (Math.abs(s.err) < 0.02 ? "sharp" : "blur");
}
function draw(t) {
  const s = stateAt(t);
  drawEye(s.a, s.ri);
  const bright = clamp((s.lg - Math.log10(L_DIM)) / (Math.log10(L_BRIGHT) - Math.log10(L_DIM)), 0, 1);
  const alpha = 0.42 + 0.58 * bright;
  const src = ctl.V > 0.02 ? { at: [-1000 / ctl.V, 0] } : { angle: 0 };
  const main = bundle(src, s.a, s.ri, false);
  let html = beamSvg(main, "ey-ray", "ey-fill", alpha);
  let dotRays = [];
  if (s.dot > 0.004) { dotRays = bundle({ angle: (BLIND_ANGLE * Math.PI) / 180 }, s.a, s.ri, true); html += beamSvg(dotRays, "ey-ray-dot", "ey-fill-dot", alpha * s.dot); }
  ref.rays.innerHTML = html;
  const ends = main.map((r) => W(r.end));
  if (!ends.length) ends.push(W(onSphere(0, GLOBE.Rr)));
  ref.spot.innerHTML = dotsSvg(ends, { size: 0.55, tone: "hi" }) + dotsSvg([ends[Math.floor(ends.length / 2)]], { size: 1.1, tone: "hi" });
  ref.signal.style.opacity = (0.35 + 0.65 * bright).toFixed(3);
  const text = readoutOf(s);
  if (readout.dataset.text !== text) { readout.dataset.text = text; readout.innerHTML = markChange(text); }
  return s;
}

// ----- scenarios, tour and input -----
const SCENARIOS = {
  rest: [],
  near: [{ at: 0, set: { V: 4 } }],
  dim: [{ at: 0, set: { L: L_DIM } }],
  blindspot: [{ at: 0, set: { dot: 1 } }],
};
const START = { V: 0, L: L_BRIGHT, dot: 0 };
let mode = "tour", plan = null, idleTimer = 0, frame = 0, visible = false;
function atStart(t) {
  const s = stateAt(t);
  return ctl.V === 0 && ctl.L === L_BRIGHT && ctl.dot === 0 && s.A < 0.01 && Math.abs(s.Dent - pupilOf(L_BRIGHT)) < 0.01 && s.dot < 0.005;
}
function startPlan(id, t, kind) {
  const ready = atStart(t);
  setControls(START, t);
  const lead = ready || still.matches ? 0.4 : 1.8;
  plan = { id, t0: t, kind, steps: SCENARIOS[id].map((s) => ({ at: lead + s.at, set: s.set, done: false })) };
  topic = id;
  if (still.matches) { for (const st of plan.steps) { setControls(st.set, t); st.done = true; } }
}
function anatomyScenario(id) {
  if (!Object.prototype.hasOwnProperty.call(SCENARIOS, id)) return false;
  mode = "scenario";
  clearTimeout(idleTimer);
  startPlan(id, now(), "scenario");
  describe();
  draw(now());
  run();
  return true;
}
window.__eye = () => { const t = now(); const s = stateAt(t); return { mode, topic, ctl: { ...ctl }, A: s.A, a: s.a, pupil: s.Dent, iris: s.ri, dot: s.dot, err: s.err, acc: { t0: acc.t0, lat: acc.lat, target: acc.target, s0: acc.s0, hasPrev: !!acc.prev }, t }; };
const NOTES = {
  near: () => "The ciliary muscle contracts, the zonules slacken and the lens rounds up: {{+4.0 D}} of accommodation brings the page at {{25 cm}} sharp onto the fovea within about a second and a half.",
  dim: () => "Light drops {{5,000 \u2192 0.5 cd/m\u00b2}}. After 0.4 s the iris opens the pupil {{" + pupilOf(L_BRIGHT).toFixed(1) + " \u2192 " + pupilOf(L_DIM).toFixed(1) + " mm}}, so the light reaching the retina goes {{" + fmt(trolands(L_BRIGHT, pupilOf(L_BRIGHT))) + " \u2192 " + fmt(trolands(L_DIM, pupilOf(L_DIM))) + " td}}.",
  blindspot: () => "A dot {{" + BLIND_ANGLE.toFixed(1) + "\u00b0}} out to the side lands on the optic disc, {{" + DISC.fromFovea.toFixed(1) + " mm}} from the fovea, where there are no rods or cones, so it is {{not seen}}.",
};
const cases = bindCases((id) => { anatomyScenario(id); return id === "rest" ? "" : NOTES[id](); }, { stage });

const TOUR = [
  { at: 0, id: "rest" }, { at: 2.6, id: "near" }, { at: 7.2, id: "rest" }, { at: 9.6, id: "dim" }, { at: 18, id: "rest" }, { at: 20.4, id: "blindspot" }, { at: 25, id: "rest" },
];
const TOUR_LEN = 27.4;
let tourT0 = 0, tourIndex = -1;
function tourStep(t) {
  const u = (t - tourT0) % TOUR_LEN;
  let i = 0;
  for (let j = 0; j < TOUR.length; j++) if (u >= TOUR[j].at) i = j;
  if (i !== tourIndex) { tourIndex = i; startPlan(TOUR[i].id, t, "tour"); describe(); }
}
function advance(t) {
  if (!plan) return;
  for (const st of plan.steps) if (!st.done && t - plan.t0 >= st.at) { setControls(st.set, plan.t0 + st.at); st.done = true; }
}
function settledAt(t) {
  if ([acc, pupil, dotSeg, glow].some((seg) => seg.t0 !== undefined && t < seg.t0 + seg.lat + 0.02)) return false;
  const s1 = stateAt(t), s2 = stateAt(t + 0.05);
  return Math.abs(s1.A - s2.A) < 1e-4 && Math.abs(s1.Dent - s2.Dent) < 1e-4 && Math.abs(s1.dot - s2.dot) < 1e-4 && Math.abs(s1.lg - s2.lg) < 1e-4 && (!plan || plan.steps.every((st) => st.done));
}
function tick() {
  const t = now();
  if (mode === "tour") tourStep(t);
  advance(t);
  draw(t);
  frame = visible && (mode === "tour" || !settledAt(t)) ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) frame = requestAnimationFrame(tick); }
function describe() {
  const s = stateAt(now() + 30);
  stage.setAttribute("aria-valuenow", ctl.V.toFixed(1));
  stage.setAttribute("aria-valuetext", "Target " + distText(ctl.V) + ", " + fmt(ctl.L) + " candela per square metre, pupil " + pupilOf(ctl.L).toFixed(1) + " millimetres" + (ctl.dot ? ", dot on the blind spot, not seen" : ""));
}
function userInput() {
  mode = "user";
  plan = null;
  clearTimeout(idleTimer);
  if (!still.matches) idleTimer = setTimeout(() => { if (mode === "user") { mode = "tour"; tourT0 = now(); tourIndex = -1; run(); } }, 3600);
}
stage.addEventListener("pointermove", (event) => {
  if (mode === "scenario" || event.pointerType === "touch") return;
  const box = svg.getBoundingClientRect();
  const fx = clamp(((event.clientX - box.left) / box.width - 0.1) / 0.55, 0, 1);
  const fy = clamp(((event.clientY - box.top) / box.height - 0.15) / 0.7, 0, 1);
  const V = Math.round(fx * 40) / 10;
  const Lv = Math.pow(10, lerp(Math.log10(L_BRIGHT), Math.log10(L_DIM), Math.round(fy * 20) / 20));
  const t = now();
  userInput();
  const dV = Math.abs(V - ctl.V), dL = Math.abs(Math.log10(Lv) - Math.log10(ctl.L));
  if (dV > 0 || dL > 0) topic = dV / 4 >= dL / 4 ? "near" : "dim";
  setControls({ V, L: Lv }, t);
  run();
});
stage.addEventListener("pointerdown", (event) => {
  userInput();
  if (event.pointerType === "touch") { topic = "blindspot"; setControls({ dot: ctl.dot ? 0 : 1 }, now()); }
  run();
});
stage.addEventListener("pointerleave", () => { if (mode === "user") userInput(); });
stage.addEventListener("keydown", (event) => {
  const t = now();
  let next = null;
  if (event.key === "ArrowRight") { next = { V: clamp(Math.round((ctl.V + 0.5) * 10) / 10, 0, 4) }; topic = "near"; }
  else if (event.key === "ArrowLeft") { next = { V: clamp(Math.round((ctl.V - 0.5) * 10) / 10, 0, 4) }; topic = "near"; }
  else if (event.key === "Home") { next = { V: 0 }; topic = "near"; }
  else if (event.key === "End") { next = { V: 4 }; topic = "near"; }
  else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    const step = event.key === "ArrowUp" ? 1 : -1;
    const lg = clamp(Math.round(Math.log10(ctl.L) * 2) / 2 + step * 0.5, Math.log10(L_DIM), Math.log10(L_BRIGHT));
    next = { L: Math.abs(lg - Math.log10(L_BRIGHT)) < 1e-6 ? L_BRIGHT : Math.abs(lg - Math.log10(L_DIM)) < 1e-6 ? L_DIM : Math.pow(10, lg) };
    topic = "dim";
  } else if (event.key === "b" || event.key === "B" || event.key === " " || event.key === "Enter") { next = { dot: ctl.dot ? 0 : 1 }; topic = "blindspot"; }
  else if (event.key === "Escape") { next = { ...START }; topic = "rest"; }
  if (!next) return;
  event.preventDefault();
  userInput();
  setControls(next, t);
  describe();
  run();
});
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); else if (frame) { cancelAnimationFrame(frame); frame = 0; } }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) mode = "user";
tourT0 = now();
if (mode === "tour") tourStep(tourT0); else { topic = "rest"; }
describe();
draw(now());
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "The human eye",
  hint: "Hover · arrows · B",
  readout: "far · 5,000 cd/m² · pupil 1.9 mm · sharp",
  cases: [
    { id: "near", label: "Look at something near", hue: "violet" },
    { id: "dim", label: "Lights go dim", hue: "amber" },
    { id: "blindspot", label: "Dot on the blind spot", hue: "red" },
  ],
  keys: [
    { mark: "lit", label: "Light from what the eye looks at, traced through cornea and lens" },
    { mark: "raised", label: "Lens, hung from the ciliary muscle by zonule fibres" },
    { mark: "flat", label: "Retina, with the fovea on the axis and the optic disc 4.5 mm nasal" },
  ],
  caption:
    "A right eye cut through its horizontal meridian, seen from above on a stand with a millimetre scale. Light is bent mostly by the cornea, then by the lens, onto the fovea. For near work the ciliary muscle contracts, the zonules slacken and the lens rounds up: 4.0 D of accommodation for 25 cm (the readout's +D). In dim light the pupil opens and lets in more light (td: trolands, luminance times pupil area). The optic disc, where the nerve leaves, has no rods or cones, so a dot 15.5° out to the side is not seen. Optics from Le Grand's schematic eye; pupil size from De Groot and Gebhard (1952). Move left and right to change the distance, up and down to change the light; B shows the dot.",
  body: `<div class="ey-stage iso-stage" tabindex="0" role="slider" aria-label="The human eye. Left and right arrows move the target nearer or farther, up and down change the light, B shows a dot on the blind spot, Escape returns to rest." aria-valuemin="0" aria-valuemax="4" aria-valuenow="0">${svg}</div>`,
});

const html = k.pageHtml({ title: "The human eye", theme, body, script: kitScript() + live }).replace("</style>", css + "</style>");
writeFileSync(join(HERE, OUT), html);
console.log("wrote", OUT, (html.length / 1024).toFixed(0) + " KB");
