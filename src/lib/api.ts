import { supabase } from '@/integrations/supabase/client';
const ctlFetch = async <T>(fn: string, body: any, timeoutMs = 30000): Promise<T> => {
const timeoutPromise = new Promise((_, reject) =>
setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
);
try {
const invokePromise = supabase.functions.invoke(fn, { body });
const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as any;
if (error) throw error;
return (data as T) ?? ({} as T);
} catch (error) {
throw error;
}
};


export async function checkServerHealth(): Promise<boolean> {
try {
const res = await ctlFetch<{ ok: boolean }>("health", {});
return !!res.ok;
} catch {
return false;
}
}


export async function getServerModels(): Promise<{ text: string; visuals: string; images: string } | null> {
try {
const res = await ctlFetch<{ ok: boolean; models?: { text: string; visuals: string; images: string } }>("health", {});
return res.models || null;
} catch {
return null;
}
}


// =====================
// TEXT GENERATION (lean)
// =====================
export async function generateTextOptions(params: GenerateTextParams): Promise<{ line: string }[]> {
// Normalize insertWords to array
const insertWords = Array.isArray(params.insertWords)
? params.insertWords.filter(Boolean)
: params.insertWords ? [params.insertWords as unknown as string] : [];


const payload = {
category: params.category || "celebrations",
subcategory: params.subcategory,
tone: params.tone,
rating: params.rating || "PG",
insertWords,
gender: params.gender || "neutral",
userId: params.userId ?? "anonymous",
rules_id: params.rules_id
};


const res = await ctlFetch<GenerateTextResponse>("generate-text", payload);
if (!res || res.success !== true || !Array.isArray(res.options) || res.options.length === 0) {
throw new Error((res as any)?.error || "Generation failed");
}
// Normalize to { line }[] for UI
return res.options.slice(0, 4).map((line: string) => ({ line }));
}


// =====================
// VISUAL RECOMMENDATIONS
// =====================
export async function generateVisualOptions(params: GenerateVisualsParams): Promise<VisualRecommendation[]> {
try {
const res = await ctlFetch<GenerateVisualsResponse>("generate-visuals", params, 90000); // 90s timeout
if (!res || (res as any).success !== true) {
throw new Error((res as any)?.error || "Visual generation failed");
}
const visuals = (res as any).visuals as VisualRecommendation[];
if (!Array.isArray(visuals) || visuals.length === 0) throw new Error("No visuals returned");
return visuals.slice(0, 4);
} catch (error) {
console.error('Visual generation failed:', error);
throw error;
}
}


// =====================
// FINAL PROMPT TEMPLATES
// =====================
export async function generateFinalPrompt(params: GenerateFinalPromptParams): Promise<{templates: Array<{name: string, positive: string, negative: string, description: string}>}> {
try {
const rawRes = await ctlFetch<GenerateFinalPromptResponse>("generate-final-prompt", params);
const res = typeof rawRes === "string" ? JSON.parse(rawRes) : rawRes;
if (!res || !res.success) {
const errorMessage = res?.error || "Template generation failed";
throw new Error(errorMessage);
}
return { templates: res.templates };
} catch (error) {
console.error('Template generation failed:', error);
throw error;
}
}


// =====================
// IMAGE GENERATION + POLLING
// =====================
export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResponse> {
try {
const response = await ctlFetch<GenerateImageResponse>("generate-image", params, 60000);
return response;
} catch (error) {
console.error('Error generating image:', error);
throw new Error(error instanceof Error ? error.message : 'Failed to generate image');
}
}


export async function pollImageStatus(jobId: string, provider: 'ideogram' | 'openai' | 'gemini'): Promise<{
success: boolean;
status: 'pending' | 'completed' | 'failed';
imageData?: string;
error?: string;
progress?: number;
}> {
try {
const response = await ctlFetch<{
success: boolean;
status: 'pending' | 'completed' | 'failed';
imageData?: string;
error?: string;
progress?: number;
}>("poll-image-status", { jobId, provider }, 15000);
return response;
} catch (error) {
console.error('Error polling image status:', error);
return { success: false, status: 'failed', error: error instanceof Error ? error.message : 'Failed to poll image status' };
}
}


// =====================
// GEMINI TEST (unchanged)
// =====================
export async function testGeminiAPI(): Promise<any> {
try {
const response = await ctlFetch<any>("test-gemini", {}, 15000);
return response;
} catch (error) {
console.error('Error testing Gemini API:', error);
throw error;
}
}