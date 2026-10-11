import { describe, expect, it } from "vitest";
import { validateStartSessionOptions } from "../src/shared/types.js";

describe("validateStartSessionOptions", () => {
  it("accepts known agents and dialects while dropping unset fields", () => {
    expect(
      validateStartSessionOptions({
        userIdentity: "visitor-12",
        initAgent: "knowledge",
        initDialect: "EGY",
      }),
    ).toEqual({
      userIdentity: "visitor-12",
      initAgent: "knowledge",
      initDialect: "EGY",
    });
    expect(validateStartSessionOptions(undefined)).toEqual({});
  });

  it.each([
    [null, "Session options must be an object"],
    [[], "Session options must be an object"],
    [{ initAgent: "unknown" }, "initAgent is not supported"],
    [{ initDialect: "unknown" }, "initDialect is not supported"],
    [{ userIdentity: 42 }, "userIdentity must be a string"],
    [{ tenantApiKey: "not-a-request-option" }, "Unknown session option: tenantApiKey"],
  ])("rejects invalid options %#", (value, message) => {
    expect(() => validateStartSessionOptions(value)).toThrow(message);
  });
});
