import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLAVE_USUARIO_ACTUAL } from './agendaCompartida';
import { api } from '../api/client';
import { rutinaCatalogoParaCliente } from './rutinasPredeterminadas';

// Claves compartidas para que la biblioteca, la edición y las asignaciones lean los mismos datos.
export const CLAVE_RUTINAS = 'ptrainer_rutinas_coach';
export const CLAVE_EJERCICIOS = 'ptrainer_ejercicios_coach';
export const CLAVE_ASIGNACIONES = 'ptrainer_asignaciones_rutinas';
export const CLAVE_SELECCION_PENDIENTE = 'ptrainer_rutinas_seleccion_pendiente';
export const CLAVE_RUTINAS_COMPRADAS = 'ptrainer_rutinas_compradas';
// Versiones de rutinas editadas para un cliente en particular: { [clienteId]: { [rutinaId]: rutina } }.
export const CLAVE_RUTINAS_POR_CLIENTE = 'ptrainer_rutinas_por_cliente';
// Último plan de nutrición que el coach le asignó a cada cliente, para poder editarlo después.
export const CLAVE_NUTRICION_POR_CLIENTE = 'ptrainer_nutricion_por_cliente';

// Normaliza el correo para que cada cuenta tenga su propia lista de rutinas compradas.
function normalizarCorreoCompras(correo) {
  return String(correo || '').trim().toLowerCase();
}

// Si la pantalla no recibe el correo por propiedades, lo recupera de la sesión local activa.
async function correoUsuarioActivo(correo) {
  const correoRecibido = normalizarCorreoCompras(correo);
  if (correoRecibido) return correoRecibido;

  try {
    const guardado = await AsyncStorage.getItem(CLAVE_USUARIO_ACTUAL);
    const usuario = JSON.parse(guardado || '{}');
    return normalizarCorreoCompras(usuario.correo || usuario.email);
  } catch (error) {
    return '';
  }
}

// Devuelve la clave local de compras que corresponde exclusivamente a una cuenta.
export function claveRutinasCompradasParaCorreo(correo) {
  const correoNormalizado = normalizarCorreoCompras(correo);
  return correoNormalizado ? `${CLAVE_RUTINAS_COMPRADAS}:${correoNormalizado}` : null;
}

// Lee las rutinas compradas por una cuenta, sin compartirlas con otros perfiles del dispositivo.
export async function leerRutinasCompradas(correo) {
  const correoCuenta = await correoUsuarioActivo(correo);
  const clave = claveRutinasCompradasParaCorreo(correoCuenta);
  if (!clave) return [];

  let locales = [];
  try {
    const guardadas = await AsyncStorage.getItem(clave);
    const ids = guardadas ? JSON.parse(guardadas) : [];
    locales = Array.isArray(ids) ? ids.map(String) : [];
  } catch (error) {
    locales = [];
  }

  // El servidor es la fuente de verdad. Antes, las compras guardadas solo en el teléfono se
  // mandaban al servidor como compras nuevas (cualquiera podía agregarse rutinas así).
  // La copia local solo se usa cuando no hay conexión.
  try {
    const respuesta = await api('/rutinas/compradas/');
    const servidor = Array.isArray(respuesta?.rutinasCompradas) ? respuesta.rutinasCompradas.map(String) : [];
    await AsyncStorage.setItem(clave, JSON.stringify(servidor)).catch(() => {});
    return servidor;
  } catch (error) {
    return locales;
  }
}

// Guarda una rutina comprada y evita duplicar su identificador en la cuenta actual.
export async function guardarRutinaComprada(correo, rutinaId, rutina = {}) {
  const correoCuenta = await correoUsuarioActivo(correo);
  const clave = claveRutinasCompradasParaCorreo(correoCuenta);
  if (!clave) throw new Error('No se encontró el correo de la cuenta activa.');

  const compras = await leerRutinasCompradas(correoCuenta);
  const id = String(rutinaId);
  // El nivel y el enfoque aprovechan los campos que ya existen en la rutina guardada del alumno.
  const nivelTexto = String(rutina.nivel || '').toLocaleLowerCase('es-CL');
  const nivel = ['inicial', 'principiante', 'basico', 'básico'].includes(nivelTexto)
    ? 'Basico'
    : nivelTexto === 'intermedio'
      ? 'Intermedio'
      : ['avanzado', 'advanced'].includes(nivelTexto)
        ? 'Avanzado'
        : '';
  const respuesta = await api('/rutinas/compradas/', {
    method: 'POST',
    body: { rutina_id: id, nivel, split: rutina.enfoqueRutina || rutina.frecuencia || '' },
  });
  const delServidor = Array.isArray(respuesta?.rutinasCompradas) ? respuesta.rutinasCompradas.map(String) : null;
  const actualizadas = delServidor || (compras.includes(id) ? compras : [...compras, id]);
  await AsyncStorage.setItem(clave, JSON.stringify(actualizadas));
  return actualizadas;
}

