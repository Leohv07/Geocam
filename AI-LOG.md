# Registro de Auditoría de IA (AI-LOG)

**Integrantes:** Leonardo Hernández, Julián Ortiz
**Semana:** 9
**Proyecto:** GeoCam sincronizada — TanStack Query y sincronización offline-first (taller en clase T1–T7 + trabajo para la casa C1–C7)
**Herramienta:** Claude Code (Claude Opus 5.5)
**Versiones verificadas en `package.json` / `node_modules`:** Expo SDK 57, `@tanstack/react-query` 5.107.1, `@tanstack/react-query-persist-client` 5.107.1, `@tanstack/query-async-storage-persister` 5.107.1, `expo-network` 57.0.3, `drizzle-orm` 0.45, `drizzle-kit` 0.31

> Los AI-LOG anteriores están en [`docs/AI-LOG-semana6.md`](./docs/AI-LOG-semana6.md), [`docs/AI-LOG-semana7.md`](./docs/AI-LOG-semana7.md) y [`docs/AI-LOG-semana8.md`](./docs/AI-LOG-semana8.md).

## 1. Prompts Utilizados

- "Lee la guía de la Semana 9 y los proyectos de referencia `s9-geocam-sync` y `s9-muro-tanstack`, compáralos con mi código y dame un plan corto antes de cambiar nada. Adapta los cambios a mi proyecto, no lo reemplaces: mantén login, `Stack.Protected`, `owner_id` por usuario (C5), subida sin duplicados (C2), borrado coherente (C3) y la pestaña Nube."
- "Cuando una foto baja de la nube y no existe en este teléfono, descarga también la imagen con URL firmada a `documents/photos/` y guarda esa ruta en `uri`. Si la descarga falla, que no rompa la sincronización y se reintente en el siguiente ciclo."
- "Deja un botón 'Sincronizar ahora' en la pestaña Fotos además del indicador, y que el indicador lleve a `app/sincronizacion.tsx`."
- "Avísame antes de correr la migración de SQLite."

## 2. Código Generado vs. Código Modificado

### Adaptación 1 — El proyecto de referencia no filtra por usuario
- **Qué trae la referencia:** `listPending()`, `findByClientId()` e `insertFromRemote()` sin dueño, y un esquema que importa `expo-crypto`.
- **Qué hicimos:** todas las funciones nuevas del repositorio reciben `ownerId` (C5 de la Semana 8). `insertFromRemote` guarda el dueño de la sesión, y el cursor de bajada y el último resultado se guardan por usuario (`lastPulledAt:<userId>`). `db/schema.ts` sigue sin imports de Expo (el UUID se genera en el repositorio), así que `drizzle-kit generate` funcionó a la primera.

### Adaptación 2 — La política de UPDATE de la guía ya existía
- **Qué propone la guía (T1):** `create policy "editar las mías" ... for update`.
- **Problema:** en la Semana 8 ya habíamos creado "actualizar las mías" para la re-sincronización (C2). Crearla otra vez deja dos políticas iguales con distinto nombre.
- **Qué hicimos:** `supabase/semana9.sql` no la crea. Además usamos `if not exists` / `drop trigger if exists` para que se pueda ejecutar dos veces sin error.

### Adaptación 3 — Subida del archivo: `upsert: true` en vez de ignorar "already exists"
- **Qué trae la guía:** `upload(...)` y, si el error dice `exists`, se ignora.
- **Qué hicimos:** mantuvimos lo de la Semana 8: `upload(..., { upsert: true })` (ya teníamos la política de update en `storage.objects`). Si el `upsert` de la fila falla justo después de subir el archivo, se borra el archivo (C2: sin archivos huérfanos).

### Adaptación 4 — Borrado lógico (C1) y "resucitar" una foto
- **Qué trae la referencia:** nada. Solo cubre el taller, y `remove()` es un DELETE directo.
- **Qué hicimos:** `markDeleted()` pone `deletedAt` y `updatedAt`; todas las consultas de la UI filtran `deletedAt IS NULL`, pero `pendingQuery` sí incluye las marcas. Revisamos dos casos que no estaban en la guía:
  - Si llega de la nube una edición **más nueva** que mi borrado local, `applyRemote` pone `deletedAt = null` (si no, la foto quedaba oculta y además "sincronizada" para siempre).
  - Si mi edición local es **más nueva** que un borrado remoto, el archivo del bucket ya no existe: `clearRemotePath()` hace que `push` lo vuelva a subir.

### Adaptación 5 — La descarga de la imagen no puede romper la bajada
- **Qué trae la referencia:** `downloadPhotoFile()` dentro de `pull`. Si la descarga falla, `pull` lanza el error y la fila queda bloqueando el cursor.
- **Qué hicimos:** `pull` inserta la fila con `uri = ''` y avanza el cursor. Un paso aparte, `downloadMissing()`, descarga todas las fotos con `uri` vacía usando URL firmadas en lote, y cada fallo queda en la lista de errores del ciclo. La UI muestra ⬇️ mientras tanto. El archivo se llama `<clientId>.jpg`: repetir la descarga no duplica archivos.

### Adaptación 6 — `useSync` montado en varias pantallas
- **Riesgo:** con `staleTime: 0`, cada pantalla que monta `useSync` (pestañas, indicador, pantalla de estado) dispararía un ciclo nuevo.
- **Qué hicimos:** `refetchOnMount: false` y `gcTime: 0`. Se sincroniza al abrir la app (primer observador), al reconectar, al volver a primer plano y con `requestSync()` después de cada cambio local. Además, `syncAll` reutiliza el ciclo en curso.

### Adaptación 7 — Persistir solo la Nube (C3)
- **Qué hicimos:** `shouldDehydrateQuery` guarda solo las consultas `['cloud', ...]`. La de sincronización nunca se persiste: si se guardara, al abrir la app se mostraría un resultado viejo. La llave incluye el `userId` y `signOut()` llama a `queryClient.clear()`, para que otra cuenta en el mismo teléfono no vea la caché anterior. Para no agregar un módulo nativo nuevo usamos `expo-sqlite/kv-store`, que tiene la API de AsyncStorage.

## 3. Alucinaciones o Errores Detectados

- **Firma de TanStack Query v3/v4:** revisamos que todo use la forma de objeto de la v5 (`useQuery({ queryKey, queryFn })`, `gcTime` y no `cacheTime`, `status === 'pending'` y no `'loading'`, `initialPageParam` declarado en `useInfiniteQuery`, sin `onSuccess` dentro de `useQuery`). `npx tsc --noEmit` pasa sin errores.
- **Conflicto de dependencias al instalar:** `npm install` falló con `ERESOLVE` porque npm intentaba instalar `react-dom@19.3.1`, que exige una versión de React más nueva que la del SDK (19.2.3). Lo resolvimos igual que el proyecto de referencia `s9-geocam-sync`: `.npmrc` con `legacy-peer-deps=true`.
- **`window.addEventListener('online')`:** no se usa. La red llega a TanStack Query con `onlineManager.setEventListener` + `expo-network`, y el foco con `focusManager` + `AppState`.

## 4. Verificación

- `npx tsc --noEmit`: sin errores.
- Migración `drizzle/0004_semana9_sync.sql` generada con `npm run db:generate -- --name semana9_sync` (sin editar a mano): `CREATE TABLE sync_meta` + `ALTER TABLE photos ADD deleted_at`.
- Las pruebas en el iPhone y en el segundo teléfono están en la matriz C6 del README. **Los resultados se anotan después de ejecutarlas.**
