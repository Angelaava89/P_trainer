import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const carpetaVideos = () =>
  new Directory(Paths.document, 'videos-ejercicios');

const MAX_BYTES = 50 * 1024 * 1024;

export async function seleccionarVideo() {
  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsMultipleSelection: false,
    allowsEditing: false,
  });

  if (resultado.canceled) return null;

  const video = resultado.assets?.[0];

  if (!video?.uri) {
    throw new Error('No se pudo obtener el video seleccionado.');
  }

  if (video.fileSize && video.fileSize > MAX_BYTES) {
    throw new Error('Selecciona un video de hasta 50 MB.');
  }

  return video;
}

export async function guardarVideoLocal(video) {
  const carpeta = carpetaVideos();

  await carpeta.create({
    intermediates: true,
    idempotent: true,
  });

  // Conservamos la extensión: cambiarla no convierte el video.
  const origenNombre = video.fileName || video.uri.split('?')[0];
  const extension =
    origenNombre.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();

  if (!extension) {
    throw new Error('No se pudo reconocer la extensión del video.');
  }

  const nombre =
    `video-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` +
    `.${extension}`;

  const origen = new File(video.uri);
  const destino = new File(carpeta, nombre);

  try {
    await origen.copy(destino);

    // Verificamos también el archivo copiado.
    if (!destino.exists || !destino.size) {
      throw new Error('El video está vacío o no se pudo copiar.');
    }

    if (destino.size > MAX_BYTES) {
      throw new Error('Selecciona un video de hasta 50 MB.');
    }

    return nombre;
  } catch (error) {
    if (destino.exists) {
      await destino.delete().catch(() => {});
    }
    throw error;
  }
}

export function obtenerUriVideoLocal(nombre) {
  if (!nombre) return null;

  const archivo = new File(carpetaVideos(), nombre);

  return archivo.exists ? archivo.uri : null;
}

// Elimina el archivo local cuando el entrenador borra su ficha de video.
export async function eliminarVideoLocal(nombre) {
  if (!nombre) return;

  const archivo = new File(carpetaVideos(), nombre);
  if (archivo.exists) await archivo.delete();
}