// Precio único de cada rutina individual en el catálogo.
export const PRECIO_RUTINA = 10000;

// Ejercicios reales de la rutina "Split App principiante" (días 1 a 4), con su descripción.
export const EJERCICIOS_INICIALES = [
  { id: 'EJ-101', nombre: 'Plano Banca', grupo: 'Pecho, Tríceps, Hombro anterior', equipo: 'Barra y banco plano', nivel: 'Inicial', series: '3', repeticiones: '6–8 reps', descanso: '3 min', descripcion: 'Acostado en banco plano, baja la barra controlada hasta el pecho y empújala hasta estirar los brazos.' },
  { id: 'EJ-102', nombre: 'Inclinado mancuernas', grupo: 'Pecho superior, Hombro anterior, Tríceps', equipo: 'Mancuernas y banco inclinado', nivel: 'Inicial', series: '3', repeticiones: '8–12 reps', descanso: '2 min', descripcion: 'En banco inclinado (30–45°), baja las mancuernas a los lados del pecho y súbelas juntándolas arriba.' },
  { id: 'EJ-103', nombre: 'Inclinado máquina de press', grupo: 'Pecho superior, Tríceps', equipo: 'Máquina de press inclinado', nivel: 'Inicial', series: '3', repeticiones: '15–20 reps', descanso: '2 min', descripcion: 'Sentado en la máquina de press inclinado, empuja las manillas hacia adelante y arriba sin bloquear los codos.' },
  { id: 'EJ-104', nombre: 'Dips fallo', grupo: 'Pecho inferior, Tríceps', equipo: 'Paralelas o anillas', nivel: 'Inicial', series: '3', repeticiones: 'Al fallo', descanso: '30 seg', descripcion: 'Apoyado en paralelas o anillas, baja el cuerpo doblando los codos y vuelve a subir hasta estirar los brazos. Repite hasta el fallo.' },
  { id: 'EJ-105', nombre: 'Skullcrushers con barra', grupo: 'Tríceps', equipo: 'Barra y banco plano', nivel: 'Inicial', series: '3', repeticiones: '6–8 reps', descanso: '2 min', descripcion: 'Acostado, baja la barra hacia la frente doblando solo los codos y vuelve a estirar los brazos.' },
  { id: 'EJ-106', nombre: 'Extensión de tríceps con barra en polea', grupo: 'Tríceps', equipo: 'Polea alta con barra', nivel: 'Inicial', series: '3', repeticiones: '8–12 reps', descanso: '2 min', descripcion: 'De pie frente a la polea alta, empuja la barra hacia abajo con los codos pegados al cuerpo.' },
  { id: 'EJ-107', nombre: 'Extensión de tríceps con cuerda', grupo: 'Tríceps', equipo: 'Polea alta con cuerda', nivel: 'Inicial', series: '3', repeticiones: '15–20 reps', descanso: '2 min', descripcion: 'Con la cuerda en la polea alta, empuja hacia abajo y separa las manos al final del movimiento.' },
  { id: 'EJ-108', nombre: 'Rows con barra', grupo: 'Espalda, Bíceps, Hombro posterior', equipo: 'Barra', nivel: 'Inicial', series: '3', repeticiones: '6–8 reps', descanso: '3 min', descripcion: 'Inclinado hacia adelante con la espalda recta, tira de la barra hacia el abdomen juntando las escápulas.' },
  { id: 'EJ-109', nombre: 'Remo en T o máquina', grupo: 'Espalda media, Dorsales, Bíceps', equipo: 'Barra T o máquina de remo', nivel: 'Inicial', series: '3', repeticiones: '8–12 reps', descanso: '2 min', descripcion: 'En la barra T o en la máquina de remo, tira hacia el pecho manteniendo el pecho arriba.' },
  { id: 'EJ-110', nombre: 'Jalón al pecho agarre inverso', grupo: 'Dorsales, Bíceps', equipo: 'Polea alta', nivel: 'Inicial', series: '3', repeticiones: '15–20 reps', descanso: '2 min', descripcion: 'Sentado en la polea, con las palmas hacia ti, baja la barra hacia la parte alta del pecho llevando los codos hacia abajo.' },
  { id: 'EJ-111', nombre: 'Curl de bíceps con barra', grupo: 'Bíceps', equipo: 'Barra', nivel: 'Inicial', series: '3', repeticiones: '6–8 reps', descanso: '2 min', descripcion: 'De pie, sube la barra doblando los codos sin balancear el cuerpo y bájala lento.' },
  { id: 'EJ-112', nombre: 'Curl en banco Scott concentrado a 1 brazo', grupo: 'Bíceps', equipo: 'Banco Scott y mancuerna', nivel: 'Inicial', series: '3', repeticiones: '8–12 reps', descanso: '2 min', descripcion: 'Con el brazo apoyado en el banco Scott, sube la mancuerna concentrándote en el bíceps, un brazo a la vez.' },
  { id: 'EJ-113', nombre: 'Hammer curls', grupo: 'Bíceps, Antebrazo', equipo: 'Mancuernas', nivel: 'Inicial', series: '3', repeticiones: '15–20 reps', descanso: '2 min', descripcion: 'Con las palmas mirándose (agarre martillo), sube las mancuernas doblando los codos.' },
  { id: 'EJ-114', nombre: 'Squats', grupo: 'Cuádriceps, Glúteo, Isquiotibiales', equipo: 'Barra y rack', nivel: 'Inicial', series: '3', repeticiones: '6–8 reps', descanso: '3 min', descripcion: 'Con la barra en la espalda, baja flexionando rodillas y cadera como si te sentaras y vuelve a subir.' },
  { id: 'EJ-115', nombre: 'Prensa abierta', grupo: 'Cuádriceps, Glúteo, Aductores', equipo: 'Máquina de prensa', nivel: 'Inicial', series: '3', repeticiones: '8–12 reps', descanso: '2 min', descripcion: 'En la prensa, con los pies separados y abiertos, baja la plataforma y empújala sin bloquear las rodillas.' },
  { id: 'EJ-116', nombre: 'Extensión de cuádriceps', grupo: 'Cuádriceps', equipo: 'Máquina de extensión', nivel: 'Inicial', series: '3', repeticiones: '15–20 reps', descanso: '2 min', descripcion: 'Sentado en la máquina, estira las piernas hasta arriba y bájalas controlando el peso.' },
  { id: 'EJ-117', nombre: 'Peso muerto rumano', grupo: 'Isquiotibiales, Glúteo, Espalda baja', equipo: 'Barra', nivel: 'Inicial', series: '3', repeticiones: '6–8 reps', descanso: '3 min', descripcion: 'Con las piernas casi estiradas, baja la barra pegada a las piernas llevando la cadera atrás y vuelve a subir.' },
  { id: 'EJ-118', nombre: 'Camilla femoral', grupo: 'Isquiotibiales', equipo: 'Máquina de curl femoral', nivel: 'Inicial', series: '3', repeticiones: '15–20 reps', descanso: '2 min', descripcion: 'Acostado boca abajo en la camilla, lleva los talones hacia los glúteos y baja lento.' },
  { id: 'EJ-119', nombre: 'Calf raise en máquina o barra Smith con step', grupo: 'Pantorrilla', equipo: 'Máquina o barra Smith con step', nivel: 'Inicial', series: '3', repeticiones: '20–25 reps', descanso: '1:30 min', descripcion: 'Con la punta de los pies en el step, sube en puntillas lo más alto posible y baja estirando el talón.' },
  { id: 'EJ-120', nombre: 'Press militar con barra Smith o mancuernas', grupo: 'Hombro, Tríceps', equipo: 'Barra Smith o mancuernas', nivel: 'Inicial', series: '3', repeticiones: '6–8 reps', descanso: '2 min', descripcion: 'Sentado o de pie, empuja la barra o las mancuernas desde los hombros hasta arriba de la cabeza.' },
  { id: 'EJ-121', nombre: 'Elevaciones frontales con mancuernas', grupo: 'Hombro anterior', equipo: 'Mancuernas', nivel: 'Inicial', series: '3', repeticiones: '15–20 reps', descanso: '2 min', descripcion: 'De pie, sube las mancuernas al frente con los brazos casi estirados hasta la altura de los hombros.' },
  { id: 'EJ-122', nombre: 'Laterales con mancuernas', grupo: 'Hombro lateral', equipo: 'Mancuernas', nivel: 'Inicial', series: '3', repeticiones: '15–20 reps', descanso: '2 min', descripcion: 'De pie, abre los brazos hacia los lados hasta la altura de los hombros y baja lento.' },
  { id: 'EJ-123', nombre: 'Laterales en polea a una mano', grupo: 'Hombro lateral', equipo: 'Polea baja', nivel: 'Inicial', series: '3', repeticiones: '15–20 reps', descanso: '1:30 min', descripcion: 'De lado a la polea baja, sube el brazo hacia el costado hasta la altura del hombro, una mano a la vez.' },
  { id: 'EJ-124', nombre: 'Posterior en máquina o banca inclinada con mancuernas', grupo: 'Hombro posterior, Espalda alta', equipo: 'Máquina o banco inclinado con mancuernas', nivel: 'Inicial', series: '3', repeticiones: '15–20 reps', descanso: '1:30 min', descripcion: 'En la máquina o boca abajo en banco inclinado, abre los brazos hacia atrás juntando las escápulas.' },
];

