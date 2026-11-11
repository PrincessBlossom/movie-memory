import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

// next/font self-hosts Montserrat at build time: no request to Google Fonts
// from the browser, and no layout shift while the font loads.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Movie Memory",
  description: "Remember your favorite movie and learn fun facts about it.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The font variable goes on <html> (not <body>) because --font-sans is
    // defined at :root and must be able to resolve var(--font-montserrat).
    <html lang="en" className={montserrat.variable}>
      <body className="antialiased">
        <header className="absolute top-8 left-1/2 -translate-x-1/2 text-xl font-bold tracking-tight whitespace-nowrap text-brand">
          Movie Memory
        </header>
        {/* pt-28 keeps content clear of the absolutely positioned header */}
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 pt-28 pb-12">
          {children}
        </main>
      </body>
    </html>
  );
}
