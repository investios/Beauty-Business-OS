import OwnerShell from "@/components/OwnerShell";
import { ARTICLES, ARTICLE_PLAN } from "@/lib/library";
export const dynamic = "force-dynamic";
const CAT: Record<string, string> = { trichology: "Трихология", extensions: "Наращивание", care: "Уход", recovery: "Восстановление" };

/** Библиотека знаний: статус статей (только просмотр). Редактирование и утверждение в кабинете — следующий этап. */
export default function OwnerLibrary() {
  const written = new Map(ARTICLES.map((a) => [a.slug, a]));
  return (
    <OwnerShell current="library">
      {() => (
        <>
          <div><h1>Библиотека знаний</h1><p className="hint">Сейчас только просмотр. Статьи на утверждении не индексируются поисковиками. ИИ-консультант использует их выжимки и честно пишет, что статья ещё не утверждена.</p></div>
          <ul style={{ display: "grid", gap: 10, margin: "16px 0 0", padding: 0, listStyle: "none" }}>
            {ARTICLE_PLAN.map((p) => {
              const a = written.get(p.slug);
              return (
                <li key={p.slug} className="panel" style={{ margin: 0, padding: 16 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                    <span className="hint" style={{ margin: 0 }}>№ {p.n}</span>
                    <span className="badge">{CAT[p.cat] ?? p.cat}</span>
                    {a ? <span className={`badge ${a.status === "approved" ? "ok" : "warn"}`}>{a.status === "approved" ? "утверждено" : "на утверждении"}</span> : <span className="badge">тема</span>}
                  </div>
                  <b style={{ display: "block", lineHeight: 1.35, overflowWrap: "anywhere" }}>{a ? <a href={`/ru/library/${p.slug}`} target="_blank" rel="noopener">{p.ru}</a> : p.ru}</b>
                  {a && <p className="hint" style={{ margin: "6px 0 0" }}>Языки: {Object.keys(a.langs).join(", ")} · источников: {a.sources.length}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </OwnerShell>
  );
}
