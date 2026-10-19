// ============================================================
//  Bio Buddy logic. You shouldn't need to edit this file.
//  Change the bot's personality in config.js instead.
// ============================================================

const cfg = BOT_CONFIG;
const $ = (id) => document.getElementById(id);

const messagesEl = $("messages");
const startersEl = $("starters");
const formEl = $("chat-form");
const inputEl = $("user-input");
const sendBtn = $("send-btn");
const keyModal = $("key-modal");
const keyInput = $("key-input");
const rememberBox = $("remember-box");
const statusEl = $("kb-status");

let history = []; // conversation sent to Gemini (plain questions, no notes)
let busy = false;

// ---------- Knowledge base settings (read from config.js) ----------
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";
const KB_USE = cfg.useKnowledge !== false;
const KB_FILE = cfg.knowledgeFile || "knowledge.md";
const KB_METHOD = cfg.searchMethod === "keywords" ? "keywords" : "meaning";
const KB_TOPK = Math.max(1, Math.floor(Number(cfg.topK) || 3));
const KB_MODEL = cfg.embeddingModel || "gemini-embedding-2";
const KB_MAX_CHARS = 1500; // notes longer than this are split into parts
const KB_BATCH = 50; // most notes sent to the embedding service at once
const KB_CACHE_KEY = "bio_buddy_embeddings";

// What the bot currently knows about your notes
const kb = {
  notes: [], // [{ title, text }]
  vectors: null, // one list of numbers per note (meaning search)
  problem: "", // a message if the file is missing or empty
  wantsKey: false, // true when meaning search is waiting for an API key
  queryFailed: false // true when the last question couldn't use meaning search
};
let kbRun = 0; // lets us ignore out-of-date loads
let kbPromise = Promise.resolve();

