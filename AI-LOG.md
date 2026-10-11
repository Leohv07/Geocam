# Registro de Auditoría de IA (AI-LOG)

**Integrantes:** Leonardo Hernández, Julián Ortiz
**Semana:** 7
**Proyecto:** GeoCam persistente – Taller Integrador 2 (taller en clase T1–T6 + trabajo para la casa C1–C6)
**Versiones verificadas en `package.json`:** Expo SDK 57, `expo-sqlite` ~57.0.3, `expo-file-system` ~57.0.7, `drizzle-orm` 0.45.3, `drizzle-kit` 0.31.11

> El AI-LOG de la Semana 6 quedó en [`docs/AI-LOG-semana6.md`](./docs/AI-LOG-semana6.md).

## 1. Prompts Utilizados

- "Ayúdame con la Guía Semana 7 paso a paso: reemplaza el `GeoPhotosContext` de GeoCam por SQLite con Drizzle (T1–T6), con repositorio `photos`, hook `usePhotos` y migraciones generadas con drizzle-kit."
- "Haz el trabajo para la casa: tabla `albums` con `onDelete: 'set null'`, segunda migración con `note` y `favorite`, pantalla `foto/[id]`, búsqueda y filtros con `useLiveQuery` y fotos permanentes con expo-file-system."
- "No sirve el botón de marcar como favorita." → La IA encontró que las consultas de Drizzle no se ejecutaban (ver Corrección 6).
- "Me da este problema en el iPhone: Could not connect to development server." → Reiniciar `npx expo start -c` y volver a escanear el QR, o usar `--tunnel`.

## 2. Código Generado vs. Código Modificado

### Corrección 1 — Fusionar `babel.config.js` y `metro.config.js` con NativeWind
- **Qué propone la guía:** un `babel.config.js` con solo `presets: ['babel-preset-expo']` y un `metro.config.js` que exporta `config` directamente.
- **Problema:** copiarlos tal cual borra la configuración de NativeWind de la Semana 2 (`jsxImportSource: 'nativewind'`, `nativewind/babel` y `withNativeWind`), y todos los `className` dejarían de funcionar.
- **Qué modificamos:** conservamos los presets de NativeWind y solo agregamos `plugins: [['inline-import', { extensions: ['.sql'] }]]`. En Metro, `config.resolver.sourceExts.push('sql')` va **antes** de `withNativeWind`.

### Corrección 2 — TypeScript no reconocía los `.sql`
- `npx tsc --noEmit` fallaba al importar las migraciones. Agregamos `declare module "*.sql"` en `nativewind-env.d.ts`.

### Corrección 3 — Del objeto `coords` a columnas planas, y `id` numérico
- **Antes:** `GeoPhoto.coords: Coords | null` e `id: string`.
- **Ahora:** `latitude`, `longitude` y `accuracy` son columnas `real` opcionales, y `usePhotos.addPhoto` hace `coords?.latitude ?? null`. El `id` es `integer autoincrement`.

### Corrección 4 — `drizzle-kit` omitió `ON DELETE SET NULL` (C1)
- **Qué generó la herramienta:** la migración `0001` contiene `ALTER TABLE photos ADD album_id integer REFERENCES albums(id);` **sin** `ON DELETE SET NULL`, aunque el esquema dice `onDelete: 'set null'`.
- **Cómo lo detectamos:** aplicamos las dos migraciones en SQLite con `PRAGMA foreign_keys = ON`, asignamos una foto a un álbum e intentamos borrarlo. Resultado: `FOREIGN KEY constraint failed`.
- **Qué modificamos:** la guía prohíbe editar migraciones a mano, así que `albumsRepo.remove` hace el `SET NULL` en una transacción: primero `UPDATE photos SET album_id = NULL WHERE album_id = ?` y después `DELETE FROM albums`. En el iPhone, al borrar el álbum "Casa", la foto del ventilador quedó "Sin álbum" y no se borró.

