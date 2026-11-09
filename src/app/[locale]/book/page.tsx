import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getTenantBySlug, listServices } from "@/lib/booking";
import { dictFor, isLoc } from "@/lib/i18n";
import BookingFlow from "@/components/BookingFlow";

export const dynamic = "force-dynamic";

export default async function Book({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ service?: string }> }) {
  const { locale } = await params;
  const { service } = await searchParams;
  if (!isLoc(locale)) notFound();
  const d = dictFor(locale);
  const db = await getDb();
  const tenant = (await getTenantBySlug(db, "demo"))!;
  const services = (await listServices(db, tenant.id)).map((s) => ({ id: s.id, slug: s.slug, title: s.title_i18n[locale], desc: s.desc_i18n[locale], duration: s.duration_min }));
  return (
    <div className="page"><div className="wrap narrow">
      <h1 style={{ fontSize: "clamp(34px, 8vw, 52px)" }}>{d.bookTitle}</h1>
      <BookingFlow locale={locale} d={d} services={services} initialSlug={service} />
    </div></div>
  );
}
