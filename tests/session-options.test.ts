import { describe, expect, it } from "vitest";
import { validateStartSessionOptions } from "../src/shared/types.js";

  sessionEndpoint: "/api/seha-care/session",
  language: "en",
  sessionHeaders: { "x-organization-context": "clinic-12" },
  sessionBody: { organizationContext: { bookingId: "booking-4821" } },
};
  language: "ar",
  beforeStartAction: async () => {},
};
  sessionHeaders: { "x-organization-context": "clinic-12" },
};
  sessionEndpoint: "/api/seha-care/session",
  beforeStartAction: async () => {},
};

describe("validateStartSessionOptions", () => {
  it("accepts known agents and dialects while dropping unset fields", () => {
    expect(
      validateStartSessionOptions({
        userIdentity: "visitor-12",
        initAgent: "knowledge",
        initDialect: "EGY",
        language: "ar",
      }),
    ).toEqual({
      userIdentity: "visitor-12",
      initAgent: "knowledge",
      initDialect: "EGY",
      language: "ar",
    });
    expect(validateStartSessionOptions(undefined)).toEqual({});
  });

  it.each([
    [null, "Session options must be an object"],
    [[], "Session options must be an object"],
    [{ initAgent: "unknown" }, "initAgent is not supported"],
    [{ initDialect: "unknown" }, "initDialect is not supported"],
    [{ language: "EN" }, "language must be en or ar"],
    [{ language: "en-US" }, "language must be en or ar"],
    [{ language: "" }, "language must be en or ar"],
    [{ language: null }, "language must be en or ar"],
    [{ userIdentity: 42 }, "userIdentity must be a string"],
    [{ tenantApiKey: "not-a-request-option" }, "Unknown session option: tenantApiKey"],
  ])("rejects invalid options %#", (value, message) => {
    expect(() => validateStartSessionOptions(value)).toThrow(message);
  });
});
