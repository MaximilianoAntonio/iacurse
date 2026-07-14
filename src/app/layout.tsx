import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
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
