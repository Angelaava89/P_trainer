import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Dónde está Django. Orden de prioridad:
// 1) EXPO_PUBLIC_API_URL en el archivo .env de la raíz (ver .env.example)
// 2) la IP del PC donde corre Expo — así el teléfono y el emulador llegan solos
// 3) 10.0.2.2 (el "localhost del PC" visto desde el emulador de Android)
function urlBase() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) {
    return `http://${host}:8000`;
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

export const API_URL = urlBase();

// El token de sesión que devuelve Django al registrarse o iniciar sesión
let token = null;

// Clave de AsyncStorage donde AuthContext guarda { token, usuario } para no perder
// la sesión al cerrar y volver a abrir la app.
export const CLAVE_SESION = 'ptrainer_sesion';

export function setToken(nuevoToken) {
  token = nuevoToken;
}

// AuthContext registra aquí cómo cerrar la sesión; se llama cuando Django responde 401
// (token vencido o cuenta eliminada) o cuando el panel admin cierra sesión.
let alCerrarSesion = null;

export function registrarCierreSesion(funcion) {
  alCerrarSesion = funcion;
}

export function notificarCierreSesion() {
  if (alCerrarSesion) alCerrarSesion();
}

// Django manda { detail: "..." } o { campo: ["..."] } — de ahí sale el texto para mostrar
function mensajeDeError(datos) {
  if (!datos) return 'El servidor respondió con un error.';
  if (typeof datos.detail === 'string') return datos.detail;
  if (typeof datos.mensaje === 'string') return datos.mensaje;
  // Busca el primer texto aunque venga anidado y antepone el campo:
  // { datos: { altura: ["Este campo es requerido."] } } -> "datos › altura: Este campo es requerido."
  const ruta = [];
  let valor = datos;
  while (valor && typeof valor === 'object') {
    if (Array.isArray(valor)) {
      valor = valor[0];
    } else {
      const [campo, siguiente] = Object.entries(valor)[0] ?? [];
      if (campo && campo !== 'non_field_errors') ruta.push(campo);
      valor = siguiente;
    }
  }
  if (!valor) return 'El servidor respondió con un error.';
  return ruta.length ? `${ruta.join(' › ')}: ${valor}` : String(valor);
}

// Uso: await api('/peso/')  ·  await api('/peso/', { method: 'POST', body: { kg: 77.2 } })
export async function api(ruta, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  // si el servidor no contesta en 15 s se corta, para que la pantalla no quede colgada
  const controller = new AbortController();
  const temporizador = setTimeout(() => controller.abort(), 15000);

  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/api${ruta}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new Error(`No se pudo conectar con el servidor (${API_URL}). Revisa que Django esté corriendo.`);
  } finally {
    clearTimeout(temporizador);
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    // Token vencido o inválido: se cierra la sesión guardada (el login devuelve 401 por
    // contraseña incorrecta, así que ahí no se cierra nada).
    if (respuesta.status === 401 && token && ruta !== '/login/') notificarCierreSesion();
    const error = new Error(mensajeDeError(datos));
    error.status = respuesta.status;
    throw error;
  }
  return datos;
}
