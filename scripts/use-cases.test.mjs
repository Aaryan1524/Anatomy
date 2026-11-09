import test from "node:test";
import assert from "node:assert/strict";
import * as k from "../kit/iso-kit.mjs";

test("a plate without cases renders no use-case row", () => {
  const html = k.plateHtml({ fig: "Fig 1", title: "T", readout: "r", body: "<svg></svg>", caption: "c" });
  assert.equal(html.includes("iso-cases"), false);
  assert.equal(k.casesHtml([]), "");
});

test("cases render as at most three numbered, escaped buttons between the card and the legend", () => {
  const cases = [
    { id: "near", label: "Look near" },
    { id: "dim", label: "Lights <dim>" },
    { id: "blind", label: "Blind spot" },
    { id: "extra", label: "Fourth" },
  ];
  const html = k.plateHtml({ fig: "Fig 1", body: "<svg></svg>", caption: "c", cases });
  assert.equal((html.match(/class="iso-case"/g) || []).length, 3);
  assert.equal(html.includes('data-case="extra"'), false);
  assert.ok(html.includes("Lights &lt;dim&gt;"));
  assert.ok(html.indexOf("iso-cases") > html.indexOf("iso-plate"));
  assert.ok(html.indexOf("iso-cases") < html.indexOf("iso-legend"));
});

function fakePage(ids) {
  const listeners = {};
  const button = (id) => {
    const attrs = {};
    const handlers = [];
    return { dataset: { case: id }, attrs, style: { getPropertyValue: () => "" }, closest: () => null, setAttribute: (n, v) => (attrs[n] = v), addEventListener: (_, f) => handlers.push(f), click: () => handlers.forEach((f) => f()) };
  };
  const buttons = ids.map(button);
  const note = { innerHTML: "", hidden: true };
  const root = { querySelectorAll: () => buttons, querySelector: (q) => (q === "[data-case-note]" ? note : null) };
  const stageHandlers = [];
  const stage = { addEventListener: (_, f) => stageHandlers.push(f) };
  globalThis.window = { addEventListener: (type, f) => (listeners[type] = f) };
  return { buttons, note, root, stage, key: (key) => stageHandlers.forEach((f) => f({ key, preventDefault() {} })), message: (data) => listeners.message({ data }) };
}

test("bindCases drives the figure from buttons, keys, the hook and messages", () => {
  const page = fakePage(["near", "dim"]);
  const played = [];
  const cases = k.bindCases((id) => (played.push(id), id === "rest" ? "" : "note for " + id), { root: page.root, stage: page.stage });

  page.buttons[0].click();
  assert.equal(cases.current, "near");
  assert.equal(page.buttons[0].attrs["aria-pressed"], "true");
  assert.equal(page.buttons[1].attrs["aria-pressed"], "false");
  assert.deepEqual([page.note.innerHTML, page.note.hidden], ["note for near", false]);

  page.buttons[0].click();
  assert.equal(cases.current, "rest");
  assert.equal(page.note.hidden, true);

  page.key("2");
  assert.equal(cases.current, "dim");

  window.anatomyScenario("dim");
  assert.equal(cases.current, "dim");
  page.message({ type: "scenario", id: "near" });
  assert.equal(cases.current, "near");
  page.message({ type: "other", id: "dim" });
  assert.equal(cases.current, "near");
  assert.deepEqual(played, ["near", "rest", "dim", "dim", "near"]);
  delete globalThis.window;
});

test("each case carries its hue, a named hue maps to the theme token, and a raw colour passes through escaped", () => {
  const html = k.casesHtml([{ id: "near", label: "Near", hue: "blue" }, { id: "hot", label: "Hot", hue: "#c00" }, { id: "third", label: "Third" }]);
  assert.ok(html.includes('style="--case-hue:var(--anatomy-hue-blue)"'));
  assert.ok(html.includes('style="--case-hue:#c00"'));
  assert.ok(html.includes(`style="--case-hue:var(--anatomy-hue-${k.CASE_HUES[2]})"`), "unset hues follow the default order by position");
  assert.equal((html.match(/iso-case-swatch/g) || []).length, 3);
  for (const theme of [/\.iso\{[^}]*--anatomy-hue-blue:/, /\.iso\[data-theme="light"\]\{[^}]*--anatomy-hue-blue:/]) assert.match(k.ISO_CSS, theme);
});

test("markChange escapes text and wraps each {{changed value}}", () => {
  assert.equal(k.markChange("lens {{60 → 64 D}} <b>"), 'lens <b class="iso-change">60 → 64 D</b> &lt;b&gt;');
  assert.equal(k.markChange("no change"), "no change");
});

test("bindCases colours the parts of the playing case and clears them on rest", () => {
  const style = {};
  const figure = { style: { setProperty: (n, v) => (style[n] = v), removeProperty: (n) => delete style[n] } };
  const part = (cases) => { const attrs = { "data-case-part": cases }; return { attrs, getAttribute: (n) => attrs[n], setAttribute: (n, v) => (attrs[n] = v), removeAttribute: (n) => delete attrs[n] }; };
  const lens = part("near"), pupil = part("dim near");
  figure.querySelectorAll = () => [lens, pupil];
  const mk = (id, hue) => ({ dataset: { case: id }, style: { getPropertyValue: () => hue }, setAttribute() {}, addEventListener() {}, closest: () => figure });
  const buttons = [mk("near", "var(--anatomy-hue-blue)"), mk("dim", "var(--anatomy-hue-amber)")];
  const note = { innerHTML: "", hidden: true };
  globalThis.window = { addEventListener() {} };
  const cases = k.bindCases((id) => (id === "rest" ? "" : "power {{+4 D}}"), { root: { querySelectorAll: () => buttons, querySelector: (q) => (q === "[data-case-note]" ? note : null) } });
  cases.set("near");
  assert.equal(style["--anatomy-change"], "var(--anatomy-hue-blue)");
  assert.ok("data-change" in lens.attrs && "data-change" in pupil.attrs);
  assert.equal(note.innerHTML, 'power <b class="iso-change">+4 D</b>');
  cases.set("dim");
  assert.equal(style["--anatomy-change"], "var(--anatomy-hue-amber)");
  assert.ok(!("data-change" in lens.attrs) && "data-change" in pupil.attrs);
  cases.set("rest");
  assert.equal(style["--anatomy-change"], undefined);
  assert.ok(!("data-change" in pupil.attrs));
  assert.equal(note.hidden, true);
  delete globalThis.window;
});
