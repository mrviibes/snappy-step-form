/* ================================
   Step-2 Text Validator (TypeScript)
   Enforces: structure, inserts, category anchoring, rating tone, punctuation
   ================================ */

type Rating = "G" | "PG" | "PG-13" | "R";

type Scenario = {
  category: "celebrations" | "sports" | "daily_life" | "pop_culture";
  subcategory: string;                 // e.g., "wedding", "birthday", "work"
  rating: Rating;
  insertTags?: string[];               // appear once each, flex integration allowed
};

type BatchInput = {
  scenario: Scenario;
  lines: string[];                     // 4 lines from generator
};

const FORBIDDEN_PUNCT = /[;…]|(?:^|[^.])\.\.(?:[^.]|$)|[–—]/; // semicolon, ellipsis char, ".." , en/em dash
const MAX_PUNCT_PER_LINE = 2;

// Soft lexicons for flexible anchoring (extend as needed)
const LEX: Record<string, string[]> = {
  wedding: ["vows","rings","altar","reception","dance floor","bouquet","honeymoon","bride","groom","cake","toast","in-laws"],
  engagement: ["ring","proposal","fiancé","fiancée","yes","forever"],
  birthday: ["birthday","cake","candles","party","balloons","frosting","gift"],
  graduation: ["cap","gown","diploma","tassel","stage","ceremony"],
  work: ["meeting","boss","deadline","office","email","printer","coffee","slides","calendar"],
  school: ["exam","homework","teacher","class","test","grade","study"],
  soccer: ["goal","field","referee","fans","stadium","match","cup"],
  basketball: ["hoop","court","dribble","dunk","buzzer","playoffs"],
  baseball: ["bat","ball","base","inning","pitcher","glove","strike"],
  hockey: ["puck","ice","rink","goalie","stick","net","season"],
  music: ["song","lyrics","concert","stage","band","playlist"],
  movies: ["movie","film","screen","popcorn","theater","trailer"],
  tv: ["show","series","episode","streaming","channel","binge"],
  "dad-jokes": ["pun","groan","eye roll","lawn","grill","thermostat","cargo shorts","socks","sandals","minivan","coupon","garage","toolbox"]
};

// Rating language gates
const SWEARS_MILD = /\b(hell|damn|crap)\b/i;
const SWEARS_STRONG = /\b(fuck(?:ing)?|shit|asshole|bastard|douche)\b/i;
// Never allow slurs. Keep this list server side if you must, do not log violations.
const SLURS = /\b(?:slur_placeholder_1|slur_placeholder_2)\b/i; // replace with your own server side list