// Rutinas reales del "Split App principiante": un día por rutina, con los mismos ejercicios de la biblioteca.
const ejercicioDeRutina = (id) => ({ ...EJERCICIOS_INICIALES.find((item) => item.id === id), id, ejercicioId: id });

export const RUTINAS_INICIALES = [
  {
    id: 'RUT-101',
    titulo: 'Día 1 · Pecho y tríceps (empuje)',
    nivel: 'Inicial',
    frecuencia: 'Split App principiante',
    ejercicios: ['EJ-101', 'EJ-102', 'EJ-103', 'EJ-104', 'EJ-105', 'EJ-106', 'EJ-107'].map(ejercicioDeRutina),
  },
  {
    id: 'RUT-102',
    titulo: 'Día 2 · Espalda y bíceps (tirón)',
    nivel: 'Inicial',
    frecuencia: 'Split App principiante',
    ejercicios: ['EJ-108', 'EJ-109', 'EJ-110', 'EJ-111', 'EJ-112', 'EJ-113'].map(ejercicioDeRutina),
  },
  {
    id: 'RUT-103',
    titulo: 'Día 3 · Pierna',
    nivel: 'Intermedio',
    frecuencia: 'Split App principiante',
    ejercicios: ['EJ-114', 'EJ-115', 'EJ-116', 'EJ-117', 'EJ-118', 'EJ-119'].map(ejercicioDeRutina),
  },
  {
    id: 'RUT-104',
    titulo: 'Día 4 · Hombro',
    nivel: 'Intermedio',
    frecuencia: 'Split App principiante',
    ejercicios: ['EJ-120', 'EJ-121', 'EJ-122', 'EJ-123', 'EJ-124'].map(ejercicioDeRutina),
  },
  {
    id: 'RUT-105',
    titulo: 'Día 5 · Variable 1 (pecho-empuje)',
    nivel: 'Avanzado',
    frecuencia: 'Split App principiante',
    ejercicios: ['EJ-102', 'EJ-103', 'EJ-104', 'EJ-105', 'EJ-106', 'EJ-107'].map(ejercicioDeRutina),
  },
  {
    id: 'RUT-106',
    titulo: 'Día 5 · Variable 2 (espalda-tirón)',
    nivel: 'Avanzado',
    frecuencia: 'Split App principiante',
    ejercicios: ['EJ-108', 'EJ-109', 'EJ-110', 'EJ-111', 'EJ-112', 'EJ-113'].map(ejercicioDeRutina),
  },
];