### Corrección 5 — Transacción async en un driver síncrono
- **Qué generó la IA:** `await db.transaction(async (tx) => { await tx.update(...); await tx.delete(...); })`.
- **Problema:** el driver `expo-sqlite` de Drizzle es **síncrono** (`BaseSQLiteDatabase<'sync'>`). Con un callback async, el `COMMIT` ocurre antes de que se ejecute el `delete`, así que la segunda sentencia queda fuera de la transacción.
- **Qué modificamos:** callback síncrono con `.run()` en cada sentencia.

### Corrección 6 — El botón "Marcar como favorita" no hacía nada
- **Qué generó la IA:** `const setFavorite = (fav) => photosRepo.update(id, { favorite: fav })`, y la pantalla la llamaba con `void setFavorite(...)`.
- **Problema detectado al probar en el iPhone:** las consultas de Drizzle son **perezosas** y solo se ejecutan con `await`, `.then()` o `.run()`. `void` descarta el objeto sin ejecutarlo, así que no se guardaba nada. Lo mismo pasaba al mover la foto de álbum. "Guardar nota" sí funcionaba porque la pantalla usaba `await`.
- **Qué modificamos:** en `hooks/usePhoto.ts` las acciones son `async` y hacen `await photosRepo.update(...)`.

### Corrección 7 — `File.copy()` es asíncrono en SDK 57 (C5)
- **Qué propone la guía:** `source.copy(destination); return destination.uri;`, de forma síncrona.
- **Problema:** en `node_modules/expo-file-system/build/internal/NativeFileSystem.types.d.ts` del SDK 57, `copy()` devuelve `Promise<void>` (existe aparte `copySync`). Sin `await` se guardaría en SQLite una ruta que todavía no existe.
- **Qué modificamos:** `persistPhoto` es `async` y hace `await source.copy(destination)`. Además, `deletePhotoFile` solo borra archivos dentro de `documents/photos/`, para nunca tocar la galería ni la caché.

## 3. Alucinaciones o Errores Detectados

| Error típico (tabla de la guía) | ¿Apareció? | Qué usamos |
|---|---|---|
| `SQLite.openDatabase` / `tx.executeSql` | No | `openDatabaseSync` |
| `drizzle-orm/better-sqlite3` | No | `drizzle-orm/expo-sqlite` |
| `drizzle.config.ts` sin `driver: 'expo'` | No | Se genera `drizzle/migrations.js` |
| Falta `inline-import` o `sql` en Metro | No | Configurado; el bundle incluye el `CREATE TABLE` |
| `drizzle-kit push` | No | Solo `drizzle-kit generate` + `useMigrations` |
| Base sin `enableChangeListener` | No | Activado; la lista se actualiza sola |
| Llaves foráneas sin `PRAGMA foreign_keys = ON` | No | Se ejecuta al abrir la conexión |
| `FileSystem.copyAsync` mezclado con `new File()` | No | Solo la API nueva (`File`, `Directory`, `Paths`) |

Errores reales encontrados además de la tabla: `ON DELETE SET NULL` omitido por drizzle-kit (Corrección 4), transacción async (Corrección 5), consultas perezosas con `void` (Corrección 6) y `copy()` asíncrono (Corrección 7).

## 4. Verificación en dispositivo (iPhone, Expo Go SDK 57)

| Prueba | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ Sin errores |
| T6: 3 fotos → cerrar Expo Go → reabrir | ✅ "3 en el mapa" |
| C2: segunda migración sobre las fotos de la clase | ✅ Las 3 fotos siguen |
| C3: nota "Ventilador" + favorita | ✅ Se guardan y la lista se actualiza sola |
| C4: filtro ★ Favoritas | ✅ Solo aparece el ventilador |
| C1: foto en álbum "Casa" → borrar el álbum | ✅ La foto queda "Sin álbum" |
| C5: foto nueva | ✅ Aparece con su miniatura (copiada a `documents/photos/`) |
| C3: eliminar foto | ✅ Desaparece de la lista |

### Problemas de entorno
- **Login de Expo Go:** "You're signed in to Expo CLI as leohv, but not signed in to Expo Go". Se resolvió iniciando sesión en Expo Go con la misma cuenta.
- **"Could not connect to development server":** se resolvió reiniciando `npx expo start -c` y escaneando el QR nuevo.