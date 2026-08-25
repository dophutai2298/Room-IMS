import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

import { Sidebar } from "@/components/layout/Sidebar";
import { AppQueryProvider } from "@/components/query-provider";
import { PwaServiceWorker } from "@/components/pwa-service-worker";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  applicationName: "Rental Room",
  title: {
    default: "Rental Room - Quản lý phòng trọ",
    template: "%s · Rental Room 201 CV",
  },
  description: "Bảng điều hành cho Admin quản lý phòng trọ.",
  icons: {
    icon: [
      {
        url: "/icons/pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Rental Room",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edf4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#102d25" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="rental-room-theme"
        >
          <AppQueryProvider>
            <a className="skip-link" href="#main-content">
              Bỏ qua đến nội dung chính
            </a>
            <div className="min-h-dvh text-foreground">
              <Sidebar />
              <main
                id="main-content"
                className="pwa-safe-content min-w-0 px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8"
              >
                <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-7">
                  {children}
                </div>
              </main>
            </div>
            <Toaster position="top-right" richColors />
            <PwaServiceWorker />
          </AppQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
