import type { TextCodePointRange } from "@textfilters/core";

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

export interface EmailFilter {
  readonly name: typeof EMAIL_FILTER_NAME;
  censor(text: unknown): string;
}

export interface EmailScanInput {
  readonly text: string;
  readonly codePoints: readonly string[];
}

export interface EmailRangeScanResult {
  readonly ranges: readonly TextCodePointRange[];
}

export interface EmailRangeScanner {
  readonly name: typeof EMAIL_FILTER_NAME;
  scan(input: EmailScanInput): EmailRangeScanResult;
}
