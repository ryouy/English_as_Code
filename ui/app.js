const TOKEN_RE = /[A-Za-z]+(?:'[A-Za-z]+)*|[.,!?;:]/g;

function tokenizeClient(text) {
  const toks = [];
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    toks.push({ surface: m[0], start: m.index, end: m.index + m[0].length });
  }
  return toks;
}

let state = { mode: "simple", sentences: [] };

const englishPane = document.getElementById("englishPane");
const codePane = document.getElementById("codePane");
const inspectorBody = document.getElementById("inspectorBody");
const input = document.getElementById("input");

document.getElementById("analyze").addEventListener("click", analyze);
document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.mode = btn.dataset.mode;
    render();
  });
});

async function analyze() {
  const text = input.value;
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  state.sentences = data.sentences;
  render();
}

/** Maps an Inspector POS label to a syntax-highlight color class. Same category
 * -> same color on both the English and Code sides. */
function colorClass(pos, isSlang) {
  if (isSlang) return "c-slang";
  if (!pos) return "c-default";
  if (pos.includes("pronoun")) return "c-pronoun";
  if (pos.includes("proper noun")) return "c-proper";
  if (pos.includes("modal")) return "c-modal";
  if (pos.includes("be-verb")) return "c-modal";
  if (pos.includes("auxiliary")) return "c-modal";
  if (pos.includes("preposition")) return "c-prep";
  if (pos.includes("conjunction")) return "c-conj";
  if (pos.includes("wh-word")) return "c-wh";
  if (pos.includes("negation")) return "c-negation";
  if (pos.includes("adverb")) return "c-adverb";
  if (pos.includes("determiner")) return "c-det";
  if (pos.includes("verb/noun")) return "c-verb";
  return "c-default";
}

function buildTextSpans(text, spans, sentIdx, kind) {
  // spans: [{start, end, cls}], must be non-overlapping; gaps between them are
  // rendered as neutral punctuation/whitespace so the whole line is colorized.
  const sorted = spans.slice().sort((a, b) => a.start - b.start);
  const frag = document.createElement("span");
  let cursor = 0;
  for (const s of sorted) {
    if (s.start > cursor) appendPunct(frag, text.slice(cursor, s.start));
    const el = document.createElement("span");
    el.textContent = text.slice(s.start, s.end);
    el.className = `tok ${s.cls}`;
    el.dataset.start = s.start;
    el.dataset.end = s.end;
    el.dataset.sent = sentIdx;
    el.dataset.kind = kind;
    frag.appendChild(el);
    cursor = s.end;
  }
  if (cursor < text.length) appendPunct(frag, text.slice(cursor));
  return frag;
}

function appendPunct(frag, text) {
  if (!text) return;
  const el = document.createElement("span");
  el.className = "c-punct";
  el.textContent = text;
  frag.appendChild(el);
}

function render() {
  englishPane.innerHTML = "";
  codePane.innerHTML = "";

  state.sentences.forEach((s, i) => {
    if (s.error) {
      const row = document.createElement("div");
      row.textContent = `Parse error: ${s.error}`;
      englishPane.appendChild(row);
      return;
    }

    const inspectorByStart = new Map(s.inspector.map((it) => [it.start, it]));
    const engToks = tokenizeClient(s.input).filter((t) => !/^[.,!?;:]$/.test(t.surface));
    const engSpans = engToks.map((t) => {
      const item = inspectorByStart.get(t.start);
      return { start: t.start, end: t.end, cls: colorClass(item?.pos, item?.isSlang) };
    });
    englishPane.appendChild(buildTextSpans(s.input, engSpans, i, "eng"));
    englishPane.appendChild(document.createElement("hr"));

    if (state.mode === "simple") {
      const codeSpans = s.prettyMappings.map((m) => {
        const item = inspectorByStart.get(m.srcStart);
        return { start: m.outStart, end: m.outEnd, srcStart: m.srcStart, srcEnd: m.srcEnd, cls: colorClass(item?.pos, item?.isSlang) };
      });
      codePane.appendChild(buildCodeSpans(s.codePretty, codeSpans, i));
    } else if (state.mode === "structure") {
      const pre = document.createElement("pre");
      pre.className = "plain";
      pre.textContent = s.structure;
      codePane.appendChild(pre);
    } else if (state.mode === "grammar") {
      codePane.appendChild(buildGrammarTable(s.grammar));
    }
    codePane.appendChild(document.createElement("hr"));
  });

  attachHandlers();
}

