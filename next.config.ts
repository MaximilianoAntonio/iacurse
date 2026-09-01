import type { NextConfig } from "next";

// Origen del backend Django: las imágenes /media/ y las llamadas fetch van allí.
// Se lee en build-time (misma variable que usa src/hooks/use-fetch.ts).
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Content-Security-Policy pragmática para Next.js standalone:
// - script-src/style-src incluyen 'unsafe-inline' porque Next y Tailwind
//   inyectan scripts/estilos inline en hidratación (endurecer exige nonces
//   con middleware; queda como mejora futura).
// - frame-src limitado a YouTube/Vimeo (embeds de video del contenido).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' ${API_ORIGIN} data: blob:`,
  `font-src 'self' data:`,
  `connect-src 'self' ${API_ORIGIN}`,
  `frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Cabeceras de seguridad del HTML servido por el frontend (el backend ya
  // emite las suyas vía SecurityMiddleware; aquí cubrimos las páginas).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