// IDs de los ejercicios y rutinas de ejemplo (Pecho y tríceps, Espalda y bíceps, Piernas y core)
// que se reemplazaron por los reales.
const IDS_EJEMPLO = ['EJ-001', 'EJ-002', 'EJ-003', 'EJ-004', 'EJ-005', 'EJ-006', 'EJ-007', 'EJ-008', 'EJ-009', 'RUT-001', 'RUT-002', 'RUT-003'];
export const CLAVE_BIBLIOTECA_REAL = 'ptrainer_biblioteca_real_v1';

// Se ejecuta una sola vez por teléfono: quita los ejemplos que quedaron guardados y agrega los reales.
// Lo que el personal trainer creó por su cuenta se conserva.
export async function actualizarBibliotecaReal() {
  try {
    if (await AsyncStorage.getItem(CLAVE_BIBLIOTECA_REAL)) return;
    const reemplazar = async (clave, reales) => {
      const guardado = await AsyncStorage.getItem(clave);
      if (!guardado) return; // sin datos guardados, la pantalla ya parte con los reales
      const lista = JSON.parse(guardado);
      if (!Array.isArray(lista)) return;
      const propios = lista.filter((item) => !IDS_EJEMPLO.includes(String(item.id)));
      const faltantes = reales.filter((real) => !propios.some((item) => String(item.id) === real.id));
      await AsyncStorage.setItem(clave, JSON.stringify([...faltantes, ...propios]));
    };
    await reemplazar(CLAVE_EJERCICIOS, EJERCICIOS_INICIALES);
    await reemplazar(CLAVE_RUTINAS, RUTINAS_INICIALES);
    await AsyncStorage.setItem(CLAVE_BIBLIOTECA_REAL, '1');
  } catch {
    // si falla, la próxima vez que se abra la pantalla se vuelve a intentar
  }
}

