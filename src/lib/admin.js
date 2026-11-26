import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, api, notificarCierreSesion, setToken } from '../api/client';

// Claves separadas de la sesión cliente para que el token de administrador no se mezcle con ella.
export const ADMIN_TOKEN_KEY = 'ptrainer_admin_token';
export const ADMIN_USER_KEY = 'ptrainer_admin_usuario';
export const ADMIN_PREVIEW_KEY = 'ptrainer_admin_vista_previa';

// Datos vacíos para navegar el diseño durante la vista previa; no representan métricas reales.
const RESUMEN_VACIO = {
  usuarios_total: 0,
  clientes: 0,
  profesionales: 0,
  administradores: 0,
  clientes_con_plan: 0,
  rutinas_vendidas: null,
  rutinas_vendidas_disponible: false,
  planes_basicos: 0,
  planes_avanzados: 0,
  nuevos_30_dias: 0,
  pagos_integrados: false,
  usuarios_recientes: [],
};

export async function activarVistaPreviaAdmin() {
  // Al entrar a la demo se borra el token en memoria y se marca la vista previa en el dispositivo.
  setToken(null);
  await AsyncStorage.setItem(ADMIN_PREVIEW_KEY, '1');
}

// opciones (opcional): { method, body } para agregar (POST), editar (PATCH) o borrar (DELETE).
export async function apiAdmin(ruta, opciones) {
  const vistaPrevia = await AsyncStorage.getItem(ADMIN_PREVIEW_KEY);
  // En vista previa solo se permiten respuestas locales conocidas, sin llamadas privadas al backend.
  if (vistaPrevia === '1') {
    if (ruta === '/admin/resumen/') return RESUMEN_VACIO;
    if (ruta === '/admin/usuarios/') return { total: 0, limite: 100, usuarios: [] };
    if (ruta === '/admin/rutinas-predeterminadas/') return { total: 0, rutinas: [] };
    if (ruta === '/admin/ejercicios/') return [];
    if (['POST', 'PATCH', 'DELETE'].includes(opciones?.method)) return opciones.body || {};
  }

  // Fuera de la vista previa, cada ruta administrativa debe llevar el token real.
  const token = await AsyncStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) {
    setToken(null);
    const error = new Error('Inicia sesión con una cuenta administradora.');
    error.status = 401;
    throw error;
  }

  setToken(token);
  return opciones ? api(ruta, opciones) : api(ruta);
}

// Sube un archivo (imagen o video) con FormData: { campos } + "archivo".
// archivo: el asset que entrega expo-image-picker ({ uri, fileName, mimeType, file? }).
export async function subirArchivoAdmin(ruta, campos, archivo) {
  const vistaPrevia = await AsyncStorage.getItem(ADMIN_PREVIEW_KEY);
  if (vistaPrevia === '1') return { url: archivo?.uri };

  const token = await AsyncStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) {
    const error = new Error('Inicia sesión con una cuenta administradora.');
    error.status = 401;
    throw error;
  }

  const formulario = new FormData();
  Object.entries(campos || {}).forEach(([clave, valor]) => formulario.append(clave, String(valor)));
  const nombre = archivo.fileName || archivo.uri.split('/').pop() || 'archivo';
  const tipo = archivo.mimeType || (archivo.type === 'video' ? 'video/mp4' : 'image/jpeg');
  // En web el selector entrega un File real; en el teléfono se envía { uri, name, type }.
  if (archivo.file) formulario.append('archivo', archivo.file, nombre);
  else formulario.append('archivo', { uri: archivo.uri, name: nombre, type: tipo });

  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/api${ruta}`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: formulario,
    });
  } catch {
    throw new Error(`No se pudo conectar con el servidor (${API_URL}).`);
  }
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const error = new Error(datos?.mensaje || datos?.detail || 'El servidor respondió con un error.');
    error.status = respuesta.status;
    throw error;
  }
  return datos;
}

export async function cerrarSesionAdmin() {
  // Devuelve si se estaba en demo para salir al inicio en vez de volver al formulario de acceso.
  const vistaPrevia = await AsyncStorage.getItem(ADMIN_PREVIEW_KEY);
  setToken(null);
  await AsyncStorage.multiRemove([ADMIN_TOKEN_KEY, ADMIN_USER_KEY, ADMIN_PREVIEW_KEY]);
  // También se borra la sesión guardada por AuthContext, para que no se recupere al reabrir la app.
  notificarCierreSesion();
  return vistaPrevia === '1';
}
