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
  // Replace em dashes
  if (rules.punctuation.ban_em_dash) {
    Object.entries(rules.punctuation.replacement).forEach(([from, to]) => {
      line = line.replace(new RegExp(from, 'g'), to);
    });
  }
  
  // Apply auto substitutions
  Object.entries(rules.spelling.auto_substitutions).forEach(([from, to]) => {
    line = line.replace(new RegExp(`\\b${from}\\b`, 'gi'), to);
  });
  
  // Count and limit punctuation marks
  const allowedPattern = rules.punctuation.allowed.map(p => `\\${p}`).join('');
  const punctuationRegex = new RegExp(`[${allowedPattern}]`, 'g');
  const matches = line.match(punctuationRegex) || [];
  
  if (matches.length > rules.punctuation.max_marks_per_line) {
    // Remove excess punctuation, keeping the first few
    let count = 0;
    line = line.replace(punctuationRegex, (match) => {
      count++;
      return count <= rules.punctuation.max_marks_per_line ? match : '';
    });
    
    // Ensure line ends with proper punctuation if it doesn't already
    if (!line.match(/[.!?]$/)) {
      line = line.trim() + '.';
    }
  }
  
  return line.trim();
}

export function validateLength(line: string, rules: ViiibesRules): boolean {
  return line.length >= rules.length.min_chars && line.length <= rules.length.max_chars;
}
