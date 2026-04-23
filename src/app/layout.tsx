import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "מעקב ביקורי משגיחים",
  description: "מערכת מעקב ובקרה לביקורי משגיחים",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ביקורי משגיחים",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
