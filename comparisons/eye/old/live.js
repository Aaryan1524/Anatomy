// Live behaviour for the eye model. Inlined after the kit, the model and the
// constants that build.mjs writes, so iso, pathOf, translateAlong, the model's
// functions (bundle, chief, lensOutline, iris, ciliary, pupilFor …) and P,
// S, ZE, el are in scope.

// ---- state: one set of targets that the tour, the pointer, the keys and the
// scenarios all write; one set of animated values the drawing reads ----------
const BLIND = blindSpan();
const P_BRIGHT = pupilFor(LIGHT.bright);
const target = { D: 0, lum: LIGHT.bright, theta: 7, dot: 0 };
const now = { D: 0, lum: LIGHT.bright, theta: 7, dot: 0, A: 0, Arate: 0, pupil: P_BRIGHT, t: 0 };
let topic = "rest";
const history = []; // [t, D seen, luminance] — what the eye was given, for the reflex latencies


const follow = (value, goal, dt, tau) => (Math.abs(goal - value) < 1e-4 ? goal : value + (goal - value) * (1 - Math.exp(-dt / tau)));
function seenAt(t) {
  for (let i = history.length - 1; i >= 0; i--) if (history[i][0] <= t) return history[i];
  return history[0] || [0, now.D, now.lum];
}

// ---- the reflexes ----------------------------------------------------------
function step(dt, calm) {
  now.t += dt;
  // what the person is given: the target box moves and its light changes quickly
  now.D = calm ? target.D : follow(now.D, target.D, dt, 0.11);
  const lumLog = calm ? Math.log10(target.lum) : follow(Math.log10(now.lum), Math.log10(target.lum), dt, 0.12);
  now.lum = 10 ** lumLog;
  if (Math.abs(lumLog - Math.log10(target.lum)) < 1e-4) now.lum = target.lum;
  now.theta = calm ? target.theta : follow(now.theta, target.theta, dt, 0.55);
  now.dot = calm ? target.dot : follow(now.dot, target.dot, dt, 0.25);
  history.push([now.t, now.D, now.lum]);
  while (history.length > 2 && history[1][0] < now.t - 1) history.shift();
  // accommodation: answers the target's vergence after a latency, critically damped
  const goalA = calm ? now.D : seenAt(now.t - ACC.latency)[1];
  if (calm) { now.A = goalA; now.Arate = 0; }
  else {
    const w = goalA > now.A ? ACC.omegaUp : ACC.omegaDown;
    for (let i = 0; i < 4; i++) {
      const h = dt / 4;
      now.Arate += (w * w * (goalA - now.A) - 2 * w * now.Arate) * h;
      now.A += now.Arate * h;
    }
    if (Math.abs(goalA - now.A) < 2e-4 && Math.abs(now.Arate) < 2e-3) { now.A = goalA; now.Arate = 0; }
  }
  // pupil: light reflex (quick to close, slow to open) plus a little near miosis
  const want = (lum) => pupilFor(lum) - PUPIL.nearMiosis * now.A;
  let goalP = want(seenAt(now.t - PUPIL.latencyIn)[2]);
  let tau = PUPIL.tauIn;
  if (goalP > now.pupil) { goalP = want(seenAt(now.t - PUPIL.latencyOut)[2]); tau = PUPIL.tauOut; }
  now.pupil = calm ? want(now.lum) : follow(now.pupil, goalP, dt, tau);
  if (Math.abs(now.pupil - goalP) < 0.002) now.pupil = goalP;
}
const settled = () =>
  now.D === target.D && now.lum === target.lum && now.theta === target.theta && now.dot === target.dot && now.Arate === 0 && now.A === now.D && Math.abs(now.pupil - (pupilFor(now.lum) - PUPIL.nearMiosis * now.A)) < 0.0021;

// ---- drawing -----------------------------------------------------------------
const f1 = (v) => v.toFixed(1);
const lumText = (l) => (l >= 10 ? Math.round(l).toString() : l >= 1 ? l.toFixed(1) : l.toFixed(2).replace(/0$/, ""));
const distText = (D) => (D < 0.01 ? "far" : D < 1 ? (1 / D).toFixed(1) + " m" : Math.round(100 / D) + " cm");
const brightness = (lum) => clamp((Math.log10(lum) + 1) / 4, 0, 1);

