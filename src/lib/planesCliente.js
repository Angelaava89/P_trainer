import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { plans } from '../constants/index';
import { api } from '../api/client';
import { CLAVE_USUARIO_ACTUAL } from './agendaCompartida';
import { leerRutinasCompradas } from './rutinas';

// Esta clave conserva el plan de cada correo en el almacenamiento local del dispositivo.
export const CLAVE_PLANES_CONTRATADOS = 'ptrainer_planes_contratados';

// Normaliza el correo para que mayúsculas o espacios no separen una misma cuenta.
function normalizarCorreo(correo) {
  return String(correo || '').trim().toLowerCase();
}

// Devuelve el correo de la cuenta de cliente que tiene sesión en el dispositivo.
async function leerCorreoActual() {
  const guardado = await AsyncStorage.getItem(CLAVE_USUARIO_ACTUAL);
  const usuario = JSON.parse(guardado || '{}');
  return normalizarCorreo(usuario.correo || usuario.email);
}

// Guarda el plan en el arreglo plan[] del servidor y conserva la selección local para mostrar la interfaz correcta.
// Si el servidor tiene los pagos simulados desactivados (COMPRAS_SIMULADAS en settings.py),
// responde 403 con el motivo y ese mensaje es el que ve el cliente.
export async function guardarPlanContratado(planId) {
  const planValido = plans.some((plan) => plan.id === planId);

  if (!planValido) {
    throw new Error('El plan seleccionado no existe.');
  }

  const correo = await leerCorreoActual();

  if (!correo) {
    throw new Error(
      'No se encontró el correo de la cuenta activa.'
    );
  }

  // El servidor valida el nivel y añade el contrato al usuario autenticado antes de actualizar la caché local.
  const respuesta = await api('/planes/', {
    method: 'POST',
    body: { planId },
  });
  if (!respuesta?.plan) throw new Error('El servidor no confirmó el registro del plan.');

  const guardados = await AsyncStorage.getItem(CLAVE_PLANES_CONTRATADOS);

  const planes = JSON.parse(guardados || '{}');

  const mapaValido =
    planes &&
    typeof planes === 'object' &&
    !Array.isArray(planes)
      ? planes
      : {};

  await AsyncStorage.setItem(
    CLAVE_PLANES_CONTRATADOS,
    JSON.stringify({
      ...mapaValido,
      [correo]: planId,
    })
  );

  return respuesta.plan;
}

//nuevo
export async function quitarPlanContratadoDePrueba() {
  if (!__DEV__) {
    throw new Error(
      'Esta opción solo está disponible en desarrollo.'
    );
  }

  const correo = await leerCorreoActual();

  if (!correo) {
    throw new Error(
      'No se encontró el correo de la cuenta activa.'
    );
  }

  const guardados = await AsyncStorage.getItem(
    CLAVE_PLANES_CONTRATADOS
  );

  const planes = JSON.parse(guardados || '{}');

  const mapaValido =
    planes &&
    typeof planes === 'object' &&
    !Array.isArray(planes)
      ? { ...planes }
      : {};

  delete mapaValido[correo];

  await AsyncStorage.setItem(
    CLAVE_PLANES_CONTRATADOS,
    JSON.stringify(mapaValido)
  );
}

// Busca el plan de una cuenta sin compartirlo con otras cuentas del mismo dispositivo.
async function leerPlanPorCorreo(correo) {
  if (!correo) return null;

  const guardados = await AsyncStorage.getItem(CLAVE_PLANES_CONTRATADOS);
  const planes = JSON.parse(guardados || '{}');
  if (!planes || typeof planes !== 'object' || Array.isArray(planes)) return null;
  return planes[normalizarCorreo(correo)] || null;
}

// Guarda en este dispositivo el nivel que la interfaz usa para mostrar las secciones del plan.
async function guardarPlanLocal(correo, planId) {
  const guardados = await AsyncStorage.getItem(CLAVE_PLANES_CONTRATADOS);
  const planes = JSON.parse(guardados || '{}');
  const mapaValido = planes && typeof planes === 'object' && !Array.isArray(planes) ? planes : {};

  await AsyncStorage.setItem(
    CLAVE_PLANES_CONTRATADOS,
    JSON.stringify({ ...mapaValido, [normalizarCorreo(correo)]: planId })
  );
}

