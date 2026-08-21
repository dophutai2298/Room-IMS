import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

import { Sidebar } from "@/components/layout/Sidebar";
import { AppQueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  applicationName: "Rental Room",
  title: {
    default: "Rental Room - Quản lý phòng trọ",
    template: "%s · Rental Room 201 CV",
  },
  description: "Bảng điều hành cho Landlord và Staff quản lý phòng trọ.",
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
                className="min-w-0 px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8"
              >
                <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-7">
                  {children}
                </div>
              </main>
            </div>
            <Toaster position="top-right" richColors />
          </AppQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
