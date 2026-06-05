import {
  type TextCodePointRange,
  mergeCodePointRanges,
} from "@textfilters/core";

import {
  createEmailTextMeta,
  isAsciiAlphaNumeric,
  type EmailTextMeta,
} from "./normalization.js";
import { isProseBareAtPhrase } from "./scanner/context/index.js";
import {
  hasBoundary,
  isLocalChar,
  isValidDomain,
  isValidLocal,
} from "./scanner/rules/index.js";
import { tokenize } from "./scanner/tokenization/tokenizer.js";
import {
  SCANNER_PUNCTUATION,
  TOKEN_TYPE,
  TOKEN_VALUE,
  type ScannerOptions,
} from "./scanner/core/types.js";
import { type EmailFilterOptions } from "./types.js";

const previousContent = (meta: EmailTextMeta, index: number): string => {
  for (let i = index; i >= 0; i--) {
    if (!meta.zeroWidth[i]) {
      return meta.normalized[i];
    }
  }
  return "";
};

const nextContent = (meta: EmailTextMeta, index: number): string => {
  for (let i = index; i < meta.normalized.length; i++) {
    if (!meta.zeroWidth[i]) {
      return meta.normalized[i];
    }
  }
  return "";
};

const collectDirectRange = (
  meta: EmailTextMeta,
  atIndex: number,
  options: ScannerOptions,
): TextCodePointRange | null => {
  let localStart = atIndex - 1;
  while (
    localStart >= 0 &&
    !meta.zeroWidth[localStart] &&
    isLocalChar(meta.normalized[localStart])
  ) {
    localStart--;
  }
  localStart++;

  let domainEnd = atIndex + 1;
  while (
    domainEnd < meta.normalized.length &&
    !meta.zeroWidth[domainEnd] &&
    (isAsciiAlphaNumeric(meta.normalized[domainEnd]) ||
      meta.normalized[domainEnd] === SCANNER_PUNCTUATION.hyphen ||
      meta.normalized[domainEnd] === TOKEN_VALUE.dotSymbol)
  ) {
    domainEnd++;
  }

  const local = meta.normalized.slice(localStart, atIndex).join("");
  const domain = meta.normalized.slice(atIndex + 1, domainEnd).join("");
  const labels = domain.split(TOKEN_VALUE.dotSymbol);

  if (!isValidLocal(local) || !isValidDomain(labels, options)) return null;
  if (!hasBoundary(previousContent(meta, localStart - 1))) return null;
  if (!hasBoundary(nextContent(meta, domainEnd))) return null;

  return [localStart, domainEnd];
};

const collectObfuscatedRanges = (
  meta: EmailTextMeta,
  options: ScannerOptions,
): readonly TextCodePointRange[] => {
  const tokens = tokenize(meta);
  const ranges: TextCodePointRange[] = [];

  for (let i = 0; i < tokens.length - 4; i++) {
    const local = tokens[i];
    const at = tokens[i + 1];
    if (local.type !== TOKEN_TYPE.word || at.type !== TOKEN_TYPE.at) continue;
    if (local.value.length < 3) continue;
    if (!isValidLocal(local.value)) continue;

    const labels: string[] = [];
    let cursor = i + 2;
    if (tokens[cursor]?.type !== TOKEN_TYPE.word) continue;
    labels.push(tokens[cursor].value);
    cursor++;

    while (
      tokens[cursor]?.type === TOKEN_TYPE.dot &&
      tokens[cursor + 1]?.type === TOKEN_TYPE.word
    ) {
      labels.push(tokens[cursor + 1].value);
      cursor += 2;
    }

    if (!isValidDomain(labels, options)) continue;
    if (isProseBareAtPhrase(meta, tokens, i, local, at)) continue;

    const endToken = tokens[cursor - 1];
    if (!hasBoundary(previousContent(meta, local.start - 1))) continue;
    if (!hasBoundary(nextContent(meta, endToken.end))) continue;
    ranges.push([local.start, endToken.end]);
    i = cursor - 1;
  }

  return ranges;
};

export function collectEmailRanges(
  value: string,
  options: EmailFilterOptions = {},
): readonly TextCodePointRange[] {
  const meta = createEmailTextMeta(value);
  const scannerOptions = {
    allowLocalhost: options.allowLocalhost === true,
    allowSingleLabelDomain: options.allowSingleLabelDomain === true,
  };
  const ranges: TextCodePointRange[] = [];

  // Direct addresses are character-scanned around literal "@" so package
  // scopes and social handles can be rejected with boundary checks.
  for (let i = 0; i < meta.normalized.length; i++) {
    if (meta.normalized[i] !== TOKEN_VALUE.atSymbol) continue;
    const range = collectDirectRange(meta, i, scannerOptions);
    if (range) {
      ranges.push(range);
      i = range[1] - 1;
    }
  }

  // Obfuscated addresses need token-level context because words around "at"
  // can be either mailbox introductions or ordinary prose/URL-like text.
  ranges.push(...collectObfuscatedRanges(meta, scannerOptions));
  return mergeCodePointRanges(ranges);
}
