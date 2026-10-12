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

let history = []; // conversation sent to Gemini
let busy = false;

// ---------- Setup ----------
function setup() {
  document.title = cfg.name;
  document.documentElement.style.setProperty("--accent", cfg.themeColor);
  $("bot-emoji").textContent = cfg.emoji;
  $("bot-name").textContent = cfg.name;
  $("bot-tagline").textContent = cfg.tagline;
  startChat();
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
  if (type === "user") {
    div.textContent = text;
  } else if (type === "error") {
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

function scrollDown() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
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

async function askGemini() {
  const key = getKey();
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(cfg.model) +
    ":generateContent";

  const body = {
    systemInstruction: { parts: [{ text: cfg.systemInstruction }] },
    contents: history
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
    const reply = await askGemini();
    thinking.remove();
    if (!reply) {
      history.pop();
      addBubble("error", "I couldn't come up with an answer to that. Try rephrasing your question.");
    } else {
      history.push({ role: "model", parts: [{ text: reply }] });
      addBubble("bot", reply);
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
});

keyModal.addEventListener("click", (e) => {
  if (e.target === keyModal) closeKeyModal();
});

setup();
