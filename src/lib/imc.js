// Rangos de IMC de la Organización Mundial de la Salud (OMS).
// Colores sobrios (tonos apagados) para que armonicen con el fondo oscuro de la app.
export const RANGOS_IMC = [
  {
    desde: 0, hasta: 18.5, nombre: 'Bajo peso', etiqueta: 'Bajo peso', color: '#5B8DEF', icon: 'arrow-down-circle',
    resumen: 'Tu peso está por debajo de lo recomendado para tu estatura.',
    recomendaciones: [
      'Aumenta de forma gradual las calorías con alimentos nutritivos: legumbres, frutos secos, lácteos, huevos y carnes.',
      'Haz 4 a 5 comidas al día y no te saltes el desayuno.',
      'Prioriza el entrenamiento de fuerza para ganar masa muscular, no solo peso.',
      'Si bajaste de peso sin buscarlo, consulta a un médico o nutricionista.',
    ],
  },
  {
    desde: 18.5, hasta: 25, nombre: 'Peso normal', etiqueta: 'Normal', color: '#4FB286', icon: 'checkmark-circle',
    resumen: '¡Bien! Tu peso es saludable para tu estatura.',
    recomendaciones: [
      'Mantén una alimentación variada: verduras, frutas, proteínas y carbohidratos integrales.',
      'Entrena al menos 3 veces por semana combinando fuerza y cardio.',
      'Duerme entre 7 y 9 horas y toma suficiente agua.',
      'Enfócate en tu objetivo: composición corporal, fuerza o rendimiento.',
    ],
  },
  {
    desde: 25, hasta: 30, nombre: 'Sobrepeso', etiqueta: 'Sobrepeso', color: '#D9B44A', icon: 'alert-circle',
    resumen: 'Tu peso está un poco por sobre lo recomendado para tu estatura.',
    recomendaciones: [
      'Crea un déficit calórico moderado: porciones más pequeñas y menos ultraprocesados.',
      'Aumenta la actividad diaria: camina más y suma cardio 2 a 3 veces por semana.',
      'Mantén el entrenamiento de fuerza para conservar tu masa muscular mientras bajas grasa.',
      'Reduce bebidas azucaradas y alcohol.',
    ],
  },
  {
    desde: 30, hasta: 35, nombre: 'Obesidad grado I', etiqueta: 'Obesidad I', color: '#D98B4E', icon: 'warning',
    resumen: 'Tu peso está en un rango que aumenta el riesgo para tu salud.',
    recomendaciones: [
      'Te recomendamos un control con médico o nutricionista antes de exigirte mucho.',
      'Empieza con ejercicio de bajo impacto: caminata, bicicleta estática o natación.',
      'Ordena tus horarios de comida y prioriza verduras y proteínas en cada plato.',
      'Busca bajar de a poco: entre 0,5 y 1 kg por semana es un buen ritmo.',
    ],
  },
  {
    desde: 35, hasta: 40, nombre: 'Obesidad grado II', etiqueta: 'Obesidad II', color: '#C9665A', icon: 'warning',
    resumen: 'Tu peso está en un rango de riesgo alto para tu salud.',
    recomendaciones: [
      'Consulta a un médico antes de comenzar un plan de entrenamiento.',
      'Prefiere ejercicios de bajo impacto para cuidar tus articulaciones.',
      'Trabaja junto a un nutricionista en un plan de alimentación a tu medida.',
      'Celebra los avances pequeños: la constancia es más importante que la velocidad.',
    ],
  },
  {
    desde: 40, hasta: Infinity, nombre: 'Obesidad mórbida', etiqueta: 'Mórbida', color: '#A8475A', icon: 'medkit',
    resumen: 'Tu peso está en un rango de riesgo muy alto para tu salud.',
    recomendaciones: [
      'Es muy importante que tengas un control médico antes de empezar a entrenar.',
      'Tu entrenador adaptará la rutina con ejercicios seguros y de bajo impacto.',
      'Un equipo de salud (médico y nutricionista) te puede acompañar en el proceso.',
      'Cada kilo cuenta: bajar un 5 a 10% de tu peso ya mejora mucho tu salud.',
    ],
  },
];

// IMC = peso / altura² (altura en metros). Devuelve null si faltan datos.
export function calcularImc(alturaCm, pesoKg) {
  const alturaM = Number(alturaCm) / 100;
  const peso = Number(pesoKg);
  if (!alturaM || !peso) return null;
  return peso / (alturaM * alturaM);
}

// Rango de la OMS en que cae un IMC
export function rangoImc(imc) {
  return RANGOS_IMC.find((r) => imc >= r.desde && imc < r.hasta) || RANGOS_IMC[1];
}

// 21.53 -> "21,5"
export const decimalImc = (n) => n.toFixed(1).replace('.', ',');
