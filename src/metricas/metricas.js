export function calcularVariacionPeso(historial) {
  if (!historial || historial.length === 0) {
    return {
      actual: 0,
      diferencia: 0,
      porcentaje: 0,
    };
  }

  if (historial.length === 1) {
    return {
      actual: historial[0].kg,
      diferencia: 0,
      porcentaje: 0,
    };
  }

  const actual = historial[historial.length - 1].kg;
  const inicial = historial[0].kg;
  const diferencia = actual - inicial;
  const porcentaje = inicial !== 0 ? (diferencia / inicial) * 100 : 0;

  return { actual, diferencia, porcentaje };
}
