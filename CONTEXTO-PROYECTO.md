# Contexto del proyecto — Dividir gastos

Documento de continuidad: visión, decisiones, stack, modelo de datos, qué está hecho y qué sigue. Pensado para que un agente de IA (o un dev) retome el desarrollo con contexto completo.

---

## Visión del producto

- Web app para registrar **gastos compartidos**: quién pagó, entre quiénes se reparte el monto, y en algún momento un **balance / transferencias sugeridas**.
- **Autenticación**: Google OAuth y **email + contraseña** con **confirmación por email** (Supabase Auth).
- **Datos** en Postgres vía **Supabase** (API de datos + RLS).

### Modelo de uso acordado (importante)

- La app es **por cuenta**: cada usuario logueado ve **solo sus datos**.
- **No hay** vínculo a otras cuentas de la app: los “participantes” de un grupo son **nombres de texto** definidos por el usuario, **por grupo** (no hay agenda global ni `user_id` de terceros).
- Cada **grupo** tiene una **moneda única** (hoy solo **ARS** u **USD**), elegida en la creación.
- Nombres: reglas de formato en `src/lib/text/format-names.ts` (grupo: primera letra del string; participantes: primera letra de cada palabra; el resto se conserva como escribió el usuario). Validación y duplicados **case insensitive** donde aplica.
- Participante “vos”: etiqueta fija **`Tú`** (`SELF_PARTICIPANT_LABEL` en código). En el formulario de creación de grupo hay un **switch** “Formo parte de los participantes” (por defecto activo); si se desactiva, no se guarda fila `is_self` y no hay botón Quitar en esa fila (la fila desaparece hasta volver a activar).

---

## Prioridades

1. **Simplicidad** y entendibilidad del código (nombres de variables explícitos; comentarios en **inglés** en código donde aporten).
2. **Responsive** (mobile / tablet / desktop) cuando se trabaje UI; el repaso visual global quedó **para el final** del proyecto.
3. Trabajo con el usuario: avanzar **por slices**, explicar cada paso y **esperar confirmación** antes de seguir (cuando aplique).

---

## Stack

| Capa | Elección |
|------|----------|
| App | **Next.js 16** (App Router, TypeScript, Tailwind CSS v4) |
| Deploy | **Vercel** (preset Next.js) |
| Auth + DB | **Supabase** (Postgres, Auth, Data API activo) |
| Cliente Supabase | `@supabase/supabase-js` + `@supabase/ssr` (cookies + `middleware` para refrescar sesión) |

**Seguridad de datos**: **anon key** + JWT del usuario; **no** se usa service role en el cliente. **RLS** en tablas expuestas.

**Variables de entorno** (`Vercel` y `.env.local` local, no commitear valores reales):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave “publishable / anon” del panel)

Plantilla: `.env.example`.

---

## Estructura relevante del repo

| Ruta | Rol |
|------|-----|
| `src/lib/supabase/client.ts` | Cliente browser (Supabase) |
| `src/lib/supabase/server.ts` | Cliente servidor (cookies) |
| `src/lib/supabase/middleware.ts` + `middleware.ts` | Refresco de sesión |
| `src/app/auth/callback/route.ts` | OAuth / magic link: `exchangeCodeForSession`; cookies en el **Response** del redirect |
| `src/lib/text/format-names.ts` | Formato de nombres (grupo / participantes) |
| `src/lib/validation/group-create.ts` | Validación + `buildCreatePayload` para crear grupo |
| `src/app/actions/groups.ts` | Server action `createGroupAction` |
| `src/app/actions.ts` | `signOut` |
| `src/app/groups/layout.tsx` | Requiere sesión para `/groups/*` |
| `src/app/page.tsx` | Home: “Mis grupos” |
| `src/app/groups/new/page.tsx` | Crear grupo |
| `src/app/groups/[id]/page.tsx` | Detalle del grupo (placeholder; sin gastos aún) |
| `src/components/create-group-form.tsx` | Formulario creación (participantes, switch “Formo parte…”, moneda, etc.) |
| `supabase-slice1-groups.sql` | DDL + RLS de `groups` y `participants` |
| `supabase-drop-mvp-notes.sql` | Solo si existió la tabla de prueba `mvp_notes` del MVP inicial |
| `DESIGN.md` + `src/app/globals.css` | Tokens / tema base (repaso visual global pendiente) |

---

## Modelo de datos (estado actual)

### Tabla `groups`

- `user_id` → dueño (`auth.users`).
- `name` (único por usuario, **case insensitive** + trim; índice en SQL).
- `currency`: `'ARS' | 'USD'` (check en BD).
- Timestamps.

### Tabla `participants`

- `group_id` → `groups` (cascade delete).
- `display_name` (texto; único por grupo case insensitive + trim).
- `is_self` (boolean).
- `sort_order` (orden en UI / lógica futura).

**RLS**: el dueño del grupo lee/escribe sus `groups`; `participants` accesibles si el `group_id` pertenece a un grupo del usuario (políticas con `EXISTS` sobre `groups`).

**Nota**: ejecutar **`supabase-slice1-groups.sql`** en el SQL Editor de Supabase si el entorno aún no tiene estas tablas.

---

## Flujos implementados

1. Login (`/login`): Google + email/contraseña; confirmación por mail → `/auth/callback`.
2. Home (`/`): lista de grupos; “Nuevo grupo”; cerrar sesión.
3. Crear grupo (`/groups/new`): nombre, moneda, switch de inclusión propia, lista de participantes (patrón “agregar al final”), crear → server action → redirect a `/groups/[id]`.
4. Detalle grupo (`/groups/[id]`): título, moneda, placeholder para gastos.

---

## Próximo slice (borrador — definir alcance en la siguiente iteración)

**Objetivo general**: cargar **gastos** dentro de un grupo (con **crear, editar, eliminar**), probablemente en la pantalla de detalle.

**A definir antes de implementar**: campos exactos del gasto (monto, fecha, descripción, quién pagó, split entre quiénes), reglas con **participantes** existentes, restricciones al editar/borrar, y si el balance/transferencias entra en el mismo slice o después.

---

## Otros

- **Dominio previsto**: `dividirgastos.com` (DNS → Vercel).
- **Git**: alias global `git c <mensaje sin comillas>` → `add` + `commit` + `push` (ver `~/.gitconfig`).
- **MVP inicial de “notas”**: removido del código; tabla `mvp_notes` eliminable con `supabase-drop-mvp-notes.sql` si quedó en algún entorno.

---

*Última actualización: pausa de desarrollo; slice de gastos pendiente de alcance detallado.*