function draw() {
  const D = now.D;
  const xc = xAt(D);
  el.carriage.setAttribute("transform", translateAlong(P, [xc, 0, 0]));
  const b = brightness(now.lum);
  el.panel.style.opacity = (0.05 + 0.85 * b).toFixed(3);
  // dimmer pointer on the knob face: 270° of travel, 0.1 → 1000 cd/m²
  const ang = (-135 + 270 * b) * (Math.PI / 180);
  const c = pointOn(KNOB_F, 5.55, 0, 0), tip = pointOn(KNOB_F, 5.55, 4.2, ang);
  el.knob.setAttribute("d", pathOf([iso(c, P), iso(tip, P)]));

  // the eye's own parts
  const lens = lensOutline(now.A);
  el.lens.setAttribute("d", pe(lens.points));
  el.lensEdge.setAttribute("d", pe(lens.points));
  const mid = [(lens.shape.front + lens.shape.back) / 2, 0];
  el.nucleus.setAttribute("d", pe(lens.points.map(([s, n]) => [mid[0] + (s - mid[0]) * 0.56, n * 0.6])));
  const zon = [];
  [1, -1].forEach((sign, i) => {
    const cil = ciliary(now.A, sign);
    el.cil[i].setAttribute("d", pe(cil.outline));
    el.cilO[i].setAttribute("d", pe(cil.outline));
    const ir = iris(now.pupil, now.A, sign);
    el.iris[i].setAttribute("d", pe(ir.outline));
    el.irisO[i].setAttribute("d", pe(ir.outline));
    // zonule fibres: from the ciliary processes to the lens round its equator.
    // Taut when the ciliary muscle is relaxed, slack when it contracts.
    const slack = clamp((eyePower(now.A) - eyePower(0)) / 6, 0, 1);
    const n = lens.points.length;
    const eqIndex = lens.points.reduce((best, p, j) => (sign * p[1] > sign * lens.points[best][1] ? j : best), 0);
    for (let f = 0; f < 5; f++) {
      const pr = cil.processes;
      const u = 0.15 + 0.175 * f; // along the processes, 0..1 over two segments
      const seg = u < 0.5 ? [pr[0], pr[1], u * 2] : [pr[1], pr[2], (u - 0.5) * 2];
      const from = [seg[0][0] + (seg[1][0] - seg[0][0]) * seg[2], seg[0][1] + (seg[1][1] - seg[0][1]) * seg[2]];
      const to = lens.points[(eqIndex + (f - 2) * 2 + n) % n];
      const m = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      const sag = [0.12 * slack * sign, 0.12 * slack * (f - 2) * 0.5];
      zon.push(pe([from, ...[0.25, 0.5, 0.75].map((t) => [from[0] + (to[0] - from[0]) * t + sag[1] * Math.sin(Math.PI * t), from[1] + (to[1] - from[1]) * t - sag[0] * Math.sin(Math.PI * t)]), to], false));
    }
  });
  el.zonules.setAttribute("d", zon.join(""));

  // the light from the target's cross, through the pupil to the retina
  const L = -D;
  const B = bundle({ L, A: now.A, pupil: now.pupil });
  const T = [-xc / S - 0.01, 0];
  const [e1, e2] = B.edges;
  let poly;
  const rays = [];
  if (B.focus > -E_RET) {
    const F = [B.focus, 0];
    poly = pe([T, e1.a, e1.b, e1.c, F, e2.c, e2.b, e2.a]) + pe([F, e1.hit, e2.hit]);
  } else poly = pe([T, e1.a, e1.b, e1.c, e1.hit, e2.hit, e2.c, e2.b, e2.a]);
  for (const e of B.edges) rays.push(pe([T, e.a, e.b, e.c, e.hit], false));
  el.beam.setAttribute("d", poly);
  el.beam.style.opacity = (0.02 + 0.08 * b).toFixed(3);
  el.rays.setAttribute("d", rays.join(""));
  el.rays.style.opacity = (0.2 + 0.5 * b).toFixed(3);

  // the test dot and its chief ray through the nodal point
  const ch = chief(now.theta);
  const Ddraw = -EYE.N * S - xc;
  const yDot = Ddraw * Math.tan(now.theta * DEG);
  const dotScreen = iso([0.05, yDot, ZE], P);
  const base = iso([0, 0, 0], P);
  el.dot.setAttribute("cx", (dotScreen[0] - base[0]).toFixed(2));
  el.dot.setAttribute("cy", (dotScreen[1] - base[1]).toFixed(2));
  el.dot.style.opacity = now.dot.toFixed(3);
  const dotWorld = [xc + 0.05, yDot, ZE];
  el.chief.setAttribute("d", pathOf([iso(dotWorld, P), iso(W3(ch.hit), P)]));
  el.chief.style.opacity = (now.dot * (0.35 + 0.6 * b)).toFixed(3);
  const spot = iso(W3(ch.hit), P);
  el.spot.setAttribute("cx", spot[0].toFixed(2));
  el.spot.setAttribute("cy", spot[1].toFixed(2));
  el.spot.style.opacity = (now.dot * (ch.onDisc ? 0.25 : 1)).toFixed(3);

  say(readoutText(B, ch));
}
const E_RET = EYE.retinaIn;

