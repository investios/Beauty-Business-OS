import { notFound } from "next/navigation";
import { getDb, one } from "@/lib/db";
import { getBookingByToken, getTenantBySlug, listServices } from "@/lib/booking";
import { dictFor, isLoc } from "@/lib/i18n";
import { formatLocal } from "@/lib/tz";
import BookingFlow from "@/components/BookingFlow";
import CancelButton from "@/components/CancelButton";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Manage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { locale, id } = await params;
  const { token } = await searchParams;
  if (!isLoc(locale)) notFound();
  const d = dictFor(locale);
  const db = await getDb();
  const tenant = (await getTenantBySlug(db, "demo"))!;
  const ok = /^[0-9a-f-]{36}$/.test(id) && token;
  const a = ok ? await getBookingByToken(db, tenant.id, id, token!) : null;
  if (!a) return <div className="page"><div className="wrap narrow"><h1 style={{ fontSize: 40 }}>{d.notFound}</h1></div></div>;
  const svc = (await listServices(db, tenant.id)).find((s) => s.id === a.service_id)!;
  void one;
  const when = formatLocal(new Date(a.start_at).getTime(), locale);
  return (
    <div className="page"><div className="wrap narrow">
      <h1 style={{ fontSize: "clamp(34px, 8vw, 52px)" }}>{d.manageTitle}</h1>
      <p className="summary" style={{ marginTop: 18 }}>{svc.title_i18n[locale]} · {when}</p>
      {a.status === "cancelled" ? <p className="msg-error">{d.cancelled}</p> : (
        <>
          <CancelButton locale={locale} id={id} token={token!} d={d} />
          <div style={{ height: 24 }} />
          <h2 style={{ fontSize: 28, marginBottom: 12 }}>{d.reschedBtn}</h2>
          <BookingFlow locale={locale} d={d} mode="reschedule" manage={{ id, token: token!, serviceId: a.service_id }}
            services={[{ id: svc.id, slug: svc.slug, title: svc.title_i18n[locale], desc: svc.desc_i18n[locale], duration: svc.duration_min }]} />
        </>
      )}
    </div></div>
  );
}
