import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Movie Memory",
  description: "Remember your favorite movie and learn fun facts about it.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
