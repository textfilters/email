import { type EmailTextMeta } from "../../normalization.js";
import { isAddressListGap, isSameProsePhrase } from "./phrase.js";
import { hasProseLocalContext } from "./prose.js";
import {
  isAddressListConjunction,
  isValidDomain,
  isValidLocal,
} from "../rules/index.js";
import { TOKEN_TYPE, type ScannerOptions, type Token } from "../core/types.js";

const DEFAULT_DOMAIN_OPTIONS: ScannerOptions = {
  allowLocalhost: false,
  allowSingleLabelDomain: false,
};

const previousObfuscatedAddressLocalIndex = (
  tokens: readonly Token[],
  endIndex: number,
): number | undefined => {
  // Walk backward over "label dot label" domain tokens to find the local part
  // before the matching "at". This is only used for list-context inheritance.
  let cursor = endIndex;
  const lastLabel = tokens[cursor];
  if (lastLabel?.type !== TOKEN_TYPE.word) return undefined;

  const labels = [lastLabel.value];
  cursor -= 1;
  while (
    tokens[cursor]?.type === TOKEN_TYPE.dot &&
    tokens[cursor - 1]?.type === TOKEN_TYPE.word
  ) {
    labels.unshift(tokens[cursor - 1].value);
    cursor -= 2;
  }

  if (!isValidDomain(labels, DEFAULT_DOMAIN_OPTIONS)) return undefined;
  if (tokens[cursor]?.type !== TOKEN_TYPE.at) return undefined;

  const localIndex = cursor - 1;
  const local = tokens[localIndex];
  if (
    local?.type !== TOKEN_TYPE.word ||
    local.value.length < 3 ||
    !isValidLocal(local.value)
  ) {
    return undefined;
  }

  return localIndex;
};

export const previousAddressListLocalIndex = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
): number | undefined => {
  const conjunctionIndex = index - 1;
  const conjunction = tokens[conjunctionIndex];
  if (!isAddressListConjunction(conjunction)) return undefined;
  if (!isSameProsePhrase(meta, conjunction, local)) return undefined;

  const priorEndIndex = conjunctionIndex - 1;
  const priorEnd = tokens[priorEndIndex];
  if (
    priorEnd === undefined ||
    !isAddressListGap(meta, priorEnd, conjunction)
  ) {
    return undefined;
  }

  const priorLocalIndex = previousObfuscatedAddressLocalIndex(
    tokens,
    priorEndIndex,
  );
  if (priorLocalIndex === undefined) return undefined;

  const priorLocal = tokens[priorLocalIndex];
  if (
    priorLocal !== undefined &&
    hasProseLocalContext(meta, tokens, priorLocalIndex, priorLocal)
  ) {
    return undefined;
  }

  return priorLocalIndex;
};
