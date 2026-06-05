import { createTextPipeline } from "@textfilters/core";
import { describe, expect, it } from "vitest";

import {
  EMAIL_FILTER_NAME,
  createEmailFilter,
  emailFilter,
  filter,
} from "../src/index.js";

describe("@textfilters/email options and integration", () => {
  it("supports custom mask characters", () => {
    expect(
      createEmailFilter({ maskChar: "#" }).censor("user@example.com"),
    ).toBe("################");
  });

  it("supports localhost when configured", () => {
    expect(
      createEmailFilter({ allowLocalhost: true }).censor("mail user@localhost"),
    ).toBe("mail **************");
    expect(
      createEmailFilter({ allowLocalhost: true }).censor(
        "email admin at localhost",
      ),
    ).toBe("email ******************");

    const user = "user at localhost";
    const admin = "admin at localhost";
    expect(
      createEmailFilter({ allowLocalhost: true }).censor(
        `email ${user} and ${admin}`,
      ),
    ).toBe(`email ${"*".repeat(user.length)} and ${"*".repeat(admin.length)}`);
  });

  it("supports single-label domains when configured", () => {
    expect(
      createEmailFilter({ allowSingleLabelDomain: true }).censor(
        "mail user@example",
      ),
    ).toBe("mail ************");
    expect(
      createEmailFilter({ allowSingleLabelDomain: true }).censor(
        "email admin at example",
      ),
    ).toBe("email ****************");

    const user = "user at example";
    const admin = "admin at example";
    expect(
      createEmailFilter({ allowSingleLabelDomain: true }).censor(
        `email ${user} and ${admin}`,
      ),
    ).toBe(`email ${"*".repeat(user.length)} and ${"*".repeat(admin.length)}`);
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
