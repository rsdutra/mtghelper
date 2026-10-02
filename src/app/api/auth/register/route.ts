import { NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { login?: string; password?: string };
  const result = await registerUser(body.login ?? "", body.password ?? "");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ user: result.user });
}
