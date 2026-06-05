import { type EmailTextMeta } from "../normalization.js";
import { hasEmailIntroducerContext } from "./introducers.js";
import { hasProseLocalContext } from "./prose.js";
import { TOKEN_VALUE, type Token } from "./types.js";

export const isProseBareAtPhrase = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
  at: Token,
): boolean =>
  (at.value === TOKEN_VALUE.atWord || at.value === TOKEN_VALUE.atSymbol) &&
  !at.wrapped &&
  (hasProseLocalContext(meta, tokens, index, local) ||
    !hasEmailIntroducerContext(meta, tokens, index, local));
