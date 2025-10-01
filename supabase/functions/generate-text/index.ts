import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  general_text_rules,
  celebration_text_rules,
  joke_text_rules, 
  daily_life_text_rules, 
  sports_text_rules, 
  pop_culture_text_rules, 
  miscellaneous_text_rules,
  custom_design_text_rules
} from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------- Types ----------------
interface GeneratePayload {
  category: string;
  subcategory?: string;
  theme?: string;           // deepest leaf (preferred)
  tone?: string;
  rating?: string;
  insertWords?: string[];   // e.g., ["Jesse"]
}

// ---------------- Helpers ----------------
const MAX_LEN = 120;

function clampLen(s: string, n = MAX_LEN): string {
  if (!s) return s;
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,\s]*$/, "") + ".";
}
function ensureEndPunct(s: string): string { return /[.!?]$/.test(s) ? s : s + "."; }

// allow only . , ? !  → replace other punctuation with space
// keepAsterisk = true only for PG where we actually display * in censored words
function sanitizePunct(s: string, keepAsterisk = false): string {
  const rx = keepAsterisk
    ? /[;:()\[\]{}"\/\\<>|~`^_@#\$%&+=–—]/g
    : /[;:()\[\]{}"\/\\<>|~`^_*@#\$%&+=–—]/g;
  return (s || "").replace(rx, " ").replace(/\s{2,}/g, " ").trim();
}

// strong comma hygiene: kill leading commas, collapse runs, space-after, never space-before
function tidyCommas(s: string): string {
  if (!s) return s;
  let out = s.replace(/^\s*,+\s*/g, "");
  out = out.replace(/(\s*,\s*)+/g, ", ");
  out = out.replace(/\s+,/g, ",");
  out = out.replace(/,(?!\s|$)/g, ", ");
  return out.replace(/\s{2,}/g, " ").trim();
}

// punctuation cap: keep at most two of . , ? !
function limitPunctPerLine(s: string): string {
  const allowed = new Set([".", ",", "!", "?"]);
  let count = 0, out = "";
  for (const ch of s) {
    if (allowed.has(ch)) { count++; if (count <= 2) out += ch; }
    else out += ch;
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// drop label/meta lines like "TONE:", "RATING:", "SPECIFIC WORDS:", etc.
function isMetaLine(s: string): boolean {
  return /^\s*(tone|rating|specific(?:\s+)?words?|process|category|context|rules?)\s*:/i.test(s);
}

// Fix orphan "'s" when the name was removed earlier
function fixOrphanPossessive(line: string, word: string): string {
  return line.replace(/(^|[^\p{L}\p{N}’'])(?='s\b)/u, (_m, p1) => `${p1}${word}`);
}

// Insert a specific word once, placed mid-sentence when possible
function placeWordNaturally(line: string, word: string): string {
  if (!word) return line;
  let s = fixOrphanPossessive(line, word);

  // Remove naked instances (leave possessives intact)
  const rx = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
  s = s.replace(rx, "").replace(/\s{2,}/g, " ").trim();

  if (s.includes(",")) {
    s = s.replace(",", `, ${word},`).replace(/,\s*,/g, ", ");
    return s;
  }
  const firstSpace = s.indexOf(" ");
  if (firstSpace > 0) s = s.slice(0, firstSpace) + " " + word + s.slice(firstSpace);
  else s = `${word} ${s}`;
  return s;
}

// distribute Specific Words: exactly one per line, placed naturally
function distributeSpecificWords(lines: string[], words: string[]): string[] {
  const norm = (words || []).map(w => (w || "").trim()).filter(Boolean);
  if (!norm.length) return lines; // bug fix: don't map to a function
  return lines.map((line, i) => ensureEndPunct(tidyCommas(placeWordNaturally(line, norm[i % norm.length]))));
}

function enforceLeafPresence(s: string, leafTokens: string[]): string {
  if (!leafTokens.length) return s;
  const low = s.toLowerCase();
  if (leafTokens.some(t => low.includes(t))) return s;
  const add = leafTokens.find(t => t.length > 3) || leafTokens[0];
  return add ? s.replace(/\.$/, "") + `, ${add}.` : s;
}

// Basic duplicate bigram dampener across lines
function dampenDuplicatePairs(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.map((line, idx) => {
    const tokens = line.toLowerCase().replace(/[^a-z0-9\s’'-]/gi, "").split(/\s+/).filter(Boolean);
    const bigrams = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) bigrams.add(tokens[i] + " " + tokens[i + 1]);
    const overlap = [...bigrams].some(b => seen.has(b));
    for (const b of bigrams) seen.add(b);
    if (!overlap) return line;
    const add = ["today", "tonight", "this year", "right now"][idx % 4];
    return clampLen(line.replace(/\.$/, "") + ` ${add}.`);
  });
}

// -------- Rating enforcement (hard, with PG-13 tightening) --------
const R_WORDS = ["fuck","fucking","shit","bullshit"]; // no slurs
const PG13_ALLOWED = ["hell","damn"];
const MEDIUM_PROFANITY = ["bastard","asshole","prick","dick","douche","crap"]; // extend if needed
const PG_CENSOR = [/fuck/gi,/shit/gi,/bullshit/gi,/fucking/gi];

// Robust inflection handling for censorship/removal
const STRONG_PATTERNS = [
  /\bfuck(?:ing|er|ed|s)?\b/gi,
  /\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi,
  /\bbullshit\b/gi,
];

function containsAny(s: string, list: string[]) {
  const low = s.toLowerCase();
  return list.some(w => low.includes(w));
}

// For R: weave profanity after name/comma/first word; avoid ending on it
function weaveProfanity(line: string, names: string[]): string {
  if (containsAny(line, R_WORDS)) return line;
  for (const name of names) {
    const rx = new RegExp(`\\b(${escapeRegExp(name)})\\b(?!\\s+(?:fuck|fucking))`, "i");
    if (rx.test(line)) return line.replace(rx, `$1 fuck`);
  }
  if (line.includes(",")) return line.replace(",", ", you lucky fuck,").replace(/,\s*,/g, ", ");
  const i = line.indexOf(" ");
  return i > 0 ? line.slice(0, i) + " fuck" + line.slice(i) : line + " fuck";
}

function censorPG(s: string) {
  // Keep first and last letter, middle as ** for strong profanity + inflections
  let out = s;
  for (const rx of STRONG_PATTERNS) {
    out = out.replace(rx, (m) => {
      const first = m[0];
      const last = /[a-z]/i.test(m[m.length - 1]) ? m[m.length - 1] : "";
      return `${first}**${last}`;
    });
  }
  return out;
}

function removeStrongForPG13(s: string) {
  let out = s;
  for (const rx of STRONG_PATTERNS) out = out.replace(rx, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

function enforceRatingLine(s: string, rating: string, names: string[]): string {
  let line = s.trim();

  if (/^R$/i.test(rating)) {
    line = weaveProfanity(line, names);
    // don't end on profanity
    line = line.replace(/\b(fuck|fucking|shit|bullshit)[.!?]?\s*$/i, "$1, legend");
  } else if (/^PG-?13$/i.test(rating)) {
    // remove strong profanities + inflections completely
    line = removeStrongForPG13(line);
    for (const w of [...MEDIUM_PROFANITY]) {
      const rx = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
      line = line.replace(rx, "");
    }
    // keep at most one of hell/damn
    const hadHell = /\bhell\b/i.test(line);
    line = hadHell ? line.replace(/\bdamn\b/gi, "") : line.replace(/\bhell\b/gi, "");
    line = line.replace(/\s{2,}/g," ").trim();
  } else if (/^PG$/i.test(rating)) {
    // censored swears only (keep asterisks)
    line = censorPG(line);
  } else if (/^G$/i.test(rating)) {
    for (const w of [...R_WORDS, ...PG13_ALLOWED, ...MEDIUM_PROFANITY]) {
      const rx = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
      line = line.replace(rx, "");
    }
    line = line.replace(/\s{2,}/g," ").trim();
  }

  // sanitize + commas
