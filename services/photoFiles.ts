// services/photoFiles.ts — C5: fotos permanentes en la carpeta de documentos
// API nueva de expo-file-system (SDK 57): clases File, Directory y Paths. No se mezcla con la API legacy.
import { Directory, File, Paths } from 'expo-file-system';

const photosDir = new Directory(Paths.document, 'photos');

/** Copia la foto desde la caché a documents/photos y devuelve la nueva URI. */
export async function persistPhoto(cacheUri: string): Promise<string> {
  if (!photosDir.exists) photosDir.create({ intermediates: true, idempotent: true });
  const source = new File(cacheUri);
  const ext = source.extension || '.jpg';
  const destination = new File(photosDir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  // En SDK 57 copy() es asíncrono: sin await se guardaría la ruta antes de que exista el archivo
  await source.copy(destination);
  return destination.uri;
}

/** Borra el archivo solo si está dentro de documents/photos (nunca toca la galería del usuario). */
export function deletePhotoFile(uri: string): void {
  if (!uri || !uri.startsWith(photosDir.uri)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}

/**
 * Semana 9: descarga a documents/photos el archivo de una foto que vino de la nube,
 * para que se vea sin conexión. El nombre es el clientId: repetir la descarga no duplica archivos.
 */
export async function downloadPhotoFile(url: string, clientId: string): Promise<string> {
  if (!photosDir.exists) photosDir.create({ intermediates: true, idempotent: true });
  const destination = new File(photosDir, `${clientId}.jpg`);
  if (destination.exists) {
    if (destination.size > 0) return destination.uri;
    destination.delete(); // restos de un intento anterior que se cortó
  }
  const file = await File.downloadFileAsync(url, destination);
  return file.uri;
}