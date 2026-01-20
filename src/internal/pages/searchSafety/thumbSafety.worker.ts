type AnalyzeMsg = {
  type: "analyze";
  url: string;
  bitmap: ImageBitmap;
};

type ResultMsg = {
  type: "result";
  url: string;
  hash: string;
  sexual: number;
  violence: number;
  disturbing: number;
};

type ErrorMsg = {
  type: "error";
  url: string;
  error: string;
};

const SIZE = 224;

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function sigmoid(x: number): number {
  if (x > 20) return 1;
  if (x < -20) return 0;
  return 1 / (1 + Math.exp(-x));
}

function bytesToHex(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < b.length; i++) out += b[i]!.toString(16).padStart(2, "0");
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(digest);
}

function getImageData224(bitmap: ImageBitmap): ImageData {
  const canvas = new OffscreenCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no_canvas_ctx");
  ctx.drawImage(bitmap, 0, 0, SIZE, SIZE);
  return ctx.getImageData(0, 0, SIZE, SIZE);
}

function computeScores(img: ImageData): {
  sexual: number;
  violence: number;
  disturbing: number;
} {
  const { data, width, height } = img;
  const pixels = width * height;

  let skinCount = 0;
  let redCount = 0;
  let darkCount = 0;

  let lumaSum = 0;
  let edgeSum = 0;

  const luma = new Uint8Array(pixels);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;

    const y = (r * 30 + g * 59 + b * 11) / 100;
    luma[p] = y & 0xff;
    lumaSum += y;

    if (y < 42) darkCount++;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    // YCbCr-ish skin heuristic (conservative: tends to over-detect skin).
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    const skin =
      r > 60 &&
      g > 30 &&
      b > 15 &&
      (max - min) > 10 &&
      r >= g &&
      r >= b &&
      cb >= 75 &&
      cb <= 140 &&
      cr >= 130 &&
      cr <= 185;
    if (skin) skinCount++;

    const redLike =
      r > 110 && g < 90 && b < 90 && (r - g) > 35 && (r - b) > 35;
    if (redLike) redCount++;
  }

  for (let y = 0; y < height - 1; y++) {
    const row = y * width;
    for (let x = 0; x < width - 1; x++) {
      const idx = row + x;
      const v = luma[idx]!;
      const dx = Math.abs(v - luma[idx + 1]!);
      const dy = Math.abs(v - luma[idx + width]!);
      edgeSum += dx + dy;
    }
  }

  const skinRatio = skinCount / pixels;
  const redRatio = redCount / pixels;
  const darkRatio = darkCount / pixels;

  const edgeMean = edgeSum / ((width - 1) * (height - 1) * 2 * 255);

  // A tiny, conservative heuristic "micro-model" meant to minimize false negatives
  // (err on the side of keeping thumbnails blurred).
  const sexual = clamp01(sigmoid(-2.2 + 9.0 * skinRatio + 1.2 * edgeMean));
  const violence = clamp01(sigmoid(-2.8 + 14.0 * redRatio + 0.8 * edgeMean));
  const disturbing = clamp01(
    sigmoid(-2.6 + 6.0 * darkRatio + 6.0 * redRatio + 1.0 * edgeMean),
  );

  return { sexual, violence, disturbing };
}

self.onmessage = async (ev: MessageEvent<AnalyzeMsg>) => {
  const msg = ev.data;
  if (!msg || msg.type !== "analyze") return;

  const url = String(msg.url || "");
  const bitmap = msg.bitmap;

  try {
    const img = getImageData224(bitmap);
    const bytes = new Uint8Array(img.data.buffer.slice(0));
    const hash = await sha256Hex(bytes);
    const scores = computeScores(img);

    const out: ResultMsg = {
      type: "result",
      url,
      hash,
      sexual: scores.sexual,
      violence: scores.violence,
      disturbing: scores.disturbing,
    };
    (self as any).postMessage(out);
  } catch (e: any) {
    const out: ErrorMsg = {
      type: "error",
      url,
      error: String(e?.message || e || "analyze_failed"),
    };
    (self as any).postMessage(out);
  } finally {
    try {
      bitmap?.close?.();
    } catch {
      // ignore
    }
  }
};

