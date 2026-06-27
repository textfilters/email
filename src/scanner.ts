import {
  lowerNfkc,
  type TextCodePointRange,
  mergeCodePointRanges,
} from "@textfilters/core";

import { createEmailTextMeta } from "./normalization.js";
import { collectDirectEmailRange } from "./scanner/matching/direct.js";
import { collectObfuscatedEmailRanges } from "./scanner/matching/obfuscated.js";
import { createExclusionSets } from "./scanner/rules/exclusions.js";
import { TOKEN_VALUE, type ScannerOptions } from "./scanner/core/types.js";
import {
  EMAIL_FILTER_NAME,
  type EmailFilterOptions,
  type EmailRangeScanner,
} from "./types.js";

export interface EmailScannerConfig extends EmailFilterOptions {}

export function createEmailScanner(
  config: EmailScannerConfig = {},
): EmailRangeScanner {
  const scannerOptions = createScannerOptions(config);

  return {
    name: EMAIL_FILTER_NAME,
    scan(input) {
      return {
        ranges: scanEmailRangesWithOptions(input.text, scannerOptions),
      };
    },
  };
}

export function scanEmailRanges(
  value: unknown,
  options: EmailFilterOptions = {},
): readonly TextCodePointRange[] {
  return scanEmailRangesWithOptions(
    String(value ?? ""),
    createScannerOptions(options),
  );
}

export function collectEmailRanges(
  value: string,
  options: EmailFilterOptions = {},
): readonly TextCodePointRange[] {
  return scanEmailRanges(value, options);
}

function createScannerOptions(options: EmailFilterOptions): ScannerOptions {
  return {
    allowLocalhost: options.allowLocalhost === true,
    allowSingleLabelDomain: options.allowSingleLabelDomain === true,
    matchObfuscated: options.matchObfuscated !== false,
    exclusions: createExclusionSets(
      options.excludeEmails,
      options.excludeUsernames,
      options.excludeDomains,
    ),
  };
}

function scanEmailRangesWithOptions(
  value: string,
  scannerOptions: ScannerOptions,
): readonly TextCodePointRange[] {
  if (!value || !hasEmailCandidate(value, scannerOptions)) {
    return [];
  }

  const meta = createEmailTextMeta(value);
  const ranges: TextCodePointRange[] = [];

  // Direct addresses are character-scanned around literal "@" so package
  // scopes and social handles can be rejected with boundary checks.
  for (let i = 0; i < meta.normalized.length; i++) {
    if (meta.normalized[i] !== TOKEN_VALUE.atSymbol) continue;
    const range = collectDirectEmailRange(meta, i, scannerOptions);
    if (range) {
      ranges.push(range);
      i = range[1] - 1;
    }
  }

  if (scannerOptions.matchObfuscated) {
    // Obfuscated addresses need token-level context because words around "at"
    // can be either mailbox introductions or ordinary prose/URL-like text.
    ranges.push(...collectObfuscatedEmailRanges(meta, scannerOptions));
  }
  return mergeCodePointRanges(ranges);
}

function hasEmailCandidate(
  value: string,
  scannerOptions: ScannerOptions,
): boolean {
  const normalized = lowerNfkc(value);
  if (normalized.includes(TOKEN_VALUE.atSymbol)) return true;
  if (!scannerOptions.matchObfuscated) return false;

  if (!hasWordCandidate(normalized, TOKEN_VALUE.atWord)) return false;
  return (
    scannerOptions.allowLocalhost ||
    scannerOptions.allowSingleLabelDomain ||
    normalized.includes(TOKEN_VALUE.dotSymbol) ||
    hasWordCandidate(normalized, TOKEN_VALUE.dotWord)
  );
}

function hasWordCandidate(value: string, word: string): boolean {
  for (
    let index = value.indexOf(word);
    index >= 0;
    index = value.indexOf(word, index + 1)
  ) {
    const before = value[index - 1] ?? "";
    const after = value[index + word.length] ?? "";
    if (!isAsciiLetter(before) && !isAsciiLetter(after)) {
      return true;
    }
  }

  return false;
}

function isAsciiLetter(value: string): boolean {
  return value.length === 1 && value >= "a" && value <= "z";
}