// Arma el catálogo de compra con las seis rutinas predeterminadas de la biblioteca del entrenador.
export async function leerCatalogoRutinas() {
  await actualizarBibliotecaReal();

  let rutinasGuardadas = [];
  try {
    const guardadas = await AsyncStorage.getItem(CLAVE_RUTINAS);
    const lista = guardadas ? JSON.parse(guardadas) : [];
    if (Array.isArray(lista)) rutinasGuardadas = lista;
  } catch (error) {
    rutinasGuardadas = [];
  }

  let catalogoServidor = [];
  // Administración publica el catálogo en Mongo para que todos los clientes vean las mismas rutinas.
  try {
    const respuesta = await api('/rutinas-predeterminadas/');
    const listaServidor = Array.isArray(respuesta) ? respuesta : respuesta?.rutinas;
    if (Array.isArray(listaServidor) && listaServidor.length) {
      // El servidor entrega split/cardio como objetos y los ejercicios agrupados por día.
      catalogoServidor = listaServidor.map(rutinaCatalogoParaCliente);
    }
  } catch (error) {
    // Si el servidor no publica todavía el catálogo, la app conserva las rutinas integradas de respaldo.
  }

  // El catálogo local funciona como respaldo durante la configuración inicial del servidor.
  const catalogoLocal = RUTINAS_INICIALES.map((rutinaBase, indice) => {
    const guardada = rutinasGuardadas.find((rutina) => String(rutina.id) === String(rutinaBase.id));
    const rutina = guardada ? { ...rutinaBase, ...guardada } : rutinaBase;
    const nombreOriginal = rutina.titulo || rutinaBase.titulo;
    const enfoque = nombreOriginal.replace(/^Día\s*\d+\s*[·.-]\s*/i, '');
    const ejercicios = Array.isArray(rutina.ejercicios) ? rutina.ejercicios : rutinaBase.ejercicios;

    return {
      id: String(rutinaBase.id),
      titulo: `Rutina ${indice + 1}`,
      nombre: nombreOriginal,
      enfoqueRutina: enfoque,
      nivel: rutina.nivel || rutinaBase.nivel,
      frecuencia: rutina.frecuencia || rutinaBase.frecuencia,
      descripcion: rutina.descripcion || 'Rutina predeterminada de entrenamiento.',
      variables: [],
      dias: [{ nombre: nombreOriginal, ejercicios }],
    };
  });

  if (!catalogoServidor.length) return catalogoLocal;
  const nombresServidor = new Set(catalogoServidor.flatMap((rutina) => [rutina.nombre, rutina.enfoqueRutina].map((texto) => String(texto || '').toLowerCase().trim())));
  const idsServidor = new Set(catalogoServidor.map((rutina) => String(rutina.id)));
  const rutinasLocalesSinDuplicar = catalogoLocal.filter((rutina) => (
    !idsServidor.has(String(rutina.id)) && !nombresServidor.has(String(rutina.nombre || '').toLowerCase().trim())
  ));
  return [...catalogoServidor, ...rutinasLocalesSinDuplicar];
}
