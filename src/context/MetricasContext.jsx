import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

// Todo se guarda en Mongo usando el modelo que ya existe, sin campos nuevos:
//   datos.pesoActual  -> el peso de hoy (kg)                       PATCH /api/datos/
//   medidas[]         -> { fecha, peso, pecho, cintura, brazo, pierna }  POST /api/medidas/
// El historial de peso del gráfico se arma con medidas[].peso + datos.pesoActual.
const MetricasContext = createContext(null);
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

// Convierte una fecha ISO en fecha local para que no cambie el día por la zona horaria.
function aFecha(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    return new Date(anio, mes - 1, dia, 12);
  }
  return new Date(valor);
}

// Conserva la fecha original y añade una etiqueta corta para las listas y los gráficos.
function conEtiqueta(registro) {
  const fechaOriginal = registro.fechaISO || registro.fecha;
  const fecha = aFecha(fechaOriginal);
  const etiqueta = Number.isNaN(fecha.getTime())
    ? String(fechaOriginal ?? '')
    : `${String(fecha.getDate()).padStart(2, '0')} ${MESES_CORTOS[fecha.getMonth()]}`;
  return { ...registro, fechaISO: fechaOriginal, fecha: etiqueta };
}

export function MetricasProvider({ children }) {
  const { usuario } = useAuth();
  const usuarioId = usuario?.id ?? null;

  const [medidasHistorial, setMedidasHistorial] = useState([]);
  const [pesoActual, setPesoActual] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const usuarioAnterior = useRef(usuarioId);

  // Lee desde Mongo las medidas (con su peso) y el peso actual.
  const recargar = useCallback(async () => {
    if (!usuarioId) return;
    const [medidas, datos] = await Promise.all([
      api('/medidas/').catch(() => null),
      api('/datos/').catch(() => null),
    ]);
    if (Array.isArray(medidas)) setMedidasHistorial(medidas.map(conEtiqueta));
    if (Number(datos?.pesoActual) > 0) setPesoActual(Number(datos.pesoActual));
  }, [usuarioId]);

  useEffect(() => {
    const anterior = usuarioAnterior.current;
    usuarioAnterior.current = usuarioId;

    if (anterior !== null && anterior !== usuarioId) {
      setMedidasHistorial([]);
      setPesoActual(null);
      setPerfil(null);
    }
    setError('');
    if (!usuarioId) return;

    // Mientras llega la respuesta, se usa el peso que vino con el login.
    if (Number(usuario?.datos?.pesoActual) > 0) setPesoActual(Number(usuario.datos.pesoActual));
    setCargando(true);
    recargar()
      .catch((e) => setError(e?.message || 'No se pudieron cargar las métricas.'))
      .finally(() => setCargando(false));
  }, [usuarioId]);

  // Historial de peso para el gráfico: un punto por cada medida guardada (su peso y su fecha)
  // y, al final, el peso actual si es distinto del de la última medida.
  const pesoHistorial = useMemo(() => {
    const puntos = medidasHistorial
      .map((medida, indice) => ({
        _id: `medida-${indice}`,
        origen: 'medida',
        kg: Number(medida.peso),
        fecha: medida.fecha,
        fechaISO: medida.fechaISO,
      }))
      .filter((punto) => punto.kg > 0);

    const ultimo = puntos[puntos.length - 1];
    if (pesoActual && (!ultimo || ultimo.kg !== pesoActual)) {
      puntos.push({ _id: 'actual', origen: 'actual', kg: pesoActual, fecha: 'Actual', fechaISO: new Date().toISOString() });
    }
    return puntos;
  }, [medidasHistorial, pesoActual]);

  // Guarda el peso de hoy en datos.pesoActual. Lanza el error si Django lo rechaza
  // (por ejemplo, 400 si la persona todavía no completa "Tus métricas").
  const agregarPeso = async (kg) => {
    await api('/datos/', { method: 'PATCH', body: { pesoActual: kg } });
    setPesoActual(kg);
    return true;
  };

  // Solo el peso actual se puede editar: los pesos de medidas antiguas quedan como registro histórico.
  const actualizarPeso = async (id, kg) => {
    if (id !== 'actual' && id !== pesoHistorial[pesoHistorial.length - 1]?._id) return false;
    await agregarPeso(kg);
    return true;
  };

  // Guarda una medición completa en medidas[] con el peso de ese día.
  // medidas = { pecho, cintura, brazo, pierna, peso? } — si no viene peso se usa el actual.
  const agregarMedidas = async (medidas) => {
    const peso = Number(medidas.peso) > 0 ? Number(medidas.peso) : pesoActual;
    if (!usuarioId || !peso) return false;
    try {
      const respuesta = await api('/medidas/', { method: 'POST', body: { ...medidas, peso } });
      const nueva = respuesta?.medidas ?? respuesta;
      setMedidasHistorial((historial) => [...historial, conEtiqueta(nueva)]);
      return true;
    } catch {
      return false;
    }
  };

  // Mantiene las métricas recientes en memoria para que el perfil las pueda mostrar tras editarlas.
  const guardarPerfil = async (datos) => {
    setPerfil((anterior) => ({ ...anterior, ...datos }));
  };

  return (
    <MetricasContext.Provider
      value={{
        pesoHistorial,
        medidasHistorial,
        pesoActual,
        perfil,
        agregarPeso,
        actualizarPeso,
        agregarMedidas,
        guardarPerfil,
        recargar,
        cargando,
        error,
      }}
    >
      {children}
    </MetricasContext.Provider>
  );
}

export function useMetricas() {
  const context = useContext(MetricasContext);
  if (!context) throw new Error('useMetricas debe usarse dentro de MetricasProvider');
  return context;
}
