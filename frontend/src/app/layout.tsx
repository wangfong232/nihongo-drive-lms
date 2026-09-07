import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { CourseLevelProvider } from "@/lib/courseLevel";

export const metadata: Metadata = {
  title: "Nihongo LMS — Modern Japanese Learning Management System",
  description: "Self-hosted interactive Japanese language course platform with Google Drive integration, SRS Vocabulary, and Quizzes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-[#f8f9ff] dark:bg-[#090d16] text-[#0b1c30] dark:text-slate-100 font-sans selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:text-emerald-200">
        <ThemeProvider>
          <I18nProvider>
            <CourseLevelProvider>{children}</CourseLevelProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
