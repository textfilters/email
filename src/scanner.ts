import {
  type TextCodePointRange,
  mergeCodePointRanges,
} from "@textfilters/core";

import {
  createEmailTextMeta,
  isAsciiAlphaNumeric,
  isAsciiLetter,
  isWhitespace,
  type EmailTextMeta,
} from "./normalization.js";
import { type EmailFilterOptions } from "./types.js";

interface ScannerOptions {
  readonly allowLocalhost: boolean;
  readonly allowSingleLabelDomain: boolean;
}

const TOKEN_TYPE = {
  word: "word",
  at: "at",
  dot: "dot",
} as const;

type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];

interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly start: number;
  readonly end: number;
  readonly wrapped: boolean;
}

const LOCAL_CHAR_RE = /^[a-z0-9._%+-]$/u;
const WORD_CHAR_RE = /^[a-z0-9_+-]$/u;
const DOMAIN_LABEL_RE = /^[a-z0-9-]+$/u;
const TLD_RE = /^[a-z][a-z0-9-]{1,62}$/u;
const EMAIL_INTRODUCER_WORDS = new Set([
  "bcc",
  "cc",
  "contact",
  "e-mail",
  "email",
  "forward",
  "mail",
  "message",
  "reach",
  "respond",
  "reply",
  "send",
  "try",
  "write",
]);
const DIRECT_EMAIL_INTRODUCER_WORDS = new Set([
  "bcc",
  "cc",
  "contact",
  "e-mail",
  "email",
  "forward",
  "mail",
  "message",
  "reach",
]);
const PREPOSITIONAL_EMAIL_INTRODUCER_WORDS = new Set([
  "bcc",
  "cc",
  "contact",
  "e-mail",
  "email",
  "forward",
  "mail",
  "message",
  "respond",
  "reply",
  "send",
  "write",
]);
const OBJECT_PREPOSITIONAL_EMAIL_INTRODUCER_WORDS = new Set([
  "e-mail",
  "email",
  "forward",
  "mail",
  "message",
  "send",
]);
const PHRASAL_EMAIL_INTRODUCER_WORDS = new Set(["reach", "reply", "respond"]);
const POSSESSIVE_INTRODUCER_WORDS = new Set([
  "her",
  "his",
  "my",
  "our",
  "their",
  "your",
]);
const PREPOSITIONAL_INTRODUCER_WORDS = new Set(["to", "via"]);
const PHRASAL_PARTICLE_WORDS = new Set(["back", "out"]);
const COPULA_INTRODUCER_WORDS = new Set(["is", "was"]);
const ADDRESS_NOUN_WORDS = new Set(["address"]);
const LABEL_SEPARATOR_WORDS = new Set([":", "-"]);
const ADDRESS_LIST_CONJUNCTION_WORDS = new Set(["and", "or"]);
const SENDABLE_OBJECT_WORDS = new Set(["it", "that", "this"]);
const RECIPIENT_OBJECT_WORDS = new Set(["me", "us"]);
const COPULA_PROSE_LOCAL_WORDS = new Set(["down", "hosted", "located"]);
const DETERMINER_WORDS = new Set([
  "a",
  "an",
  "her",
  "his",
  "my",
  "our",
  "that",
  "the",
  "their",
  "this",
  "your",
]);
const ADJECTIVE_INTRODUCER_WORDS = new Set([
  "contact",
  "e-mail",
  "email",
  "mail",
  "message",
]);
const COURTESY_COMMAND_WORDS = new Set(["kindly", "please"]);
const PROSE_OBJECT_LOCAL_WORDS = new Set([
  "code",
  "form",
  "page",
  "service",
  "shopping",
]);
const SENTENCE_INITIAL_PROSE_LOCAL_WORDS = new Set([
  "apply",
  "located",
  "shop",
  "study",
  "work",
]);
const FORWARD_PROSE_LOCAL_WORDS = new Set([
  "apply",
  "code",
  "form",
  "page",
  "shop",
  "shopping",
  "study",
  "work",
]);

const isLocalChar = (value: string): boolean => LOCAL_CHAR_RE.test(value);

const isWordChar = (value: string): boolean => WORD_CHAR_RE.test(value);

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

const hasBoundary = (value: string): boolean =>
  value === "" || !isLocalChar(value);

