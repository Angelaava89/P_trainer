// Traduce las rutinas predeterminadas que entrega Django (rutina_a_api en
// backend/config/proyecto_Trainer/catalogo_rutinas.py) a textos y filas que usan las pantallas.
//
// Formato que llega del servidor:
//   {
//     id, nombre, nivel, descripcion,
//     split: { dias_entrenamiento, secuencia, repetir, descripcion },   <- objeto, no texto
//     cardio: { sesiones_semana, tipo, duracion_min, en_ayunas, indicaciones } | null,
//     dias: [{ id_dia, orden, nombre, ..., ejercicios: [{ idEjercicio, nombre_ejercicio,
//              equipo, series, reps_min, reps_max, al_fallo, descanso_seg, rer, ... }] }]
//   }
// Rutinas antiguas pueden traer split como texto y dias como una fila por ejercicio;
// todo lo de aquí acepta ambos formatos.

const texto = (valor) => (valor === null || valor === undefined ? '' : String(valor).trim());

// split puede ser objeto ({ descripcion }) o texto (formato antiguo).
export function textoSplit(split) {
  if (split && typeof split === 'object') return texto(split.descripcion);
  return texto(split);
}

// cardio es un objeto o null; se arma una frase corta para mostrar.
export function textoCardio(cardio) {
  if (!cardio || typeof cardio !== 'object') return texto(cardio);
  const partes = [];
  if (Number(cardio.sesiones_semana) > 0) partes.push(`${cardio.sesiones_semana} sesiones por semana`);
  if (texto(cardio.tipo)) partes.push(texto(cardio.tipo));
  if (Number(cardio.duracion_min) > 0) partes.push(`${cardio.duracion_min} min`);
  if (cardio.en_ayunas) partes.push('en ayunas');
  const frase = partes.length ? `Cardio: ${partes.join(' · ')}` : '';
  return [frase, texto(cardio.indicaciones)].filter(Boolean).join('. ');
}

// "8-12", "10" o "Al fallo".
export function textoRepeticiones(ejercicio = {}) {
  if (texto(ejercicio.repeticiones)) return texto(ejercicio.repeticiones);
  const min = ejercicio.reps_min;
  const max = ejercicio.reps_max;
  if (min != null && max != null) return Number(min) === Number(max) ? String(min) : `${min}-${max}`;
  if (min != null || max != null) return String(min ?? max);
  return ejercicio.al_fallo ? 'Al fallo' : '';
}

// 120 -> "2 min", 90 -> "90 seg"; acepta también el texto antiguo ("2 min").
export function textoDescanso(ejercicio = {}) {
  if (texto(ejercicio.descanso)) return texto(ejercicio.descanso);
  const segundos = Number(ejercicio.descanso_seg);
  if (!Number.isFinite(segundos) || segundos <= 0) return '';
  return segundos % 60 === 0 ? `${segundos / 60} min` : `${segundos} seg`;
}

// Días de la rutina con sus ejercicios, en cualquiera de los dos formatos.
// Devuelve [{ numero, nombre, meta, ejercicios: [ejercicio original] }] ordenado por número de día.
export function diasDeRutina(rutina = {}) {
  const dias = Array.isArray(rutina.dias) ? rutina.dias : [];
  const formatoNuevo = dias.some((dia) => Array.isArray(dia?.ejercicios));

  if (formatoNuevo) {
    return dias
      .map((dia, indice) => ({
        numero: Number(dia.orden) || indice + 1,
        nombre: texto(dia.nombre) || `Día ${Number(dia.orden) || indice + 1}`,
        meta: dia,
        ejercicios: Array.isArray(dia.ejercicios) ? dia.ejercicios : [],
      }))
      .sort((a, b) => a.numero - b.numero);
  }

  // Formato antiguo: una fila por ejercicio con su número de día.
  const grupos = new Map();
  dias.forEach((fila) => {
    const numero = Number.parseInt(fila?.dia, 10) || 1;
    if (!grupos.has(numero)) grupos.set(numero, []);
    grupos.get(numero).push(fila);
  });
  return [...grupos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([numero, ejercicios]) => ({ numero, nombre: `Día ${numero}`, meta: {}, ejercicios }));
}

export function contarEjercicios(rutina) {
  return diasDeRutina(rutina).reduce((total, dia) => total + dia.ejercicios.length, 0);
}

