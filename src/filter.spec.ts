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

  it("masks obfuscated email addresses introduced by prepositional wording", () => {
    expect(filter.censor("contact located at example dot com")).toBe(
      "contact **************************",
    );
    expect(filter.censor("send to user at example dot com")).toBe(
      "send to ***********************",
    );
    expect(filter.censor("send an email to user at example dot com")).toBe(
      "send an email to ***********************",
    );
    expect(filter.censor("contact via user at example dot com")).toBe(
      "contact via ***********************",
    );
    expect(filter.censor("send via admin at example dot com")).toBe(
      "send via ************************",
    );
    expect(filter.censor("message via support at example dot com")).toBe(
      "message via **************************",
    );
    expect(filter.censor("contact via admin at example dot com")).toBe(
      "contact via ************************",
    );
    expect(filter.censor("please contact via support at example dot com")).toBe(
      "please contact via **************************",
    );
    expect(filter.censor("email to admin at example dot com")).toBe(
      "email to ************************",
    );
    expect(filter.censor("cc to user at example dot com")).toBe(
      "cc to ***********************",
    );
    expect(filter.censor("bcc via admin at example dot com")).toBe(
      "bcc via ************************",
    );
    expect(filter.censor("send a message to admin at example dot com")).toBe(
      "send a message to ************************",
    );
    expect(filter.censor("forward to admin at example dot com")).toBe(
      "forward to ************************",
    );
    expect(filter.censor("forward to service at example dot com")).toBe(
      "forward to **************************",
    );
    expect(filter.censor("send it to user at example dot com")).toBe(
      "send it to ***********************",
    );
    expect(filter.censor("send this to admin at example dot com")).toBe(
      "send this to ************************",
    );
    expect(filter.censor("send it to our support at example dot com")).toBe(
      "send it to our **************************",
    );
    expect(filter.censor("send this to your admin at example dot com")).toBe(
      "send this to your ************************",
    );
    expect(filter.censor("email me user at example dot com")).toBe(
      "email me ***********************",
    );
    expect(filter.censor("message us admin at example dot com")).toBe(
      "message us ************************",
    );
    expect(filter.censor("write to admin at example dot com")).toBe(
      "write to ************************",
    );
    expect(filter.censor("please reply to user at example dot com")).toBe(
      "please reply to ***********************",
    );
    expect(filter.censor("please reach out to user at example dot com")).toBe(
      "please reach out to ***********************",
    );
    expect(
      filter.censor("please reach out to our support at example dot com"),
    ).toBe("please reach out to our **************************");
    expect(filter.censor("send to located at example dot com")).toBe(
      "send to **************************",
    );
    expect(filter.censor("send to our support at example dot com")).toBe(
      "send to our **************************",
    );
  });

  it("masks obfuscated email addresses introduced by e-mail wording", () => {
    expect(filter.censor("please e-mail user at example dot com")).toBe(
      "please e-mail ***********************",
    );
    expect(filter.censor("email service at example dot com")).toBe(
      "email **************************",
    );
    expect(filter.censor("email the admin at example dot com")).toBe(
      "email the ************************",
    );
    expect(filter.censor("please cc user at example dot com")).toBe(
      "please cc ***********************",
    );
    expect(filter.censor("bcc admin at example dot com")).toBe(
      "bcc ************************",
    );
    expect(filter.censor("cc the admin at example dot com")).toBe(
      "cc the ************************",
    );
    expect(filter.censor("cc me user at example dot com")).toBe(
      "cc me ***********************",
    );
    expect(filter.censor("message the user at example dot com")).toBe(
      "message the ***********************",
    );
    expect(filter.censor("please email service at example dot com")).toBe(
      "please email **************************",
    );
    expect(filter.censor("send email service at example dot com")).toBe(
      "send email **************************",
    );
    expect(filter.censor("forward user at example dot com")).toBe(
      "forward ***********************",
    );
    expect(filter.censor("please forward admin at example dot com")).toBe(
      "please forward ************************",
    );
    expect(filter.censor("forward service at example dot com")).toBe(
      "forward **************************",
    );
    expect(filter.censor("please reach user at example dot com")).toBe(
      "please reach ***********************",
    );
    expect(filter.censor("reach service at example dot com")).toBe(
      "reach **************************",
    );
    expect(filter.censor("try user at example dot com")).toBe(
      "try ***********************",
    );
    expect(filter.censor("write admin at example dot com")).toBe(
      "write ************************",
    );
  });

  it("masks obfuscated email addresses introduced through copula wording", () => {
    expect(filter.censor("my email is user at example dot com")).toBe(
      "my email is ***********************",
    );
    expect(filter.censor("my email address is user at example dot com")).toBe(
      "my email address is ***********************",
    );
    expect(filter.censor("my address is user at example dot com")).toBe(
      "my address is ***********************",
    );
    expect(filter.censor("address is admin at example dot com")).toBe(
      "address is ************************",
    );
    expect(filter.censor("work address is user at example dot com")).toBe(
      "work address is ***********************",
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
    expect(filter.censor("we work @ example dot com")).toBe(
      "we work @ example dot com",
    );
    expect(filter.censor("employees work at example dot com")).toBe(
      "employees work at example dot com",
    );
    expect(filter.censor("children study at example dot com")).toBe(
      "children study at example dot com",
    );
    expect(filter.censor("Work at example dot com")).toBe(
      "Work at example dot com",
    );
    expect(filter.censor("Study at example dot com")).toBe(
      "Study at example dot com",
    );
    expect(filter.censor("Shop at example dot com")).toBe(
      "Shop at example dot com",
    );
    expect(filter.censor("Apply at example dot com")).toBe(
      "Apply at example dot com",
    );
    expect(filter.censor("the email service at example dot com is down")).toBe(
      "the email service at example dot com is down",
    );
    expect(filter.censor("the e-mail service at example dot com")).toBe(
      "the e-mail service at example dot com",
    );
    expect(filter.censor("the contact form at example dot com")).toBe(
      "the contact form at example dot com",
    );
    expect(filter.censor("the contact us page at example dot com")).toBe(
      "the contact us page at example dot com",
    );
    expect(filter.censor("contact us page at example dot com")).toBe(
      "contact us page at example dot com",
    );
    expect(filter.censor("the contact me form at example dot com")).toBe(
      "the contact me form at example dot com",
    );
    expect(filter.censor("contact the page at example dot com")).toBe(
      "contact the page at example dot com",
    );
    expect(filter.censor("contact the form at example dot com")).toBe(
      "contact the form at example dot com",
    );
    expect(filter.censor("the contact via page at example dot com")).toBe(
      "the contact via page at example dot com",
    );
    expect(filter.censor("corporate contact via form at example dot com")).toBe(
      "corporate contact via form at example dot com",
    );
    expect(filter.censor("please contact via form at example dot com")).toBe(
      "please contact via form at example dot com",
    );
    expect(filter.censor("contact via page at example dot com")).toBe(
      "contact via page at example dot com",
    );
    expect(filter.censor("send via service at example dot com")).toBe(
      "send via service at example dot com",
    );
    expect(filter.censor("message via code at example dot com")).toBe(
      "message via code at example dot com",
    );
    expect(filter.censor("contact via work at example dot com")).toBe(
      "contact via work at example dot com",
    );
    expect(filter.censor("email the service at example dot com")).toBe(
      "email the service at example dot com",
    );
    expect(filter.censor("email this form at example dot com")).toBe(
      "email this form at example dot com",
    );
    expect(filter.censor("message this page at example dot com")).toBe(
      "message this page at example dot com",
    );
    expect(filter.censor("forward shopping at example dot com")).toBe(
      "forward shopping at example dot com",
    );
    expect(filter.censor("forward to shop at example dot com")).toBe(
      "forward to shop at example dot com",
    );
    expect(filter.censor("reach shopping at example dot com")).toBe(
      "reach shopping at example dot com",
    );
    expect(filter.censor("reach work at example dot com")).toBe(
      "reach work at example dot com",
    );
    expect(filter.censor("the email to page at example dot com")).toBe(
      "the email to page at example dot com",
    );
    expect(filter.censor("the message to page at example dot com")).toBe(
      "the message to page at example dot com",
    );
    expect(filter.censor("corporate email to page at example dot com")).toBe(
      "corporate email to page at example dot com",
    );
    expect(filter.censor("website message to page at example dot com")).toBe(
      "website message to page at example dot com",
    );
    expect(filter.censor("I like my job at example dot com")).toBe(
      "I like my job at example dot com",
    );
    expect(filter.censor("we saw her work at example dot com")).toBe(
      "we saw her work at example dot com",
    );
    expect(filter.censor("Located at example dot com")).toBe(
      "Located at example dot com",
    );
    expect(filter.censor("See our site. Located at example dot com")).toBe(
      "See our site. Located at example dot com",
    );
    expect(filter.censor("we work at example [dot] com")).toBe(
      "we work at example [dot] com",
    );
    expect(filter.censor("try shopping at example dot com")).toBe(
      "try shopping at example dot com",
    );
    expect(filter.censor("try shopping at example [dot] com")).toBe(
      "try shopping at example [dot] com",
    );
    expect(filter.censor("try work at example dot com")).toBe(
      "try work at example dot com",
    );
    expect(filter.censor("try work at example [dot] com")).toBe(
      "try work at example [dot] com",
    );
    expect(filter.censor("try to shop at example dot com")).toBe(
      "try to shop at example dot com",
    );
    expect(filter.censor("try to apply at example dot com")).toBe(
      "try to apply at example dot com",
    );
    expect(filter.censor("send me to shop at example dot com")).toBe(
      "send me to shop at example dot com",
    );
    expect(filter.censor("send us to apply at example dot com")).toBe(
      "send us to apply at example dot com",
    );
    expect(filter.censor("write code at example dot com")).toBe(
      "write code at example dot com",
    );
    expect(filter.censor("write code at example [dot] com")).toBe(
      "write code at example [dot] com",
    );
    expect(filter.censor("write work at example dot com")).toBe(
      "write work at example dot com",
    );
    expect(filter.censor("write work at example [dot] com")).toBe(
      "write work at example [dot] com",
    );
    expect(filter.censor("send this form at example dot com")).toBe(
      "send this form at example dot com",
    );
    expect(filter.censor("send that page at example dot com")).toBe(
      "send that page at example dot com",
    );
    expect(filter.censor("Our service at example dot com is down")).toBe(
      "Our service at example dot com is down",
    );
    expect(filter.censor("Their page at example dot com moved")).toBe(
      "Their page at example dot com moved",
    );
    expect(filter.censor("Our work at example dot com is showcased")).toBe(
      "Our work at example dot com is showcased",
    );
    expect(filter.censor("Their study at example dot com was cited")).toBe(
      "Their study at example dot com was cited",
    );
    expect(
      filter.censor("corporate email service at example dot com is down"),
    ).toBe("corporate email service at example dot com is down");
    expect(filter.censor("website contact form at example dot com")).toBe(
      "website contact form at example dot com",
    );
    expect(filter.censor("my email is hosted at example dot com")).toBe(
      "my email is hosted at example dot com",
    );
    expect(filter.censor("my address is hosted at example dot com")).toBe(
      "my address is hosted at example dot com",
    );
    expect(filter.censor("address is located at example dot com")).toBe(
      "address is located at example dot com",
    );
    expect(filter.censor("address is work at example dot com")).toBe(
      "address is work at example dot com",
    );
    expect(filter.censor("work address is located at example dot com")).toBe(
      "work address is located at example dot com",
    );
    expect(filter.censor("the email is down at example dot com")).toBe(
      "the email is down at example dot com",
    );
    expect(filter.censor("the address is down at example dot com")).toBe(
      "the address is down at example dot com",
    );
    expect(filter.censor("my email address is hosted at example dot com")).toBe(
      "my email address is hosted at example dot com",
    );
    expect(filter.censor("the email address is down at example dot com")).toBe(
      "the email address is down at example dot com",
    );
  });

  it("masks mixed explicit dot obfuscated email addresses", () => {
    const email = "user at example [dot] com";
    expect(filter.censor(`try ${email}`)).toBe(
      `try ${"*".repeat(email.length)}`,
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
