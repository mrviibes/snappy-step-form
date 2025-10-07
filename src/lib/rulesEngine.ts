interface ViiibesRules {
  id: string;
  version: number;
  humor_baseline: boolean;
  allow_positive_and_roast: boolean;
  length: { min_chars: number; max_chars: number };
  punctuation: {
    ban_em_dash: boolean;
    replacement: Record<string, string>;
    allowed: string[];
    max_marks_per_line: number;
  };
  text_layout: {
    text_area_max_pct: number;
    placements: string[];
  };
  tones: Record<string, { rules: string[] }>;
  ratings: Record<string, {
    desc: string;
    allow_profanity: boolean;
    allow_censored_swears?: boolean;
    censored_forms?: string[];
    allow_adult_refs: boolean;
    insult_strength: string;
    profanity_whitelist?: string[];
    block_stronger_profanity?: boolean;
    require_profanity?: boolean;
    notes?: string[];
  }>;
  spelling: {
    require_exact_quotes: boolean;
    avoid_fragile_words: string[];
    auto_substitutions: Record<string, string>;
  };
  render_hints: {
    force_typography: string[];
    placement_rules: Record<string, any>;
  };
}

let cachedRules: ViiibesRules | null = null;

export async function getRules(): Promise<ViiibesRules> {
  if (cachedRules) return cachedRules;
  
  const res = await fetch('/config/viibes-rules-v4.json');
  if (!res.ok) throw new Error('Failed to load rules');
  cachedRules = await res.json();
  return cachedRules;
}

export function enforceBasicRules(line: string, rules: ViiibesRules): string {
  if (rules.punctuation.ban_em_dash) {
    Object.entries(rules.punctuation.replacement).forEach(([from, to]) => {
      line = line.replace(new RegExp(from, "g"), to);
    });
  }
  if (rules.spelling?.auto_substitutions) {
    Object.entries(rules.spelling.auto_substitutions).forEach(([from, to]) => {
      const re = new RegExp(`\\b${from}\\b`, "gi");
      line = line.replace(re, to);
    });
  }
  line = line.replace(/[:;!?"""'''(){}\[\]<>/_*#+=~^`|\\]/g, "");
  line = line.replace(/\s+/g, " ").trim();
  if (!/[.]$/.test(line)) line += ".";
  return line;
}

export function validateLength(line: string, rules: ViiibesRules): boolean {
  return line.length >= rules.length.min_chars && line.length <= rules.length.max_chars;
}
