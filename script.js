// ============================================================
//  Bio Buddy logic. You shouldn't need to edit this file.
//  Change the bot's personality and settings in config.js.
// ============================================================

const cfg = BOT_CONFIG;
const $ = (id) => document.getElementById(id);

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";
const KEY_NAME = "gemini_api_key";
const CACHE_NAME = "biobuddy_note_vectors";

const messagesEl = $("messages");
const startersEl = $("starters");
const formEl = $("chat-form");
const inputEl = $("user-input");
const sendBtn = $("send-btn");
const keyModal = $("key-modal");
const keyInput = $("key-input");
const rememberBox = $("remember-box");
const statusEl = $("kb-status");

let history = []; // plain questions and answers sent to Gemini
let busy = false;

// The knowledge base
let kb = { raw: "", chunks: [], vectors: null, problem: "", embedError: "" };
let embedPromise = null;

// ---------- Setup ----------
function setup() {
  document.title = cfg.name;
  document.documentElement.style.setProperty("--accent", cfg.themeColor);
  $("bot-emoji").textContent = cfg.emoji;
  $("bot-name").textContent = cfg.name;
  $("bot-tagline").textContent = cfg.tagline;
  startChat();
  loadKnowledge();
}

function startChat() {
  history = [];
  messagesEl.innerHTML = "";
  addBubble("bot", cfg.welcomeMessage);
  renderStarters();
  inputEl.value = "";
  autoGrow();
}

function renderStarters() {
  startersEl.innerHTML = "";
  startersEl.hidden = false;
  cfg.starterQuestions.forEach((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q;
    b.addEventListener("click", () => sendMessage(q));
    startersEl.appendChild(b);
  });
}

// ---------- Safe formatting ----------
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function boldify(s) {
  return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

// Escapes HTML first, then turns **bold** and "- bullets" into real formatting
function formatText(text) {
  const lines = escapeHtml(text).split("\n");
  let html = "";
  let inList = false;
  for (const line of lines) {
    const m = line.match(/^\s*[-*•]\s+(.*)$/);
    if (m) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += "<li>" + boldify(m[1]) + "</li>";
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      if (line.trim() !== "") html += "<p>" + boldify(line) + "</p>";
    }
  }
  if (inList) html += "</ul>";
  return html;
}

// ---------- Chat bubbles ----------
function addBubble(type, text) {
  const div = document.createElement("div");
  div.className = "bubble " + type;
  if (type === "user" || type === "error") {
    div.textContent = text;
  } else {
    div.innerHTML = formatText(text);
  }
  messagesEl.appendChild(div);
  scrollDown();
  return div;
}

function addThinking() {
  const div = document.createElement("div");
  div.className = "bubble bot thinking";
  div.setAttribute("aria-label", "Thinking");
  div.innerHTML = "<span></span><span></span><span></span>";
  messagesEl.appendChild(div);
  scrollDown();
  return div;
}

// The small "Sources" section under an answer
function addSources(bubble, sources, method) {
  if (!sources.length) return;
  const box = document.createElement("details");
  box.className = "sources";
  const sum = document.createElement("summary");
  sum.textContent = "📚 Sources (" + (method === "meaning" ? "meaning" : "keyword") + " search)";
  box.appendChild(sum);
  sources.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "source-item";
    const head = document.createElement("strong");
    head.textContent = "[" + (i + 1) + "] " + s.chunk.title + " · score " + s.score.toFixed(2);
    const preview = document.createElement("p");
    const t = s.chunk.text;
    preview.textContent = t.length > 160 ? t.slice(0, 160).trim() + "…" : t;
    item.appendChild(head);
    item.appendChild(preview);
    box.appendChild(item);
  });
  bubble.appendChild(box);
  scrollDown();
}

function scrollDown() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---------- API key storage ----------
function getKey() {
  try {
    const s = sessionStorage.getItem(KEY_NAME);
    if (s) return s;
  } catch (e) {}
  try {
    const l = localStorage.getItem(KEY_NAME);
    if (l) return l;
  } catch (e) {}
  return "";
}

function saveKey(key, remember) {
  try { sessionStorage.setItem(KEY_NAME, key); } catch (e) {}
  try {
    if (remember) localStorage.setItem(KEY_NAME, key);
    else localStorage.removeItem(KEY_NAME);
  } catch (e) {}
}

function openKeyModal() {
  keyInput.value = "";
  let remembered = false;
  try { remembered = !!localStorage.getItem(KEY_NAME); } catch (e) {}
  rememberBox.checked = remembered;
  keyModal.hidden = false;
  keyInput.focus();
}

function closeKeyModal() {
  keyModal.hidden = true;
}

// ---------- Talking to Gemini ----------
function friendlyError(status) {
  if (status === 400 || status === 403) {
    return "Your API key doesn't seem to work. Click “API key” at the top and paste it again.";
  }
  if (status === 404) {
    return "I couldn't find that AI model. Check the model name in config.js.";
  }
  if (status === 429) {
    return "Too many requests right now. Wait a minute and try again.";
  }
  if (status >= 500) {
    return "Google's server is having trouble (error " + status + "). Please try again in a moment.";
  }
  return "Something went wrong (error " + status + "). Please try again.";
}

