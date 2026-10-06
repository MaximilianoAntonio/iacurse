import type { Metadata } from "next";
import { Archivo, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
// Estilos de KaTeX para las fórmulas del contenido del curso (Reader 2.0)
import "katex/dist/katex.min.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieNotice } from "@/components/app/cookie-notice";

// Tipografía del rediseño: Archivo (display industrial), Hanken Grotesk
// (texto de trabajo) y JetBrains Mono (datos y medición). Sale de Geist.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "CAAMI · Plataforma de Aprendizaje Adaptativo",
  description:
    "CAAMI: plataforma web con IA generativa para apoyar el aprendizaje personalizado en Electromedicina II. Piloto de innovación docente, Universidad de Valparaíso.",
  keywords: [
    "CAAMI",
    "Electromedicina",
    "IA generativa",
    "aprendizaje adaptativo",
    "Ingeniería Civil Biomédica",
    "Universidad de Valparaíso",
    "innovación docente",
  ],
  authors: [{ name: "Prof. Hermes Mora · Escuela de Ingeniería Civil Biomédica, UV" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${hanken.variable} ${archivo.variable} ${jetbrains.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <CookieNotice />
        </ThemeProvider>
      </body>
    </html>
  );
}
