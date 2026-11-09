import { describe, it, expect } from "vitest";
import { makeSession, readSession } from "@/lib/auth";

describe("owner session cookie", () => {
  it("accepts a freshly signed session", () => expect(readSession(makeSession("tenant-1"))).toEqual({ tenantId: "tenant-1" }));
  it("rejects a tampered tenant id (cannot switch to another salon)", () => {
    const [body, sig] = makeSession("tenant-1").split(".");
    const forged = Buffer.from(JSON.stringify({ t: "tenant-2", exp: Date.now() + 1e6 })).toString("base64url");
    expect(readSession(`${forged}.${sig}`)).toBeNull();
    expect(readSession(`${body}.AAAA`)).toBeNull();
  });
  it("rejects empty, garbage and expired sessions", () => {
    expect(readSession(undefined)).toBeNull();
    expect(readSession("garbage")).toBeNull();
    const realNow = Date.now; Date.now = () => realNow() + 13 * 3600 * 1000;
    try { expect(readSession(makeSession("t"))).not.toBeNull(); } finally { Date.now = realNow; }
    const s = makeSession("t");
    Date.now = () => realNow() + 13 * 3600 * 1000;
    try { expect(readSession(s)).toBeNull(); } finally { Date.now = realNow; }
  });
});
