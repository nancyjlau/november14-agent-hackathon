import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "rizz et al. — make your move. cite your sources.",
  description: "A little chemistry. A little machine learning. Conversation-inspired replies with real arXiv references, made for LINE.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
