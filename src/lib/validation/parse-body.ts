/**
 * Shared request-body validator.
 *
 * Every API route that accepts JSON should run user input through a Zod
 * schema before touching it. This helper unifies:
 *   - JSON parse with consistent 400 on malformed input
 *   - Zod parse with consistent 400 + issue list
 *   - Pass-through of validated data to the route handler
 *
 * Usage:
 *   const parsed = await parseBody(req, MySchema);
 *   if (!parsed.ok) return parsed.response;
 *   const { foo } = parsed.data;
 *
 * The error shape stays stable across the app:
 *   { error: "Invalid request", issues: [{ path, message }] }
 *
 * — so clients can build a single error formatter that works for every
 * endpoint instead of one-off per-route handling.
 */

import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";

export type ParseBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function parseBody<T>(
  req: NextRequest,
  schema: z.ZodType<T>,
): Promise<ParseBodyResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Invalid request",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * URL search params variant — for GET routes that take query strings.
 * Coerces strings → numbers/booleans where the schema asks for them.
 */
export function parseQuery<T>(
  req: NextRequest,
  schema: z.ZodType<T>,
): ParseBodyResult<T> {
  const raw: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}
