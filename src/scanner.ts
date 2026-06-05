import {
  type TextCodePointRange,
  mergeCodePointRanges,
} from "@textfilters/core";

import { createEmailTextMeta } from "./normalization.js";
import {
  collectDirectEmailRange,
  collectObfuscatedEmailRanges,
} from "./scanner/matching.js";
import { createExclusionSets } from "./scanner/rules.js";
import { TOKEN_VALUE, type ScannerOptions } from "./scanner/core.js";
import { type EmailFilterOptions } from "./types.js";

export function collectEmailRanges(
  value: string,
  options: EmailFilterOptions = {},
): readonly TextCodePointRange[] {
  const meta = createEmailTextMeta(value);
  const scannerOptions: ScannerOptions = {
    allowLocalhost: options.allowLocalhost === true,
    allowSingleLabelDomain: options.allowSingleLabelDomain === true,
    matchObfuscated: options.matchObfuscated !== false,
    exclusions: createExclusionSets(
      options.excludeEmails,
      options.excludeUsernames,
      options.excludeDomains,
    ),
  };
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
