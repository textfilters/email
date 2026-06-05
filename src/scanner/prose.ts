import { type EmailTextMeta } from "../normalization.js";
import {
  hasEmailLabelContext,
  hasNonEmailProseLabelContext,
} from "./labels.js";
import { previousWordInSamePhrase } from "./phrase.js";
import { isKnownProseLocal } from "./rules.js";
import { type Token } from "./types.js";

export const hasProseLocalContext = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
): boolean =>
  // Known prose local parts are only rejected at phrase start when there is no
  // explicit email label. This keeps "From: work at ..." masked while leaving
  // "Work at example dot com" and "Service at ..." alone.
  (isKnownProseLocal(local) &&
    previousWordInSamePhrase(meta, tokens, index) === undefined &&
    !hasEmailLabelContext(meta, tokens, index)) ||
  hasNonEmailProseLabelContext(meta, tokens, index, local);
