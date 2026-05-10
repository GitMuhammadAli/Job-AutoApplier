import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: { jobApplication: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { checkDuplicate, isDuplicateApplication } from "./duplicate-checker";

const findMany = vi.mocked(prisma.jobApplication.findMany);

function applicationFor(opts: {
  globalJobId: string;
  company: string;
  title: string;
  daysAgo?: number;
  sentAt?: boolean;
}) {
  const ts = new Date(Date.now() - (opts.daysAgo ?? 0) * 86400000);
  return {
    id: `app-${opts.globalJobId}`,
    sentAt: opts.sentAt === false ? null : ts,
    createdAt: ts,
    userJob: {
      globalJob: { company: opts.company, title: opts.title, id: opts.globalJobId },
    },
  };
}

beforeEach(() => {
  findMany.mockReset();
});

describe("checkDuplicate", () => {
  it("returns isDuplicate=false when no recent applications", async () => {
    findMany.mockResolvedValue([] as never);
    const r = await checkDuplicate("u1", { company: "Acme", title: "Backend Engineer", id: "g1" });
    expect(r.isDuplicate).toBe(false);
  });

  it("returns isDuplicate=true for the SAME globalJob id", async () => {
    findMany.mockResolvedValue([
      applicationFor({ globalJobId: "g1", company: "Acme", title: "Backend Engineer" }),
    ] as never);

    const r = await checkDuplicate("u1", { company: "Acme", title: "Different Title", id: "g1" });
    expect(r.isDuplicate).toBe(true);
    expect(r.reason).toMatch(/exact/i);
  });

  it("ignores apps from a different company even with same title", async () => {
    findMany.mockResolvedValue([
      applicationFor({ globalJobId: "g1", company: "OtherCo", title: "Backend Engineer" }),
    ] as never);

    const r = await checkDuplicate("u1", { company: "Acme", title: "Backend Engineer", id: "g2" });
    expect(r.isDuplicate).toBe(false);
  });

  it("returns isDuplicate=true for similar title at same company (>=85% word overlap)", async () => {
    findMany.mockResolvedValue([
      applicationFor({ globalJobId: "g1", company: "Acme", title: "Backend Engineer" }),
    ] as never);
    const r = await checkDuplicate("u1", { company: "Acme", title: "Backend Engineer", id: "g2" });
    expect(r.isDuplicate).toBe(true);
  });

  it("returns isDuplicate=false when titles differ significantly (<85%)", async () => {
    findMany.mockResolvedValue([
      applicationFor({ globalJobId: "g1", company: "Acme", title: "Senior Backend Engineer Platform" }),
    ] as never);
    const r = await checkDuplicate("u1", {
      company: "Acme",
      title: "Junior Frontend React Designer",
      id: "g2",
    });
    expect(r.isDuplicate).toBe(false);
  });

  it("normalizes company punctuation/case (acme = ACME = Acme,)", async () => {
    findMany.mockResolvedValue([
      applicationFor({ globalJobId: "g1", company: "ACME,", title: "Engineer" }),
    ] as never);
    const r = await checkDuplicate("u1", { company: "acme", title: "Engineer", id: "g2" });
    expect(r.isDuplicate).toBe(true);
  });

  it("queries only active statuses (SENT, SENDING, READY)", async () => {
    findMany.mockResolvedValue([] as never);
    await checkDuplicate("u1", { company: "Acme", title: "Eng", id: "g1" });
    const where = findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.status).toMatchObject({ in: ["SENT", "SENDING", "READY"] });
  });

  it("queries only this user's applications", async () => {
    findMany.mockResolvedValue([] as never);
    await checkDuplicate("user-42", { company: "Acme", title: "Eng", id: "g1" });
    const where = findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.userId).toBe("user-42");
  });

  it("includes daysAgo in duplicate reason when sentAt set", async () => {
    findMany.mockResolvedValue([
      applicationFor({ globalJobId: "g1", company: "Acme", title: "Engineer", daysAgo: 5 }),
    ] as never);
    const r = await checkDuplicate("u1", { company: "Acme", title: "Engineer", id: "g2" });
    expect(r.reason).toMatch(/5/);
    expect(r.reason).toMatch(/applied/i);
  });

  it("uses 'queued' phrasing when not yet sent", async () => {
    findMany.mockResolvedValue([
      applicationFor({ globalJobId: "g1", company: "Acme", title: "Engineer", sentAt: false }),
    ] as never);
    const r = await checkDuplicate("u1", { company: "Acme", title: "Engineer", id: "g2" });
    expect(r.reason).toMatch(/queued/i);
  });
});

describe("isDuplicateApplication (boolean helper)", () => {
  it("returns false when no apps", async () => {
    findMany.mockResolvedValue([] as never);
    const r = await isDuplicateApplication("u1", { company: "Acme", title: "Eng" });
    expect(r).toBe(false);
  });

  it("returns true when a similar role at same company exists", async () => {
    findMany.mockResolvedValue([
      applicationFor({ globalJobId: "g1", company: "Acme", title: "Engineer" }),
    ] as never);
    const r = await isDuplicateApplication("u1", { company: "Acme", title: "Engineer" });
    expect(r).toBe(true);
  });
});
