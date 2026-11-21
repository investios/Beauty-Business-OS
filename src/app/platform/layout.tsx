import "../globals.css";
export const metadata = { title: "Панель платформы", robots: { index: false, follow: false } };
export default function PlatformRoot({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>;
}
