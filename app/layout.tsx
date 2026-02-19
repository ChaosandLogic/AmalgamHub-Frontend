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
                
                // Suppress WebSocket errors from Next.js HMR/Turbopack
                // These are common in development and don't affect functionality
                const originalError = console.error;
                console.error = function(...args) {
                  const message = args[0]?.toString() || '';
                  // Suppress generic WebSocket errors from Next.js
                  if (message.includes('websocket error') || 
                      message.includes('WebSocket') && message.includes('error') ||
                      message.includes('HMR') && message.includes('error')) {
                    // Silently ignore - these are development-only HMR connection issues
                    return;
                  }
                  // Call original console.error for other errors
                  originalError.apply(console, args);
                };
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
