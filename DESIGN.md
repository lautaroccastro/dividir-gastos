# Lineamientos visuales (base)

## Herramienta

- **Tailwind CSS v4** con tokens en `src/app/globals.css` (`@theme inline` + variables en `:root`).
- No hay “temas” con nombre en Tailwind: se elige una **paleta base** (aquí: neutros cálidos **stone** + acento **teal**) y se exponen como **colores semánticos** (`background`, `primary`, etc.) para no atar el código a un gris concreto en cada pantalla.

## Principios

- **Un acento** para acciones principales (botones, enlaces importantes); el resto en escala neutra.
- **Sin animaciones** por ahora; foco en legibilidad y contraste.
- **Claro / oscuro** según `prefers-color-scheme` (mismo token, distinto valor en `:root`).

## Tokens (resumen)

| Token | Uso |
|-------|-----|
| `background` / `foreground` | Fondo general y texto principal |
| `muted` / `muted-foreground` | Fondos suaves y texto secundario |
| `border` / `input` | Bordes y campos |
| `primary` / `primary-foreground` | Botones primarios y CTA |
| `card` | Superficies tipo lista / tarjeta |
| `destructive` | Errores y alertas negativas |

## Cómo cambiar el look

1. Editá los valores hex/oklch en `:root` (y el bloque `prefers-color-scheme: dark`) en `globals.css`.
2. Preferí **no** usar `zinc-900` suelto en componentes nuevos; usá `bg-primary`, `text-muted-foreground`, etc.

## Tipografía

- **Geist Sans** (títulos y UI) y **Geist Mono** (datos tabulares si hace falta más adelante), cargadas en `layout.tsx`.
