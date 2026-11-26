import AsyncStorage from '@react-native-async-storage/async-storage';
import { ADMIN_TOKEN_KEY, ADMIN_USER_KEY, ADMIN_PREVIEW_KEY } from './admin';
import { CLAVE_USUARIO_ACTUAL } from './agendaCompartida';
import { tienePlanContratado } from './planesCliente';
import { leerRutinasCompradas } from './rutinas';

// Decide a qué pantalla va una sesión recién abierta (login) o recuperada (al reabrir la app),
// y deja en el dispositivo los datos que leen esas pantallas.
// sesion = { token, usuario } tal como lo devuelve /api/login/.
export async function destinoDeSesion(sesion) {
  const usuario = sesion?.usuario || {};
  const correo = String(usuario.correo || '').trim().toLowerCase();
  const nombre = usuario.nombre || '';

  if (usuario.tipo_usuario === 'Profesor') {
    await AsyncStorage.setItem(CLAVE_USUARIO_ACTUAL, JSON.stringify({ nombre, correo, rol: 'profesional' }));
    return '/panel_profesional';
  }

  if (usuario.tipo_usuario === 'Admin') {
    await AsyncStorage.removeItem(ADMIN_PREVIEW_KEY);
    await AsyncStorage.multiSet([
      [ADMIN_TOKEN_KEY, sesion.token],                    // lo usa apiAdmin() en el panel
      [ADMIN_USER_KEY, JSON.stringify(usuario)],
      [CLAVE_USUARIO_ACTUAL, JSON.stringify({ nombre, correo, rol: 'administrador' })],
    ]);
    return '/admin';
  }

  await AsyncStorage.setItem(CLAVE_USUARIO_ACTUAL, JSON.stringify({ nombre, correo }));

  // La cuenta cliente solo entra a Inicio después de tener un plan o una rutina comprada.
  const [tienePlan, rutinasCompradas] = await Promise.all([
    tienePlanContratado(correo),
    leerRutinasCompradas(correo),
  ]);
  return tienePlan || rutinasCompradas.length > 0 ? '/home' : '/elige_inicio';
}
