import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hub de Búsqueda — Terremoto Venezuela 2026",
  description: "Busca personas desaparecidas o a salvo en todas las plataformas de registro del terremoto en Venezuela al mismo tiempo.",
  icons: {
    icon: "/favicon-32x32.png",
    shortcut: "/favicon-32x32.png",
    apple: "/logo.png",
  },
  verification: {
    google: "v_IEZ_pRgvcXyPUptoP15JNVCZMXiNrGjR5-t_ae46Y",
  },
  openGraph: {
    title: "Hub de Búsqueda — Terremoto Venezuela 2026",
    description: "Busca personas desaparecidas o a salvo en todas las plataformas de registro del terremoto en Venezuela al mismo tiempo.",
    url: "https://buscavenezuela.vercel.app",
    siteName: "BuscaVenezuela",
    images: [{ url: "https://buscavenezuela.vercel.app/logo.png", width: 512, height: 512 }],
    locale: "es_VE",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Hub de Búsqueda — Terremoto Venezuela 2026",
    description: "Busca personas desaparecidas o a salvo en todas las plataformas de registro del terremoto en Venezuela al mismo tiempo.",
    images: ["https://buscavenezuela.vercel.app/logo.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Hub de Búsqueda — Terremoto Venezuela 2026",
  url: "https://buscavenezuela.vercel.app",
  description:
    "Busca personas desaparecidas o localizadas tras el terremoto de Venezuela 2026. Centralizamos los registros de Venezuela Te Busca y Venezuela Reporta.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://buscavenezuela.vercel.app/?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
      <GoogleAnalytics gaId="G-7561Y7CJ6H" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </html>
  );
}
