function buildMinimalPrompt(
  category: string,
  leaf: string,
  toneTag: string,     // from TONE_TAGS
  ratingTag: string,   // from RATING_TAGS (1 short sentence)
  inserts: string[]    // e.g., ["Jesse","gay"]
) {
  const sys = `You write 4 punchy, human one-liners for a ${category} occasion.
Return EXACTLY 4 lines. One sentence per line. ≤120 chars. End with punctuation.
Use Tone and Rating as creative constraints, not labels.
Insert Words: include exactly one per line, placed naturally (allow “Name’s”), never tacked on at the end.
Always keep a comedic beat; gentler tones are still witty.`;

  const user = `Context: ${category} › ${leaf || "the selected theme"}
Tone: ${toneTag}
Rating: ${ratingTag}
Insert Words: ${inserts.join(", ") || "none"}

Write 4 distinct one-liners. Vary structure:
• vocative compliment with twist
• imperative CTA
• metaphor/simile gag
• affectionate mini-roast

Do not output labels or numbering. Output the 4 lines only.`;

  return `${sys}\n\n${user}`;
}
