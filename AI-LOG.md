# Registro de Auditoría de IA (AI-LOG)

**Integrantes:** Leonardo Hernández, Julián Ortiz
**Semana:** 8
**Proyecto:** GeoCam con respaldo en la nube — Backend as a Service con Supabase (taller en clase T1–T6 + trabajo para la casa C1–C7)
**Versiones verificadas en `package.json`:** Expo SDK 57, `@supabase/supabase-js` ^2.118.0, `expo-secure-store` ~57.0.4, `expo-crypto` ~57.0.4, `drizzle-orm` 0.45, `drizzle-kit` 0.31

> Los AI-LOG anteriores están en [`docs/AI-LOG-semana6.md`](./docs/AI-LOG-semana6.md) y [`docs/AI-LOG-semana7.md`](./docs/AI-LOG-semana7.md).

## 1. Prompts Utilizados

- "Ayúdame con la Guía Semana 8 paso a paso sobre GeoCam: proyecto en Supabase, login con correo y contraseña, sesión guardada en SecureStore y rutas protegidas con `Stack.Protected`."
- "Crea el SQL de la tabla `photos` con RLS por dueño y un bucket privado `geocam` con una carpeta por usuario."
- "Agrega a SQLite los campos de sincronización (`clientId`, `updatedAt`, `remotePath`, `syncedAt`) con una migración de drizzle-kit, sin perder las fotos de la Semana 7."
- "Haz el trabajo para la casa: botón Sincronizar con avance, subida sin duplicados ni archivos huérfanos, borrado coherente, pestaña Nube con tiempo real y fotos separadas por usuario."
- "Me sale este error al generar la migración: `TransformError ... react-native/index.js: Unexpected "typeof"`." → Ver Corrección 1.

## 2. Código Generado vs. Código Modificado

### Corrección 1 — `expo-crypto` dentro de `db/schema.ts` rompe drizzle-kit
- **Qué propone la guía:** `clientId: text('client_id').$defaultFn(() => Crypto.randomUUID())` importando `expo-crypto` en el esquema.
- **Problema:** `drizzle-kit generate` se ejecuta en **Node**, no en el teléfono. Al leer el esquema intenta cargar `expo-crypto` → `react-native`, y falla con `TransformError ... Unexpected "typeof"`.
- **Qué modificamos:** el esquema quedó sin imports de Expo (`clientId: text('client_id').unique()`) y el UUID se genera en el repositorio: `photosRepo.create()` y `ensureSyncFields()` usan `Crypto.randomUUID()`. Así la migración `0002_sync_fields` se generó sin errores.

### Corrección 2 — `markSynced` no debe tocar `updatedAt`
- **Riesgo:** si al marcar la foto como subida se actualiza también `updatedAt`, la foto vuelve a quedar **pendiente** para siempre (`syncedAt < updatedAt`).
- **Qué hicimos:** `markSynced(id, remotePath)` solo escribe `remotePath` y `syncedAt`. En cambio, `update()` (nota, favorita, álbum) **siempre** escribe `updatedAt = new Date()`, para que una edición después de subir vuelva a marcarla como pendiente.

### Corrección 3 — Subir con `Blob`/`FormData` crea archivos de 0 bytes
- **Qué suele generar la IA:** `fetch(uri).then(r => r.blob())` o un `FormData`.
- **Problema:** en React Native eso sube archivos vacíos a Storage.
- **Qué usamos:** `fetch(uri).then(r => r.arrayBuffer())`, y además se comprueba que el archivo exista (`new File(uri).exists`) y que `byteLength > 0` antes de subir. En Storage, cada foto pesa alrededor de **1.3 MB** (`s8-storage.png`).

### Corrección 4 — Subida idempotente, sin duplicados ni huérfanos (C2)
- La ruta siempre es `<user_id>/<client_id>.jpg`, y `client_id` y `storage_path` son `unique` en PostgreSQL.
- Antes de subir se busca la fila por `client_id`: si ya existe, solo se actualizan los metadatos (política **UPDATE** en la tabla).
- Si el archivo sube pero el `insert` de la fila falla, se borra el archivo con `storage.remove([path])`.
- Se usa `upsert: true` para reemplazar un archivo huérfano de un intento anterior. Esto exige políticas **INSERT, SELECT y UPDATE** en `storage.objects`, que la guía no incluía completas.

### Corrección 5 — Borrado coherente (C3)
- **Orden:** primero la fila remota, luego el archivo del bucket, y solo si ambos salen bien se borra la fila local y el archivo del teléfono.
- Sin conexión se lanza el error, la pantalla muestra "Sin conexión… No se borró nada" y la foto queda intacta en ambos lados. Repetir el borrado es seguro.
- Al agitar el teléfono (`clearAll`), las fotos que no se pudieron borrar de la nube se conservan y se informa cuántas.

### Corrección 6 — Fotos separadas por usuario también en SQLite (C5)
- **Problema:** RLS separa las fotos en Supabase, pero la base local del teléfono es una sola. Con otra cuenta se verían las fotos del usuario anterior.
- **Qué modificamos:** tercera migración `0003_owner_id` (`ALTER TABLE photos ADD owner_id text`). Todas las consultas de `photosRepo` reciben el `ownerId` de la sesión (`hooks/useUserId.ts`), y `useLiveQuery` usa `[userId]` como dependencia. `ensureSyncFields(userId)` asigna las fotos antiguas (sin dueño) al primer usuario que inicia sesión.
- Los álbumes siguen siendo locales y compartidos (no se sincronizan en esta semana).

