import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Lernwerk", template: "%s · Lernwerk" },
  description: "Prüfungsnah lernen: Karteikarten, Übungsfragen und Prüfungssimulationen für meine Uni-Fächer.",
  // Vom iPhone-Homescreen aus ohne Safari-Leisten starten
  appleWebApp: { capable: true, title: "Lernwerk", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Bis an den Rand (Notch, Home-Indikator); die Abstände kommen über env(safe-area-inset-*)
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
};

/** Setzt das Theme vor dem ersten Paint, damit nichts aufblitzt. */
const themeScript = `(function(){try{var t=localStorage.getItem("lernwerk-theme");var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          <Header />
          <main className="safe-x mx-auto w-full max-w-5xl flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:pt-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
