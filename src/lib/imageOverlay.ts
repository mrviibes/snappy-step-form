export type Layout = "lower_third" | "top_bottom" | "sidebar" | "caption" | "minimal";

export interface OverlayOpts {
  text: string;
  layout: Layout;
  maxFraction?: number;   // default 0.25
  fontFamily?: string;    // e.g. "Inter, Arial, sans-serif"
  weight?: number;        // 600–800 looks good
  padding?: number;       // px
  stroke?: boolean;       // add 1–2px outline
}

export async function drawOverlay(imgUrl: string, opts: OverlayOpts): Promise<HTMLCanvasElement> {
  const img = await loadImage(imgUrl);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = img.width; 
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  const maxArea = (opts.maxFraction ?? 0.25) * canvas.width * canvas.height;
  const pad = opts.padding ?? 24;

  // Choose layout rect
  const rect = (() => {
    if (opts.layout === "lower_third")   return { x: 0, y: canvas.height * 0.72, w: canvas.width, h: canvas.height * 0.28 };
    if (opts.layout === "sidebar")       return { x: 0, y: 0, w: Math.round(canvas.width * 0.30), h: canvas.height };
    if (opts.layout === "caption")       return { x: 0, y: canvas.height * 0.86, w: canvas.width, h: canvas.height * 0.14 };
    if (opts.layout === "minimal")       return { x: canvas.width*0.15, y: canvas.height*0.10, w: canvas.width*0.70, h: canvas.height*0.20 };
    // top_bottom default
    return { x: 0, y: 0, w: canvas.width, h: canvas.height * 0.20 };
  })();

  // Shrink rect if it exceeds max area
  const rectArea = rect.w * rect.h;
  if (rectArea > maxArea) {
    const scale = Math.sqrt(maxArea / rectArea);
    rect.w *= scale; 
    rect.h *= scale;
    // Keep anchored for each layout
    if (opts.layout === "lower_third" || opts.layout === "caption") {
      rect.y = canvas.height - rect.h;
    } else if (opts.layout === "minimal") {
      rect.x = (canvas.width - rect.w) / 2;
      rect.y = canvas.height * 0.10;
    }
  }

  // Draw semi-transparent banner for contrast
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // Fit text into rect with binary search on font size
  const fontBase = 64;
  const family = opts.fontFamily ?? "Inter, Arial, sans-serif";
  const weight = opts.weight ?? 800;

  function fits(size: number) {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = wrapLines(ctx, opts.text, rect.w - pad*2);
    const height = lines.length * (size * 1.25);
    return height <= (rect.h - pad*2);
  }
  
  let lo = 12, hi = fontBase, mid = fontBase;
  while (lo <= hi) { 
    mid = ((lo+hi)/2)|0; 
    fits(mid) ? lo = mid+1 : hi = mid-1; 
  }
  const fontSize = hi > 0 ? hi : 12;

  ctx.font = `${weight} ${fontSize}px ${family}`;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const lines = wrapLines(ctx, opts.text, rect.w - pad*2);
  const lineH = fontSize * 1.25;
  let y = rect.y + pad;

  // Optional stroke for readability
  if (opts.stroke) {
    ctx.lineWidth = Math.max(1, Math.round(fontSize / 16));
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    for (const ln of lines) { 
      ctx.strokeText(ln, rect.x + pad, y); 
      y += lineH; 
    }
    y = rect.y + pad;
  }
  
  for (const ln of lines) { 
    ctx.fillText(ln, rect.x + pad, y); 
    y += lineH; 
  }

  return canvas;
}

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (context.measureText(test).width > maxWidth) { 
      if (line) lines.push(line); 
      line = w; 
    } else { 
      line = test; 
    }
  }
  if (line) lines.push(line);
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { 
    const i = new Image(); 
    i.crossOrigin = "anonymous"; 
    i.onload = () => res(i); 
    i.onerror = rej; 
    i.src = src; 
  });
}

// Layout mapping helper for existing layout names
export function mapLayoutToOverlay(layout: string): Layout {
  const mapping: Record<string, Layout> = {
    "meme-text": "top_bottom",
    "lower-banner": "lower_third", 
    "side-bar": "sidebar",
    "badge-callout": "minimal",
    "subtle-caption": "caption",
    "negative-space": "minimal"
  };
  
  return mapping[layout] || "lower_third";
}

// Convert canvas to downloadable blob
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise(resolve => {
    canvas.toBlob(resolve as BlobCallback, 'image/png', 1.0);
  });
}
