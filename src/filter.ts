import {
  maskCodePointRangesPreservingLength,
  normalizeTextInput,
  type TextCodePointRange,
} from "@textfilters/core";

import { collectEmailRanges } from "./scanner.js";
import {
  EMAIL_FILTER_NAME,
  type EmailFilter,
  type EmailFilterOptions,
} from "./types.js";

const maskEmailRanges = (
  codePoints: readonly string[],
  ranges: readonly TextCodePointRange[],
  maskChar: string,
): string => {
  if (ranges.length === 0) return codePoints.join("");
  return maskCodePointRangesPreservingLength(codePoints, ranges, maskChar);
};

export function createEmailFilter(
  options: EmailFilterOptions = {},
): EmailFilter {
  const maskChar = options.maskChar ?? "*";

  return {
    name: EMAIL_FILTER_NAME,
    censor(text) {
      const source = normalizeTextInput(text);
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
