import { isWhitespace, type EmailTextMeta } from "../../normalization.js";
import {
  isAddressNoun,
  isEmailLabelWord,
  isKnownProseLocal,
  isLabelSeparator,
  isLabelSeparatorToken,
  isRecipientObject,
  SCANNER_WORD,
} from "../rules.js";
import { previousWordInSamePhrase } from "./phrase.js";
import { TOKEN_TYPE, type Token } from "../core.js";

const hasLabelSeparator = (
  meta: EmailTextMeta,
  start: number,
  end: number,
): boolean => {
  // A label can be split from its value by ":" or "-", and values may start on
  // the next line. The separator is required so plain adjacent words do not
  // become labels accidentally.
  let seenLabelSeparator = false;
  for (let i = start; i < end; i++) {
    if (meta.zeroWidth[i]) continue;
    const value = meta.normalized[i];
    if (isLabelSeparator(value)) {
      seenLabelSeparator = true;
      continue;
    }
    if (!isWhitespace(value)) return false;
  }
  return seenLabelSeparator;
};

const isEmailLabel = (
  label: Token | undefined,
  beforeLabel: Token | undefined,
): boolean =>
  isEmailLabelWord(label) ||
  (label?.type === TOKEN_TYPE.word &&
    label.value === SCANNER_WORD.to &&
    (beforeLabel === undefined ||
      (beforeLabel.type === TOKEN_TYPE.word &&
        beforeLabel.value === SCANNER_WORD.reply))) ||
  (isAddressNoun(label) &&
    (beforeLabel === undefined || isEmailLabelWord(beforeLabel))) ||
  (isRecipientObject(label) && isEmailLabelWord(beforeLabel));

const labelIndexBeforeSeparator = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
): number | undefined => {
  // Hyphen is part of WORD_CHAR_RE, so "Email - user..." can tokenize the
  // separator as a word token. Walk back across separator tokens before looking
  // for the actual label word.
  const local = tokens[index];
  let labelIndex = index - 1;
  while (isLabelSeparatorToken(tokens[labelIndex])) labelIndex -= 1;

  const label = tokens[labelIndex];
  if (local === undefined || label?.type !== TOKEN_TYPE.word) return undefined;
  if (!hasLabelSeparator(meta, label.end, local.start)) return undefined;

  return labelIndex;
};

export const hasEmailLabelContext = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
): boolean => {
  const labelIndex = labelIndexBeforeSeparator(meta, tokens, index);
  if (labelIndex === undefined) return false;
  const label = tokens[labelIndex];
  const beforeLabel = previousWordInSamePhrase(meta, tokens, labelIndex);
  return isEmailLabel(label, beforeLabel);
};

export const hasNonEmailProseLabelContext = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
): boolean => {
  // Non-email headings such as "Try:" and "Note:" should preserve known prose
  // locals even when the value looks like an obfuscated address.
  if (!isKnownProseLocal(local)) return false;

  const labelIndex = labelIndexBeforeSeparator(meta, tokens, index);
  if (labelIndex === undefined) return false;

  const label = tokens[labelIndex];
  const beforeLabel = previousWordInSamePhrase(meta, tokens, labelIndex);
  return !isEmailLabel(label, beforeLabel);
};