// ---------- Setup ----------
function setup() {
  document.title = cfg.name;
  document.documentElement.style.setProperty("--accent", cfg.themeColor);
  $("bot-emoji").textContent = cfg.emoji;
  $("bot-name").textContent = cfg.name;
  $("bot-tagline").textContent = cfg.tagline;
  startChat();
  kbPromise = loadKnowledge();
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
// "sources" is an optional list of notes shown under a bot reply.
function addBubble(type, text, sources) {
  const div = document.createElement("div");
  div.className = "bubble " + type;
  if (type === "user") {
    div.textContent = text;
  } else if (type === "error") {
    div.textContent = text;
  } else {
    div.innerHTML = formatText(text);
    if (sources && sources.length) div.appendChild(buildSources(sources));
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

function scrollDown() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---------- "Sources" section under replies ----------
function snippet(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? flat.slice(0, 160).trim() + "…" : flat;
}

function buildSources(notes) {
  const details = document.createElement("details");
  details.className = "sources";

  const summary = document.createElement("summary");
  summary.textContent = "Sources (" + notes.length + ")";
  details.appendChild(summary);

  const list = document.createElement("ol");
  notes.forEach((n, i) => {
    const li = document.createElement("li");

    const head = document.createElement("div");
    head.className = "source-head";
    const title = document.createElement("strong");
    title.textContent = "[" + (i + 1) + "] " + n.title;
    const score = document.createElement("span");
    score.className = "source-score";
    score.textContent = "score " + n.score.toFixed(2);
    head.appendChild(title);
    head.appendChild(score);

    const body = document.createElement("p");
    body.className = "source-snippet";
    body.textContent = snippet(n.text);

    li.appendChild(head);
    li.appendChild(body);
    list.appendChild(li);
  });
  details.appendChild(list);
  return details;
}

// ---------- API key storage ----------
function getKey() {
  try {
    const s = sessionStorage.getItem("gemini_api_key");
    if (s) return s;
  } catch (e) {}
  try {
    const l = localStorage.getItem("gemini_api_key");
    if (l) return l;
  } catch (e) {}
  return "";
}

function saveKey(key, remember) {
  try { sessionStorage.setItem("gemini_api_key", key); } catch (e) {}
  try {
    if (remember) localStorage.setItem("gemini_api_key", key);
    else localStorage.removeItem("gemini_api_key");
  } catch (e) {}
}

function openKeyModal() {
  keyInput.value = "";
  let remembered = false;
  try { remembered = !!localStorage.getItem("gemini_api_key"); } catch (e) {}
  rememberBox.checked = remembered;
  keyModal.hidden = false;
  keyInput.focus();
}

function closeKeyModal() {
  keyModal.hidden = true;
}

// ---------- Knowledge base: loading your notes ----------
function setStatus(text, warn) {
  if (!KB_USE) {
    statusEl.hidden = true;
    return;
  }
  statusEl.textContent = text;
  statusEl.classList.toggle("warn", !!warn);
  statusEl.hidden = false;
}

function showKbStatus() {
  if (kb.problem) {
    setStatus("📚 " + kb.problem, true);
    return;
  }
  const n = kb.notes.length;
  const label = n === 1 ? "1 note" : n + " notes";
  if (kb.vectors && !kb.queryFailed) {
    setStatus("📚 " + label + " loaded · meaning search");
    return;
  }
  let why = "";
  let warn = false;
  if (KB_METHOD === "meaning") {
    if (kb.wantsKey) {
      why = " (add your API key to use meaning search)";
    } else {
      why = " (meaning search isn't working right now)";
      warn = true;
    }
  }
  setStatus("📚 " + label + " loaded · keyword search" + why, warn);
}

// Turns the text of knowledge.md into a list of notes.
// Everything above the first "## " line is ignored.
function parseKnowledge(raw) {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const found = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      current = { title: m[1], lines: [] };
      found.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }

  const notes = [];
  for (const f of found) {
    const body = f.lines.join("\n").trim();
    if (!body) continue;
    const parts = splitLong(body);
    parts.forEach((part, i) => {
      const title = parts.length > 1 ? f.title + " (part " + (i + 1) + ")" : f.title;
      notes.push({ title: title, text: part });
    });
  }
  return notes;
}

// Splits a long note at blank lines so each part stays under KB_MAX_CHARS.
function splitLong(body) {
  if (body.length <= KB_MAX_CHARS) return [body];
  const paragraphs = body.split(/\n\s*\n/);
  const parts = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && current.length + 2 + p.length > KB_MAX_CHARS) {
      parts.push(current);
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// A short "fingerprint" of the notes file. If the file changes, the
// fingerprint changes, and the saved embeddings are made again.
function fingerprint(raw) {
  const s = KB_MODEL + "|" + KB_MAX_CHARS + "|" + raw;
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16) + "-" + s.length;
}

function readCache(fp) {
  try {
    const c = JSON.parse(localStorage.getItem(KB_CACHE_KEY));
    if (c && c.fp === fp && Array.isArray(c.vectors) && c.vectors.length === kb.notes.length) {
      return c.vectors;
    }
  } catch (e) {}
  return null;
}

function writeCache(fp, vectors) {
  try {
    localStorage.setItem(KB_CACHE_KEY, JSON.stringify({ fp: fp, vectors: vectors }));
  } catch (e) {}
}

async function loadKnowledge() {
  if (!KB_USE) {
    statusEl.hidden = true;
    return;
  }
  const run = ++kbRun;
  kb.notes = [];
  kb.vectors = null;
  kb.problem = "";
  kb.wantsKey = false;
  kb.queryFailed = false;
  setStatus("📚 Loading notes…");

  let raw = "";
  try {
    const res = await fetch(KB_FILE, { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    raw = await res.text();
  } catch (e) {
    if (run !== kbRun) return;
    kb.problem = "Couldn't find " + KB_FILE + ". Check that it's in the same folder as index.html.";
    showKbStatus();
    return;
  }
  if (run !== kbRun) return;

  kb.notes = parseKnowledge(raw);
  if (kb.notes.length === 0) {
    kb.problem = KB_FILE + " has no notes yet. Start each note with ## and a title.";
    showKbStatus();
    return;
  }

  if (KB_METHOD !== "meaning") {
    showKbStatus();
    return;
  }
  if (!getKey()) {
    kb.wantsKey = true;
    showKbStatus();
    return;
  }

  const fp = fingerprint(raw);
  const cached = readCache(fp);
  if (cached) {
    kb.vectors = cached;
    showKbStatus();
    return;
  }

  setStatus("📚 " + kb.notes.length + " notes loaded · preparing meaning search…");
  try {
    const texts = kb.notes.map((n) => "title: " + n.title + " | text: " + n.text);
    const vectors = await embedTexts(texts);
    if (run !== kbRun) return;
    kb.vectors = vectors;
    writeCache(fp, vectors);
  } catch (e) {
    if (run !== kbRun) return;
    kb.vectors = null; // falls back to keyword search
  }
  showKbStatus();
}

// ---------- Knowledge base: embeddings ("meaning" search) ----------
async function embedTexts(texts) {
  const url = API_BASE + encodeURIComponent(KB_MODEL) + ":batchEmbedContents";
  const vectors = [];
  for (let i = 0; i < texts.length; i += KB_BATCH) {
    const chunk = texts.slice(i, i + KB_BATCH);
    const body = {
      requests: chunk.map((t) => ({
        model: "models/" + KB_MODEL,
        content: { parts: [{ text: t }] }
      }))
    };
    const res = await fetch(url, {
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
    const data = await res.json();
    const embeddings = data.embeddings || [];
    if (embeddings.length !== chunk.length) {
      throw new Error("Unexpected embedding response");
    }
    embeddings.forEach((e) => vectors.push(e.values));
  }
  return vectors;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// ---------- Knowledge base: keyword search ----------
const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "your", "can", "does", "did",
  "how", "what", "when", "where", "which", "who", "why", "with", "this", "that",
  "these", "those", "from", "have", "has", "had", "was", "were", "will", "would",
  "should", "could", "about", "into", "than", "then", "there", "their", "they",
  "them", "its", "our", "any", "all", "out", "too", "very", "just", "tell", "give"
]);

function tokenize(text) {
  const words = (text.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    .map((w) => {
      if (w.length > 4 && w.endsWith("ing")) return w.slice(0, -3);
      if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
      if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
      return w;
    });
  return words;
}

function keywordSearch(question) {
  const terms = Array.from(new Set(tokenize(question)));
  if (!terms.length) return [];
  const hits = kb.notes.map((n) => {
    const titleWords = new Set(tokenize(n.title));
    const bodyWords = new Set(tokenize(n.text));
    let points = 0;
    for (const t of terms) {
      if (titleWords.has(t)) points += 3; // a title match counts the most
      if (bodyWords.has(t)) points += 1;
    }
    return { title: n.title, text: n.text, score: Math.min(1, points / (terms.length * 4)) };
  });
  return hits
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, KB_TOPK);
}

// Finds the best notes for a question. It never throws:
// if meaning search fails, it uses keyword search instead.
async function findNotes(question) {
  if (!KB_USE) return [];
  try { await kbPromise; } catch (e) {}
  if (!kb.notes.length) return [];

  if (kb.vectors) {
    try {
      const vecs = await embedTexts(["task: search result | query: " + question]);
      const q = vecs[0];
      const hits = kb.notes.map((n, i) => ({
        title: n.title,
        text: n.text,
        score: cosine(q, kb.vectors[i])
      }));
      hits.sort((a, b) => b.score - a.score);
      if (kb.queryFailed) {
        kb.queryFailed = false;
        showKbStatus();
      }
      return hits.slice(0, KB_TOPK);
    } catch (e) {
      kb.queryFailed = true;
      showKbStatus();
    }
  }
  return keywordSearch(question);
}

// Puts the chosen notes and the question into one message for Gemini.
function buildPrompt(question, notes) {
  let out = "NOTES:\n";
  if (!notes.length) {
    out += "(No matching notes were found.)\n";
  } else {
    notes.forEach((n, i) => {
      out += "[" + (i + 1) + "] " + n.title + "\n" + n.text + "\n\n";
    });
  }
  out += "\nQUESTION:\n" + question;
  return out;
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
    return "Google's server is having trouble. Please try again in a moment.";
  }
  return "Something went wrong (error " + status + "). Please try again.";
}

async function askGemini(notes) {
  const key = getKey();
  const url = API_BASE + encodeURIComponent(cfg.model) + ":generateContent";

  // The saved history keeps only the plain questions. For this one request,
  // the latest question is swapped for a version that includes the notes.
  let contents = history;
  let system = cfg.systemInstruction;
  if (KB_USE) {
    const last = history[history.length - 1];
    contents = history.slice(0, -1).concat([
      { role: "user", parts: [{ text: buildPrompt(last.parts[0].text, notes) }] }
    ]);
    if (cfg.knowledgeRules) system += "\n\n" + cfg.knowledgeRules;
  }

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: contents
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = new Error("HTTP " + res.status);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
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
    let notes = [];
    try { notes = await findNotes(text); } catch (e) { notes = []; }

    const reply = await askGemini(notes);
    thinking.remove();
    if (!reply) {
      history.pop();
      addBubble("error", "I couldn't come up with an answer to that. Try rephrasing your question.");
    } else {
      history.push({ role: "model", parts: [{ text: reply }] });
      addBubble("bot", reply, notes);
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
  kbPromise = loadKnowledge(); // a new key may unlock meaning search
});

keyModal.addEventListener("click", (e) => {
  if (e.target === keyModal) closeKeyModal();
});

setup();
