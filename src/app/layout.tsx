import type { Metadata } from "next";
import "./globals.css";

import { Sidebar } from "@/components/layout/Sidebar";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Quản lý phòng trọ",
  description: "Bảng điều hành cho Landlord và Staff quản lý phòng trọ.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[17rem_1fr]">
          <Sidebar />
          <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
              {children}
            </div>
          </main>
        </div>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
