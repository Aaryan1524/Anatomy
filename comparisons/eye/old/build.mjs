// Fig 1 · How the eye works: a horizontally sectioned teaching model of a
// right eye on a bench, looking down a short rail at a backlit target box.
// node figures/eye/build.mjs           → figures/eye/eye.html (dark)
// node figures/eye/build.mjs --light   → figures/eye/eye-light.html
// node figures/eye/build.mjs --audit   → geometry audit of the recorded solids
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../kit/iso-kit.mjs";
import * as G from "../../../kit/lathe.mjs";
import * as A from "../../../kit/audit.mjs";
import { kitScript } from "../../../scripts/inline-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "eye-light.html" : "eye.html";

const WIDTH = 600;
const HEIGHT = 380;
const AZ = 52;
const EL = 50;

// ---- world layout (units ≈ px; the eye is drawn 5 units per mm) ----------
const S = 10;
const ZE = 166; // height of the section plane = the optic axis
const RG = M.EYE.R * S; // globe radius, world
const PLATE = { x: -342, y: -108, w: 548, d: 216, r: 10 };
const PLATE_H = 12;
const FOOT_H = 6;
const RAIL = { x: -330, y: -11, w: 182, d: 22, r: 2 };
const RAIL_H = 9;
const X_FAR = -300; // card face at 0 D
const X_NEAR = -172; // card face at 4 D (25 cm)
const xAt = (D) => X_FAR + ((X_NEAR - X_FAR) * D) / 4;
const BOX = { dx: 20, y0: -30, y1: 84, z0: ZE - 34, z1: ZE + 34 };
const CAR_Z = RAIL_H;
const CAR_H = 6;

// eye coordinates (s along the axis toward the target, n nasal +, mm) to world.
// The eye looks along -x; for a right eye the nose is on -y.
const W3 = ([s, n], z = ZE) => [-s * S, -n * S, z];
const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [X_FAR - BOX.dx, BOX.y0, BOX.z1],
    [X_FAR - BOX.dx, BOX.y1, BOX.z1],
    [X_FAR, BOX.y1, BOX.z1],
    [0, -RG, ZE],
    [RG, 0, ZE],
    [0, RG, ZE],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: AZ, elevation: EL },
);
const V = G.viewOf(P);
const at = (p) => k.iso(p, P);
const S_ = (paths, style) => k.solidSvg(paths, style);
const L_ = (d, style) => k.lineSvg(d, style);
const D_ = (pts, style) => k.dotsSvg(pts, style);
const depth = (p) => G.dot3(p, V);
const pathEye = (pts, closed = true) => k.pathOf(pts.map((p) => at(W3(p))), closed);

// ---- audit recorder: every solid drawn is recorded with its true shape ---
const R = A.recorder(P);
const items = [];
function put(name, centre, svg, shapes = [], bias = 0) {
  R.put({ name, at: centre, centre, bias, svg, shapes: shapes.map((shape) => R.solid(shape)) });
}

