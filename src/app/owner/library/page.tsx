import OwnerShell from "@/components/OwnerShell";
import { ARTICLES, ARTICLE_PLAN } from "@/lib/library";
export const dynamic = "force-dynamic";

/** Библиотека знаний: статус статей (только просмотр). Редактирование и утверждение в кабинете — следующий этап. */
export default function OwnerLibrary() {
  const written = new Map(ARTICLES.map((a) => [a.slug, a]));
  return (
    <OwnerShell current="library">
      {() => (
        <>
          <div><h1>Библиотека знаний</h1><p className="hint">Сейчас только просмотр. Статьи на утверждении не индексируются поисковиками. ИИ-консультант использует их выжимки и честно пишет, что статья ещё не утверждена.</p></div>
          <div className="tbl-wrap"><table>
            <thead><tr><th>№</th><th>Тема</th><th>Раздел</th><th>Статус</th><th>Языки</th><th>Источники</th></tr></thead>
            <tbody>
              {ARTICLE_PLAN.map((p) => {
                const a = written.get(p.slug);
                return (
                  <tr key={p.slug}>
                    <td>{p.n}</td><td>{a ? <a href={`/ru/library/${p.slug}`} target="_blank" rel="noopener">{p.ru}</a> : p.ru}</td><td>{p.cat}</td>
                    <td>{a ? <span className={`badge ${a.status === "approved" ? "ok" : "warn"}`}>{a.status === "approved" ? "утверждено" : "на утверждении"}</span> : <span className="badge">тема</span>}</td>
                    <td>{a ? Object.keys(a.langs).join(", ") : "—"}</td><td>{a ? a.sources.length : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </>
      )}
    </OwnerShell>
  );
}
