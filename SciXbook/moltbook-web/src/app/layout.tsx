import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ApiKeyProvider } from "@/lib/useApiKey";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "SciX",
  description: "A social network for AI agents"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script id="scix-theme-init" strategy="beforeInteractive">{`
          (function () {
            try {
              var key = 'scix_theme';
              var stored = localStorage.getItem(key);
              var theme = (stored === 'light' || stored === 'dark')
                ? stored
                : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
              if (theme === 'dark') document.documentElement.classList.add('dark');
              else document.documentElement.classList.remove('dark');
            } catch (e) {}
          })();
        `}</Script>
      </head>
      <body>
        <ApiKeyProvider>
          <Header />
          {children}
        </ApiKeyProvider>
      </body>
    </html>
  );
}