// Utility: normalize whitespace
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// Utility: count punctuation marks that end or split clauses
const punctCount = (s: string) => (s.match(/[.!?,:"]/g) || []).length;

// Flexible/Exact insert tag matcher
function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function hasInsertOnceExact(text: string, tag: string): boolean {
  const t = norm(text);
  const base = esc(tag.trim());
  const re = new RegExp(`(^|\\W)${base}(?=\\W|$)`, "i");
  const reAll = new RegExp(`(^|\\W)${base}(?=\\W|$)`, "ig");
  const hits = t.match(reAll)?.length || 0;
  return re.test(t) && hits === 1;
}
function hasInsertOnceFlexible(text: string, tag: string): boolean {
  const t = norm(text);
  const base = tag.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = tag.includes(" ") ? base.replace(/\s+/g, "\\s+") : `${base}(?:s|es|ed|ing)?`;
  const re = new RegExp(`(^|\\W)${pattern}(?=\\W|$)`, "i");
  const reAll = new RegExp(`(^|\\W)${pattern}(?=\\W|$)`, "ig");
  return re.test(t) && ((t.match(reAll) || []).length === 1);
}

// Category anchoring: direct keyword or contextual cue (LOOSENED RULES)
function anchoredToCategory(text: string, subcat: string): boolean {
  const words = LEX[subcat] || [];
  // Check for direct lexicon keywords first
  if (words.some(w => new RegExp(`\\b${w.replace(/\s+/g, "\\s+")}\\b`, "i").test(text))) return true;

  // Expanded context cues - now includes cultural and situational references
  const cues: Record<string, RegExp> = {
    wedding: /\b(bride|groom|best man|maid of honor|altar|reception|first dance|in laws|married|ceremony|veil|dress|suit|couple|unity|eternal|forever|commitment|sacred|blessed|husband|wife)\b/i,
    engagement: /\b(proposed|popped the question|she said yes|he said yes|diamond|proposal|future|commitment|planning|engaged|fiancé|fiancée)\b/i,
    birthday: /\b(happy birthday|blow out|turning \d+|party hat|surprise party|age|years old|older|celebration|presents|gifts|aging|another year|milestone|candle|wish)\b/i,
    babyshower: /\b(expecting|mom to be|little one|bundle of joy|due date|gender reveal|pregnant|baby|shower|newborn|infant|arrival|blessing|tiny|precious)\b/i,
    graduation: /\b(graduat|commencement|walk the stage|diploma|degree|education|achievement|accomplished|future|career|proud|success|milestone)\b/i,
    work: /\b(office|boss|coworker|meeting|deck|spreadsheet|corporate|business|career|professional|salary|promotion|overtime|deadline)\b/i,
    school: /\b(homework|cafeteria|locker|principal|student|teacher|class|grade|exam|study|education|learning|campus)\b/i,
    soccer: /\b(offside|corner kick|yellow card|red card|field|goal|match|team|fans|stadium|world cup|league)\b/i,
    basketball: /\b(free throw|fast break|shot clock|court|hoop|dunk|team|fans|playoffs|championship|league)\b/i,
    baseball: /\b(home run|double play|dugout|diamond|stadium|fans|season|playoffs|world series|league)\b/i,
    hockey: /\b(power play|faceoff|hat trick|ice|rink|fans|season|playoffs|cup|league)\b/i,
    music: /\b(setlist|encore|crowd surf|concert|performance|stage|audience|fans|sound|rhythm|melody)\b/i,
    movies: /\b(red carpet|credits rolled|director's cut|cinema|theater|screen|premiere|hollywood|entertainment|film)\b/i,
    tv: /\b(season finale|binge|remote|streaming|episode|series|show|entertainment|television|screen)\b/i,
    'dad-jokes': /\b(pun|groan|eye roll|lawn|grill|thermostat|cargo shorts|socks|sandals|minivan|coupon|garage|toolbox)\b/i
  };
  return cues[subcat]?.test(text) || false;
}

// Rating compliance
function ratingOK(text: string, rating: Rating): boolean {
  if (SLURS.test(text)) return false;
  switch (rating) {
    case "G":
      return !SWEARS_MILD.test(text) && !SWEARS_STRONG.test(text);
    case "PG":
      return !SWEARS_STRONG.test(text);                    // mild allowed only if product wants it off, keep strict here
    case "PG-13":
      return !SWEARS_STRONG.test(text);                    // mild ok, strong not ok
    case "R":
      return true;                                         // strong allowed, still no slurs
  }
}

// Single line validation
export function validateLine(line: string, scenario: Scenario): { ok: true } | { ok: false; reason: string } {
  const text = norm(line);

  // 1) one sentence, 50–120 chars
  if (text.length < 50 || text.length > 120) return { ok: false, reason: "length_out_of_bounds" };

  // 2) punctuation caps
  if (punctCount(text) > MAX_PUNCT_PER_LINE) return { ok: false, reason: "too_much_punctuation" };

  // 3) forbidden punctuation
  if (FORBIDDEN_PUNCT.test(text)) return { ok: false, reason: "forbidden_punctuation" };

// 4) insert tags once each (flex or exact for proper names)
if (scenario.insertTags?.length) {
  for (const tag of scenario.insertTags) {
    const isProperName = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/.test(tag.trim());
    const ok = isProperName ? hasInsertOnceExact(text, tag) : hasInsertOnceFlexible(text, tag);
    if (!ok) return { ok: false, reason: `insert_not_once:${tag}` };
  }
}

  // 5) category anchoring (flex)
  if (!anchoredToCategory(text, scenario.subcategory)) return { ok: false, reason: "category_anchor_missing" };

  // 6) rating compliance
  if (!ratingOK(text, scenario.rating)) return { ok: false, reason: "rating_violation" };

  // 7) basic cleanliness
  if (/\b(NAME|USER|PLACEHOLDER|friend)\b/i.test(text)) return { ok: false, reason: "placeholder_leak" };

  return { ok: true };
}

// Batch validation (set of 4). Enforces varied rhythm and anchoring coverage.
export function validateBatch(input: BatchInput): { ok: true } | { ok: false; details: any } {
  const { scenario, lines } = input;
  if (!Array.isArray(lines) || lines.length !== 4) return { ok: false, details: "batch_must_have_4_lines" };

  const results = lines.map(l => validateLine(l, scenario));
  const failures = results
    .map((r, i) => ({ i, r }))
    .filter(x => !x.r.ok)
    .map(x => ({ index: x.i, reason: (x.r as any).reason }));

  if (failures.length) return { ok: false, details: { failures } };

  // rhythm: require at least one short (<70), one long (>=100)
  const lens = lines.map(l => norm(l).length);
  const hasShort = lens.some(n => n < 70);
  const hasLong = lens.some(n => n >= 100);
  if (!hasShort || !hasLong) return { ok: false, details: "rhythm_variety_missing" };

  // LOOSENED RULE: batch-level anchoring - at least 2 of 4 lines should contain a direct lexicon hit
  // The other lines can rely on contextual cues only
  const directLexHits = lines.filter(l =>
    (LEX[scenario.subcategory] || []).some(w => new RegExp(`\\b${w.replace(/\s+/g, "\\s+")}\\b`, "i").test(l))
  ).length;
  if (directLexHits < 2) return { ok: false, details: "insufficient_direct_anchors" };

  return { ok: true };
}
