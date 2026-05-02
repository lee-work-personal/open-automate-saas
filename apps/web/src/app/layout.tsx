import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenAutomate - Test Automation Platform",
  description: "Record, manage, and execute automated tests for your web applications",
  keywords: ["test automation", "e2e testing", "playwright", "selenium", "test management"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.variable} font-sans antialiased bg-gray-950 text-gray-100`}>
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#1f2937',
                color: '#f3f4f6',
                border: '1px solid #374151',
              },
              success: {
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#f3f4f6',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#f3f4f6',
                },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
