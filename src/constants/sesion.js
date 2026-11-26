import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Llave donde guardamos al usuario que inició sesión
const LLAVE_SESION = 'usuario_sesion';

// Llamar después de un login exitoso.
// usuario = { nombre: 'Angie', rol: 'cliente' | 'profesional', token: '...' }
export async function guardarSesion(usuario) {
  await AsyncStorage.setItem(LLAVE_SESION, JSON.stringify(usuario));
}

// Devuelve el usuario guardado o null si no hay sesión
export async function obtenerSesion() {
  const datos = await AsyncStorage.getItem(LLAVE_SESION);
  return datos ? JSON.parse(datos) : null;
}

// Llamar al cerrar sesión (por ejemplo desde /configuracion)
export async function cerrarSesion() {
  await AsyncStorage.removeItem(LLAVE_SESION);
}

// Hook para usar en cualquier pantalla: const { usuario, cargando } = useSesion();
export function useSesion() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerSesion()
      .then(setUsuario)
      .finally(() => setCargando(false));
  }, []);

  return { usuario, cargando };
}
