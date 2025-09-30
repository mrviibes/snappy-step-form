// ====== Add near Interfaces ======
interface GeneratePayload {
  category: string;
  subcategory?: string;
  theme?: string; // <-- NEW: deepest leaf, e.g., "Corgi"
  tone?: string;
  rating?: string;
  insertWords?: string[];
}

// ====== Inside serve handler after payload parse ======
const { category, subcategory, tone, rating, insertWords = [], theme } = payload;

// Compute leaf focus token(s)
const leaf = (theme || subcategory || "").trim();
const leafTokens = leaf
  .toLowerCase()
  .split(/[^\p{L}\p{N}’'-]+/u)
  .filter(w => w.length > 2);

// Build system prompt
let systemPrompt = category === "Jokes" ? joke_text_rules : text_rules;

systemPrompt += `
CONTEXT
- CATEGORY: ${category || "n/a"}
- SUBCATEGORY: ${subcategory || "n/a"}
- THEME (LEAF FOCUS): ${leaf || "n/a"}`;

// Keep your CRITICAL FORMAT line as-is
systemPrompt += `

CRITICAL FORMAT: Return exactly 4 separate lines. Each line must be a complete sentence ending with punctuation. Use newline characters between each line. Do not write paragraphs or combine multiple sentences on one line.`;

// ====== Build userPrompt (short and strict) ======
let userPrompt = `Write 4 ${tone?.toLowerCase() || "humorous"} one-liners that clearly center on "${leaf || "the selected theme"}".`;
if (category?.toLowerCase() === "jokes") {
  userPrompt += ` Never say humor labels (dad-joke, pun, joke/jokes); imply the style only.`;
}
if (insertWords.length) {
  userPrompt += ` Each line must naturally include: ${insertWords.join(", ")}.`;
}
userPrompt += ` One sentence per line, ≤2 punctuation marks.`;

// ====== After you parse `lines`, enforce FOCUS for concrete leaves ======
function hasLeafToken(s: string) {
  const low = s.toLowerCase();
  return leafTokens.length ? leafTokens.some(t => low.includes(t)) : true;
}

// If it's NOT a label-y theme (like "dad-jokes") and we have concrete tokens,
// softly enforce presence by nudging lines that missed it.
const looksLikeLabel = /joke|pun|one-liner|knock|lightbulb/i.test(leaf);
if (leaf && !looksLikeLabel) {
  lines = lines.map(l => (hasLeafToken(l) ? l : (() => {
    // If missing, nudge by appending the most salient token once.
    const add = leafTokens.find(t => t.length > 3) || leafTokens[0] || "";
    return add ? `${l.replace(/\.$/,"")}, ${add}.` : l;
  })()));
}
