import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PageTransition from "./components/PageTransition";
import { ToastProvider } from "./components/Toast";
import DarkModeInit from "./components/DarkModeInit";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Amalgam Hub",
  description: "Track your work hours, manage projects, and submit timesheets with ease.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Initialize dark mode before React hydrates to prevent hydration mismatch */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedDarkMode = localStorage.getItem('darkMode');
                  if (savedDarkMode === 'enabled') {
                    document.documentElement.classList.add('dark-mode');
                    document.body.classList.add('dark-mode');
                  }
                } catch (e) {
                  // localStorage not available, ignore
                }
                
                // Suppress HMR WebSocket noise in development only
                if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
                  const originalError = console.error;
                  console.error = function(...args) {
                    const message = args[0]?.toString() || '';
                    if (message.includes('WebSocket') && (message.includes('error') || message.includes('HMR'))) {
                      return;
                    }
                    originalError.apply(console, args);
                  };
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        suppressHydrationWarning
      >
        <DarkModeInit />
        <ToastProvider>
          <PageTransition>{children}</PageTransition>
        </ToastProvider>
      </body>
    </html>
  );
}
