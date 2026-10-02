# Registro de Auditoría de IA (AI-LOG)

**Integrantes:** Leonardo Hernández, Julián Ortiz
**Semana:** 6
**Proyecto:** GeoCam – Taller Integrador 2
**SDK de Expo verificado:** 57 (campo `expo` en `package.json`)

## 1. Prompts Utilizados

- "Genera el proyecto completo de la Guía Semana 6 (GeoCam): hooks `useGeoLocation`, `useCamera` y `useShake`, `GeoPhotosContext`, las pestañas GeoCam y Mapa, README y AI-LOG, con Expo Router, NativeWind y TypeScript sin `any`."
- "Escribe un Custom Hook en React Native con TypeScript que detecte cuando el usuario agita el teléfono usando expo-sensors, con umbral configurable, cooldown y limpieza con bandera `cancelled`."
- "Me da este problema cuando entro en mi iPhone: You need to be signed in to Expo Go and Expo CLI." → Solución: `npx expo login` en el PC e iniciar sesión con la misma cuenta en Expo Go.
- "¿Qué falta por hacer en el proyecto?" → checklist de pruebas y evidencias por requisito.

## 2. Código Generado vs. Código Modificado

### Corrección 1 — El cleanup no se ejecutaba al cambiar de pestaña
- **¿Qué generó la IA?** El código de la guía usa `useGeoLocation({ watch: true })`. Con ese valor el GPS solo se detiene cuando el componente se desmonta.
- **Problema:** Expo Router **no desmonta** las pestañas al cambiar de tab. Por eso el GPS, el acelerómetro y la cámara seguían activos en la pestaña Mapa, y el requisito "sal de la pestaña y confirma con un log que el GPS se detiene" no se cumplía.
- **¿Qué modifiqué/corregí?** Usé `useIsFocused()` de `expo-router` y pasé `watch: isFocused`, `enabled: isFocused` (useShake), `useLevel(isFocused)` y `<CameraView active={isFocused} />`. Ahora el log `[useGeoLocation] cleanup: GPS detenido` aparece al salir de la pestaña.

### Corrección 2 — El permiso no se actualizaba al volver de Ajustes
- **¿Qué generó la IA?** Hooks que consultan el permiso solo al montar.
- **Problema:** después de "Abrir Ajustes" y activar el permiso, la app seguía mostrando *blocked* hasta reiniciarse.
- **¿Qué modifiqué/corregí?** Agregué un listener de `AppState`. Cuando la app vuelve a estar `active`, se **re-consulta** el permiso con `getForegroundPermissionsAsync()` y con el tercer valor de `useCameraPermissions()`, sin volver a pedirlo.

### Corrección 3 — useShake
- Agregué `setUpdateInterval(100)`, un cooldown de 1500 ms y la verificación con `isAvailableAsync`.
- Guardé el callback en una `ref` para no reiniciar la suscripción en cada render.
- Agregué la opción `enabled` para pausar el sensor fuera de foco.

### Corrección 4 — ids duplicados
- `String(Date.now())` puede repetirse si se importan dos fotos en el mismo milisegundo. Lo reemplacé por `createPhotoId()`, que añade un sufijo aleatorio.

## 3. Alucinaciones o Errores Detectados

| La IA / el material propuso | Problema detectado | Corrección aplicada |
|---|---|---|
| `import { Tabs } from 'expo-router'` | En el SDK 57 está marcado `@deprecated` (lo confirmé en `node_modules/expo-router/build/exports.d.ts`) | `import { Tabs } from 'expo-router/js-tabs'` |
| `mediaTypes: ImagePicker.MediaTypeOptions.Images` | Opción obsoleta | `mediaTypes: ['images']` |
| `import { Camera } from 'expo-camera'` + `Camera.requestCameraPermissionsAsync()` | API antigua | `CameraView` + `useCameraPermissions()` |
| `npm install expo-camera` | Puede instalar una versión incompatible con el SDK | `npx expo install expo-camera` |
| Leer el nivel con `Gyroscope` | Mide rad/s; integrarlo produce deriva | Ángulo calculado desde la gravedad con `Accelerometer` (`atan2(x, -y)`) |

## 4. Reto EXIF: qué devolvió cada plataforma

Las claves se imprimen en la terminal con `[EXIF] claves GPS:` al importar una foto.

| Plataforma | Claves GPS recibidas | Formato |
|---|---|---|
| iOS (captura de pantalla) | Sin claves GPS: las capturas de pantalla no guardan ubicación | La tarjeta no mostró "coords EXIF"; se usó la ubicación actual (11.54145, -72.91144) |
| iOS (foto de la app Cámara) | No probado. Esperado: `{GPS}.Latitude`, `{GPS}.LatitudeRef`, `{GPS}.Longitude`, `{GPS}.LongitudeRef` | Decimal positivo + referencia N/S/E/W; el código vuelve negativa la longitud con `W` |
| Android | No probado | Según la documentación: `GPSLatitude` como racional `"11/1,32/1,3840/100"`; `lib/exif.ts` soporta ambos formatos |

## 5. Pruebas realizadas en dispositivo (iPhone, Expo Go SDK 57)

| Prueba | Resultado |
|---|---|
| La app no pide permisos al abrirse | ✅ Solo al tocar "Permitir acceso" |
| GPS en vivo | ✅ 11.54145, -72.91145 ±17 m (Riohacha) |
| Limpieza del GPS al cambiar de pestaña | ✅ Logs `GPS iniciado` / `cleanup: GPS detenido` |
| R1 + R3: foto de cámara en el mapa | ✅ Marcador verde con tarjeta |
| R2: importar de galería | ✅ Marcador azul con etiqueta GALERÍA |
| R4: agitar | ✅ Alert "Se eliminarán 2 foto(s)", y al borrar el mapa queda vacío |
| Agitar en la pestaña Mapa | ✅ No dispara el Alert: `useShake` está desactivado fuera de foco (solo se abre el menú de Expo Go) |

### Problema encontrado durante las pruebas
- **Conflicto de gesto:** en Expo Go, agitar el teléfono también abre el menú de desarrollo. En un build de producción ese menú no existe, así que el conflicto solo ocurre en desarrollo.
- **Login obligatorio en iOS:** Expo Go en iPhone exigió iniciar sesión con la misma cuenta en la CLI (`npx expo login`) y en la app.
