import Svg, { Circle, Line, Polyline } from 'react-native-svg';

// gráfico de línea genérico — recibe data: [{ kg }, { kg }, ...] (o cualquier
// objeto con la propiedad "kg") y dibuja la curva + grilla + el punto
// resaltado en el último valor. Pensado para reutilizarse en cualquier
// pantalla que necesite un gráfico simple de tendencia.
// serieSecundaria (opcional): { data: [{ kg }], color } — una segunda línea en las mismas fechas,
// por ejemplo el peso junto a una medida. Usa su propia escala porque cm y kg no son comparables,
// así que lo que se compara es la tendencia (si suben o bajan juntas), no la altura exacta.
export default function LineChart({ data, color = '#2E7032', height = 120, yTicks = 3, serieSecundaria = null }) {
  const width = 300; // "unidades" del viewBox — el SVG se estira al 100% del ancho del contenedor
  const padding = 20;

  if (!data || data.length === 0) return null;

  const xStep = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
//Esa línea está calculando cuánto espacio horizontal debe haber entre cada punto de un gráfico de líneas.

  // Convierte una lista de valores en puntos del SVG, con su propio mínimo y máximo.
  const calcularPuntos = (serie) => {
    const valores = serie.map((d) => d.kg);
    const yMin = Math.min(...valores);
    const yMax = Math.max(...valores);
    const rangoY = yMax - yMin || 1;
    return serie.map((d, i) => ({
      x: padding + i * xStep,
      y: padding + (1 - (d.kg - yMin) / rangoY) * (height - padding * 2),
    }));
  };

  const puntos = calcularPuntos(data);
  const puntosStr = puntos.map((p) => `${p.x},${p.y}`).join(' ');

  // La segunda línea solo se dibuja si tiene un valor por cada fecha de la principal.
  const haySerie2 = serieSecundaria?.data?.length === data.length
    && serieSecundaria.data.every((d) => Number.isFinite(d.kg));
  const puntos2 = haySerie2 ? calcularPuntos(serieSecundaria.data) : [];
  const color2 = serieSecundaria?.color || '#FFFFFF';

  // líneas horizontales de referencia (grilla), repartidas entre el mínimo y el máximo
  const ticks = Array.from({ length: yTicks }, (_, i) => {
    const y = padding + (1 - i / (yTicks - 1)) * (height - padding * 2);
    return y;
  });
  {/* Svg lienzo por donde se va a dibujar el grafico y viewBox es un sistema de coordenadas*/}
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}> 
      {ticks.map((y) => (
        <Line key={y} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#3A3F4B" strokeWidth={1} />
      ))}{/* ticks por cada valor se crea una linea desde donde comienza hasta donde llega y stroke es el color que se le otorga */}

      {/* línea del peso: punteada para distinguirla de la medida */}
      {haySerie2 && (
        <Polyline
          points={puntos2.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={color2}
          strokeWidth={2}
          strokeDasharray="5,4"
        />
      )}
      {puntos2.map((p, i) => (
        <Circle key={`s2-${i}`} cx={p.x} cy={p.y} r={i === puntos2.length - 1 ? 4 : 2.5} fill={color2} />
      ))}

      <Polyline points={puntosStr} fill="none" stroke={color} strokeWidth={2.5} />

      {puntos.map((p, i) => {
        const esUltimo = i === puntos.length - 1;
        return (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={esUltimo ? 5 : 3}
            fill={esUltimo ? '#FFFFFF' : color}
            stroke={color}
            strokeWidth={esUltimo ? 2 : 0}
          />
        );
      })}
    </Svg>
  );
}