const isValidLocal = (value: string): boolean => {
  if (value.length === 0 || value.length > 64) return false;
  if (value.startsWith(".") || value.endsWith(".")) return false;
  if (value.includes("..")) return false;
  return Array.from(value).every(isLocalChar);
};

const isKnownProseLocal = (token: Token): boolean =>
  PROSE_OBJECT_LOCAL_WORDS.has(token.value) ||
  SENTENCE_INITIAL_PROSE_LOCAL_WORDS.has(token.value);

const isForwardProseLocal = (token: Token): boolean =>
  FORWARD_PROSE_LOCAL_WORDS.has(token.value);

const isEmailIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && EMAIL_INTRODUCER_WORDS.has(token.value);

const isDirectEmailIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word &&
  DIRECT_EMAIL_INTRODUCER_WORDS.has(token.value);

const isPrepositionalEmailIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word &&
  PREPOSITIONAL_EMAIL_INTRODUCER_WORDS.has(token.value);

const isObjectPrepositionalEmailIntroducer = (
  token: Token | undefined,
): boolean =>
  token?.type === TOKEN_TYPE.word &&
  OBJECT_PREPOSITIONAL_EMAIL_INTRODUCER_WORDS.has(token.value);

const isPhrasalEmailIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word &&
  PHRASAL_EMAIL_INTRODUCER_WORDS.has(token.value);

const isPossessiveIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word &&
  POSSESSIVE_INTRODUCER_WORDS.has(token.value);

const isPrepositionalIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word &&
  PREPOSITIONAL_INTRODUCER_WORDS.has(token.value);

const isPhrasalParticle = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && PHRASAL_PARTICLE_WORDS.has(token.value);

const isCopulaIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && COPULA_INTRODUCER_WORDS.has(token.value);

const isAddressNoun = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && ADDRESS_NOUN_WORDS.has(token.value);

const isAddressListConjunction = (token: Token | undefined): token is Token =>
  token?.type === TOKEN_TYPE.word &&
  ADDRESS_LIST_CONJUNCTION_WORDS.has(token.value);

const isLabelSeparator = (value: string): boolean =>
  LABEL_SEPARATOR_WORDS.has(value);

const isLabelSeparatorToken = (token: Token | undefined): token is Token =>
  token?.type === TOKEN_TYPE.word && isLabelSeparator(token.value);

const isSendableObject = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && SENDABLE_OBJECT_WORDS.has(token.value);

const isRecipientObject = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && RECIPIENT_OBJECT_WORDS.has(token.value);

const isDeterminer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && DETERMINER_WORDS.has(token.value);

const isCourtesyCommand = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && COURTESY_COMMAND_WORDS.has(token.value);

const isContactResourcePhrase = (
  introducer: Token | undefined,
  object: Token | undefined,
  local: Token,
): boolean =>
  introducer?.type === TOKEN_TYPE.word &&
  introducer.value === "contact" &&
  isRecipientObject(object) &&
  PROSE_OBJECT_LOCAL_WORDS.has(local.value);

const isDeterminerLedEmailObjectPhrase = (
  introducer: Token | undefined,
  determiner: Token | undefined,
  local: Token,
): boolean =>
  isDirectEmailIntroducer(introducer) &&
  isDeterminer(determiner) &&
  !isKnownProseLocal(local);

const isPlainAddressIntroducer = (token: Token | undefined): boolean =>
  token === undefined || token.type === TOKEN_TYPE.word;

const isAddressCopulaIntroducer = (
  token: Token | undefined,
  local: Token,
): boolean =>
  isEmailIntroducer(token) ||
  (isPlainAddressIntroducer(token) && !isKnownProseLocal(local));

const hasCommandContextBeforePrepositionalIntroducer = (
  previous: Token | undefined,
  previousPrevious: Token | undefined,
): boolean =>
  previous === undefined ||
  isCourtesyCommand(previous) ||
  isPrepositionalEmailIntroducer(previous) ||
  (isDeterminer(previous) && isPrepositionalEmailIntroducer(previousPrevious));

const isPrepositionalResourcePhrase = (
  preposition: Token,
  introducer: Token | undefined,
  previous: Token | undefined,
  previousPrevious: Token | undefined,
  local: Token,
): boolean => {
  if (!isKnownProseLocal(local)) return false;
  if (introducer?.type !== TOKEN_TYPE.word) return false;
  if (preposition.value === "via") return true;
  if (introducer.value === "respond") return true;
  if (introducer.value === "forward") return isForwardProseLocal(local);
  if (
    (introducer.value === "e-mail" ||
      introducer.value === "email" ||
      introducer.value === "mail" ||
      introducer.value === "message" ||
      introducer.value === "contact") &&
    !hasCommandContextBeforePrepositionalIntroducer(previous, previousPrevious)
  ) {
    return true;
  }
  return false;
};

