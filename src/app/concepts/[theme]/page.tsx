import { notFound } from "next/navigation";
import ConceptHome from "@/components/ConceptHome";
import ConceptB1 from "@/components/concepts/ConceptB1";
import ConceptB2 from "@/components/concepts/ConceptB2";
import ConceptB3 from "@/components/concepts/ConceptB3";
import ConceptD1 from "@/components/concepts/ConceptD1";
import ConceptD2 from "@/components/concepts/ConceptD2";
import ConceptD3 from "@/components/concepts/ConceptD3";
import { CLANGS, VARIANTS, type CLang, type Theme } from "@/lib/concept-copy";

export const dynamic = "force-dynamic";
export function generateStaticParams() { return VARIANTS.map((theme) => ({ theme })); }

export default async function ConceptPage({ params, searchParams }: { params: Promise<{ theme: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { theme } = await params;
  const { lang } = await searchParams;
  if (!(VARIANTS as readonly string[]).includes(theme)) notFound();
  const l = (CLANGS as string[]).includes(lang ?? "") ? (lang as CLang) : "ru";
  if (theme === "b1") return <ConceptB1 lang={l} />;
  if (theme === "b2") return <ConceptB2 lang={l} />;
  if (theme === "b3") return <ConceptB3 lang={l} />;
  if (theme === "d1") return <ConceptD1 lang={l} />;
  if (theme === "d2") return <ConceptD2 lang={l} />;
  if (theme === "d3") return <ConceptD3 lang={l} />;
  return <ConceptHome theme={theme as Theme} lang={l} />;
}
