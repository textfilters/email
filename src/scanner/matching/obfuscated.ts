import { type TextCodePointRange } from "@textfilters/core";

import { type EmailTextMeta } from "../../normalization.js";
import { isProseBareAtPhrase } from "../context.js";
import { TOKEN_TYPE, type ScannerOptions } from "../core.js";
import {
  hasBoundary,
  isExcludedAddress,
  isValidDomain,
  isValidLocal,
} from "../rules.js";
import { tokenize } from "../tokenization.js";
import { nextContent, previousContent } from "./boundary.js";

export const collectObfuscatedEmailRanges = (
  meta: EmailTextMeta,
  options: ScannerOptions,
): readonly TextCodePointRange[] => {
  // Obfuscated matching needs surrounding token context because plain words
  // around "at" are often prose rather than mailbox addresses.
  const tokens = tokenize(meta);
  const ranges: TextCodePointRange[] = [];

  for (let i = 0; i < tokens.length - 2; i++) {
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
    if (isExcludedAddress(local.value, labels, options)) continue;
    if (isProseBareAtPhrase(meta, tokens, i, local, at, options)) continue;

    const endToken = tokens[cursor - 1];
    if (!hasBoundary(previousContent(meta, local.start - 1))) continue;
    if (!hasBoundary(nextContent(meta, endToken.end))) continue;
    ranges.push([local.start, endToken.end]);
    i = cursor - 1;
  }

  return ranges;
};
