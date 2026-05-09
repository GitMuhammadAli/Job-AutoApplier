import { describe, it, expect, vi } from "vitest";
import { apiSuccess, apiError, handleRouteError } from "./api-response";
import { NextResponse } from "next/server";

describe("apiSuccess", () => {
  it("returns NextResponse with body containing data", async () => {
    const r = apiSuccess({ ok: true, count: 5 });
    expect(r).toBeInstanceOf(NextResponse);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBe(5);
  });

  it("default status is 200", () => {
    const r = apiSuccess({ ok: true });
    expect(r.status).toBe(200);
  });

  it("accepts custom status code", () => {
    const r = apiSuccess({ created: true }, { status: 201 });
    expect(r.status).toBe(201);
  });

  it("accepts empty data object", async () => {
    const r = apiSuccess({});
    const body = await r.json();
    expect(body).toEqual({});
  });

  it("preserves nested data structures", async () => {
    const r = apiSuccess({ user: { id: "u1", profile: { name: "Ali" } } });
    const body = await r.json();
    expect(body.user.profile.name).toBe("Ali");
  });
});

describe("apiError", () => {
  it("returns NextResponse with error in body", async () => {
    const r = apiError("Something failed", 500);
    const body = await r.json();
    expect(body.error).toBe("Something failed");
  });

  it("uses provided status code", () => {
    expect(apiError("not found", 404).status).toBe(404);
    expect(apiError("server", 500).status).toBe(500);
    expect(apiError("bad", 400).status).toBe(400);
  });

  it("default status is 500 when not specified", () => {
    const r = apiError("msg");
    expect(r.status).toBe(500);
  });

  it("handles empty error message", async () => {
    const r = apiError("", 400);
    const body = await r.json();
    expect(body.error).toBe("");
  });
});

describe("handleRouteError", () => {
  it("returns 500 by default", () => {
    const r = handleRouteError("TestRoute", new Error("boom"), "Default error");
    expect(r.status).toBe(500);
  });

  it("logs to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    handleRouteError("TestRoute", new Error("boom"), "msg");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns the provided default message in body", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = handleRouteError("R", new Error("boom"), "Default error");
    const body = await r.json();
    expect(body.error).toContain("Default");
    spy.mockRestore();
  });

  it("handles non-Error values (strings, objects)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => handleRouteError("R", "string error", "msg")).not.toThrow();
    expect(() => handleRouteError("R", { code: 500 }, "msg")).not.toThrow();
    expect(() => handleRouteError("R", null, "msg")).not.toThrow();
    spy.mockRestore();
  });
});
