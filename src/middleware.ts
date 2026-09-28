import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("mtg_session")?.value;
  const path = request.nextUrl.pathname;
  const needsAuth = path.startsWith("/decks") || path.startsWith("/colecao");
  if (needsAuth && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (path.startsWith("/cadastro") && session) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/decks/:path*", "/colecao/:path*", "/cadastro", "/cadastro/:path*"],
};
