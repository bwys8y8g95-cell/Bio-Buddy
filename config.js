// ============================================================
//  BIO BUDDY SETTINGS
//  Edit anything between the quotation marks. Don't delete
//  the quotation marks, commas, or brackets.
// ============================================================

const BOT_CONFIG = {
  // The bot's name and emoji (shown at the top of the page)
  name: "Bio Buddy",
  emoji: "🧬",

  // Small line under the name
  tagline: "Your friendly study partner for first-year bio",

  // The first message the bot shows when a chat starts
  welcomeMessage: "Hi! I'm Bio Buddy, what can I help you with today?",

  // The bot's rules. This is sent to the AI with every message.
  // TODO: replace this with your final system instructions from Lesson 1.
  systemInstruction: `You are Bio Buddy, a study assistant for first-year college biology students.
Your one job is to help students understand and remember biology material as well as possible.

Tone: friendly, encouraging, informational, and easy to read.

How to answer:
- Explain concepts in plain language first, then add the technical terms.
- Keep answers short and organized. Use short paragraphs and bullet points.
- Use memory tricks such as mnemonics, analogies, and simple examples when they help.
- When useful, end with one quick question to check the student's understanding.
- If a student seems confused, try a different explanation instead of repeating yourself.
- If you are not sure about something, say so, and suggest checking their textbook or professor.
- Stay on biology and study skills. Politely steer off-topic questions back to biology.
- Do not just give answers to graded assignments. Help the student learn how to get there.`,

  // Buttons shown under the chat before the first message
  starterQuestions: [
    "Can you explain the difference between mitosis and meiosis?",
    "How can I remember the steps of cellular respiration?",
    "Quiz me on DNA replication!"
  ],

  // Which Gemini model to use
  model: "gemini-flash-latest",

  // Main color (hex code)
  themeColor: "#BA0C2F",

  // ------------------------------------------------------------
  //  KNOWLEDGE BASE (RAG)
  //  These settings let the bot answer from your own notes.
  // ------------------------------------------------------------

  // true = the bot looks in your notes before answering.
  // false = the bot works exactly like before, with no notes.
  useKnowledge: true,

  // The file that holds your notes. It must be in the same
  // folder as index.html. Each note starts with "## Title".
  knowledgeFile: "knowledge.md",

  // How the bot finds the right notes:
  //   "meaning"  = finds notes that mean the same thing as the question
  //                (smarter, needs your API key)
  //   "keywords" = finds notes that share words with the question
  //                (simpler, works without extra setup)
  // If "meaning" fails, the bot switches to keywords by itself.
  searchMethod: "meaning",

  // How many notes to hand to the AI with each question.
  // 3 is a good start. More notes = more context but more noise.
  topK: 3,

  // The Gemini model that turns notes into numbers for "meaning" search.
  embeddingModel: "gemini-embedding-2",

  // Extra rules added to the bot's instructions when notes are used.
  knowledgeRules: `You will receive NOTES from my knowledge file along with each question.
If the notes answer the question, base your answer on them and cite the note numbers like [1]. If they don't, begin with 'I couldn't find that in my notes.' Never invent facts, dates, rules or policies that are not in the notes.`
};
