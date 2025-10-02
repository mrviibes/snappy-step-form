export async function generateTextOptions(params: GenerateTextParams): Promise<{ line: string }[]> {
  const insertWords = Array.isArray(params.insertWords)
    ? params.insertWords.filter(Boolean)
    : params.insertWords ? [params.insertWords as unknown as string] : [];

  const payload = {
    category: params.category || "celebrations",
    subcategory: params.subcategory,
    tone: params.tone,
    rating: params.rating || "PG",
    insertWords,
    gender: params.gender || "neutral"
  };

  const res = await ctlFetch<any>("generate-text", payload);
  if (!res || res.success !== true || !Array.isArray(res.options) || res.options.length === 0) {
    throw new Error(res?.error || "Generation failed");
  }
  return res.options.slice(0, 4).map((line: string) => ({ line }));
}
