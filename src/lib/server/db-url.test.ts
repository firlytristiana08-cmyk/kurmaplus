import { describe, expect, it } from "vitest";
import { pickPostgresUrl } from "./db";

describe("pickPostgresUrl", () => {
  it("mendahulukan Hyperdrive bila binding tersedia", () => {
    const target = pickPostgresUrl({
      hyperdrive: "postgres://user:pass@127.0.0.1:5432/db",
      databaseUrl: "postgresql://other",
      projectRef: "abc",
      password: "secret",
    });
    expect(target).toEqual({
      url: "postgres://user:pass@127.0.0.1:5432/db",
      viaHyperdrive: true,
    });
  });

  it("memakai DATABASE_URL bila ada (tanpa Hyperdrive)", () => {
    const target = pickPostgresUrl({
      databaseUrl: "  'postgresql://explicit'  ",
      projectRef: "abc",
      password: "secret",
    });
    expect(target).toEqual({ url: "postgresql://explicit", viaHyperdrive: false });
  });

  it("membangun URL pooler dari SUPABASE_PROJECT_REF + password", () => {
    const target = pickPostgresUrl({
      projectRef: "dmwtrtcehxjcweoanbsx",
      password: "p@ss:w/rd",
      region: "ap-southeast-1",
    });
    expect(target).toEqual({
      url: "postgresql://postgres.dmwtrtcehxjcweoanbsx:p%40ss%3Aw%2Frd@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
      viaHyperdrive: false,
    });
  });

  it("region default ap-southeast-1", () => {
    const target = pickPostgresUrl({ projectRef: "ref", password: "pw" });
    expect(target?.url).toContain("@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres");
    expect(target?.viaHyperdrive).toBe(false);
  });

  it("null bila tidak ada kredensial sama sekali", () => {
    expect(pickPostgresUrl({})).toBeNull();
    expect(pickPostgresUrl({ projectRef: "ref" })).toBeNull();
    expect(pickPostgresUrl({ password: "pw" })).toBeNull();
    expect(pickPostgresUrl({ hyperdrive: "   " })).toBeNull();
  });
});
