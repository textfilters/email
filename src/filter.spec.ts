import { createTextPipeline } from "@textfilters/core";
import { describe, expect, it } from "vitest";

import {
  EMAIL_FILTER_NAME,
  createEmailFilter,
  emailFilter,
  filter,
} from "./index.js";

describe("@textfilters/email", () => {
  it("masks direct email addresses", () => {
    expect(filter.censor("contact user@example.com")).toBe(
      "contact ****************",
    );
  });

  it("masks complex direct email addresses", () => {
    expect(filter.censor("send first.last+tag@sub.example.co.uk now")).toBe(
      "send ******************************** now",
    );
  });

  it("masks mixed-case email addresses", () => {
    expect(filter.censor("Mail User@Example.COM")).toBe(
      "Mail ****************",
    );
  });

  it("masks fullwidth separators after normalization", () => {
    expect(filter.censor("contact user＠example．com")).toBe(
      "contact ****************",
    );
  });

  it("masks bracketed obfuscated email addresses", () => {
    expect(filter.censor("contact user [at] example [dot] com")).toBe(
      "contact ***************************",
    );
  });

  it("masks compact parenthesized obfuscated email addresses", () => {
    expect(filter.censor("contact user(at)example(dot)com")).toBe(
      "contact ***********************",
    );
  });

  it("masks word obfuscated email addresses", () => {
    expect(filter.censor("contact user at example dot com")).toBe(
      "contact ***********************",
    );
  });

  it("masks symbolic obfuscated email addresses", () => {
    expect(filter.censor("contact user [@] example [.] com")).toBe(
      "contact ************************",
    );
  });

  it("masks obfuscated variants with extra spaces", () => {
    expect(
      filter.censor("contact user   [ at ]   example   [ dot ]   com"),
    ).toBe("contact ***************************************");
  });

  it("masks explicit obfuscated email addresses with www subdomains", () => {
    const email = "user [at] www [dot] example [dot] com";
    expect(filter.censor(`contact ${email}`)).toBe(
      `contact ${"*".repeat(email.length)}`,
    );
  });

  it("masks bare-word obfuscated email addresses with www subdomains", () => {
    const email = "user at www dot example dot com";
    expect(filter.censor(`contact ${email}`)).toBe(
      `contact ${"*".repeat(email.length)}`,
    );
  });

  it("masks common-word local parts in obfuscated email addresses", () => {
    expect(filter.censor("contact the at example dot com")).toBe(
      "contact **********************",
    );
    expect(filter.censor("email you at example dot com")).toBe(
      "email **********************",
    );
  });

  it("masks obfuscated email addresses introduced by possessive pronouns", () => {
    expect(filter.censor("email our support at example dot com")).toBe(
      "email our **************************",
    );
    expect(filter.censor("my admin at example dot com")).toBe(
      "my ************************",
    );
    expect(filter.censor("their sales at example dot com")).toBe(
      "their ************************",
    );
    expect(filter.censor("your admin at example dot com")).toBe(
      "your ************************",
    );
  });

  it("masks bare-word obfuscated email addresses after punctuation or newlines", () => {
    const email = "user at example dot com";
    expect(filter.censor(`hello. ${email}`)).toBe(
      `hello. ${"*".repeat(email.length)}`,
    );
    expect(filter.censor(`hello\n${email}`)).toBe(
      `hello\n${"*".repeat(email.length)}`,
    );
  });

  it("does not mask package scopes", () => {
    expect(filter.censor("install @textfilters/core")).toBe(
      "install @textfilters/core",
    );
  });

  it("does not mask social handles", () => {
    expect(filter.censor("message @username")).toBe("message @username");
  });

  it("does not mask prose without a plausible local part", () => {
    expect(filter.censor("meet me at example dot com")).toBe(
      "meet me at example dot com",
    );
  });

  it("does not mask URL-like text after a normal word", () => {
    expect(filter.censor("и ещё www (.) example dot com")).toBe(
      "и ещё www (.) example dot com",
    );
    expect(filter.censor("go www dot example dot com")).toBe(
      "go www dot example dot com",
    );
    expect(filter.censor("we are at www dot example dot com")).toBe(
      "we are at www dot example dot com",
    );
    expect(filter.censor("we are at example dot com")).toBe(
      "we are at example dot com",
    );
    expect(filter.censor("we live at example dot com")).toBe(
      "we live at example dot com",
    );
    expect(filter.censor("we work at www dot example dot com")).toBe(
      "we work at www dot example dot com",
    );
    expect(filter.censor("employees work at example dot com")).toBe(
      "employees work at example dot com",
    );
    expect(filter.censor("children study at example dot com")).toBe(
      "children study at example dot com",
    );
  });

  it("does not mask versions, coordinates, or normal text", () => {
    expect(filter.censor("version 1.2.3 near 127.0.0.1 is normal")).toBe(
      "version 1.2.3 near 127.0.0.1 is normal",
    );
  });

  it("does not mask localhost or incomplete domains by default", () => {
    expect(filter.censor("mail user@localhost or user@example")).toBe(
      "mail user@localhost or user@example",
    );
  });

  it("supports custom mask characters", () => {
    expect(
      createEmailFilter({ maskChar: "#" }).censor("user@example.com"),
    ).toBe("################");
  });

  it("supports localhost when configured", () => {
    expect(
      createEmailFilter({ allowLocalhost: true }).censor("mail user@localhost"),
    ).toBe("mail **************");
  });

  it("supports single-label domains when configured", () => {
    expect(
      createEmailFilter({ allowSingleLabelDomain: true }).censor(
        "mail user@example",
      ),
    ).toBe("mail ************");
  });

  it("is idempotent", () => {
    const once = filter.censor("contact user@example.com");
    expect(filter.censor(once)).toBe(once);
  });

  it("has a stable name and factory alias", () => {
    expect(filter.name).toBe("email");
    expect(EMAIL_FILTER_NAME).toBe("email");
    expect(emailFilter().name).toBe("email");
  });

  it("works inside the core text pipeline", () => {
    const pipeline = createTextPipeline().use(filter);
    expect(pipeline.censor("contact user@example.com")).toBe(
      "contact ****************",
    );
  });
});
