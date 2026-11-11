import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSessionToken, secretsMatch, verifySessionToken } from "./auth";
import { hasRole } from "./constants";
import { hashPassword, verifyPassword } from "./password";

const USER_ID = "64b7f0c2a1b2c3d4e5f60718";
let previous: string | undefined;

beforeAll(() => {
  previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";
});
afterAll(() => {
  process.env.SESSION_SECRET = previous;
});

describe("session tokens", () => {
  it("round-trips the user id and session version", async () => {
    const token = await createSessionToken(USER_ID, 3);
    expect(await verifySessionToken(token)).toMatchObject({ userId: USER_ID, sessionVersion: 3 });
  });

  it("rejects expired tokens", async () => {
    const token = await createSessionToken(USER_ID, 0, Date.now() - 31 * 86400_000);
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects tampered tokens", async () => {
    const token = await createSessionToken(USER_ID, 0);
    const [id, , exp, sig] = token.split(".");
    expect(await verifySessionToken(`${id}.1.${exp}.${sig}`)).toBeNull(); // changed session version
    expect(await verifySessionToken(`64b7f0c2a1b2c3d4e5f60719.0.${exp}.${sig}`)).toBeNull(); // another user
    expect(await verifySessionToken(`${id}.0.${Number(exp) + 1}.${sig}`)).toBeNull(); // longer expiry
    expect(await verifySessionToken(`${token}x`)).toBeNull();
  });

  it("rejects malformed and missing tokens", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
    expect(await verifySessionToken("a.b.c.d")).toBeNull();
    expect(await verifySessionToken("123.abc")).toBeNull();
  });

  it("rejects tokens signed with another secret", async () => {
    const token = await createSessionToken(USER_ID, 0);
    process.env.SESSION_SECRET = "a-completely-different-secret-of-32-plus-chars";
    expect(await verifySessionToken(token)).toBeNull();
    process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";
  });

  it("treats a short or missing secret as signed out", async () => {
    const token = await createSessionToken(USER_ID, 0);
    process.env.SESSION_SECRET = "short";
    expect(await verifySessionToken(token)).toBeNull();
    process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";
  });

  it("compares secrets", async () => {
    expect(await secretsMatch("hunter22", "hunter22")).toBe(true);
    expect(await secretsMatch("hunter22", "hunter23")).toBe(false);
  });
});

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same-password")).not.toBe(await hashPassword("same-password"));
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc")).toBe(false);
  });
});

describe("roles", () => {
  it("ranks admin above editor above viewer", () => {
    expect(hasRole("admin", "admin")).toBe(true);
    expect(hasRole("admin", "viewer")).toBe(true);
    expect(hasRole("editor", "editor")).toBe(true);
    expect(hasRole("editor", "admin")).toBe(false);
    expect(hasRole("viewer", "editor")).toBe(false);
    expect(hasRole("viewer", "viewer")).toBe(true);
  });
});
