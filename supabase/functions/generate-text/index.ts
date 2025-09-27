// ...imports & boilerplate exactly as you pasted...

// ====== Length variety helpers (NEW) ======
const LENGTH_BUCKETS = [68, 85, 105, 118]; // tweakable targets

function softTrimAtWordBoundary(s: string, target: number) {
  if (s.length <= target) return s;
  let cut = s.slice(0, target);
  cut = cut.replace(/\s+\S*$/,"").trim();
  if (!/[.?!]$/.test(cut)) cut += ".";
  return cut;
}

function smartExpand(
  s: string,
  tokens: {text:string; role:string}[],
  tone: string
) {
  const endPunct = /[.?!]$/;
  const base = s.replace(endPunct, "");
  const t = tokens[0]?.text ?? "";

  const tailsPool: string[] = [
    `with ${t ? t + " present" : "suspicious confidence"}`,
    "like silence had it coming",
    "in a room already low on patience",
    "which somehow wasn’t even the finale",
    "just when quiet thought it was safe",
    "with timing only a calendar could love"
  ];
  if (/savage/i.test(tone)) {
    tailsPool.push(
      "like a public service announcement for groans",
      "with the efficiency of a friendly menace"
    );
  } else if (/playful/i.test(tone)) {
    tailsPool.push(
      "like confetti nobody ordered",
      "with a grin that sponsors itself"
    );
  }
  const tail = " " + tailsPool[Math.floor(Math.random()*tailsPool.length)];
  const out = base + ", " + tail.trim();
  return endPunct.test(s) ? out + s.slice(s.length-1) : out + ".";
}

function normalizeToBucket(
  s: string,
  target: number,
  tokens: {text:string; role:string}[],
  tone: string,
  rules: any
) {
  let out = s;
  if (out.length < Math.max(60, target - 8)) {
    out = smartExpand(out, tokens, tone);
  }
  if (out.length > target + 6) {
    out = softTrimAtWordBoundary(out, Math.min(target, (rules.length?.max_chars ?? 120)));
  }
  return out;
}

// ...all your existing utilities unchanged...

// ============== ENFORCEMENT (main pipeline) ==============
function enforceRules(
  lines: string[],
  rules: any,
  rating: string,
  insertTokens: Token[] = [],
  tone: string = ""              // <-- NEW param
) {
  const enforcement: string[] = [];
  const minLen = rules.length?.min_chars ?? 60;
  const maxLen = rules.length?.max_chars ?? 120;

  let processed = lines
    .map((raw) => stripLeadingNumber(raw.trim()))
    .filter((l) => l && !META.test(l))
    .map((t) => t.replace(/["`]+/g, "").replace(/\s+/g, " ").trim());

  // ...existing per-line cleanup, token placement, rating handling...

  // ---- length variety normalization (apply AFTER rating-specific edits, BEFORE dedupe)
  const idxs = [0,1,2,3].sort(()=>Math.random()-0.5);
  processed = processed.map((ln, i) => {
    const bucket = LENGTH_BUCKETS[idxs[i % LENGTH_BUCKETS.length]];
    return normalizeToBucket(ln, bucket, insertTokens, tone, rules);
  });

  // ...dedupe & return...
  let unique = dedupeFuzzy(processed, 0.6);
  if (unique.length < 4) unique = dedupeFuzzy(processed, 0.8);
  if (unique.length === 0) unique = processed.slice(0, 4);
  return { lines: unique, enforcement };
}

// ============== BACKFILL (only prompt tweaked) ==============
async function backfillLines(
  missing: number,
  systemPrompt: string,
  accepted: string[],
  tone: string,
  rating: string,
  tokens: Token[],
  category?: string,
  subcategory?: string
) {
  const block = accepted.map((l,i)=>`${i+1}. ${l}`).join("\n");
  const jokeMode = typeof category === "string" && /^jokes/i.test(category);
  const styleHint = jokeMode && subcategory ? ` in the style '${subcategory}'` : "";
  const tokenHint = tokens.length ? "\nTOKENS: " + tokens.map(t => `${t.role}=${t.text}`).join(" | ") : "";
  const user = `We still need ${missing} additional ${jokeMode ? "jokes" : "one-liners"}${styleHint} that satisfy ALL constraints.${tokenHint}
Do not repeat word pairs used in:
${block}
Tone=${tone}; Rating=${rating}.
Aim for varied lengths within 60–120 characters (e.g., some near 65, 85, 105, 120).
Return exactly ${missing} new lines, one per line.`;

  const { content } = await callOpenAI(systemPrompt, user);
  return parseLines(content);
}

// ============== HTTP ==============
serve(async (req) => {
  // ...unchanged...
  // Enforce (pass tone into enforceRules now)
  let { lines, enforcement } = enforceRules(
    candidates,
    rules,
    rating || "PG-13",
    tokens,
    tone || ""
  );

  // In backfill loop, same call signature:
  // const enforcedMore = enforceRules(more, rules, rating || "PG-13", tokens, tone || "");
  // ...rest unchanged...
});
