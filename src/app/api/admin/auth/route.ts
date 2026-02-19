import { NextRequest, NextResponse } from "next/server";
import {
  validateAdminCredentials,
  createAdminSession,
  destroyAdminSession,
} from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Admin credentials not configured on server" },
        { status: 503 }
      );
    }

    if (!validateAdminCredentials(username, password)) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    createAdminSession();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  destroyAdminSession();
  return NextResponse.json({ success: true });
}