// ---- base plate on feet --------------------------------------------------
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = k.corners(PLATE, 24).sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
  for (const [x, y] of feet) {
    out.push(S_(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(S_(k.cylinder(x, y, 6, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
  }
  out.push(S_(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L_(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 11);
  out.push(L_(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D_(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // label plate on the near edge
  const label = { x: 112, y: PLATE.y + PLATE.d - 28, w: 66, d: 16, r: 1.5 };
  out.push(S_(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L_(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
  out.push(L_([[label.x + 6, 26], [label.x + 6, 18], [label.x + 6, 32]].map(([x0, len], i) => k.lineOnTop([x0, label.y + 4.5 + i * 3.4], [x0 + len, label.y + 4.5 + i * 3.4], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D_([at([label.x + 3, label.y + label.d / 2, 0.8]), at([label.x + label.w - 3, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  return out.join("");
}
put("stand.plate", [0, 0, -PLATE_H], plate() + `<path class="iso-halo" d="${k.haloOf({ x: -RG * 0.8, y: -RG * 0.8, w: RG * 1.6, d: RG * 1.6, r: RG * 0.8 }, 0, 0.1, P)}" style="filter:blur(10px);opacity:.5"/>`, [A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate", ground: true })], -1000);

// ---- the rail with its dioptre scale --------------------------------------
function rail() {
  const out = [];
  out.push(S_(k.slabOf(RAIL, 0, RAIL_H, P, 3, 0.6), { tone: "mid" }));
  out.push(L_(k.sideSeam(RAIL, 3, P, 3), { tone: "faint" }));
  // ruler strip along the near edge of the rail top
  const strip = { x: X_FAR - 6, y: RAIL.y + RAIL.d - 6.5, w: X_NEAR - X_FAR + 12, d: 5, r: 0.8 };
  out.push(S_(k.slabOf(strip, RAIL_H, 0.5, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(X_FAR, X_NEAR, (X_NEAR - X_FAR) / 16, 4, strip.y + 0.6, RAIL_H + 0.5, [1.6, 3.2], P);
  out.push(L_(ticks.minor, { tone: "lo" }), L_(ticks.major, { tone: "mid" }));
  // end stops
  for (const x of [RAIL.x - 4, RAIL.x + RAIL.w - 1]) {
    out.push(S_(k.slabOf({ x, y: RAIL.y - 3, w: 5, d: RAIL.d + 6, r: 1.2 }, 0, RAIL_H + 5, P, 3, 0.5), { tone: "mid" }));
    out.push(D_([at([x + 2.5, RAIL.y + 2, RAIL_H + 5]), at([x + 2.5, RAIL.y + RAIL.d - 2, RAIL_H + 5])], { size: 0.45 }));
  }
  // rail screws
  out.push(D_([-316, -262, -208, -160].map((x) => at([x, RAIL.y + 4, RAIL_H])), { size: 0.4, tone: "lo" }));
  return out.join("");
}
put("rail", [RAIL.x + RAIL.w / 2, 0, 0], rail(), [A.slab(RAIL, 0, RAIL_H, { name: "rail" })], -900);

// ---- the carriage and its backlit target box (built at x = 0, moved live) ---
// The box's front face (the target) lies in the plane x = 0 of the group.
function carriage() {
  const out = [];
  const car = { x: -26, y: -17, w: 30, d: 34, r: 2.5 };
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(car, 2), CAR_Z, 0.1, P)}" style="filter:blur(4px)"/>`);
  out.push(S_(k.slabOf(car, CAR_Z, CAR_H, P, 4, 0.6), { tone: "mid" }));
  out.push(D_([[-22, -13], [-22, 13], [0, -13], [0, 13]].map(([x, y]) => at([x, y, CAR_Z + CAR_H])), { size: 0.45 }));
  // lock knob on the near side
  const knob = [-11, car.y + car.d + 3.5];
  out.push(S_(k.slabOf({ x: knob[0] - 1.6, y: car.y + car.d - 0.5, w: 3.2, d: 3, r: 0.8 }, CAR_Z + 1.5, 3, P, 2), { tone: "mid", crease: "none" }));
  out.push(S_(k.cylinder(knob[0], knob[1], 3.2, CAR_Z, 6, P, 20), { tone: "mid" }));
  out.push(L_(k.knurl(knob[0], knob[1], 3.2, CAR_Z, CAR_Z + 6, 16, P), { tone: "lo" }));
  // index pointer on the scale: a small tongue reaching over the ruler strip
  out.push(S_(k.slabOf({ x: -1.2, y: car.y + car.d - 2, w: 2.4, d: 3, r: 0.6 }, RAIL_H + 0.5, 0.6, P, 2), { tone: "hi", crease: "lo" }));
  // post with collar
  out.push(S_(k.cylinder(-11, 0, 5, CAR_Z + CAR_H, 4, P, 24), { tone: "mid" }));
  out.push(S_(k.cylinder(-11, 0, 3.2, CAR_Z + CAR_H + 4, BOX.z0 - CAR_Z - CAR_H - 4, P, 24), { tone: "mid", crease: "none" }));
  out.push(L_([30, 46].map((z) => k.sideArc(-11, 0, 3.2, z, P, 14)).join(""), { tone: "faint" }));
  // the light box
  const box = { x: -BOX.dx, y: BOX.y0, w: BOX.dx, d: BOX.y1 - BOX.y0, r: 2 };
  out.push(S_(k.slabOf(box, BOX.z0, BOX.z1 - BOX.z0, P, 4, 0.8), { tone: "mid", inner: L_(k.sideSeam(box, BOX.z1 - 7, P, 4), { tone: "faint" }) }));
  // vents on the lid: closed slots
  for (let i = 0; i < 6; i++) out.push(L_(k.planOutline({ x: -15, y: 10 + i * 9, w: 10, d: 2.4, r: 1.2 }, BOX.z1, P, 3), { tone: "lo" }));
  out.push(D_([[-16, BOX.y0 + 4], [-16, BOX.y1 - 4], [-4, BOX.y0 + 4], [-4, BOX.y1 - 4]].map(([x, y]) => at([x, y, BOX.z1])), { size: 0.45 }));
  return out.join("");
}

// The target face: a diffuser panel in the plane x = 0 (seen from +x).
const PANEL = { y0: BOX.y0 + 4, y1: BOX.y1 - 4, z0: BOX.z0 + 4, z1: BOX.z1 - 4 };
const onFace = (y, z, x = 0.05) => at([x, y, z]);
const facePath = (pts, closed = true, x = 0.05) => k.pathOf(pts.map(([y, z]) => onFace(y, z, x)), closed);
function panelSvg() {
  const out = [];
  const rect = [[PANEL.y0, PANEL.z0], [PANEL.y1, PANEL.z0], [PANEL.y1, PANEL.z1], [PANEL.y0, PANEL.z1]];
  out.push(`<path class="ey-panel" data-part="panel" d="${facePath(rect)}"/>`);
  out.push(L_(facePath(rect), { tone: "lo" }));
  // fixation cross
  out.push(`<path class="ey-mark" d="${facePath([[-5, ZE], [5, ZE]], false)}${facePath([[0, ZE - 5], [0, ZE + 5]], false)}"/>`);
  // the slot the test dot rides in: a closed outline
  const slot = [];
  for (let i = 0; i <= 12; i++) { const t = Math.PI / 2 + (i / 12) * Math.PI; slot.push([10 + 2.2 * Math.cos(t), ZE + 2.2 * Math.sin(t)]); }
  for (let i = 0; i <= 12; i++) { const t = -Math.PI / 2 + (i / 12) * Math.PI; slot.push([88 + 2.2 * Math.cos(t), ZE + 2.2 * Math.sin(t)]); }
  out.push(L_(facePath(slot), { tone: "faint" }));
  // four panel screws
  out.push(D_([[PANEL.y0 + 2.5, PANEL.z0 + 2.5], [PANEL.y1 - 2.5, PANEL.z0 + 2.5], [PANEL.y0 + 2.5, PANEL.z1 - 2.5], [PANEL.y1 - 2.5, PANEL.z1 - 2.5]].map(([y, z]) => onFace(y, z)), { size: 0.45 }));
  return out.join("");
}
// The dimmer knob on the near side of the box (axis +y).
const KNOB_F = G.frameOf([-10, BOX.y1, BOX.z0 + 18], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
function dimmer() {
  const out = [];
  out.push(L_(G.circleOf(KNOB_F, 0.02, 8.5, P), { tone: "faint" }));
  out.push(S_(G.disc(0, 1.5, 6.5, KNOB_F, P), { tone: "mid" }));
  out.push(S_(G.disc(1.5, 5.5, 5, KNOB_F, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(KNOB_F, 1.5, 5.5, 5, 28, P, { fade: [0.1, 0.55] }), { tone: "lo" }) }));
  return out.join("");
}

// ---- the eye stand: a yoke whose two pins hold the globe at its sides ------
const YOKE_Y = RG + 12; // inner faces of the uprights
const YOKE_W = 12;
const BAR_Z = 22;
const BAR_H = 8;
const PIN_DROP = 14; // pins sit this far below the cut
const PIN_R = 4.5;
const UP_TOP = ZE - 6;
function yokeBase() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: -24, y: -24, w: 48, d: 48, r: 24 }, 0, 0.1, P)}" style="filter:blur(5px)"/>`);
  out.push(S_(k.cylinder(0, 0, 24, 0, 4, P, 48, 0.6), { tone: "mid" }));
  out.push(L_(k.ring(0, 0, 19, 4, P, 40), { tone: "faint" }));
  out.push(D_([0, 1, 2, 3].map((i) => at([19 * Math.cos(i * Math.PI / 2 + 0.4), 19 * Math.sin(i * Math.PI / 2 + 0.4), 4])), { size: 0.5 }));
  out.push(S_(k.cylinder(0, 0, 8, 4, BAR_Z - 4, P, 28), { tone: "mid", crease: "none" }));
  out.push(S_(k.slabOf({ x: -YOKE_W / 2, y: -YOKE_Y - YOKE_W, w: YOKE_W, d: 2 * (YOKE_Y + YOKE_W), r: 2.5 }, BAR_Z, BAR_H, P, 4, 0.6), { tone: "mid" }));
  return out.join("");
}
const yokeShapes = [A.cylinder(0, 0, 24, 0, 4, { name: "stand.foot" }), A.cylinder(0, 0, 8, 4, BAR_Z - 4, { name: "stand.column" }), A.slab({ x: -YOKE_W / 2, y: -YOKE_Y - YOKE_W, w: YOKE_W, d: 2 * (YOKE_Y + YOKE_W), r: 2.5 }, BAR_Z, BAR_H, { name: "stand.bar" })];
function upright(sign) {
  const plan = { x: -YOKE_W / 2, y: sign > 0 ? YOKE_Y : -YOKE_Y - YOKE_W, w: YOKE_W, d: YOKE_W, r: 2.5 };
  const z0 = BAR_Z + BAR_H;
  const out = [];
  out.push(S_(k.slabOf(plan, z0, UP_TOP - z0, P, 4, 0.6), { tone: "mid", inner: L_(k.sideSeam(plan, z0 + 10, P, 4), { tone: "faint" }) }));
  out.push(D_([at([0, plan.y + YOKE_W / 2, UP_TOP])], { size: 0.5 }));
  // the pin: level, from the upright's inner face to where its upper rim meets the globe
  const dir = [0, sign, 0];
  const F = G.frameOf([0, 0, ZE - PIN_DROP], dir, [0, 0, 1], [1, 0, 0]);
  const s0 = Math.sqrt(RG * RG - (PIN_DROP - PIN_R) ** 2);
  const s1 = YOKE_Y;
  out.push(S_(G.disc(s0, s1, PIN_R, F, P), { tone: "hi", crease: "lo" }));
  // knurled thumb nut on the outer face
  const sN = YOKE_Y + YOKE_W;
  out.push(S_(G.disc(sN, sN + 5, 6.5, F, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(F, sN, sN + 5, 6.5, 30, P, { fade: [0.1, 0.55] }), { tone: "lo" }) }));
  return { svg: out.join(""), shapes: [A.slab(plan, z0, UP_TOP - z0, { name: "stand.upright" }), A.disc(F, s0, s1, PIN_R, { name: "stand.pin" }), A.disc(F, sN, sN + 5, 6.5, { name: "stand.nut" })], centre: [0, sign * (YOKE_Y + YOKE_W / 2), (z0 + UP_TOP) / 2] };
}
put("stand.yoke", [0, 0, BAR_Z], yokeBase(), yokeShapes);
const UPRIGHTS = [upright(-1), upright(1)];
put("stand.upright", UPRIGHTS[0].centre, UPRIGHTS[0].svg, UPRIGHTS[0].shapes);
put("stand.front", UPRIGHTS[1].centre, UPRIGHTS[1].svg, UPRIGHTS[1].shapes);

// ---- the globe: lower half as a smooth turned bowl, axis vertical ---------
const BOWL_F = G.frameOf([0, 0, ZE], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const bowlProfile = [];
for (let i = 0; i <= 26; i++) {
  const t = (i / 26) * (Math.PI / 2);
  bowlProfile.push([-RG * Math.cos(t), RG * Math.sin(t), 1]);
}
bowlProfile[bowlProfile.length - 1] = [0, RG];
const radius = (s) => Math.sqrt(Math.max(0, RG * RG - s * s));
const slope = (s) => -s / Math.max(1e-3, radius(s));
const onGlobe = (a, b, r = RG) => [-r * Math.cos(b) * Math.cos(a), -r * Math.cos(b) * Math.sin(a), ZE - r * Math.sin(b)];
function globeMarks() {
  const out = [];
  // the lateral rectus, cut flush where it inserts 6.9 mm behind the limbus (temporal side)
  const aL = -(Math.atan2(M.EYE.limbus, limbusS) + 6.9 / M.EYE.R);
  const half = 0.5 / M.EYE.R;
  const patch = [];
  for (let i = 0; i <= 10; i++) patch.push(onGlobe(aL - half * (1 + 0.6 * i / 10), (i / 10) * 0.43));
  for (let i = 10; i >= 0; i--) patch.push(onGlobe(aL + half * (1 + 0.6 * i / 10), (i / 10) * 0.43));
  out.push(`<path class="ey-tendon" d="${k.pathOf(patch.map(at), true)}"/>`);
  out.push(L_(k.pathOf(patch.map(at), true), { tone: "lo" }));
  // two vortex veins leaving the globe behind the equator
  for (const [a, b] of [[-1.95, 0.3], [-2.55, 0.34]]) {
    const c = onGlobe(a, b);
    const F = G.frameAlong(c, G.unit3(G.sub3(c, [0, 0, ZE])));
    out.push(`<path class="ey-vein" d="${G.circleOf(F, 0, 4.5, P)}"/>`);
    out.push(L_(G.circleOf(F, 0, 4.5, P), { tone: "lo" }));
    out.push(L_(G.circleOf(F, 0, 2, P), { tone: "faint" }));
  }
  return out.join("");
}
function bowl() {
  const paths = G.solidOf(bowlProfile, BOWL_F, P, { smooth: { slope, radius }, steps: 160, rims: "last" });
  return S_(paths, { tone: "hi", crease: "none" }) + globeMarks();
}
// The cornea's lower half: a cap turned on the optic axis, clipped below the cut.
const AX_F = G.frameOf([0, 0, ZE], [-1, 0, 0], [0, 0, 1], [0, -1, 0]);
const cc = M.cornealCentre();
const limbusS = Math.sqrt(M.EYE.R ** 2 - M.EYE.limbus ** 2);
const corneaProfile = [];
for (let i = 0; i <= 14; i++) {
  const h = M.EYE.limbus * (1 - i / 14);
  corneaProfile.push([(cc + Math.sqrt(M.EYE.corneaR ** 2 - h * h)) * S, h * S, 1]);
}
corneaProfile[0] = [limbusS * S, M.EYE.limbus * S];
corneaProfile[corneaProfile.length - 1] = [M.EYE.apex * S, 0];
function lowerClip(profile, F) {
  const pts = [];
  for (const [s, r] of profile) for (let j = 0; j <= 48; j++) {
    const ang = Math.PI / 2 + (j / 48) * Math.PI; // angles whose radial points down (u = +z)
    pts.push(at(G.pointOf(F, s, r, ang)));
  }
  return k.pathOf(G.hullOf(pts), true);
}
const corneaClip = lowerClip(corneaProfile, AX_F);
function corneaCap() {
  const paths = G.lathe([[limbusS * S, 0], ...corneaProfile], AX_F, P, { steps: 96 });
  return `<g clip-path="url(#ey-cornea-low)">${S_(paths, { tone: "hi", crease: "none" })}</g>`;
}
const GLOBE_SHAPE = A.lathe(BOWL_F, [[-RG, 0], ...bowlProfile.slice(1), [0, 0]], { name: "eye.globe" });
put("eye.cornea", W3([12, 0], ZE - 15), corneaCap(), [A.lathe(AX_F, [[limbusS * S, 0], ...corneaProfile], { name: "eye.cornea", cut: [GLOBE_SHAPE], seated: true })], 0);
put("eye.globe", [0, 0, ZE - 20], bowl(), [GLOBE_SHAPE], 0);

// ---- the section face (z = ZE): static layers ---------------------------
const E = M.EYE;
const TAU = Math.PI * 2;
const arcPts = (r, a0, a1, count = 60) => Array.from({ length: count + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / count; return [r * Math.cos(a), r * Math.sin(a)]; });
// angle on the globe measured from +s (front) toward +n (nasal)
const angOf = ([s, n]) => Math.atan2(n, s);
const limbusAng = Math.atan2(E.limbus, limbusS);
const outerOutline = [
  ...arcPts(E.R, limbusAng, TAU - limbusAng, 120),
  ...Array.from({ length: 25 }, (_, i) => { const h = -E.limbus + (2 * E.limbus * i) / 24; return [cc + Math.sqrt(E.corneaR ** 2 - h * h), h]; }),
];
const chamberAngle = M.corneoscleralAngle();
const ciIn = E.apex - E.corneaThick - E.corneaInR;
const angleAng = angOf(chamberAngle);
const innerOutline = [
  ...arcPts(E.scleraIn, angleAng, TAU - angleAng, 120),
  ...Array.from({ length: 25 }, (_, i) => { const h = -chamberAngle[1] + (2 * chamberAngle[1] * i) / 24; return [ciIn + Math.sqrt(E.corneaInR ** 2 - h * h), h]; }),
];
const oraAng = Math.acos(E.ora / E.choroidIn);
// retina: arc measured from the back pole, nasal +
const retinaAngleOf = (arc) => Math.PI - arc / E.retinaIn; // globe angle for an arc distance nasal of the fovea... sign handled below
const backAng = (arc) => Math.PI - arc / E.retinaIn; // arc > 0 nasal → angle < π (n > 0)
const discA0 = (E.disc.at - E.disc.width / 2);
const discA1 = (E.disc.at + E.disc.width / 2);
function retinaInner() {
  // from the temporal ora round the back to the nasal ora, with the foveal pit, broken at the disc
  const pts = (a0, a1, count) => Array.from({ length: count + 1 }, (_, i) => {
    const arc = a0 + ((a1 - a0) * i) / count;
    const pit = 0.2 * Math.exp(-((arc / 0.55) ** 2));
    const r = E.retinaIn + pit;
    const a = backAng(arc);
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  const oraArc = (Math.PI - oraAng) * E.retinaIn;
  const oraPoint = (arc) => { const a = backAng(arc); return [E.choroidIn * Math.cos(a), E.choroidIn * Math.sin(a)]; };
  return { temporal: [oraPoint(-oraArc), ...pts(-oraArc, discA0, 160)], nasal: [...pts(discA1, oraArc, 30), oraPoint(oraArc)] };
}
const RET = retinaInner();
const ringAt = (r, arc0, arc1, count) => Array.from({ length: count + 1 }, (_, i) => { const arc = arc0 + ((arc1 - arc0) * i) / count; const a = backAng(arc); return [r * Math.cos(a), r * Math.sin(a)]; });
const oraArcC = (Math.PI - oraAng) * E.retinaIn;

function sectionStatic() {
  const out = [];
  out.push(`<path class="ey-sclera" d="${pathEye(outerOutline)}"/>`);
  out.push(`<path class="ey-humour" d="${pathEye(innerOutline)}"/>`);
  // cornea band: outer cornea arc → inner cornea arc
  const cornea = [
    ...Array.from({ length: 25 }, (_, i) => { const h = -E.limbus + (2 * E.limbus * i) / 24; return [cc + Math.sqrt(E.corneaR ** 2 - h * h), h]; }),
    ...Array.from({ length: 25 }, (_, i) => { const h = chamberAngle[1] - (2 * chamberAngle[1] * i) / 24; return [ciIn + Math.sqrt(E.corneaInR ** 2 - h * h), h]; }),
  ];
  out.push(`<path class="ey-cornea" d="${pathEye(cornea)}"/>`);
  // choroid band round the back, from ora to ora, broken at the scleral canal
  const choroid = (a0, a1) => [...ringAt(E.scleraIn - 0.02, a0, a1, 80), ...ringAt(E.choroidIn, a1, a0, 80)];
  const canal0 = discA0 * (E.scleraIn / E.retinaIn) * (E.retinaIn / E.scleraIn);
  out.push(`<path class="ey-choroid" d="${pathEye(choroid(-oraArcC * 1.0, discA0))}${pathEye(choroid(discA1, oraArcC * 0.995))}"/>`);
  // retina band
  const retinaBand = (inner, a0, a1) => [...inner, ...ringAt(E.choroidIn, a1, a0, 80)];
  out.push(L_(pathEye(innerOutline), { tone: "lo" }));
  out.push(`<path class="ey-retina" d="${pathEye(retinaBand(RET.temporal, -oraArcC, discA0))}${pathEye(retinaBand(RET.nasal, discA1, oraArcC))}"/>`);
  return out.join("");
}
function sectionLines() {
  const out = [];
  {
    const cupAt = backAng(E.disc.at);
    const end = [(E.retinaIn + 0.25) * Math.cos(cupAt), (E.retinaIn + 0.25) * Math.sin(cupAt)];
    const start = [E.lensBack, 0];
    const curve = (off) => Array.from({ length: 25 }, (_, i) => {
      const t = i / 24;
      const s = start[0] + (end[0] - start[0]) * t;
      const n = start[1] + (end[1] - start[1]) * t + 1.1 * Math.sin(Math.PI * t) * (1 - t) + off * Math.sin(Math.PI * Math.min(1, t * 1.6));
      return [s, n];
    });
    out.push(L_(pathEye(curve(0.45), false) + pathEye(curve(-0.45), false), { tone: "faint" }));
  }
  out.push(L_(pathEye(RET.temporal, false) + pathEye(RET.nasal, false), { tone: "mid" }));
  out.push(L_(pathEye(ringAt(E.choroidIn, -oraArcC, discA0 + 0.4, 80), false) + pathEye(ringAt(E.choroidIn, discA1 - 0.4, oraArcC, 30), false), { tone: "lo" }));
  out.push(L_(pathEye(ringAt(E.scleraIn, -oraArcC, discA0 + 0.4, 80), false) + pathEye(ringAt(E.scleraIn, discA1 - 0.4, oraArcC, 30), false), { tone: "lo" }));
  // photoreceptors: a palisade between the retina's outer edge and a line just inside it
  const ticks = [];
  const pal = E.choroidIn - 0.09;
  const step = 0.32;
  for (let arc = -oraArcC + 0.4; arc < oraArcC - 0.3; arc += step) {
    if (arc > discA0 - 0.12 && arc < discA1 + 0.12) continue;
    const a = backAng(arc);
    ticks.push(pathEye([[E.choroidIn * Math.cos(a), E.choroidIn * Math.sin(a)], [(pal - 0.06) * Math.cos(a), (pal - 0.06) * Math.sin(a)]], false));
  }
  out.push(L_(ticks.join(""), { tone: "lo", className: "ey-cones" }));
  return out.join("");
}

// The optic nerve: leaves at the disc and runs back and toward the nose.
const discMid = M.chief(0) && E.disc.at;
const discAngle = backAng(discMid);
const NERVE_DIR = (() => { const u = [-1, 0.42]; const l = Math.hypot(...u); return [u[0] / l, u[1] / l]; })();
const discOut = [E.R * Math.cos(discAngle), E.R * Math.sin(discAngle)];
const NERVE_LEN = 5;
const NERVE_R = 2.1;
const nerveEnd = [discOut[0] + NERVE_DIR[0] * NERVE_LEN, discOut[1] + NERVE_DIR[1] * NERVE_LEN];
const NERVE_W = [-NERVE_DIR[0], NERVE_DIR[1]]; // world direction (x = -s, y = -n) → handled below
const nerveAxisWorld = G.unit3(G.sub3(W3(nerveEnd), W3(discOut)));
const NERVE_F = G.frameOf(W3(discOut), nerveAxisWorld, [0, 0, 1], G.cross3(nerveAxisWorld, [0, 0, 1]));
const nerveProfile = [[-0.6 * S, NERVE_R * S * 0.92], [0.4 * S, NERVE_R * S], [NERVE_LEN * S, NERVE_R * S]];
const nerveClip = lowerClip(nerveProfile, NERVE_F);
function nerveLower() {
  const paths = G.solidOf(nerveProfile, NERVE_F, P, { steps: 64 });
  // the cut end: dura sheath ring and the nerve inside it, lower half only
  const sEnd = NERVE_LEN * S;
  const lower = { from: Math.PI / 2, to: (3 * Math.PI) / 2, least: -1, trim: 0 };
  const face = L_(G.arcOf(NERVE_F, sEnd, (NERVE_R - 0.45) * S, P, lower), { tone: "lo" }) + D_([0.6, 1.2, 1.8, 2.4].flatMap((f) => [0.35, 0.7].map((rr) => at(G.pointOf(NERVE_F, sEnd, rr * (NERVE_R - 0.6) * S, Math.PI / 2 + f)))), { size: 0.5, tone: "lo" });
  return `<g clip-path="url(#ey-nerve-low)">${S_(paths, { tone: "hi", crease: "faint" })}${face}</g>`;
}
function nerveSection() {
  const out = [];
  const nrm = [-NERVE_DIR[1], NERVE_DIR[0]];
  const along = (t, w) => [discOut[0] + NERVE_DIR[0] * t + nrm[0] * w, discOut[1] + NERVE_DIR[1] * t + nrm[1] * w];
  // the canal through the wall, from the disc edges outward
  const edge0 = backAng(discA0), edge1 = backAng(discA1);
  const inner0 = [E.retinaIn * Math.cos(edge0), E.retinaIn * Math.sin(edge0)];
  const inner1 = [E.retinaIn * Math.cos(edge1), E.retinaIn * Math.sin(edge1)];
  const strip = [inner0, along(-0.6, -0.95), along(0.3, -NERVE_R + 0.6), along(1.2, -NERVE_R), along(NERVE_LEN, -NERVE_R), along(NERVE_LEN, NERVE_R), along(1.2, NERVE_R), along(0.3, NERVE_R - 0.6), along(-0.6, 0.95), inner1];
  // the cup: the disc surface dips into the nerve head
  const cup = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const p = [inner1[0] + (inner0[0] - inner1[0]) * t, inner1[1] + (inner0[1] - inner1[1]) * t];
    const dip = 0.45 * Math.sin(Math.PI * t) ** 2;
    cup.push([p[0] - Math.cos(discAngle) * dip, p[1] - Math.sin(discAngle) * dip].map((v, j) => v));
  }
  const poly = [...strip, ...cup.slice(1, -1)];
  out.push(`<path class="ey-nerve" d="${pathEye(poly)}"/>`);
  out.push(L_(pathEye(poly), { tone: "mid" }));
  // the sheath line and the central vessels
  out.push(L_(pathEye([along(0.525, -NERVE_R + 0.45), along(NERVE_LEN, -NERVE_R + 0.45)], false) + pathEye([along(0.525, NERVE_R - 0.45), along(NERVE_LEN, NERVE_R - 0.45)], false), { tone: "faint" }));
  const cupMid = cup[6];
  out.push(L_(pathEye([cupMid, along(NERVE_LEN, -0.25)], false) + pathEye([[cupMid[0] + 0.05, cupMid[1] + 0.05], along(NERVE_LEN, 0.25)], false), { tone: "lo" }));
  // lamina cribrosa: a few strands across the canal at the sclera
  const lam = [];
  for (const t of [-0.15, 0.05]) lam.push(pathEye([along(t, -0.95 - 0.12 * (t + 0.6)), along(t, 0.95 + 0.12 * (t + 0.6))], false));
  out.push(L_(lam.join(""), { tone: "faint" }));
  // cut end of the nerve
  return out.join("");
}

// ---- the nerve rest: a post and saddle under the nerve's end ---------------
function nerveRest() {
  const endW = W3([nerveEnd[0] - NERVE_DIR[0] * 3, nerveEnd[1] - NERVE_DIR[1] * 3]);
  const [x, y] = endW;
  const top = ZE - NERVE_R * S;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: x - 9, y: y - 9, w: 18, d: 18, r: 9 }, 0, 0.1, P)}" style="filter:blur(4px)"/>`);
  out.push(S_(k.cylinder(x, y, 8, 0, 2.5, P, 28, 0.4), { tone: "mid" }));
  out.push(S_(k.cylinder(x, y, 3, 2.5, top - 8 - 2.5, P, 20), { tone: "mid", crease: "none" }));
  out.push(L_(k.sideArc(x, y, 3, 40, P, 12), { tone: "faint" }));
  const saddle = { x: x - 6, y: y - 6, w: 12, d: 12, r: 2 };
  out.push(S_(k.slabOf(saddle, top - 8, 8, P, 3, 0.5), { tone: "mid" }));
  return { svg: out.join(""), shapes: [A.cylinder(x, y, 8, 0, 2.5, { name: "stand.nervebase" }), A.cylinder(x, y, 3, 2.5, top - 10.5, { name: "stand.nervepost" }), A.slab(saddle, top - 8, 8, { name: "stand.saddle" })], at: [x, y, top - 4] };
}

// ---- assemble the drawing in painter's order ------------------------------

R.put({ name: "eye.nerve", at: W3(nerveEnd, ZE - NERVE_R * S / 2), centre: W3(nerveEnd), svg: "", shapes: [R.solid(A.solid(NERVE_F, nerveProfile, { name: "eye.nerve", cut: [GLOBE_SHAPE], seated: true }))] });
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);

const dynamicEye = `
  <g data-part="ciliary">${[0, 1].map((i) => `<path class="ey-ciliary" data-c="${i}"/><path class="iso-line" data-tone="lo" data-co="${i}"/>`).join("")}</g>
  <g data-part="zonules"><path class="iso-line ey-zonule" data-tone="faint" data-zonules/></g>
  <g data-part="lens" class="iso-solid" data-lit><path class="ey-lens" data-lens/><path class="iso-line" data-tone="faint" data-nucleus/><path class="iso-edge ey-lens-edge" data-lens-edge/></g>
  <g data-part="iris">${[0, 1].map((i) => `<path class="ey-iris" data-i="${i}"/><path class="iso-line" data-tone="mid" data-io="${i}"/>`).join("")}</g>
  <path class="ey-beam" data-beam/>
  <path class="iso-line ey-ray" data-tone="hi" data-rays/>
  <path class="iso-line ey-chief" data-tone="hi" data-chief/>
  <g class="iso-dots" data-tone="hi"><circle data-spot r="1.1"/></g>
`;

const body = [
  `<defs><clipPath id="ey-cornea-low"><path d="${corneaClip}"/></clipPath><clipPath id="ey-nerve-low"><path d="${nerveClip}"/></clipPath></defs>`,
  ...R.items.filter((item) => !item.name.startsWith("eye.") && item.name !== "stand.front").map((item) => item.svg),
  `<g data-part="carriage" transform="${k.translateAlong(P, [xAt(0), 0, 0])}">${carriage()}${panelSvg()}<g data-part="dot"><circle class="ey-dot" r="2.1"/></g>${dimmer()}<path class="iso-line" data-tone="hi" data-knob/></g>`,
  ...R.items.filter((item) => item.name.startsWith("eye.")).map((item) => item.svg),
  sectionStatic(),
  sectionLines(),
  L_(pathEye(outerOutline), { tone: "hi" }),
  nerveSection().length ? "" : "",
  `<g data-part="eye-live">${dynamicEye}</g>`,
  nerveLower(),
  nerveSection(),
  UPRIGHTS[1].svg,
];

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A teaching model of a right eye, cut through its horizontal meridian and resting on a three-point stand, looks down a rail at a backlit target box. On the cut face: cornea, iris and pupil, the lens held by zonule fibres from the ciliary body, the retina lining the back with the fovea on the axis and the optic disc where the nerve leaves. Light from the target is drawn through the pupil to the retina.",
  body,
});

// ---- live code ------------------------------------------------------------
const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const CSS = `
.ey-sclera{fill:var(--ey-sclera)}
.ey-humour{fill:var(--ey-humour)}
.ey-cornea{fill:var(--ey-cornea)}
.ey-choroid{fill:var(--ey-choroid)}
.ey-retina{fill:var(--ey-retina)}
.ey-nerve{fill:var(--ey-nerve)}
.ey-ciliary{fill:var(--ey-ciliary)}
.ey-iris{fill:var(--ey-iris)}
.ey-lens{fill:var(--ey-lens)}
.ey-tendon{fill:var(--ey-ciliary)}
.ey-vein{fill:var(--anatomy-shade-0)}
.iso{--ey-sclera:#2b2b2b;--ey-humour:#1e1e1e;--ey-cornea:#232323;--ey-choroid:#0e0e0e;--ey-retina:#3a3a3a;--ey-nerve:#262626;--ey-ciliary:#141414;--ey-iris:#0a0a0a;--ey-lens:#333333;--ey-muscle:#202020}
.iso[data-theme="light"]{--ey-sclera:#ffffff;--ey-humour:#f3f3f0;--ey-cornea:#fbfbfa;--ey-choroid:#9a9a9e;--ey-retina:#e2e2df;--ey-nerve:#ececea;--ey-ciliary:#c9c9cc;--ey-iris:#8f8f94;--ey-lens:#ffffff;--ey-muscle:#d9d9d6}
.ey-lens-edge{fill:none;stroke-width:.8;stroke-linejoin:round}
.ey-beam{fill:var(--ey-light);opacity:.12}
.ey-ray{stroke-width:.4}
.ey-chief{stroke-width:.6}
.ey-panel{fill:var(--ey-light);opacity:.9}
.ey-mark{fill:none;stroke:var(--ey-ink);stroke-width:1;stroke-linecap:round}
.ey-dot{fill:var(--ey-ink)}
.iso{--ey-light:#fff7e6;--ey-ink:#141414}
.iso[data-theme="light"]{--ey-light:#ffb547;--ey-ink:#18181a}
.iso-stage{outline:none;touch-action:pan-y}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
`;

const live = `
${modelSource}
const P = ${JSON.stringify(P)};
const S = ${S}, ZE = ${ZE};
const X_FAR = ${X_FAR}, X_NEAR = ${X_NEAR};
const PANEL = ${JSON.stringify(PANEL)};
const KNOB_F = ${JSON.stringify(KNOB_F)};
const W3 = ([s, n]) => [-s * S, -n * S, ZE];
const pe = (pts, closed = true) => pathOf(pts.map((p) => iso(W3(p), P)), closed);
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (sel) => svg.querySelector(sel);
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const el = {
  carriage: q('[data-part="carriage"]'), panel: q('[data-part="panel"]'), dot: q(".ey-dot"), knob: q("[data-knob]"),
  lens: q("[data-lens]"), lensEdge: q("[data-lens-edge]"), nucleus: q("[data-nucleus]"), zonules: q("[data-zonules]"),
  beam: q("[data-beam]"), rays: q("[data-rays]"), chief: q("[data-chief]"), spot: q("[data-spot]"),
  cil: [0, 1].map((i) => q('[data-c="' + i + '"]')), cilO: [0, 1].map((i) => q('[data-co="' + i + '"]')),
  iris: [0, 1].map((i) => q('[data-i="' + i + '"]')), irisO: [0, 1].map((i) => q('[data-io="' + i + '"]')),
};
const xAt = (D) => X_FAR + ((X_NEAR - X_FAR) * D) / 4;
// knob frame helpers (lathe's pointOf, inlined)
const pointOn = (F, s, r, a) => [0, 1, 2].map((i) => F.o[i] + F.a[i] * s + r * (Math.cos(a) * F.u[i] + Math.sin(a) * F.v[i]));
`;

const BS = M.blindSpan();
const card = k.plateHtml({
  fig: "Fig 1",
  title: "The eye",
  hint: "Hover to move the target",
  readout: "far · accommodation +0.0 D · pupil 2.4 mm",
  keys: [
    { mark: "lit", label: "Lens: rounds up to focus near" },
    { mark: "raised", label: "Iris: opens the pupil in dim light" },
    { mark: "dim", label: "Retina: fovea on the axis, optic disc beside it" },
    { mark: "flat", label: "Light from the target through the pupil" },
  ],
  caption:
    `A right eye cut through its horizontal meridian, drawn to scale, looking down a rail marked in dioptres (0 D is far, 4 D is 25 cm; the rail's distances are not to scale). The cornea (${M.EYE.Fc} D) and the lens (${M.lensPower(0).toFixed(1)} D relaxed) focus a far target on the fovea. When the target comes to 25 cm the ciliary muscle contracts after about ${M.ACC.latency.toFixed(2)} s, the zonules slacken and the lens rounds up, from ${M.lensPower(0).toFixed(1)} to ${M.lensPower(4).toFixed(1)} D, so the eye accommodates 4 D within about a second and its power goes from ${M.eyePower(0).toFixed(1)} to ${M.eyePower(4).toFixed(1)} D. When the room goes from ${M.LIGHT.bright} to ${M.LIGHT.dim} cd/m² the pupil opens from ${M.pupilFor(M.LIGHT.bright).toFixed(1)} to ${M.pupilFor(M.LIGHT.dim).toFixed(1)} mm (Moon and Spencer) over several seconds, ${((M.pupilFor(M.LIGHT.dim) / M.pupilFor(M.LIGHT.bright)) ** 2).toFixed(1)} times the pupil area; the rods then take 20 to 30 minutes more to adapt. A dot ${BS.mid.toFixed(1)}° temporal of the cross images on the optic disc, ${M.EYE.disc.at} mm nasal of the fovea, where there are no rods or cones: the blind spot runs from ${BS.from.toFixed(1)}° to ${BS.to.toFixed(1)}°. Typical adult values in a two-surface model eye; the pupil also narrows slightly for near work.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Eye model: left and right arrows move the target, up and down change the light, B tests the blind spot, Escape rests" aria-valuemin="0" aria-valuemax="4" aria-valuenow="0">${svg}</div>`,
});

const page = k.pageHtml({ title: "The eye", theme, body: `<style>${CSS}</style>${card}`, script: kitScript() + live + readFileSync(join(HERE, "live.js"), "utf8") });
writeFileSync(join(HERE, OUT), page);
console.log("wrote", OUT, (page.length / 1024).toFixed(0) + " KB");
// The bowl's sphere carries on 1.5 mm past the limbus inside the cornea; seen from
// behind the limbus plane, as here, the globe body hides the cornea wherever they overlap.
A.auditOrExit(R, P, { allow: [["eye.cornea", "eye.globe"]] });