const isAdjectivalEmailIntroducer = (
  token: Token,
  previous: Token | undefined,
  local: Token,
): boolean =>
  ADJECTIVE_INTRODUCER_WORDS.has(token.value) &&
  (isDeterminer(previous) ||
    (previous !== undefined &&
      !isEmailIntroducer(previous) &&
      !isCourtesyCommand(previous) &&
      PROSE_OBJECT_LOCAL_WORDS.has(local.value)));

const isHorizontalWhitespace = (value: string): boolean =>
  value !== "\n" && value !== "\r" && isWhitespace(value);

const isSameProsePhrase = (
  meta: EmailTextMeta,
  previous: Token,
  local: Token,
): boolean => {
  for (let i = previous.end; i < local.start; i++) {
    if (meta.zeroWidth[i]) continue;
    if (!isHorizontalWhitespace(meta.normalized[i])) return false;
  }
  return true;
};

const previousWordInSamePhrase = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
): Token | undefined => {
  const current = tokens[index];
  const previous = tokens[index - 1];
  if (
    current === undefined ||
    previous?.type !== TOKEN_TYPE.word ||
    !isSameProsePhrase(meta, previous, current)
  ) {
    return undefined;
  }
  return previous;
};

const hasLabelSeparator = (
  meta: EmailTextMeta,
  start: number,
  end: number,
): boolean => {
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
  isEmailIntroducer(label) ||
  (isAddressNoun(label) &&
    (beforeLabel === undefined || isEmailIntroducer(beforeLabel))) ||
  (isRecipientObject(label) && isEmailIntroducer(beforeLabel));

const hasEmailLabelContext = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
): boolean => {
  const local = tokens[index];
  let labelIndex = index - 1;
  while (isLabelSeparatorToken(tokens[labelIndex])) labelIndex -= 1;

  const label = tokens[labelIndex];
  if (local === undefined || label?.type !== TOKEN_TYPE.word) return false;

  const beforeLabel = previousWordInSamePhrase(meta, tokens, labelIndex);
  return (
    isEmailLabel(label, beforeLabel) &&
    hasLabelSeparator(meta, label.end, local.start)
  );
};

const isDefaultMultiLabelDomain = (labels: readonly string[]): boolean =>
  labels.length > 1 &&
  labels.every((label) => {
    if (label.length === 0 || label.length > 63) return false;
    if (label.startsWith("-") || label.endsWith("-")) return false;
    return DOMAIN_LABEL_RE.test(label);
  }) &&
  TLD_RE.test(labels[labels.length - 1]);

const previousObfuscatedAddressLocalIndex = (
  tokens: readonly Token[],
  endIndex: number,
): number | undefined => {
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

  if (!isDefaultMultiLabelDomain(labels)) return undefined;
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

const previousAddressListLocalIndex = (
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
    !isSameProsePhrase(meta, priorEnd, conjunction)
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
    SENTENCE_INITIAL_PROSE_LOCAL_WORDS.has(priorLocal.value) &&
    previousWordInSamePhrase(meta, tokens, priorLocalIndex) === undefined &&
    !hasEmailLabelContext(meta, tokens, priorLocalIndex)
  ) {
    return undefined;
  }

  return priorLocalIndex;
};

const hasPrepositionalNounObjectContext = (
  preposition: Token,
  object: Token | undefined,
  beforeObject: Token | undefined,
  beforeBeforeObject: Token | undefined,
  local: Token,
): boolean => {
  if (preposition.value !== "to") return false;
  if (object?.type !== TOKEN_TYPE.word || isKnownProseLocal(local))
    return false;
  return (
    isObjectPrepositionalEmailIntroducer(beforeObject) ||
    (isDeterminer(beforeObject) &&
      isObjectPrepositionalEmailIntroducer(beforeBeforeObject))
  );
};

