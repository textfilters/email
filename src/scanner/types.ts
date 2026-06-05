export interface ScannerOptions {
  readonly allowLocalhost: boolean;
  readonly allowSingleLabelDomain: boolean;
}

export const TOKEN_TYPE = {
  word: "word",
  at: "at",
  dot: "dot",
} as const;

export const TOKEN_VALUE = {
  atWord: "at",
  atSymbol: "@",
  dotWord: "dot",
  dotSymbol: ".",
} as const;

export const SCANNER_PUNCTUATION = {
  colon: ":",
  comma: ",",
  hyphen: "-",
} as const;

type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];

export interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly start: number;
  readonly end: number;
  readonly wrapped: boolean;
}
