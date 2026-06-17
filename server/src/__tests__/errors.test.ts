import { describe, expect, it } from "vitest";
import { isTransientDbError } from "../errors.ts";

describe("isTransientDbError (transient DB-bounce → 503, not 500)", () => {
  it("matches a DrizzleQueryError whose own message carries CONNECTION_CLOSED", () => {
    expect(
      isTransientDbError({
        message: "Failed query: select ... : write CONNECTION_CLOSED 127.0.0.1:54329",
      }),
    ).toBe(true);
  });

  it("matches 'the database system is shutting down' through the cause chain", () => {
    expect(
      isTransientDbError({
        message: "Failed query: select ...",
        cause: { code: "57P03", message: "the database system is shutting down" },
      }),
    ).toBe(true);
  });

  it("matches transient client/PG shutdown codes", () => {
    expect(isTransientDbError({ code: "ECONNREFUSED" })).toBe(true);
    expect(isTransientDbError({ code: "CONNECTION_CLOSED" })).toBe(true);
    expect(isTransientDbError({ code: "57P01" })).toBe(true); // admin_shutdown
  });

  it("does NOT match a genuine query bug (missing column) or unrelated errors", () => {
    // 42703 = undefined_column — a real schema/code bug that SHOULD surface as 500.
    expect(isTransientDbError({ code: "42703", message: 'column "foo" does not exist' })).toBe(false);
    expect(isTransientDbError(new Error("Assignee must belong to same company"))).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError(undefined)).toBe(false);
  });

  it("does not infinite-loop on a circular cause chain", () => {
    const circular: { message: string; cause?: unknown } = { message: "x" };
    circular.cause = circular;
    expect(isTransientDbError(circular)).toBe(false);
  });
});
