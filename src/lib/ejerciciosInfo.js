// Ficha visual de cada ejercicio: músculos que trabaja, en qué consiste y su imagen (si la hay).
// Solo se usa para mostrar en pantalla; no cambia lo que se guarda en la base de datos.
// La búsqueda es por nombre, así sirve para la rutina "Split App principiante", la biblioteca
// del coach y las rutinas que llegan del servidor (por ejemplo "Día 1 · Plano Banca").

const IMG = {
  pressBanca: require('../../assets/images/ejercicios/press_banca_barra.jpg'),
  pressMancuernas: require('../../assets/images/ejercicios/press_mancuernas.jpg'),
  fondos: require('../../assets/images/ejercicios/fondos.jpg'),
  extensionTricepsBarra: require('../../assets/images/ejercicios/extension_triceps_barra.jpg'),
  remoInclinado: require('../../assets/images/ejercicios/remo_inclinado.jpg'),
  jalonPecho: require('../../assets/images/ejercicios/jalon_pecho.jpg'),
  curlBarra: require('../../assets/images/ejercicios/curl_barra.jpg'),
  curlFemoral: require('../../assets/images/ejercicios/curl_femoral.jpg'),
  extensionCuadriceps: require('../../assets/images/ejercicios/extension_cuadriceps.jpg'),
  pesoMuertoRumano: require('../../assets/images/ejercicios/peso_muerto_rumano.jpg'),
  lateralesMancuernas: require('../../assets/images/ejercicios/laterales_mancuernas.jpg'),
  lateralesPolea: require('../../assets/images/ejercicios/laterales_polea.jpg'),
  elevacionesFrontales: require('../../assets/images/ejercicios/elevaciones_frontales.jpg'),
  plancha: require('../../assets/images/ejercicios/plancha.jpg'),
};

