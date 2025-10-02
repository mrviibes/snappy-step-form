// src/lib/textValidator.ts (tiny, optional)
export function softValidateLine(line: string): string | null {
  const t = (line || "").trim();
  if (t.length < 40 || t.length > 120) return "line_length_40_120";
  if (!/[.!?]$/.test(t)) return "missing_terminal_punct";
  return null;
}

export function softValidateBatch(lines: string[]): string[] {
  if (!Array.isArray(lines) || lines.length !== 4) return ["batch_must_have_4_lines"];
  const errs = lines.map(softValidateLine).filter(Boolean) as string[];
  return errs; // purely advisory; do not block submission
}
