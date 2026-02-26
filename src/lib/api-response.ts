import { NextResponse } from "next/server";

/**
 * Standard success response for API routes.
 */
export function apiSuccess<T extends Record<string, unknown>>(
  data: T,
  init?: { status?: number; headers?: Record<string, string> },
): NextResponse {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

/**
 * Standard error response for API routes.
 * Follows the existing { error, details? } convention.
 */
export function apiError(
  error: string,
  status: number = 500,
  details?: string,
): NextResponse {
  const body: { error: string; details?: string } = { error };
  if (details) body.details = details;
  return NextResponse.json(body, { status });
}

/**
 * Catch an unknown error and return a standard 500.
 * Logs with a bracketed tag prefix for consistency.
 */
export function handleRouteError(
  tag: string,
  error: unknown,
  message: string = "Internal server error",
): NextResponse {
  console.error(`[${tag}] Error:`, error);
  return apiError(message, 500, String(error));
}
