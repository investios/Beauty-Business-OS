import { notFound } from "next/navigation";
import ConceptHome from "@/components/ConceptHome";
import { CLANGS, THEMES, type CLang, type Theme } from "@/lib/concept-copy";

export const dynamic = "force-dynamic";
export function generateStaticParams() { return THEMES.map((theme) => ({ theme })); }

export default async function ConceptPage({ params, searchParams }: { params: Promise<{ theme: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { theme } = await params;
  const { lang } = await searchParams;
  if (!(THEMES as readonly string[]).includes(theme)) notFound();
  const l = (CLANGS as string[]).includes(lang ?? "") ? (lang as CLang) : "ru";
  return <ConceptHome theme={theme as Theme} lang={l} />;
}
