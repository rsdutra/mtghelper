import { NextResponse } from "next/server";
import { clearSession, getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) await clearSession();
  return NextResponse.json({ user });
}