### Corrección 7 — Navegación con `Stack.Protected`, sin `router.replace`
- Tras el login o el logout no se navega a mano: `Stack.Protected guard={!!session}` muestra las pestañas y `guard={!session}` muestra `login`. Al cambiar la sesión, Expo Router redirige solo.

## 3. Alucinaciones o Errores Detectados

| Error típico | ¿Apareció? | Qué usamos |
|---|---|---|
| Guardar la sesión en `AsyncStorage` | No | `SecureStore` por partes de 1000 caracteres (`lib/secureStorage.ts`) |
| Poner la `service_role` / `sb_secret_…` en la app | No | Solo la **publishable key** en `.env` con prefijo `EXPO_PUBLIC_` |
| Bucket público | No | Bucket privado + URL firmadas de 1 hora |
| Tablas sin RLS | No | RLS activado con `(select auth.uid()) = user_id` en las 4 operaciones |
| `detectSessionInUrl: true` en móvil | No | `false` + `startAutoRefresh` / `stopAutoRefresh` con `AppState` |
| Canal de Realtime sin limpiar | No | `supabase.removeChannel(channel)` en el cleanup del `useEffect` |
| `expo-crypto` en el esquema | **Sí** | Ver Corrección 1 |
| Subir con `Blob` | Evitado | `arrayBuffer()` (Corrección 3) |

## 4. Verificación en dispositivo (iPhone, Expo Go SDK 57)

| Prueba | Resultado | Evidencia |
|---|---|---|
| `npx tsc --noEmit` | ✅ Sin errores | — |
| T2: sin sesión se muestra el login | ✅ | `docs/s8-login.png` |
| T2: crear cuenta inicia sesión directo (Confirm email desactivado) | ✅ Entró a GeoCam con las 3 fotos de la Semana 7 | — |
| T2: cerrar Expo Go y reabrir | ✅ Entra sin pedir login (sesión en SecureStore) | — |
| T5: "☁️ Subir a la nube" en el detalle | ✅ Cambia a "✅ Guardada en la nube" | `docs/s8-subir.png` |
| T6: fila en `public.photos` | ✅ `user_id`, `client_id` y `storage_path` correctos | `docs/s8-tabla.png` |
| T6: archivo en Storage dentro de la carpeta del usuario | ✅ `geocam/<user_id>/<client_id>.jpg`, image/jpeg, 1.3 MB | `docs/s8-storage.png` |
| C1: Sincronizar con avance y resumen | ✅ "Subiendo 1 de 1…" → "Sincronización completa – Subidas: 1 de 1" | `docs/s8-sincronizar.png`, `docs/s8-demo.gif` |
| C2: editar la nota de una foto ya subida y sincronizar | ✅ 6 filas (sin duplicado) y la nota "Prueba C2" actualizada en la nube | `docs/s8-tabla.png` |
| C3: eliminar una foto sincronizada | ✅ De 6 a 5 filas y de 6 a 5 archivos en Storage | `docs/s8-borrado.png`, `docs/s8-borrado-storage.png` |
| C4: pestaña Nube con URL firmadas | ✅ "6 foto(s) de leohv980@gmail.com en Supabase" con imágenes | `docs/s8-nube.png` |
| C4: tiempo real | ✅ Al editar la nota en Table Editor, el iPhone mostró "desde supabase" sin recargar | `docs/s8-realtime.png` |
| C5: segunda cuenta (`prueba.geocam@gmail.com`) | ✅ 0 fotos en Nube y en Fotos: no ve nada de la primera cuenta | `docs/s8-otra-cuenta.png` |
| C7: GIF de demostración | ✅ Tomar foto → Sincronizar → aparece en Nube | `docs/s8-demo.gif` |

**Observación:** la edición hecha en Supabase ("desde supabase") solo se ve en la pestaña Nube. La pestaña Fotos (SQLite) no cambia, porque la sincronización va en un solo sentido: del teléfono a la nube.

## 5. Seguridad (C6)

- `.env` está en `.gitignore` y nunca se subió: `git log --all --full-history -- .env` no devuelve nada, y `git ls-files .env` tampoco.
- En el repositorio solo está `.env.example`, sin valores reales.
- `git grep -i -E "sb_secret|service_role"` solo encuentra la línea del README que documenta esta auditoría: no hay claves secretas en el código.
- Durante el trabajo la contraseña de la base se pegó por error en el chat con la IA. Se **restableció** en Supabase → Project Settings → Database → Reset database password. La app no la usa.

### Problemas de entorno
- **Traductor de Brave:** al traducir el panel de Supabase al español la página fallaba (`removeChild`). Se resolvió dejando la página en inglés.
- **Red lenta:** `npm` daba `ENOTFOUND` y Expo Go daba "request timed out". Se resolvió reintentando después de `npm ping` y con `npx expo start --tunnel`. Las pruebas en el teléfono se hicieron al final, con mejor señal.
- **Estado "Unhealthy" en el panel de Supabase:** apareció en la página de inicio del proyecto (plan gratuito, instancia nano), pero la base, Storage y Realtime respondieron bien en todas las pruebas.