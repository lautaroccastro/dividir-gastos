import type { MetadataRoute } from "next";

/**
 * Manifest para “Instalar app” / PWA: iconos de calidad (SVG escala bien;
 * Chrome también usa estos metadatos al agregar a la pantalla de inicio).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dividir Gastos",
    short_name: "Dividir Gastos",
    description: "Dividí gastos con tu grupo",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "512x512",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