const hasPrepositionalEmailIntroducerContext = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
): boolean => {
  const preposition = tokens[index];
  if (!isPrepositionalIntroducer(preposition)) return false;

  const beforePreposition = previousWordInSamePhrase(meta, tokens, index);
  const beforeBeforePreposition = previousWordInSamePhrase(
    meta,
    tokens,
    index - 1,
  );
  const beforeBeforeBeforePreposition = previousWordInSamePhrase(
    meta,
    tokens,
    index - 2,
  );
  if (isPrepositionalEmailIntroducer(beforePreposition)) {
    return !isPrepositionalResourcePhrase(
      preposition,
      beforePreposition,
      beforeBeforePreposition,
      beforeBeforeBeforePreposition,
      local,
    );
  }
  if (isSendableObject(beforePreposition)) {
    return isPrepositionalEmailIntroducer(beforeBeforePreposition);
  }
  if (
    hasPrepositionalNounObjectContext(
      preposition,
      beforePreposition,
      beforeBeforePreposition,
      beforeBeforeBeforePreposition,
      local,
    )
  ) {
    return true;
  }
  return (
    isPhrasalParticle(beforePreposition) &&
    isPhrasalEmailIntroducer(beforeBeforePreposition) &&
    !isKnownProseLocal(local)
  );
};

const hasEmailIntroducerContext = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
): boolean => {
  if (hasEmailLabelContext(meta, tokens, index)) return true;

  const priorListLocalIndex = previousAddressListLocalIndex(
    meta,
    tokens,
    index,
    local,
  );
  if (priorListLocalIndex !== undefined) {
    const priorListLocal = tokens[priorListLocalIndex];
    if (
      priorListLocal !== undefined &&
      hasEmailIntroducerContext(
        meta,
        tokens,
        priorListLocalIndex,
        priorListLocal,
      )
    ) {
      return true;
    }
  }

  const previous = previousWordInSamePhrase(meta, tokens, index);
  if (previous === undefined) return true;

  const beforePrevious = previousWordInSamePhrase(meta, tokens, index - 1);
  if (isEmailIntroducer(previous)) {
    return (
      (isDirectEmailIntroducer(previous)
        ? !(
            (previous.value === "forward" || previous.value === "reach") &&
            isForwardProseLocal(local)
          )
        : !isKnownProseLocal(local)) &&
      !isAdjectivalEmailIntroducer(previous, beforePrevious, local)
    );
  }

  const beforeBeforePrevious = previousWordInSamePhrase(
    meta,
    tokens,
    index - 2,
  );
  if (hasPrepositionalEmailIntroducerContext(meta, tokens, index - 1, local)) {
    return true;
  }
  if (
    isRecipientObject(previous) &&
    isEmailIntroducer(beforePrevious) &&
    !isContactResourcePhrase(beforePrevious, previous, local)
  ) {
    return true;
  }
  if (isDeterminerLedEmailObjectPhrase(beforePrevious, previous, local)) {
    return true;
  }

  if (
    isCopulaIntroducer(previous) &&
    isEmailIntroducer(beforePrevious) &&
    !COPULA_PROSE_LOCAL_WORDS.has(local.value)
  ) {
    return true;
  }
  if (
    isCopulaIntroducer(previous) &&
    isAddressNoun(beforePrevious) &&
    isAddressCopulaIntroducer(beforeBeforePrevious, local) &&
    !COPULA_PROSE_LOCAL_WORDS.has(local.value)
  ) {
    return true;
  }

  if (
    isPossessiveIntroducer(previous) &&
    ((beforePrevious === undefined && !isKnownProseLocal(local)) ||
      isEmailIntroducer(beforePrevious) ||
      hasPrepositionalEmailIntroducerContext(meta, tokens, index - 2, local))
  ) {
    return true;
  }

  return false;
};

const isSentenceInitialProseBareAtPhrase = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
): boolean =>
  SENTENCE_INITIAL_PROSE_LOCAL_WORDS.has(local.value) &&
  previousWordInSamePhrase(meta, tokens, index) === undefined &&
  !hasEmailLabelContext(meta, tokens, index);

const isProseBareAtPhrase = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
  at: Token,
): boolean =>
  (at.value === "at" || at.value === "@") &&
  !at.wrapped &&
  (isSentenceInitialProseBareAtPhrase(meta, tokens, index, local) ||
    !hasEmailIntroducerContext(meta, tokens, index, local));

