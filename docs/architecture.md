# Email Filter Architecture

## Goals

The package provides composable email censoring for direct addresses and common obfuscated address forms. It favors small deterministic scanner steps over broad regular expressions so matching stays predictable and false positives remain bounded.

## Public API

`createEmailFilter(options?)` creates an email censor with optional `maskChar`, `allowLocalhost`, and `allowSingleLabelDomain` settings.

The default `filter` export is a shared instance with default domain rules. `emailFilter(options?)` is an alias for `createEmailFilter(options?)`.

`EmailFilterOptions` supports:

- `maskChar`: the replacement character passed through core mask normalization;
- `allowLocalhost`: allows `user@localhost`;
- `allowSingleLabelDomain`: allows other single-label domains such as `user@example`.

## High-Level Flow

```mermaid
flowchart TD
  input["Input text"] --> config["Normalize mask character and options"]
  config --> meta["Create metadata"]
  meta --> direct["Collect direct email ranges"]
  meta --> obfuscated["Collect obfuscated email ranges"]
  direct --> merge["Merge code point ranges"]
  obfuscated --> merge
  merge --> mask["Mask original code point ranges"]
  mask --> output["Output censored text"]
```

## Module Map

```mermaid
graph TD
  index["index.ts"] --> filter["filter.ts"]
  index --> types["types.ts"]
  filter --> scanner["scanner.ts"]
  filter --> types
  scanner --> normalization["normalization.ts"]
  scanner --> types
```

## File Responsibilities

| File                   | Responsibility                                                           | Out of scope                        |
| ---------------------- | ------------------------------------------------------------------------ | ----------------------------------- |
| `src/index.ts`         | Public entrypoint exports.                                               | Scanner details.                    |
| `src/types.ts`         | Public constants, options, and filter types.                             | Internal token and metadata shapes. |
| `src/normalization.ts` | Code point metadata, NFKC lowercase folding, and character predicates.   | Email matching policy.              |
| `src/scanner.ts`       | Direct and obfuscated email range collection with false-positive guards. | Public API construction or masking. |
| `src/filter.ts`        | Factory, shared instance, alias, and code point masking orchestration.   | Tokenization and domain validation. |
| `src/filter.spec.ts`   | Public behavior and integration tests.                                   | Exhaustive RFC email validation.    |

## Scanner Flow

Direct email scanning searches for normalized `@` characters, expands a valid local part to the left, expands a domain to the right, and validates label boundaries before emitting a range.

Obfuscated scanning tokenizes words and separator tokens while ignoring whitespace around bracketed separators. It accepts `at`, `dot`, `@`, and `.` separator forms when they appear between a plausible local part and a valid dotted domain.

Both paths validate local part shape, domain labels, a dotted TLD by default, and surrounding boundaries. `localhost` and other single-label domains are opt-in.

## Masking Behavior

Ranges are collected as code point indexes against the original source. Masking uses `@textfilters/core` code point helpers so astral characters are not split.

The default mask character is `*`. Custom mask characters are normalized to one JavaScript code unit where possible to keep direct replacements length-preserving.

## False-Positive Policy

The scanner intentionally avoids:

- package scopes such as `@textfilters/core`;
- social handles such as `@username`;
- prose-only `at` and `dot` words without a plausible local part;
- version-like text, decimals, and IP addresses;
- incomplete domains such as `user@example`;
- `user@localhost` unless configured.

## Change Guide

| Change                               | Primary files                          |
| ------------------------------------ | -------------------------------------- |
| Change public options                | `src/types.ts` + public API tests      |
| Change direct email matching         | `src/scanner.ts` + public API tests    |
| Change obfuscated separator handling | `src/scanner.ts` + public API tests    |
| Change normalization behavior        | `src/normalization.ts` + scanner tests |
| Change masking behavior              | `src/filter.ts` + invariant tests      |

## Release Flow

Release tags use the `v*` pattern. A tag push runs checks, publishes to GitHub Packages, and creates the GitHub Release for the same tag.

## Safety Rules

- Do not expose scanner internals as public API.
- Do not accept user-provided regular expressions.
- Do not match single-label domains by default.
- Do not update ranges after masking.
- Keep tests public-API oriented.