function readoutText(B, ch) {
  const pupil = "pupil " + f1(now.pupil) + " mm";
  if (topic === "dot" || (topic === "rest" && now.dot > 0.5)) {
    return "dot " + f1(now.theta) + "° temporal · " + (ch.onDisc ? "on the optic disc · unseen" : f1(Math.abs(ch.arc)) + " mm from fovea · seen");
  }
  if (topic === "light") {
    const area = (now.pupil / P_BRIGHT) ** 2;
    return lumText(now.lum) + " cd/m² · " + pupil + (area > 1.05 ? " · " + f1(area) + "× the pupil area" : "");
  }
  if (topic === "focus") {
    const off = B.behind;
    const focus = Math.abs(off) < 0.03 ? "in focus" : "focus " + Math.abs(off).toFixed(2) + " mm " + (off > 0 ? "behind" : "short of") + " retina";
    return distText(now.D) + " · accommodation +" + f1(now.A) + " D · " + focus;
  }
  return distText(now.D) + " · accommodation +" + f1(now.A) + " D · " + pupil;
}
let said = "";
function say(text) {
  if (text !== said) { readout.textContent = text; said = text; }
}
function describe() {
  const words = {
    rest: "Resting: looking far in bright light, lens relaxed, pupil " + f1(target.lum === LIGHT.bright ? P_BRIGHT : pupilFor(target.lum)) + " millimetres",
    focus: "Target at " + (target.D < 0.01 ? "a far distance" : Math.round(100 / target.D) + " centimetres") + ", the eye accommodates " + f1(target.D) + " dioptres",
    light: "Light " + lumText(target.lum) + " candela per square metre, pupil opens to " + f1(pupilFor(target.lum)) + " millimetres",
    dot: "Test dot at " + f1(target.theta) + " degrees temporal" + (chief(target.theta).onDisc ? ", on the blind spot" : ""),
  };
  stage.setAttribute("aria-valuenow", String(target.D));
  stage.setAttribute("aria-valuetext", words[topic] || words.rest);
}

