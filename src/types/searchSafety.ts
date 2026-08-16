export type ThumbSafetyScores = {
  sexual: number;
  violence: number;
  disturbing: number;
};

export type ThumbSafetyAnalyzeMsg = {
  type: "analyze";
  url: string;
  bitmap: ImageBitmap;
};

export type ThumbSafetyResultMsg = {
  type: "result";
  url: string;
  hash: string;
} & ThumbSafetyScores;

export type ThumbSafetyErrorMsg = {
  type: "error";
  url: string;
  error: string;
};

export type ThumbSafetySettings = {
  showSexualContent: boolean;
  showViolentContent: boolean;
  showDisturbingImagery: boolean;
};

export type ThumbSafetyBlockedCategory = "sexual" | "violence" | "disturbing";

export type PersistedCacheV1 = {
  v: 1;
  at: number;
  urls: Record<string, string>;
  hashes: Record<string, ThumbSafetyScores & { at: number }>;
  hiddenHashes?: Record<string, number>;
  hiddenUrls?: Record<string, number>;
};

export type Pending = {
  promise: Promise<{ hash: string; scores: ThumbSafetyScores } | null>;
  resolve: (v: { hash: string; scores: ThumbSafetyScores } | null) => void;
};