const isValidDomain = (
  labels: readonly string[],
  options: ScannerOptions,
): boolean => {
  if (labels.length === 0) return false;
  if (labels.length === 1) {
    if (labels[0] === "localhost") return options.allowLocalhost;
    return options.allowSingleLabelDomain && DOMAIN_LABEL_RE.test(labels[0]);
  }
  return (
    labels.every((label) => {
      if (label.length === 0 || label.length > 63) return false;
      if (label.startsWith("-") || label.endsWith("-")) return false;
      return DOMAIN_LABEL_RE.test(label);
    }) && TLD_RE.test(labels[labels.length - 1])
  );
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
      meta.normalized[domainEnd] === "-" ||
      meta.normalized[domainEnd] === ".")
  ) {
    domainEnd++;
  }

  const local = meta.normalized.slice(localStart, atIndex).join("");
  const domain = meta.normalized.slice(atIndex + 1, domainEnd).join("");
  const labels = domain.split(".");

  if (!isValidLocal(local) || !isValidDomain(labels, options)) return null;
  if (!hasBoundary(previousContent(meta, localStart - 1))) return null;
  if (!hasBoundary(nextContent(meta, domainEnd))) return null;

  return [localStart, domainEnd];
};

const readWrappedSeparator = (
  meta: EmailTextMeta,
  start: number,
): Token | null => {
  const open = meta.normalized[start];
  const close =
    open === "[" ? "]" : open === "(" ? ")" : open === "{" ? "}" : "";
  if (!close) return null;

  let cursor = start + 1;
  while (
    cursor < meta.normalized.length &&
    isWhitespace(meta.normalized[cursor])
  ) {
    cursor++;
  }

  const tokenStart = cursor;
  while (
    cursor < meta.normalized.length &&
    (isAsciiLetter(meta.normalized[cursor]) ||
      meta.normalized[cursor] === "@" ||
      meta.normalized[cursor] === ".")
  ) {
    cursor++;
  }
  const value = meta.normalized.slice(tokenStart, cursor).join("");

  while (
    cursor < meta.normalized.length &&
    isWhitespace(meta.normalized[cursor])
  ) {
    cursor++;
  }

  if (meta.normalized[cursor] !== close) return null;
  if (value === "at" || value === "@") {
    return {
      type: TOKEN_TYPE.at,
      value,
      start,
      end: cursor + 1,
      wrapped: true,
    };
  }
  if (value === "dot" || value === ".") {
    return {
      type: TOKEN_TYPE.dot,
      value,
      start,
      end: cursor + 1,
      wrapped: true,
    };
  }
  return null;
};

const tokenize = (meta: EmailTextMeta): readonly Token[] => {
  const tokens: Token[] = [];
  let cursor = 0;

  while (cursor < meta.normalized.length) {
    const current = meta.normalized[cursor];
    if (meta.zeroWidth[cursor] || isWhitespace(current)) {
      cursor++;
      continue;
    }

    const wrapped = readWrappedSeparator(meta, cursor);
    if (wrapped) {
      tokens.push(wrapped);
      cursor = wrapped.end;
      continue;
    }

    if (current === "@") {
      tokens.push({
        type: TOKEN_TYPE.at,
        value: current,
        start: cursor,
        end: cursor + 1,
        wrapped: false,
      });
      cursor++;
      continue;
    }
    if (current === ".") {
      tokens.push({
        type: TOKEN_TYPE.dot,
        value: current,
        start: cursor,
        end: cursor + 1,
        wrapped: false,
      });
      cursor++;
      continue;
    }

    if (isWordChar(current)) {
      const start = cursor;
      let value = "";
      while (
        cursor < meta.normalized.length &&
        isWordChar(meta.normalized[cursor])
      ) {
        value += meta.normalized[cursor];
        cursor++;
      }
      const type =
        value === "at"
          ? TOKEN_TYPE.at
          : value === "dot"
            ? TOKEN_TYPE.dot
            : TOKEN_TYPE.word;
      tokens.push({ type, value, start, end: cursor, wrapped: false });
      continue;
    }

    cursor++;
  }

  return tokens;
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
    if (isProseBareAtPhrase(meta, tokens, i, local, at)) {
      continue;
    }
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

  for (let i = 0; i < meta.normalized.length; i++) {
    if (meta.normalized[i] !== "@") continue;
    const range = collectDirectRange(meta, i, scannerOptions);
    if (range) {
      ranges.push(range);
      i = range[1] - 1;
    }
  }

  ranges.push(...collectObfuscatedRanges(meta, scannerOptions));
  return mergeCodePointRanges(ranges);
}
