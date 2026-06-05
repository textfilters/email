import { type TextCensor } from "@textfilters/core";

export const EMAIL_FILTER_NAME = "email";

export interface EmailFilterOptions {
  readonly maskChar?: string;
  readonly matchObfuscated?: boolean;
  readonly allowLocalhost?: boolean;
  readonly allowSingleLabelDomain?: boolean;
  readonly excludeEmails?: readonly string[];
  readonly excludeUsernames?: readonly string[];
  readonly excludeDomains?: readonly string[];
}

export type EmailFilter = TextCensor & {
  readonly name: typeof EMAIL_FILTER_NAME;
};
