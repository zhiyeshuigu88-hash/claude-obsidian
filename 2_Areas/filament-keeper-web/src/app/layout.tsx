import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/app-sidebar";
import { AppDialogsProvider } from "@/components/providers/app-dialogs-provider";
import { GlobalShortcuts } from "@/components/global-shortcuts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Filament Keeper",
  description: "3Dプリンター用フィラメントの残量・状態・コストを一元管理する個人用ローカルアプリ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider>
          <TooltipProvider>
            <AppDialogsProvider>
              <GlobalShortcuts />
              <div className="flex min-h-screen">
                <AppSidebar />
                <main className="flex-1 overflow-x-hidden">{children}</main>
              </div>
              <Toaster />
            </AppDialogsProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
