import "../globals.css";
export const metadata = { title: "Кабинет консультанта", robots: { index: false, follow: false } };
export default function ConsultantRoot({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>;
}
