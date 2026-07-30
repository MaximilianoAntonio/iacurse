import type { Metadata } from "next";
import { Archivo, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

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
  title: "ElectroMed IA · Plataforma de Aprendizaje Adaptativo",
  description:
    "Plataforma web con IA generativa para apoyar el aprendizaje personalizado en Electromedicina II. Piloto de innovación docente, Universidad de Valparaíso.",
  keywords: [
    "Electromedicina",
    "IA generativa",
    "aprendizaje adaptativo",
    "Ingeniería Civil Biomédica",
    "Universidad de Valparaíso",
    "innovación docente",
  ],
  authors: [{ name: "Prof. Hermes Mora · Escuela de Ingeniería Civil Biomédica, UV" }],
  icons: {
    icon: "/logo.svg",
  },
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
        </ThemeProvider>
      </body>
    </html>
  );
}
