import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors } from '../constants/theme';
import { RANGOS_IMC, decimalImc } from '../lib/imc';

// Medidor semicircular del IMC: 6 tramos de color (OMS) y una aguja que marca el valor.
// El medidor va de IMC 15 (izquierda) a 45 (derecha).
const MIN = 15;
const MAX = 45;
const ANCHO = 340;
const ALTO = 232;
const CX = ANCHO / 2;
const CY = 178;
const RADIO = 118;
const GROSOR = 22;
const SEPARACION = 1.6; // grados de espacio entre tramos

// IMC -> ángulo (180° = izquierda, 0° = derecha)
const angulo = (imc) => 180 - ((Math.min(Math.max(imc, MIN), MAX) - MIN) / (MAX - MIN)) * 180;

const punto = (grados, r) => {
  const rad = (grados * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
};

// arco desde "inicio" hasta "fin" (en grados, de izquierda a derecha)
function arco(inicio, fin, r) {
  const a = punto(inicio, r);
  const b = punto(fin, r);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export default function MedidorImc({ imc, rango }) {
  const tramos = RANGOS_IMC.map((r) => ({
    ...r,
    inicio: angulo(Math.max(r.desde, MIN)),
    fin: angulo(Math.min(r.hasta, MAX)),
  }));
  const aguja = angulo(imc);
  const punta = punto(aguja, RADIO - GROSOR / 2 - 10);
  const cola = punto(aguja + 180, 8);

  return (
    <Svg width="100%" height={undefined} viewBox={`0 0 ${ANCHO} ${ALTO}`} style={{ aspectRatio: ANCHO / ALTO }}>
      {/* pista de fondo */}
      <Path d={arco(180, 0, RADIO)} stroke="rgba(255,255,255,0.05)" strokeWidth={GROSOR + 8} fill="none" strokeLinecap="round" />

      {/* tramos de color: el del usuario va encendido, los demás atenuados */}
      {tramos.map((t, i) => {
        const primero = i === 0;
        const ultimo = i === tramos.length - 1;
        const inicio = primero ? t.inicio : t.inicio - SEPARACION / 2;
        const fin = ultimo ? t.fin : t.fin + SEPARACION / 2;
        const activo = t.nombre === rango.nombre;
        return (
          <Path
            key={t.nombre}
            d={arco(inicio, fin, RADIO)}
            stroke={t.color}
            strokeOpacity={activo ? 1 : 0.38}
            strokeWidth={activo ? GROSOR + 4 : GROSOR}
            strokeLinecap="butt"
            fill="none"
          />
        );
      })}

      {/* puntas redondeadas solo en los dos extremos del medidor */}
      {[tramos[0], tramos[tramos.length - 1]].map((t, i) => {
        const p = punto(i === 0 ? 180 : 0, RADIO);
        const activo = t.nombre === rango.nombre;
        const h = (activo ? GROSOR + 4 : GROSOR) / 2;
        // medio círculo hacia abajo, pegado al final del arco (sin superponerse)
        return (
          <Path
            key={`punta-${t.nombre}`}
            d={`M ${p.x - h} ${p.y} A ${h} ${h} 0 0 0 ${p.x + h} ${p.y} Z`}
            fill={t.color}
            fillOpacity={activo ? 1 : 0.38}
          />
        );
      })}

      {/* nombres de los tramos, siguiendo la curva */}
      {tramos.map((t) => {
        const medio = (t.inicio + t.fin) / 2;
        const p = punto(medio, RADIO + GROSOR / 2 + 14);
        const activo = t.nombre === rango.nombre;
        return (
          <SvgText
            key={`txt-${t.nombre}`}
            x={p.x}
            y={p.y}
            fill={activo ? t.color : 'rgba(255,255,255,0.45)'}
            fontSize={activo ? 10.5 : 9}
            fontWeight={activo ? 'bold' : 'normal'}
            textAnchor="middle"
            alignmentBaseline="middle"
            transform={`rotate(${90 - medio} ${p.x} ${p.y})`}
          >
            {t.etiqueta}
          </SvgText>
        );
      })}

      {/* marcas de corte (18,5 · 25 · 30 · 35 · 40) */}
      {[18.5, 25, 30, 35, 40].map((v) => {
        const p = punto(angulo(v), RADIO - GROSOR / 2 - 9);
        return (
          <SvgText key={`n-${v}`} x={p.x} y={p.y} fill="rgba(255,255,255,0.35)" fontSize={8} textAnchor="middle" alignmentBaseline="middle">
            {String(v).replace('.', ',')}
          </SvgText>
        );
      })}

      {/* aguja */}
      <G>
        <Line x1={cola.x} y1={cola.y} x2={punta.x} y2={punta.y} stroke={colors.blanco} strokeWidth={4} strokeLinecap="round" />
        <Circle cx={CX} cy={CY} r={13} fill={colors.grafito} stroke={rango.color} strokeWidth={3} />
        <Circle cx={CX} cy={CY} r={4} fill={colors.blanco} />
      </G>

      {/* valor debajo del centro, en el color de su rango */}
      <SvgText x={CX} y={CY + 42} fill={rango.color} fontSize={24} fontWeight="bold" textAnchor="middle">
        {`${decimalImc(imc)} · ${rango.etiqueta}`}
      </SvgText>
    </Svg>
  );
}
