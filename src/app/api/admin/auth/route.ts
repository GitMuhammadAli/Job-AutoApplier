import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  validateAdminCredentials,
  createAdminSession,
  destroyAdminSession,
} from "@/lib/admin-auth";
import { AUTH } from "@/lib/messages";
import { parseBody } from "@/lib/validation/parse-body";

const AdminLoginBody = z.object({
  username: z.string().trim().min(1).max(256),
  password: z.string().min(1).max(1024),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, AdminLoginBody);
    if (!parsed.ok) return parsed.response;
    const { username, password } = parsed.data;

    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: AUTH.ADMIN_CREDENTIALS_NOT_CONFIGURED },
        { status: 503 }
      );
    }

    if (!validateAdminCredentials(username, password)) {
      return NextResponse.json(
        { error: AUTH.INVALID_CREDENTIALS },
        { status: 401 }
      );
    }

    createAdminSession();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: AUTH.INVALID_REQUEST },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  destroyAdminSession();
  return NextResponse.json({ success: true });
}
