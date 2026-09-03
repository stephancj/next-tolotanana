import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "./providers/I18nProvider";
import { EditionProvider } from "./providers/EditionProvider";
import Navbar from "./components/Navbar";
import { SyncProvider } from "./hooks/useSync";
import { FeedbackProvider } from "./providers/FeedbackProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fiche Médicale",
  description: "Application intuitive pour la gestion des fiches médicales",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider>
          <FeedbackProvider>
            <SyncProvider>
              <EditionProvider>
                <Navbar />
                {children}
              </EditionProvider>
            </SyncProvider>
          </FeedbackProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