// A short reason, used in the status line
function shortReason(err) {
  const s = err && err.status;
  if (!s) return "no internet or blocked request";
  if (s === 400 || s === 403) return "API key not accepted";
  if (s === 404) return "embedding model not found, check embeddingModel in config.js";
  if (s === 429) return "rate limit";
  if (s >= 500) return "Google server error " + s;
  return "error " + s;
}

// One place that talks to Gemini
async function callGemini(model, method, body) {
  const res = await fetch(API_BASE + encodeURIComponent(model) + ":" + method, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getKey()
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = new Error("HTTP " + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function askGemini(promptText) {
  // History holds plain questions; swap in the version with notes for this turn
  const contents = history
    .slice(0, -1)
    .concat([{ role: "user", parts: [{ text: promptText }] }]);
  const rules = kbActive() ? "\n\n" + cfg.knowledgeRules : "";

  const data = await callGemini(cfg.model, "generateContent", {
    systemInstruction: { parts: [{ text: cfg.systemInstruction + rules }] },
    contents: contents
  });

  const parts =
    (data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts) ||
    [];
  const text = parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  return text.trim();
}

// ---------- Knowledge base: loading ----------
function kbActive() {
  return !!cfg.useKnowledge && kb.chunks.length > 0;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function updateStatus() {
  if (!cfg.useKnowledge) { setStatus(""); return; }
  if (kb.problem) { setStatus("⚠️ " + kb.problem); return; }
  const n = kb.chunks.length;
  let s = "📚 " + n + " note" + (n === 1 ? "" : "s") + " loaded · ";
  if (cfg.searchMethod === "keywords") s += "keyword search";
  else if (kb.vectors) s += "meaning search";
  else if (kb.embedError) s += "keyword search (meaning search failed: " + kb.embedError + ")";
  else if (!getKey()) s += "add your API key to start meaning search";
  else s += "getting meaning search ready…";
  setStatus(s);
}

// Turn knowledge.md into a list of notes. Each note starts with "## Title".
function parseKnowledge(md) {
  const lines = md.replace(/\r/g, "").split("\n");
  const notes = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      cur = { title: m[1], lines: [] };
      notes.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  const chunks = [];
  for (const note of notes) {
    const text = note.lines.join("\n").trim();
    if (!text) continue;
    const parts = splitLong(text, 1500);
    parts.forEach((p, i) => {
      const title = parts.length > 1 ? note.title + " (part " + (i + 1) + ")" : note.title;
      chunks.push({ title: title, text: p });
    });
  }
  return chunks;
}

// Split a long note at blank lines
function splitLong(text, max) {
  if (text.length <= max) return [text];
  const paras = text.split(/\n\s*\n/);
  const parts = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > max) {
      parts.push(cur);
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

// A short "fingerprint" so we only re-embed when knowledge.md changes
function fingerprint(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36) + "-" + s.length;
}

async function loadKnowledge() {
  kb = { raw: "", chunks: [], vectors: null, problem: "", embedError: "" };
  if (!cfg.useKnowledge) { updateStatus(); return; }
  setStatus("📚 Loading notes…");

  try {
    const res = await fetch(cfg.knowledgeFile, { cache: "no-store" });
    if (!res.ok) throw new Error("missing");
    kb.raw = await res.text();
  } catch (e) {
    kb.problem = "Couldn't find " + cfg.knowledgeFile + ". Check the file name and that it isn't inside a folder.";
    updateStatus();
    return;
  }

  kb.chunks = parseKnowledge(kb.raw);
  if (!kb.chunks.length) {
    kb.problem = cfg.knowledgeFile + " has no notes. Each note must start with ## and a title.";
    updateStatus();
    return;
  }

  updateStatus();
  await ensureEmbeddings();
}

// ---------- Knowledge base: embeddings ----------
async function embedBatch(texts) {
  const data = await callGemini(cfg.embeddingModel, "batchEmbedContents", {
    requests: texts.map((t) => ({
      model: "models/" + cfg.embeddingModel,
      content: { parts: [{ text: t }] }
    }))
  });
  const list = (data.embeddings || []).map((e) => e.values);
  if (list.length !== texts.length) throw new Error("Unexpected embedding reply");
  return list;
}

function ensureEmbeddings() {
  if (kb.vectors || cfg.searchMethod !== "meaning" || !kb.chunks.length || !getKey()) {
    updateStatus();
    return Promise.resolve();
  }
  if (!embedPromise) {
    embedPromise = buildEmbeddings().then(
      () => { embedPromise = null; },
      () => { embedPromise = null; }
    );
  }
  return embedPromise;
}

async function buildEmbeddings() {
  const fp = fingerprint(kb.raw) + "|" + cfg.embeddingModel;

  // Reuse saved vectors if knowledge.md hasn't changed
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_NAME));
    if (saved && saved.fp === fp && saved.vectors && saved.vectors.length === kb.chunks.length) {
      kb.vectors = saved.vectors;
      kb.embedError = "";
      updateStatus();
      return;
    }
  } catch (e) {}

  setStatus("📚 " + kb.chunks.length + " notes loaded · building meaning search…");
  try {
    const texts = kb.chunks.map((c) => "title: " + c.title + " │ text: " + c.text);
    let vectors = [];
    for (let i = 0; i < texts.length; i += 50) {
      vectors = vectors.concat(await embedBatch(texts.slice(i, i + 50)));
    }
    kb.vectors = vectors;
    kb.embedError = "";
    try {
      const small = vectors.map((v) => v.map((x) => Math.round(x * 1e5) / 1e5));
      localStorage.setItem(CACHE_NAME, JSON.stringify({ fp: fp, vectors: small }));
    } catch (e) {}
  } catch (err) {
    kb.embedError = shortReason(err);
  }
  updateStatus();
}

// ---------- Knowledge base: searching ----------
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

const STOP_WORDS = new Set(
  "a an the and or of to in on is are was were be do does did i my me you your it its for with as at by from this that what how why when which can about".split(" ")
);

function words(s) {
  return (s.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 3 ? w.replace(/s$/, "") : w));
}