// Filas que edita el panel admin: una por ejercicio, con su número de día.
export function filasDeRutina(rutina) {
  return diasDeRutina(rutina).flatMap((dia) => dia.ejercicios.map((ejercicio) => ({
    idEjercicio: texto(ejercicio.idEjercicio),
    dia: String(dia.numero),
    nombre_ejercicio: texto(ejercicio.nombre_ejercicio || ejercicio.nombre) || 'Ejercicio',
    equipo: texto(ejercicio.equipo),
    series: String(ejercicio.series || 3),
    repeticiones: textoRepeticiones(ejercicio),
    descanso: textoDescanso(ejercicio),
    // Campos que el formulario no muestra pero que no se deben perder al guardar.
    extra: {
      rer: ejercicio.rer,
      unilateral: ejercicio.unilateral,
      tempo: ejercicio.tempo,
      superset_grupo: ejercicio.superset_grupo,
      detalle: ejercicio.detalle,
      series_especiales: ejercicio.series_especiales,
    },
  })));
}

// Cuerpo para POST/PATCH /admin/rutinas-predeterminadas/ en formato nuevo (un día con sus ejercicios),
// conservando el nombre y los datos de cada día y del split de la rutina original.
export function cuerpoRutinaAdmin({ nombre, nivel, split, filas }, original = null) {
  const metaPorDia = new Map(diasDeRutina(original || {}).map((dia) => [dia.numero, dia.meta]));
  const porDia = new Map();

  filas.forEach((fila) => {
    const numero = Math.max(1, Number.parseInt(fila.dia, 10) || 1);
    if (!porDia.has(numero)) porDia.set(numero, []);
    const extra = Object.fromEntries(
      Object.entries(fila.extra || {}).filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
    );
    porDia.get(numero).push({
      ...extra,
      idEjercicio: String(fila.idEjercicio || ''),
      // Nombre y equipo van también: las rutinas cargadas a mano en Atlas tienen ejercicios
      // sin idEjercicio del catálogo global, y el servidor los conserva por su nombre.
      nombre_ejercicio: texto(fila.nombre_ejercicio),
      equipo: texto(fila.equipo),
      series: Math.max(1, Number.parseInt(fila.series, 10) || 1),
      // Se mandan como texto ("8-12", "2 min"); el servidor los convierte a reps_min/reps_max y descanso_seg.
      repeticiones: texto(fila.repeticiones) || '8-12',
      descanso: texto(fila.descanso) || '2 min',
    });
  });

  const dias = [...porDia.entries()]
    .sort(([a], [b]) => a - b)
    .map(([numero, ejercicios]) => {
      const meta = metaPorDia.get(numero) || {};
      return {
        orden: numero,
        id_dia: texto(meta.id_dia) || `dia${numero}`,
        nombre: texto(meta.nombre) || `Día ${numero}`,
        grupo_muscular: Array.isArray(meta.grupo_muscular) ? meta.grupo_muscular : [],
        tipo_intensidad: texto(meta.tipo_intensidad),
        intensidad: texto(meta.intensidad),
        incluye_abdomen: meta.incluye_abdomen ?? true,
        ejercicios,
      };
    });

  const splitOriginal = original?.split && typeof original.split === 'object' ? original.split : {};
  return {
    nombre,
    nivel,
    // dias_entrenamiento se omite para que el servidor lo recalcule con los días enviados.
    split: {
      secuencia: Array.isArray(splitOriginal.secuencia) ? splitOriginal.secuencia : [],
      repetir: splitOriginal.repetir ?? true,
      descripcion: split,
    },
    dias,
  };
}

// Convierte una rutina del catálogo del servidor al formato que usan las pantallas de compra
// (comprar_rutinas, metodo_pago, rutina_detalle): todos los textos ya listos para mostrar.
export function rutinaCatalogoParaCliente(rutina, indice) {
  const enfoque = textoSplit(rutina.split);
  return {
    id: String(rutina.id),
    titulo: `Rutina ${indice + 1}`,
    nombre: texto(rutina.nombre) || `Rutina ${indice + 1}`,
    enfoqueRutina: enfoque || texto(rutina.nombre) || 'Rutina predeterminada',
    nivel: texto(rutina.nivel),
    frecuencia: enfoque,
    descripcion: texto(rutina.descripcion) || textoCardio(rutina.cardio) || 'Rutina predeterminada de entrenamiento.',
    variables: [],
    dias: diasDeRutina(rutina).map((dia) => ({
      nombre: dia.nombre,
      ejercicios: dia.ejercicios.map((ejercicio, posicion) => {
        const idEjercicio = texto(ejercicio.idEjercicio);
        return {
          id: idEjercicio || `${rutina.id}-${dia.numero}-${posicion}`,
          ejercicioId: idEjercicio,
          nombre: texto(ejercicio.nombre_ejercicio || ejercicio.nombre) || 'Ejercicio',
          grupo: texto(ejercicio.equipo),
          equipo: texto(ejercicio.equipo),
          series: String(ejercicio.series || ''),
          repeticiones: textoRepeticiones(ejercicio),
          descanso: textoDescanso(ejercicio),
          descripcion: texto(ejercicio.detalle),
          rer: ejercicio.rer,
        };
      }),
    })),
  };
}
