# Contexto del proyecto — Dividir gastos (MVP)

Resumen para retomar el trabajo en otro momento o en otro chat.

## Objetivo del producto (visión)

- App web para cargar **usuarios**, **gastos** (quién pagó, entre quiénes se reparte, monto) y generar un **balance de transferencias**.
- **Login**: Google y **email + contraseña** con **confirmación por email**.
- Datos en **base de datos** (Postgres vía Supabase).

## Prioridad acordada

- **Simplicidad** y un **MVP** que valide todas las capas antes de la lógica de negocio completa.

## Stack actual

| Capa | Elección |
|------|----------|
| Frontend / backend | **Next.js 16** (App Router, TypeScript, Tailwind) |
| Hosting | **Vercel** (framework preset: Next.js) |
| Base de datos + Auth | **Supabase** (Postgres, Auth, Data API / PostgREST activo) |
| Cliente | `@supabase/supabase-js` + `@supabase/ssr` (sesión con cookies + middleware) |

**No usamos** por ahora la **service role key** en el cliente; la seguridad es **anon + JWT + RLS**.

## Variables de entorno (Vercel y local)

En Vercel (Production y Preview si usás PRs) y en `.env.local` (no commitear):

- `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto (ej. `https://xxxxx.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — clave **publishable / anon** del panel (no la secret).

Archivo de ejemplo: `.env.example`.

## Qué está implementado en el código

1. **Middleware** — refresco de sesión Supabase en cada request.
2. **`/login`** — Google OAuth, login con email/contraseña, alta de cuenta con redirect de confirmación a `/auth/callback`.
3. **`/auth/callback`** — intercambio del código OAuth por sesión; las cookies se aplican sobre el `NextResponse.redirect` (fix necesario para que el login con Google persista en Vercel).
4. **`/auth/auth-code-error`** — página si el callback falla.
5. **Home (`/`)** — si hay sesión: formulario que guarda una **nota de prueba** en tabla `mvp_notes` y lista notas del usuario.
6. **SQL** — `supabase-mvp.sql`: tabla `mvp_notes`, RLS para que cada usuario solo vea/inserte sus filas.

## Supabase — configuración que importa

- **Authentication → URL configuration**: Site URL y Redirect URLs deben incluir la URL de la app (Vercel y/o `http://localhost:3000/**`).
- **Google OAuth**: en Google Cloud, redirect URI  
  `https://<tu-ref>.supabase.co/auth/v1/callback`  
  mismo host que Project URL / Data API; en Supabase → Providers → Google con Client ID y Secret.

## Dominio

- Objetivo: **dividirgastos.com** (DNS apuntando a Vercel cuando corresponda).

## Git — alias personal

Alias global `git c` (en `~/.gitconfig`):

- Uso: `git c mensaje del commit sin comillas`  
- Equivale a: `git add .` + `git commit -m "..."` + `git push`.

## Estado actual

- **Login (Google y email) y escritura en BD verificados** en producción.
- Pendiente a nivel producto: **modelo de grupos, gastos y algoritmo de saldos**, UI definitiva, etc.

## Archivos útiles para retomar

| Archivo | Contenido |
|---------|-----------|
| `supabase-mvp.sql` | Tabla y políticas RLS del MVP |
| `src/lib/supabase/*` | Clientes browser / server / middleware |
| `src/app/auth/callback/route.ts` | Callback OAuth (cookies en response) |
| `CONTEXTO-PROYECTO.md` | Este resumen |

---

*Generado como memoria de contexto; actualizar cuando avance el modelo de datos o el despliegue.*