// Simple keyword search: title matches count double
function keywordScores(question) {
  const qw = Array.from(new Set(words(question)));
  return kb.chunks.map((c) => {
    const inTitle = new Set(words(c.title));
    const inBody = new Set(words(c.text));
    let hits = 0;
    for (const w of qw) {
      if (inTitle.has(w)) hits += 2;
      else if (inBody.has(w)) hits += 1;
    }
    return { chunk: c, score: qw.length ? hits / (2 * qw.length) : 0 };
  });
}

// Find the best notes for a question
async function retrieve(question) {
  const topK = Math.max(1, Number(cfg.topK) || 3);
  let scored = null;
  let method = "keywords";

  if (cfg.searchMethod === "meaning") {
    await ensureEmbeddings();
    if (kb.vectors) {
      try {
        const q = await embedBatch(["task: search result │ query: " + question]);
        scored = kb.chunks.map((c, i) => ({ chunk: c, score: cosine(q[0], kb.vectors[i]) }));
        method = "meaning";
      } catch (err) {
        scored = null; // fall back to keywords for this question
      }
    }
  }

  if (!scored) {
    scored = keywordScores(question).filter((s) => s.score > 0);
  }
  scored.sort((a, b) => b.score - a.score);
  return { sources: scored.slice(0, topK), method: method };
}

// Put the notes and the question together, numbered [1] [2] [3]
function buildPrompt(question, sources) {
  if (!kbActive()) return question;
  if (!sources.length) {
    return "NOTES:\n(No matching notes were found.)\n\nQUESTION: " + question;
  }
  const notes = sources
    .map((s, i) => "[" + (i + 1) + "] " + s.chunk.title + "\n" + s.chunk.text)
    .join("\n\n");
  return "NOTES:\n" + notes + "\n\nQUESTION: " + question;
}

// ---------- Sending a message ----------
async function sendMessage(text) {
  text = text.trim();
  if (!text || busy) return;

  if (!getKey()) {
    openKeyModal();
    return;
  }

  busy = true;
  sendBtn.disabled = true;
  startersEl.hidden = true;

  addBubble("user", text);
  history.push({ role: "user", parts: [{ text: text }] });
  inputEl.value = "";
  autoGrow();

  const thinking = addThinking();

  try {
    let sources = [];
    let method = "keywords";
    if (kbActive()) {
      const found = await retrieve(text);
      sources = found.sources;
      method = found.method;
    }

    const reply = await askGemini(buildPrompt(text, sources));
    thinking.remove();
    if (!reply) {
      history.pop();
      addBubble("error", "I couldn't come up with an answer to that. Try rephrasing your question.");
    } else {
      history.push({ role: "model", parts: [{ text: reply }] });
      const bubble = addBubble("bot", reply);
      if (kbActive()) addSources(bubble, sources, method);
    }
  } catch (err) {
    thinking.remove();
    history.pop(); // so the question can be sent again
    if (err && err.status) {
      addBubble("error", friendlyError(err.status));
    } else {
      addBubble("error", "I can't reach the internet. Check your connection and try again.");
    }
  } finally {
    busy = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

// ---------- Input box behavior ----------
function autoGrow() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
}

inputEl.addEventListener("input", autoGrow);

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(inputEl.value);
  }
});

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(inputEl.value);
});

// ---------- Buttons ----------
$("new-chat-btn").addEventListener("click", startChat);
$("key-btn").addEventListener("click", openKeyModal);
$("key-cancel").addEventListener("click", closeKeyModal);

$("key-save").addEventListener("click", () => {
  const key = keyInput.value.trim();
  if (!key) return;
  saveKey(key, rememberBox.checked);
  closeKeyModal();
  kb.embedError = "";
  updateStatus();
  ensureEmbeddings(); // build meaning search now that we have a key
});

keyModal.addEventListener("click", (e) => {
  if (e.target === keyModal) closeKeyModal();
});

setup();
