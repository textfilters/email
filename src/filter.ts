import {
  maskCodePointRanges,
  normalizeMaskChar,
  type TextCodePointRange,
} from "@textfilters/core";

import { collectEmailRanges } from "./scanner.js";
import {
  EMAIL_FILTER_NAME,
  type EmailFilter,
  type EmailFilterOptions,
} from "./types.js";

const normalizeLengthPreservingMaskChar = (
  maskChar: string | undefined,
): string => {
  const normalized = normalizeMaskChar(maskChar);
  return normalized.length === 1 ? normalized : "*";
};

const maskEmailRanges = (
  codePoints: readonly string[],
  ranges: readonly TextCodePointRange[],
  maskChar: string,
): string => {
  if (ranges.length === 0) return codePoints.join("");
  return maskCodePointRanges(codePoints, ranges, maskChar);
};

export function createEmailFilter(
  options: EmailFilterOptions = {},
): EmailFilter {
  const maskChar = normalizeLengthPreservingMaskChar(options.maskChar);

  return {
    name: EMAIL_FILTER_NAME,
    censor(text) {
      if (text === null || text === undefined) return "";
      const source = String(text);
      if (!source) return source;
      const codePoints = Array.from(source);
      const ranges = collectEmailRanges(source, options);
      return maskEmailRanges(codePoints, ranges, maskChar);
    },
  };
}

export function emailFilter(options?: EmailFilterOptions): EmailFilter {
  return createEmailFilter(options);
}

export const filter = createEmailFilter();
