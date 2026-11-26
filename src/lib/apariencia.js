import { useEffect, useState } from 'react';
import { api } from '../api/client';

// Fondos y video que el admin eligió en "Apariencia" (colección multimedia, ruta pública GET /apariencia/).
// Se pide una sola vez y se comparte entre todas las pantallas; se vuelve a pedir pasado 1 minuto.
// Si el servidor no responde, la app sigue con sus fondos y video originales.

// Cada imagen de fondo de la app con su clave (la misma que usa la pantalla Apariencia del admin).
const FONDOS = {
  fondo_login: require('../../assets/images/fondos/fondo_login.jpg'),
  fondo_bienvenido: require('../../assets/images/fondos/fondo_bienvenido.jpg'),
  fondo_registro: require('../../assets/images/fondos/fondo_registro.jpg'),
  fondo_metricas: require('../../assets/images/fondos/fondo_metricas.jpg'),
  fondo_progreso: require('../../assets/images/fondos/fondo_progreso.jpg'),
  fondo_rutina: require('../../assets/images/fondos/fondo_rutina.jpg'),
  fondo_perfil: require('../../assets/images/fondos/fondo_perfil.jpg'),
  fondo_clientes: require('../../assets/images/fondos/fondo_clientes.jpg'),
  fondo_panel_profesional: require('../../assets/images/fondos/fondo_panel_profesional.jpg'),
  fondo_perfil_profesional: require('../../assets/images/fondos/fondo_perfil_profesional.jpg'),
};

// require(...) devuelve siempre el mismo valor para el mismo archivo, así se sabe qué fondo usa cada pantalla.
export function claveDeFondo(imagen) {
  return Object.keys(FONDOS).find((clave) => FONDOS[clave] === imagen) || null;
}

const VIGENCIA_MS = 60 * 1000;
let actual = { video: null, fondos: {} };
let pedidoEn = 0;
let enCurso = null;
const oyentes = new Set();

export async function cargarApariencia(forzar = false) {
  if (enCurso) return enCurso;
  if (!forzar && Date.now() - pedidoEn < VIGENCIA_MS) return actual;
  enCurso = (async () => {
    try {
      const datos = await api('/apariencia/');
      actual = { video: datos?.video || null, fondos: datos?.fondos || {} };
      oyentes.forEach((avisar) => avisar(actual));
    } catch {
      // Sin conexión o sin la ruta: se mantienen los originales.
    } finally {
      pedidoEn = Date.now();
      enCurso = null;
    }
    return actual;
  })();
  return enCurso;
}

export function useApariencia() {
  const [estado, setEstado] = useState(actual);
  useEffect(() => {
    oyentes.add(setEstado);
    setEstado(actual);
    cargarApariencia();
    return () => { oyentes.delete(setEstado); };
  }, []);
  return estado;
}