function buildCodeSpans(text, spans, sentIdx) {
  const sorted = spans.slice().sort((a, b) => a.start - b.start);
  const frag = document.createElement("span");
  let cursor = 0;
  for (const s of sorted) {
    if (s.start > cursor) appendPunct(frag, text.slice(cursor, s.start));
    const el = document.createElement("span");
    el.textContent = text.slice(s.start, s.end);
    el.className = `tok ${s.cls}`;
    el.dataset.start = s.srcStart;
    el.dataset.end = s.srcEnd;
    el.dataset.sent = sentIdx;
    el.dataset.kind = "code";
    frag.appendChild(el);
    cursor = s.end;
  }
  if (cursor < text.length) appendPunct(frag, text.slice(cursor));
  return frag;
}

function buildGrammarTable(rows) {
  const table = document.createElement("table");
  table.className = "grammar";
  table.innerHTML = "<tr><th>Word</th><th>Part of speech</th><th>Role</th></tr>";
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(r.word)}</td><td>${escapeHtml(r.pos)}</td><td>${escapeHtml(r.role)}</td>`;
    table.appendChild(tr);
  }
  return table;
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function attachHandlers() {
  const allToks = () => Array.from(document.querySelectorAll(".tok"));

  allToks().forEach((el) => {
    el.addEventListener("mouseenter", () => {
      const sent = el.dataset.sent;
      const start = Number(el.dataset.start);
      const end = Number(el.dataset.end);
      allToks().forEach((other) => {
        if (other.dataset.sent !== sent) return;
        const os = Number(other.dataset.start);
        const oe = Number(other.dataset.end);
        if (overlaps(start, end, os, oe)) other.classList.add("hovered");
      });
    });
    el.addEventListener("mouseleave", () => {
      allToks().forEach((o) => o.classList.remove("hovered"));
    });
    el.addEventListener("click", () => {
      allToks().forEach((o) => o.classList.remove("selected"));
      const sent = Number(el.dataset.sent);
      const start = Number(el.dataset.start);
      const end = Number(el.dataset.end);
      allToks().forEach((other) => {
        if (Number(other.dataset.sent) !== sent) return;
        const os = Number(other.dataset.start);
        const oe = Number(other.dataset.end);
        if (overlaps(start, end, os, oe)) other.classList.add("selected");
      });
      showInspector(sent, start, end);
    });
  });
}

function showInspector(sentIdx, start, end) {
  const s = state.sentences[sentIdx];
  if (!s || !s.inspector) return;
  const items = s.inspector.filter((it) => overlaps(start, end, it.start, it.end));
  if (items.length === 0) {
    inspectorBody.textContent = "No data for this selection.";
    return;
  }
  inspectorBody.innerHTML = "";
  items.forEach((it) => {
    const box = document.createElement("div");
    box.style.marginBottom = "10px";
    const rows = [
      ["Part of speech", it.pos],
      ["Grammatical role", it.role],
    ];
    if (it.isSlang) {
      rows.push(["Usage", "Slang / informal"]);
      rows.push(["Category", it.category]);
      if (it.normalized) rows.push(["Normalized", it.normalized]);
      if (it.gloss) rows.push(["Approximate meaning", it.gloss]);
      rows.push(["Register", it.register]);
      rows.push(["Confidence", it.confidence]);
    }
    let html = `<div class="word">${escapeHtml(it.word)}</div>`;
    for (const [label, value] of rows) {
      if (!value) continue;
      html += `<div class="field"><div class="label">${label}</div><div class="value">${escapeHtml(String(value))}</div></div>`;
    }
    box.innerHTML = html;
    inspectorBody.appendChild(box);
  });
}

analyze();
