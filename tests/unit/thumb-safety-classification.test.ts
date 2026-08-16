import { describe, expect, it } from "vitest";
import {
  blockedCategories,
  isBlockedBySettings,
  isGreyZoneByTags,
  shouldSkipAnalysisAndRenderClear,
} from "../../src/internal/pages/searchSafety/thumbSafetyService";
import type { ThumbSafetySettings } from "../../src/types/searchSafety";

const ALL_HIDDEN: ThumbSafetySettings = {
  showSexualContent: false,
  showViolentContent: false,
  showDisturbingImagery: false,
};

describe("isGreyZoneByTags", () => {
  it("treats an unknown image as grey zone", () => {
    expect(isGreyZoneByTags([])).toBe(true);
    expect(isGreyZoneByTags(null)).toBe(true);
    expect(isGreyZoneByTags(undefined)).toBe(true);
  });

  it("treats a described subject as grey zone when the description involves people or private spaces", () => {
    expect(isGreyZoneByTags(["woman"])).toBe(true);
    expect(isGreyZoneByTags(["selfie"])).toBe(true);
    expect(isGreyZoneByTags(["bathroom", "tiles"])).toBe(true);
    expect(isGreyZoneByTags(["Portrait"])).toBe(true);
  });

  it("clears an image described as something else entirely", () => {
    expect(isGreyZoneByTags(["mountain", "sunset"])).toBe(false);
    expect(isGreyZoneByTags(["invoice", "chart"])).toBe(false);
  });

  // Regression: a content type is not a description. When the search page's
  // badge row and the tag list were one array, a display fallback pushed the
  // MIME type into it, so every untagged image arrived here carrying exactly
  // one tag - "image/jpeg" - which is not an empty list and matches none of the
  // sensitive words. The images nothing was known about were the ones rendered
  // in the clear and never analysed. Tags come from the gateway's index, so a
  // gateway can still send one; the classification has to hold on its own.
  it("ignores content types, which describe the file and not the subject", () => {
    expect(isGreyZoneByTags(["image/jpeg"])).toBe(true);
    expect(isGreyZoneByTags(["image/jpeg", "image/png"])).toBe(true);
    expect(isGreyZoneByTags(["video/mp4"])).toBe(true);
    expect(isGreyZoneByTags(["application/octet-stream"])).toBe(true);
    expect(isGreyZoneByTags([""])).toBe(true);
  });

  it("still reads the descriptive tags sitting next to a content type", () => {
    expect(isGreyZoneByTags(["image/jpeg", "portrait"])).toBe(true);
    expect(isGreyZoneByTags(["image/jpeg", "mountain"])).toBe(false);
  });
});

describe("shouldSkipAnalysisAndRenderClear", () => {
  it("never skips analysis for an image the index says nothing useful about", () => {
    expect(shouldSkipAnalysisAndRenderClear([])).toBe(false);
    expect(shouldSkipAnalysisAndRenderClear(["image/jpeg"])).toBe(false);
    expect(shouldSkipAnalysisAndRenderClear(undefined)).toBe(false);
  });

  it("skips analysis once the subject is described and is not sensitive", () => {
    expect(shouldSkipAnalysisAndRenderClear(["mountain"])).toBe(true);
  });
});

describe("blockedCategories", () => {
  const certain = { sexual: 0.99, violence: 0.99, disturbing: 0.99 };

  it("blocks each category the settings ask to hide", () => {
    expect(blockedCategories(certain, ALL_HIDDEN)).toEqual([
      "sexual",
      "violence",
      "disturbing",
    ]);
  });

  it("honours a category the user chose to show", () => {
    const settings = { ...ALL_HIDDEN, showSexualContent: true };
    expect(blockedCategories(certain, settings)).toEqual(["violence", "disturbing"]);
  });

  it("only blocks above the confidence threshold", () => {
    expect(blockedCategories({ sexual: 0.85, violence: 0, disturbing: 0 }, ALL_HIDDEN)).toEqual([]);
    expect(
      blockedCategories({ sexual: 0.86, violence: 0, disturbing: 0 }, ALL_HIDDEN),
    ).toEqual(["sexual"]);
  });

  // The old 0.95 needed roughly 56% skin-like pixels, which real images almost
  // never reach, so nothing was ever blocked. Locked in so a future tweak to the
  // threshold has to be a decision rather than a drift.
  it("blocks a score that the previous threshold let through", () => {
    expect(blockedCategories({ sexual: 0.9, violence: 0, disturbing: 0 }, ALL_HIDDEN)).toEqual([
      "sexual",
    ]);
  });

  it("agrees with isBlockedBySettings", () => {
    expect(isBlockedBySettings(certain, ALL_HIDDEN)).toBe(true);
    expect(isBlockedBySettings({ sexual: 0, violence: 0, disturbing: 0 }, ALL_HIDDEN)).toBe(false);
  });
});