// imagen: null => se muestra solo el texto (todavía no hay ilustración para ese ejercicio).
const FICHAS = {
  // ---------- Pecho y tríceps ----------
  planoBanca: {
    musculos: ['Pecho', 'Tríceps', 'Hombro anterior'],
    descripcion: 'Acostado en banco plano, baja la barra controlada hasta el pecho y empújala hasta estirar los brazos.',
    imagen: IMG.pressBanca,
  },
  inclinadoMancuernas: {
    musculos: ['Pecho superior', 'Hombro anterior', 'Tríceps'],
    descripcion: 'En banco inclinado (30–45°), baja las mancuernas a los lados del pecho y súbelas juntándolas arriba.',
    imagen: IMG.pressMancuernas,
  },
  inclinadoMaquina: {
    musculos: ['Pecho superior', 'Tríceps'],
    descripcion: 'Sentado en la máquina de press inclinado, empuja las manillas hacia adelante y arriba sin bloquear los codos.',
    imagen: null,
  },
  fondos: {
    musculos: ['Pecho inferior', 'Tríceps'],
    descripcion: 'Apoyado en paralelas o anillas, baja el cuerpo doblando los codos y vuelve a subir hasta estirar los brazos.',
    imagen: IMG.fondos,
  },
  skullcrushers: {
    musculos: ['Tríceps'],
    descripcion: 'Acostado, baja la barra hacia la frente doblando solo los codos y vuelve a estirar los brazos.',
    imagen: IMG.extensionTricepsBarra,
  },
  extensionPoleaBarra: {
    musculos: ['Tríceps'],
    descripcion: 'De pie frente a la polea alta, empuja la barra hacia abajo con los codos pegados al cuerpo.',
    imagen: null,
  },
  extensionCuerda: {
    musculos: ['Tríceps'],
    descripcion: 'Con la cuerda en la polea alta, empuja hacia abajo y separa las manos al final del movimiento.',
    imagen: null,
  },
  // ---------- Espalda y bíceps ----------
  remoBarra: {
    musculos: ['Espalda', 'Bíceps', 'Hombro posterior'],
    descripcion: 'Inclinado hacia adelante con la espalda recta, tira del peso hacia el abdomen juntando las escápulas.',
    imagen: IMG.remoInclinado,
  },
  remoT: {
    musculos: ['Espalda media', 'Dorsales', 'Bíceps'],
    descripcion: 'En la barra T o en la máquina de remo, tira hacia el pecho manteniendo el pecho arriba.',
    imagen: null,
  },
  jalon: {
    musculos: ['Dorsales', 'Bíceps'],
    descripcion: 'Sentado en la polea, baja la barra hacia la parte alta del pecho llevando los codos hacia abajo.',
    imagen: IMG.jalonPecho,
  },
  curlBarra: {
    musculos: ['Bíceps'],
    descripcion: 'De pie, sube la barra doblando los codos sin balancear el cuerpo y bájala lento.',
    imagen: IMG.curlBarra,
  },
  curlScott: {
    musculos: ['Bíceps'],
    descripcion: 'Con el brazo apoyado en el banco Scott, sube la mancuerna concentrándote en el bíceps, un brazo a la vez.',
    imagen: null,
  },
  hammer: {
    musculos: ['Bíceps', 'Antebrazo'],
    descripcion: 'Con las palmas mirándose (agarre martillo), sube las mancuernas doblando los codos.',
    imagen: null,
  },
  // ---------- Pierna ----------
  sentadilla: {
    musculos: ['Cuádriceps', 'Glúteo', 'Isquiotibiales'],
    descripcion: 'Con la barra en la espalda, baja flexionando rodillas y cadera como si te sentaras y vuelve a subir.',
    imagen: null,
  },
  prensa: {
    musculos: ['Cuádriceps', 'Glúteo', 'Aductores'],
    descripcion: 'En la prensa, con los pies separados y abiertos, baja la plataforma y empújala sin bloquear las rodillas.',
    imagen: null,
  },
  extensionCuadriceps: {
    musculos: ['Cuádriceps'],
    descripcion: 'Sentado en la máquina, estira las piernas hasta arriba y bájalas controlando el peso.',
    imagen: IMG.extensionCuadriceps,
  },
  pesoMuertoRumano: {
    musculos: ['Isquiotibiales', 'Glúteo', 'Espalda baja'],
    descripcion: 'Con las piernas casi estiradas, baja la barra pegada a las piernas llevando la cadera atrás y vuelve a subir.',
    imagen: IMG.pesoMuertoRumano,
  },
  camillaFemoral: {
    musculos: ['Isquiotibiales'],
    descripcion: 'Acostado boca abajo en la camilla, lleva los talones hacia los glúteos y baja lento.',
    imagen: IMG.curlFemoral,
  },
  pantorrilla: {
    musculos: ['Pantorrilla'],
    descripcion: 'Con la punta de los pies en el step, sube en puntillas lo más alto posible y baja estirando el talón.',
    imagen: null,
  },
  // ---------- Hombro ----------
  pressMilitar: {
    musculos: ['Hombro', 'Tríceps'],
    descripcion: 'Sentado o de pie, empuja la barra o las mancuernas desde los hombros hasta arriba de la cabeza.',
    imagen: null,
  },
  frontales: {
    musculos: ['Hombro anterior'],
    descripcion: 'De pie, sube las mancuernas al frente con los brazos casi estirados hasta la altura de los hombros.',
    imagen: IMG.elevacionesFrontales,
  },
  lateralesMancuernas: {
    musculos: ['Hombro lateral'],
    descripcion: 'De pie, abre los brazos hacia los lados hasta la altura de los hombros y baja lento.',
    imagen: IMG.lateralesMancuernas,
  },
  lateralesPolea: {
    musculos: ['Hombro lateral'],
    descripcion: 'De lado a la polea baja, sube el brazo hacia el costado hasta la altura del hombro, una mano a la vez.',
    imagen: IMG.lateralesPolea,
  },
  posterior: {
    musculos: ['Hombro posterior', 'Espalda alta'],
    descripcion: 'En la máquina o boca abajo en banco inclinado, abre los brazos hacia atrás juntando las escápulas.',
    imagen: null,
  },
  // ---------- Core ----------
  plancha: {
    musculos: ['Abdomen', 'Core'],
    descripcion: 'Apoyado en antebrazos y puntas de pie, mantén el cuerpo recto sin dejar caer la cadera.',
    imagen: IMG.plancha,
  },
};

