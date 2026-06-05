import { type TextCodePointRange } from "@textfilters/core";

import { type EmailTextMeta } from "../../normalization.js";
import { isBareAtProsePhrase } from "../context/bare-at-policy.js";
import { TOKEN_TYPE, type ScannerOptions } from "../core/types.js";
import { isValidLocal } from "../rules/validators.js";
import { tokenize } from "../tokenization/tokenizer.js";
import { isCandidateExcluded, isCandidateMatchable } from "./candidate.js";

export const collectObfuscatedEmailRanges = (
  meta: EmailTextMeta,
  options: ScannerOptions,
): readonly TextCodePointRange[] => {
  // Obfuscated matching needs surrounding token context because plain words
  // around "at" are often prose rather than mailbox addresses.
  const tokens = tokenize(meta);
  const ranges: TextCodePointRange[] = [];
  const acceptedListLocalIndexes = new Set<number>();

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

    if (
      isBareAtProsePhrase(
        meta,
        tokens,
        i,
        local,
        at,
        options,
        acceptedListLocalIndexes,
      )
    ) {
      continue;
    }

    const endToken = tokens[cursor - 1];
    const candidate = {
      kind: "obfuscated",
      local: local.value,
      labels,
      start: local.start,
      end: endToken.end,
    } as const;
    if (!isCandidateMatchable(meta, candidate, options)) continue;

    acceptedListLocalIndexes.add(i);
    if (!isCandidateExcluded(candidate, options)) {
      ranges.push([candidate.start, candidate.end]);
    }
    i = cursor - 1;
  }

  return ranges;
};
