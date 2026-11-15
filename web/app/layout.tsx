import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/store/auth";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DOTS Daily v2",
  description:
    "DOTS Daily v2 - Tuberculosis Treatment Monitoring System Admin Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-bg-main font-sans text-text-primary antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {`try {
            if (window.localStorage.getItem("dots-daily-theme") === "dark") {
              document.documentElement.classList.add("dark");
            }
          } catch (error) {
            console.error("Unable to read the saved theme preference.", error);
          }`}
        </Script>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
