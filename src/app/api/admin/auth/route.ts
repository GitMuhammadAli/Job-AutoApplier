import { NextRequest, NextResponse } from "next/server";
import {
  validateAdminCredentials,
  createAdminSession,
  destroyAdminSession,
} from "@/lib/admin-auth";
import { AUTH } from "@/lib/messages";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: AUTH.USERNAME_PASSWORD_REQUIRED },
        { status: 400 }
      );
    }

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
