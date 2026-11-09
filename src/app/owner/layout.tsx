import "../globals.css";
export const metadata = { title: "Кабинет мастера", robots: { index: false, follow: false } };
export default function OwnerRoot({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>;
}