// Elimina una selección local que ya no corresponde a un plan ofrecido.
async function eliminarPlanLocal(correo) {
  const guardados = await AsyncStorage.getItem(CLAVE_PLANES_CONTRATADOS);
  const planes = JSON.parse(guardados || '{}');
  const mapaValido = planes && typeof planes === 'object' && !Array.isArray(planes) ? { ...planes } : {};
  delete mapaValido[normalizarCorreo(correo)];
  await AsyncStorage.setItem(CLAVE_PLANES_CONTRATADOS, JSON.stringify(mapaValido));
}

// Traduce el contrato guardado en Mongo al identificador que ocupa la interfaz.
function obtenerIdPlan(contrato) {
  const texto = `${contrato?.idPlan || ''} ${contrato?.nombre || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (texto.includes('avanz')) return 'avanzado';
  if (texto.includes('inicial') || texto.includes('basico') || texto.includes('principiante')) return 'inicial';
  return null;
}

// Lee del servidor el plan activo de la cuenta y actualiza la copia local.
// Devuelve 'inicial', 'avanzado' o null. Lanza el error si no hay conexión.
async function planActivoDelServidor(correoCuenta) {
  const respuesta = await api('/planes/');
  const contratos = Array.isArray(respuesta) ? respuesta : [];
  // El historial guarda los contratos en orden; el último activo es el vigente.
  const contratoActivo = [...contratos].reverse().find(
    (contrato) => String(contrato?.vigencia || '').toLowerCase() === 'activo'
  );
  const idPlan = contratoActivo ? obtenerIdPlan(contratoActivo) : null;

  if (idPlan) await guardarPlanLocal(correoCuenta, idPlan);
  else await eliminarPlanLocal(correoCuenta);
  return idPlan;
}

// Comprueba el plan en Mongo, que es la fuente de verdad.
// Antes, si el servidor no tenía un plan activo pero la copia local sí, la app lo volvía a
// contratar con POST /planes/ (reactivando planes vencidos). Ahora la copia local solo se usa
// para mostrar la interfaz cuando no hay conexión.
export async function tienePlanContratado(correo) {
  const correoCuenta = normalizarCorreo(correo || await leerCorreoActual());
  if (!correoCuenta) return false;

  try {
    return Boolean(await planActivoDelServidor(correoCuenta));
  } catch (error) {
    const planLocal = await leerPlanPorCorreo(correoCuenta).catch(() => null);
    return plans.some((plan) => plan.id === planLocal);
  }
}

// Busca el plan de la cuenta actualmente guardada en el dispositivo.
async function leerPlanContratado() {
  return leerPlanPorCorreo(await leerCorreoActual());
}

// Mantiene las pantallas sincronizadas con el plan local al enfocarse cada sección.
export function usePlanContratado() {
  const [planId, setPlanId] = useState(null);
  const [cargandoPlan, setCargandoPlan] = useState(true);

  useFocusEffect(useCallback(() => {
    let activa = true;
    const cargarPlan = async () => {
      setCargandoPlan(true);
      try {
        // Primero la copia local (respuesta inmediata) y después el servidor, para que un
        // plan asignado o vencido desde el panel se vea sin tener que volver a iniciar sesión.
        const planGuardado = await leerPlanContratado();
        if (activa) setPlanId(planGuardado);
        const correo = await leerCorreoActual();
        if (correo) {
          const planServidor = await planActivoDelServidor(correo);
          if (activa) setPlanId(planServidor);
        }
      } catch (error) {
        // Sin conexión se mantiene lo que había en el dispositivo.
      } finally {
        if (activa) setCargandoPlan(false);
      }
    };

    cargarPlan();
    return () => { activa = false; };
  }, []));

  return { planId, esPlanBasico: planId === 'inicial', cargandoPlan };
}

// Recupera las compras de la cuenta activa cuando la pantalla obtiene el foco.
export function useRutinasCompradas() {
  const [rutinasCompradas, setRutinasCompradas] = useState([]);
  const [cargandoRutinas, setCargandoRutinas] = useState(true);

  useFocusEffect(useCallback(() => {
    let activa = true;
    setCargandoRutinas(true);

    leerRutinasCompradas()
      .then((ids) => { if (activa) setRutinasCompradas(ids); })
      .catch(() => { if (activa) setRutinasCompradas([]); })
      .finally(() => { if (activa) setCargandoRutinas(false); });

    return () => { activa = false; };
  }, []));

  return {
    rutinasCompradas,
    tieneRutinasCompradas: rutinasCompradas.length > 0,
    cargandoRutinas,
  };
}
