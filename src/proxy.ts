import { NextResponse, type NextRequest } from "next/server";

// "/" → язык по Accept-Language (RU/UK/EN), по умолчанию EN
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname !== "/") return NextResponse.next();
  const al = (req.headers.get("accept-language") ?? "").toLowerCase();
  const first = al.split(",")[0] ?? "";
  const loc = first.startsWith("uk") ? "uk" : first.startsWith("ru") ? "ru" : "en";
  const url = req.nextUrl.clone();
  url.pathname = `/${loc}`;
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/"] };
