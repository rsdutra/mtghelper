import { NextResponse } from "next/server";
import { suggestCards } from "@/lib/cards";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const suggestions = await suggestCards(query);
  return NextResponse.json({ suggestions });
}