// ---- loop ----------------------------------------------------------------------
let frame = 0, last = 0, visible = false;
function tick(t) {
  const dt = last ? Math.min((t - last) / 1000, 1 / 30) : 1 / 60;
  last = t;
  const calm = still.matches;
  if (touring && !driven) tourStep(dt);
  if (driven && pending && now.t >= pending.at) { const p = pending; pending = null; p.run(); describe(); }
  step(dt, calm);
  draw();
  const idle = settled() && !(touring && !driven) && !pending;
  frame = visible && !idle ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

// ---- idle tour ---------------------------------------------------------------
const TOUR = [
  [2.4, () => set({ D: 0, lum: LIGHT.bright, dot: 0 }, "rest")],
  [4.2, () => set({ D: 1 / NEAR }, "focus")],
  [3.4, () => set({ D: 0 }, "focus")],
  [7.5, () => set({ lum: LIGHT.dim }, "light")],
  [3.4, () => set({ lum: LIGHT.bright }, "light")],
  [1.6, () => set({ dot: 1, theta: 7 }, "dot")],
  [4.6, () => set({ theta: BLIND.mid }, "dot")],
  [2.4, () => set({ theta: 7 }, "dot")],
];
let touring = !still.matches, tourClock = 0, tourIndex = -1, tourNext = 1.4, idleTimer = 0;
function tourStep(dt) {
  tourClock += dt;
  if (tourClock >= tourNext) {
    tourIndex = (tourIndex + 1) % TOUR.length;
    TOUR[tourIndex][1]();
    tourNext = tourClock + TOUR[tourIndex][0];
  }
}
function set(values, name) {
  Object.assign(target, values);
  if (name && name !== topic) { topic = name; }
  describe();
}

// ---- pointer and keyboard (ignored while a scenario drives the figure) ------
function interact() {
  if (driven) return false;
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!driven && !still.matches) { touring = true; tourClock = 0; tourIndex = -1; tourNext = 0.2; run(); } }, 3600);
  return true;
}
stage.addEventListener("pointermove", (event) => {
  if (!interact()) return;
  // the pointer's x over the rail's own screen span: left is far, right is 25 cm
  const box = svg.getBoundingClientRect();
  const vx = ((event.clientX - box.left) / box.width) * svg.viewBox.baseVal.width;
  const x0 = iso([xAt(0), 0, ZE], P)[0], x1 = iso([xAt(4), 0, ZE], P)[0];
  const share = clamp((vx - x0) / (x1 - x0), 0, 1);
  set({ D: Math.round(share * 4 * 20) / 20 }, "focus");
  run();
});
stage.addEventListener("keydown", (event) => {
  const key = event.key;
  let handled = true;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "b", "B", "Escape"].includes(key)) return;
  if (!interact()) { event.preventDefault(); return; }
  if (key === "ArrowLeft") set({ D: clamp(target.D - 0.5, 0, 4) }, "focus");
  else if (key === "ArrowRight") set({ D: clamp(target.D + 0.5, 0, 4) }, "focus");
  else if (key === "Home") set({ D: 0 }, "focus");
  else if (key === "End") set({ D: 4 }, "focus");
  else if (key === "ArrowUp") set({ lum: clamp(target.lum * 10, LIGHT.dim, LIGHT.bright) }, "light");
  else if (key === "ArrowDown") set({ lum: clamp(target.lum / 10, LIGHT.dim, LIGHT.bright) }, "light");
  else if (key === "b" || key === "B") set(target.dot > 0.5 && target.theta === BLIND.mid ? { theta: 7 } : { dot: 1, theta: BLIND.mid }, "dot");
  else if (key === "Escape") set({ D: 0, lum: LIGHT.bright, dot: 0, theta: 7 }, "rest");
  else handled = false;
  if (handled) event.preventDefault();
  run();
});

// ---- scenarios: the hook a parent page drives -----------------------------
// anatomyScenario(id) or postMessage({ type: "scenario", id }). Each scenario
// starts from its own starting state, plays out with the real timings, and then
// holds until another arrives; while driven, the tour and input are off.
let driven = false, pending = null;
function startFrom(values) {
  Object.assign(target, values);
  Object.assign(now, { D: target.D, lum: target.lum, theta: target.theta, dot: target.dot, A: target.D, Arate: 0 });
  now.pupil = pupilFor(now.lum) - PUPIL.nearMiosis * now.A;
  history.length = 0;
  history.push([now.t, now.D, now.lum]);
}
const SCENARIOS = {
  rest() { set({ D: 0, lum: LIGHT.bright, dot: 0, theta: 7 }, "rest"); },
  near() {
    startFrom({ D: 0, lum: LIGHT.bright, dot: 0, theta: 7 });
    set({}, "focus");
    pending = { at: now.t + 0.6, run: () => set({ D: 1 / NEAR }, "focus") };
  },
  dim() {
    startFrom({ D: 0, lum: LIGHT.bright, dot: 0, theta: 7 });
    set({}, "light");
    pending = { at: now.t + 0.6, run: () => set({ lum: LIGHT.dim }, "light") };
  },
  blindspot() {
    startFrom({ D: 0, lum: LIGHT.bright, dot: 1, theta: 7 });
    set({}, "dot");
    pending = { at: now.t + 0.6, run: () => set({ theta: BLIND.mid }, "dot") };
  },
};
function scenario(id) {
  if (id === null || id === "tour" || id === "free") {
    driven = false; pending = null; touring = !still.matches; tourClock = 0; tourIndex = -1; tourNext = 0.2; run();
    return true;
  }
  const play = SCENARIOS[id];
  if (!play) return false;
  driven = true;
  touring = false;
  clearTimeout(idleTimer);
  pending = null;
  play();
  if (still.matches && pending) { const p = pending; pending = null; p.run(); }
  stage.dataset.scenario = id;
  last = 0;
  if (!frame) { if (visible) run(); else { step(0, still.matches); draw(); } }
  return true;
}
window.anatomyScenario = scenario;
window.addEventListener("message", (event) => {
  const data = event && event.data;
  if (data && typeof data === "object" && data.type === "scenario" && typeof data.id === "string") scenario(data.id);
});

draw();
describe();
