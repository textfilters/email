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
  "contact",
  "e-mail",
  "email",
  "mail",
  "message",
  "reach",
  "reply",
  "send",
  "try",
  "write",
]);
const DIRECT_EMAIL_INTRODUCER_WORDS = new Set([
  "contact",
  "e-mail",
  "email",
  "mail",
  "message",
]);
const POSSESSIVE_INTRODUCER_WORDS = new Set([
  "her",
  "his",
  "my",
  "our",
  "their",
  "your",
]);
const PREPOSITIONAL_INTRODUCER_WORDS = new Set(["to"]);
const PHRASAL_PARTICLE_WORDS = new Set(["out"]);
const COPULA_INTRODUCER_WORDS = new Set(["is"]);
const ADDRESS_NOUN_WORDS = new Set(["address"]);
const DIRECT_OBJECT_WORDS = new Set(["it", "me", "that", "this", "us"]);
const COPULA_PROSE_LOCAL_WORDS = new Set(["down", "hosted"]);
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
const ADJECTIVE_INTRODUCER_WORDS = new Set(["email", "mail", "message"]);
const SENTENCE_INITIAL_PROSE_LOCAL_WORDS = new Set([
  "apply",
  "located",
  "shop",
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

const isEmailIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && EMAIL_INTRODUCER_WORDS.has(token.value);

const isDirectEmailIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word &&
  DIRECT_EMAIL_INTRODUCER_WORDS.has(token.value);

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

const isDirectObject = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && DIRECT_OBJECT_WORDS.has(token.value);

const isDeterminer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && DETERMINER_WORDS.has(token.value);

const isAdjectivalEmailIntroducer = (
  token: Token,
  previous: Token | undefined,
): boolean =>
  ADJECTIVE_INTRODUCER_WORDS.has(token.value) && isDeterminer(previous);

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

const hasEmailIntroducerContext = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
  hasWrappedDomainSeparator: boolean,
): boolean => {
  const previous = previousWordInSamePhrase(meta, tokens, index);
  if (previous === undefined) return true;

  const beforePrevious = previousWordInSamePhrase(meta, tokens, index - 1);
  if (isEmailIntroducer(previous)) {
    return (
      (isDirectEmailIntroducer(previous) || hasWrappedDomainSeparator) &&
      !isAdjectivalEmailIntroducer(previous, beforePrevious)
    );
  }

  if (
    isPrepositionalIntroducer(previous) &&
    isEmailIntroducer(beforePrevious)
  ) {
    return true;
  }

  const beforeBeforePrevious = previousWordInSamePhrase(
    meta,
    tokens,
    index - 2,
  );
  if (
    isPrepositionalIntroducer(previous) &&
    isDirectObject(beforePrevious) &&
    isEmailIntroducer(beforeBeforePrevious)
  ) {
    return true;
  }
  if (
    isPrepositionalIntroducer(previous) &&
    isPhrasalParticle(beforePrevious) &&
    isEmailIntroducer(beforeBeforePrevious)
  ) {
    return true;
  }
  if (isDirectObject(previous) && isEmailIntroducer(beforePrevious)) {
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
    isEmailIntroducer(beforeBeforePrevious)
  ) {
    return true;
  }

  if (
    isPossessiveIntroducer(previous) &&
    (beforePrevious === undefined ||
      isEmailIntroducer(beforePrevious) ||
      (isPrepositionalIntroducer(beforePrevious) &&
        isEmailIntroducer(beforeBeforePrevious)))
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
  previousWordInSamePhrase(meta, tokens, index) === undefined;

const isProseBareAtPhrase = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
  at: Token,
  hasWrappedDomainSeparator: boolean,
): boolean =>
  (at.value === "at" || at.value === "@") &&
  !at.wrapped &&
  (isSentenceInitialProseBareAtPhrase(meta, tokens, index, local) ||
    !hasEmailIntroducerContext(
      meta,
      tokens,
      index,
      local,
      hasWrappedDomainSeparator,
    ));

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
    let hasWrappedDomainSeparator = false;
    let cursor = i + 2;
    if (tokens[cursor]?.type !== TOKEN_TYPE.word) continue;
    labels.push(tokens[cursor].value);
    cursor++;

    while (
      tokens[cursor]?.type === TOKEN_TYPE.dot &&
      tokens[cursor + 1]?.type === TOKEN_TYPE.word
    ) {
      hasWrappedDomainSeparator ||= tokens[cursor].wrapped;
      labels.push(tokens[cursor + 1].value);
      cursor += 2;
    }

    if (!isValidDomain(labels, options)) continue;
    if (
      isProseBareAtPhrase(meta, tokens, i, local, at, hasWrappedDomainSeparator)
    ) {
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
