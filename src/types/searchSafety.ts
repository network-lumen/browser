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
