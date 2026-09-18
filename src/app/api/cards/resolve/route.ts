import { NextResponse } from "next/server";
import { resolveCardName } from "@/lib/cards";
import { parseCardList } from "@/lib/lists";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let text = "";
  let preferSet: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    preferSet = String(form.get("set") ?? "") || null;
    if (file instanceof File) text = await file.text();
    else text = String(form.get("text") ?? "");
  } else {
  let body: { text?: string; name?: string; set?: string } = {};
  try {
    body = (await request.json()) as { text?: string; name?: string; set?: string };
  } catch {
    body = {};
  }
    preferSet = body.set ?? null;
    text = body.text ?? (body.name ? `1 ${body.name}` : "");
  }

  const lines = parseCardList(text);
  const resolved = [];
  const missing = [];

  for (const line of lines) {
    const card = await resolveCardName(line.name, preferSet);
    if (!card) {
      missing.push(line);
      continue;
    }
    resolved.push({ quantity: line.quantity, card, line: line.line });
  }

  return NextResponse.json({ resolved, missing });
}
