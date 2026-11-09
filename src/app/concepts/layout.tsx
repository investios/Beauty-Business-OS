import type { Metadata, Viewport } from "next";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/600-italic.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./concepts.css";

export const metadata: Metadata = { title: "Макеты главной страницы · MK Extension Studio", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function ConceptsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
