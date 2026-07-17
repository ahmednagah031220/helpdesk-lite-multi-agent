import { auth } from "@/lib/auth";
import { SessionUser } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function requireSession(): Promise<
  SessionUser | NextResponse
> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role,
  };
}

export function isErrorResponse(
  value: SessionUser | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
