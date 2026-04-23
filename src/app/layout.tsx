import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "מעקב ביקורי משגיחים",
  description: "מערכת ניהול ובקרה לביקורי עובדים בשטח",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}
