import { type TextCensor } from "@textfilters/core";

export const EMAIL_FILTER_NAME = "email";

export interface EmailFilterOptions {
  readonly maskChar?: string;
  readonly allowLocalhost?: boolean;
  readonly allowSingleLabelDomain?: boolean;
}

export type EmailFilter = TextCensor & {
  readonly name: typeof EMAIL_FILTER_NAME;
};