// Minúsculas y sin tildes; quita el prefijo "Día 1 · " que agregan las rutinas por días.
const normalizar = (texto = '') => String(texto)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/^dia\s*\d+\s*[·.:-]\s*/, '')
  .trim();

// El orden importa: primero los nombres más específicos.
const REGLAS = [
  [(n) => n.includes('calf') || n.includes('talon') || n.includes('pantorrilla') || n.includes('gemelo'), 'pantorrilla'],
  [(n) => n.includes('posterior'), 'posterior'],
  [(n) => n.includes('lateral') && n.includes('polea'), 'lateralesPolea'],
  [(n) => n.includes('lateral'), 'lateralesMancuernas'],
  [(n) => n.includes('frontal'), 'frontales'],
  [(n) => n.includes('militar'), 'pressMilitar'],
  [(n) => n.includes('skull') || n.includes('rompecraneos') || n.includes('press frances'), 'skullcrushers'],
  [(n) => n.includes('tricep') && n.includes('cuerda'), 'extensionCuerda'],
  [(n) => n.includes('tricep') && n.includes('polea'), 'extensionPoleaBarra'],
  [(n) => n.includes('inclinad') && n.includes('maquina'), 'inclinadoMaquina'],
  [(n) => n.includes('inclinad'), 'inclinadoMancuernas'],
  [(n) => n.includes('banca') || n.includes('press de banca') || n.includes('bench'), 'planoBanca'],
  [(n) => n.includes('dips') || n.includes('fondos'), 'fondos'],
  [(n) => n.includes('remo en t') || (n.includes('remo') && n.includes('maquina')), 'remoT'],
  [(n) => n.includes('rows') || n.includes('remo'), 'remoBarra'],
  [(n) => n.includes('jalon') || n.includes('pulldown'), 'jalon'],
  [(n) => n.includes('scott') || n.includes('predicador'), 'curlScott'],
  [(n) => n.includes('hammer') || n.includes('martillo'), 'hammer'],
  [(n) => n.includes('femoral'), 'camillaFemoral'],
  [(n) => n.includes('curl'), 'curlBarra'],
  [(n) => n.includes('squat') || n.includes('sentadilla'), 'sentadilla'],
  [(n) => n.includes('prensa'), 'prensa'],
  [(n) => n.includes('cuadricep'), 'extensionCuadriceps'],
  [(n) => n.includes('rumano') || n.includes('peso muerto'), 'pesoMuertoRumano'],
  [(n) => n.includes('plancha') || n.includes('plank'), 'plancha'],
];

// Devuelve { musculos, descripcion, imagen } o null si el ejercicio no está en la lista.
export function infoEjercicio(nombre) {
  const n = normalizar(nombre);
  if (!n) return null;
  const regla = REGLAS.find(([coincide]) => coincide(n));
  return regla ? FICHAS[regla[1]] : null;
}

// Nombre sin el prefijo del día, para títulos más limpios ("Día 1 · Plano Banca" -> "Plano Banca").
export function nombreSinDia(nombre = '') {
  return String(nombre).replace(/^d[ií]a\s*\d+\s*[·.:-]\s*/i, '').trim();
}

// Día del ejercicio si viene en el nombre ("Día 1 · ..." -> "Día 1"), o '' si no tiene.
export function diaDelNombre(nombre = '') {
  const m = String(nombre).match(/^(d[ií]a\s*\d+)\s*[·.:-]/i);
  return m ? m[1].replace(/^d[ií]a/i, 'Día') : '';
}
