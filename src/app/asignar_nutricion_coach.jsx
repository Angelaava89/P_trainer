import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import FondoThomas from '../components/FondoThomas';
import LogoMarca from '../components/LogoMarca';
import { colors } from '../constants/theme';
import '../global.css';

// En pantalla se usan los nombres de siempre; cada uno se guarda en un campo del día de la dieta
// en la base de datos (DiaDietaModel), por tipo de día.
const COMIDAS = ['Desayuno', 'Media mañana', 'Almuerzo', 'Media tarde', 'Cena', 'Medianoche', 'Snack', 'Suplementos'];
const CAMPO_COMIDA = {
  Desayuno: 'comida1',
  'Media mañana': 'comida2',
  Almuerzo: 'comida3',
  'Media tarde': 'pre_entreno',
  Cena: 'intra_entreno',
  Medianoche: 'medianoche',
  Snack: 'snack',
  Suplementos: 'suplementos',
};
// Mismo selector que ve el cliente en Mi Nutrición. El valor es el tipo_dia que guarda la base de datos.
const TIPOS_DIA = [
  { key: 'Entrenamiento', label: 'Días de entrenamiento', icono: 'barbell-outline' },
  { key: 'Descanso', label: 'Días de descanso', icono: 'bed-outline' },
];
// Todas las comidas (incluidos los suplementos) son de cada tipo de día.
const claveComida = (tipoDia, comida) => `${tipoDia}|${comida}`;
// La base de datos no acepta campos vacíos: lo que el coach deja sin llenar se guarda como "-".
const VACIO = '-';
// Alimentos creados por el coach en este teléfono (el catálogo /alimentos/ ya no existe en el servidor).
const CLAVE_ALIMENTOS_COACH = 'ptrainer_alimentos_coach_v1';

// Alimentos del "Plan Dieta Volumen-A" de Thomas. Calorías aproximadas según la porción de referencia.
const normalizarNombre = (texto = '') => String(texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const ALIMENTOS_DIETA_A = [
  { id: 'dieta-avena', nombreAlimento: 'Avena', tipo: 'Cereal', gramos: 100, calorias: 380 },
  { id: 'dieta-berries', nombreAlimento: 'Berries', tipo: 'Fruta', gramos: 100, calorias: 50 },
  { id: 'dieta-proteina-whey', nombreAlimento: 'Proteína whey (1 scoop)', tipo: 'Suplemento', gramos: 30, calorias: 120 },
  { id: 'dieta-arroz-blanco', nombreAlimento: 'Arroz blanco cocido', tipo: 'Carbohidrato', gramos: 100, calorias: 130 },
  { id: 'dieta-arroz-integral', nombreAlimento: 'Arroz integral cocido', tipo: 'Carbohidrato', gramos: 100, calorias: 112 },
  { id: 'dieta-carne-roja', nombreAlimento: 'Carne roja magra', tipo: 'Proteína', gramos: 100, calorias: 170 },
  { id: 'dieta-pollo', nombreAlimento: 'Pechuga de pollo', tipo: 'Proteína', gramos: 100, calorias: 165 },
  { id: 'dieta-tilapia', nombreAlimento: 'Tilapia', tipo: 'Proteína', gramos: 100, calorias: 128 },
  { id: 'dieta-verduras-verdes', nombreAlimento: 'Verduras verdes', tipo: 'Verdura', gramos: 100, calorias: 30 },
  { id: 'dieta-palta', nombreAlimento: 'Palta', tipo: 'Grasa saludable', gramos: 100, calorias: 160 },
  { id: 'dieta-muffin', nombreAlimento: 'Muffin (pre entreno)', tipo: 'Snack', gramos: 60, calorias: 230 },
  { id: 'dieta-barra-proteina', nombreAlimento: 'Barra de proteína Wild o YourGoal', tipo: 'Snack', gramos: 45, calorias: 180 },
  { id: 'dieta-galletas-arroz', nombreAlimento: 'Galletas de arroz (3 unidades)', tipo: 'Snack', gramos: 27, calorias: 105 },
  { id: 'dieta-almendras', nombreAlimento: 'Almendras', tipo: 'Grasa saludable', gramos: 10, calorias: 58 },
  // Suplementación del plan (tipo "Suplemento diario": solo aparecen en la sección Suplementos).
  { id: 'dieta-vitamina-c', nombreAlimento: 'Vitamina C 1000 mg (comida 1 o 2)', tipo: 'Suplemento diario', gramos: 1, calorias: 0 },
  { id: 'dieta-vitamina-d', nombreAlimento: 'Vitamina D (comida 1 o 2)', tipo: 'Suplemento diario', gramos: 1, calorias: 0 },
  { id: 'dieta-omega-3', nombreAlimento: 'Omega 3 (comida 1 o 2)', tipo: 'Suplemento diario', gramos: 1, calorias: 9 },
  { id: 'dieta-zma', nombreAlimento: 'ZMA 1 cápsula (noche)', tipo: 'Suplemento diario', gramos: 1, calorias: 0 },
  { id: 'dieta-l-carnitina', nombreAlimento: 'L-Carnitina (intra entreno)', tipo: 'Suplemento diario', gramos: 2, calorias: 0 },
  { id: 'dieta-bcaas', nombreAlimento: 'BCAAs (intra entreno)', tipo: 'Suplemento diario', gramos: 5, calorias: 20 },
];

// En "Suplementos" se muestran los suplementos (incluida la proteína whey);
// en las comidas se ocultan los suplementos diarios (vitaminas, ZMA, L-Carnitina, BCAAs).
const esSuplemento = (alimento) => normalizarNombre(alimento?.tipo).startsWith('suplemento');
const esSuplementoDiario = (alimento) => normalizarNombre(alimento?.tipo) === 'suplemento diario';
const delApartado = (alimento, comida) => (comida === 'Suplementos' ? esSuplemento(alimento) : !esSuplementoDiario(alimento));

// Cada comida se guarda como texto, un alimento por línea: "Avena · 100 g".
const textoDeComida = (alimentosElegidos) => alimentosElegidos.map(({ nombre, gramos }) => `${nombre} · ${gramos} g`).join('\n');
const leerTextoDeComida = (texto) => String(texto || '')
  .split('\n')
  .map((linea) => linea.trim())
  .filter((linea) => linea && linea !== VACIO)
  .map((linea) => {
    const partes = linea.match(/^(.*?)\s*·\s*(\d+)\s*g$/);
    return partes ? { nombre: partes[1].trim(), gramos: partes[2] } : { nombre: linea, gramos: '100' };
  });

const valorParametro = (valor) => (Array.isArray(valor) ? valor[0] : valor);

// Nutrición es solo para alumnos con Plan Avanzado vigente (misma regla que la pantalla de Clientes).
const tienePlanAvanzado = (planes = []) => {
  const lista = Array.isArray(planes) ? planes : [];
  const contratoActivo = [...lista].reverse().find((contrato) => normalizarNombre(contrato?.vigencia) === 'activo');
  return Boolean(contratoActivo) && normalizarNombre(`${contratoActivo.idPlan || ''} ${contratoActivo.nombre || ''}`).includes('avanz');
};

// El entrenador arma el plan por tipo de día y se guarda como dieta del alumno en el servidor (/dietas/).
export default function AsignarNutricionCoach() {
  const router = useRouter();
  const params = useLocalSearchParams();
  // Si se abre desde el perfil del cliente llega con su id; si se abre desde el inicio del coach,
  // primero se elige el cliente de la lista.
  const clienteDesdePerfil = valorParametro(params.clienteId) || '';
  const [clienteElegido, setClienteElegido] = useState(
    clienteDesdePerfil ? { id: clienteDesdePerfil, nombre: valorParametro(params.nombre) || 'Cliente' } : null
  );
  const [clientes, setClientes] = useState([]);
  // true cuando el cliente ya tenía un plan asignado: la pantalla pasa a "Editar plan".
  const [editandoPlan, setEditandoPlan] = useState(false);
  // id de la dieta que el cliente ya tenía (se reemplaza al guardar).
  const [dietaAnteriorId, setDietaAnteriorId] = useState('');
  const clienteId = clienteElegido?.id || '';
  const nombreCliente = clienteElegido?.nombre || 'Cliente';
  const [tipoDia, setTipoDia] = useState('Entrenamiento');
  const [selectorTipoDiaAbierto, setSelectorTipoDiaAbierto] = useState(false);
  const [comidaActiva, setComidaActiva] = useState(COMIDAS[0]);
  const [alimentos, setAlimentos] = useState([]);
  const [planPorComida, setPlanPorComida] = useState({});
  const [alimentosAgregadosPorComida, setAlimentosAgregadosPorComida] = useState({});
  // Agua diaria del plan (en litros), aparte de las comidas. Parte con lo del Plan Dieta A: 2 a 3 litros.
  const [aguaMinima, setAguaMinima] = useState('2');
  const [aguaMaxima, setAguaMaxima] = useState('3');
  // Datos generales de la dieta (opcionales).
  const [datosGenerales, setDatosGenerales] = useState({ tmb: '', macros: '', notas: '' });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [modalAlimento, setModalAlimento] = useState(false);
  const [guardandoAlimento, setGuardandoAlimento] = useState(false);
  const [nuevoAlimento, setNuevoAlimento] = useState({ nombreAlimento: '', tipo: 'General', gramos: '100', calorias: '' });

  // Alimentos que el coach creó en este teléfono.
  useFocusEffect(useCallback(() => {
    let activa = true;
    AsyncStorage.getItem(CLAVE_ALIMENTOS_COACH)
      .then((texto) => { if (activa) setAlimentos(texto ? JSON.parse(texto) : []); })
      .catch(() => { if (activa) setAlimentos([]); });
    return () => { activa = false; };
  }, []));

  // Lista de clientes para elegir a quién se le asigna el plan (solo cuando se abre desde el inicio).
  useFocusEffect(useCallback(() => {
    if (clienteDesdePerfil) return undefined;
    let activa = true;
    api('/alumnos/')
      .then((lista) => {
        if (!activa) return;
        setClientes((Array.isArray(lista) ? lista : [])
          .filter((alumno) => tienePlanAvanzado(alumno.plan))
          .map((alumno) => ({ id: String(alumno.id), nombre: alumno.nombre || 'Cliente' })));
      })
      .catch(() => { if (activa) setClientes([]); });
    return () => { activa = false; };
  }, [clienteDesdePerfil]));

  // Catálogo: alimentos del Plan Dieta A + los creados por el coach (sin repetir nombres).
  const catalogo = useMemo(() => {
    const nombres = new Set(ALIMENTOS_DIETA_A.map((a) => normalizarNombre(a.nombreAlimento)));
    return [...ALIMENTOS_DIETA_A, ...alimentos.filter((a) => !nombres.has(normalizarNombre(a.nombreAlimento)))];
  }, [alimentos]);

  // Al elegir un cliente se carga del servidor su última dieta, para poder editarla. Si no tiene, parte vacío.
  useEffect(() => {
    let activa = true;
    setPlanPorComida({});
    setAlimentosAgregadosPorComida({});
    setDietaAnteriorId('');
    setEditandoPlan(false);
    if (!clienteId) {
      setCargando(false);
      return undefined;
    }
    setCargando(true);
    api(`/dietas/listar/${clienteId}/`)
      .then((respuesta) => {
        if (!activa) return;
        const dietas = Array.isArray(respuesta?.dietas) ? respuesta.dietas : [];
        const dieta = dietas[dietas.length - 1];
        if (!dieta) return;

        const plan = {};
        const extras = [];
        const agregarComida = (clave, texto) => {
          const elegidos = leerTextoDeComida(texto);
          if (!elegidos.length) return;
          plan[clave] = {};
          elegidos.forEach(({ nombre, gramos }) => {
            let alimento = [...catalogo, ...extras].find((a) => normalizarNombre(a.nombreAlimento) === normalizarNombre(nombre));
            if (!alimento) {
              alimento = { id: `extra-${normalizarNombre(nombre)}`, nombreAlimento: nombre, tipo: 'General', gramos: Number(gramos) || 100, calorias: 0 };
              extras.push(alimento);
            }
            plan[clave][String(alimento.id)] = String(gramos);
          });
        };
        (Array.isArray(dieta.dias) ? dieta.dias : []).forEach((dia) => {
          const tipo = TIPOS_DIA.some((t) => t.key === dia.tipo_dia) ? dia.tipo_dia : 'Entrenamiento';
          Object.entries(CAMPO_COMIDA).forEach(([comida, campo]) => agregarComida(claveComida(tipo, comida), dia[campo]));
          const litros = String(dia.agua || '').match(/(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?/);
          if (litros) {
            setAguaMinima(litros[1]);
            setAguaMaxima(litros[2] || litros[1]);
          }
        });
        // Dietas guardadas antes: si los días no traen suplementos, se usan los de la dieta completa.
        if (!(dieta.dias || []).some((dia) => leerTextoDeComida(dia.suplementos).length)) {
          TIPOS_DIA.forEach(({ key }) => agregarComida(claveComida(key, 'Suplementos'), dieta.suplementos));
        }

        if (extras.length) setAlimentos((actuales) => [...actuales, ...extras]);
        setPlanPorComida(plan);
        setAlimentosAgregadosPorComida(Object.fromEntries(Object.entries(plan).map(([clave, seleccion]) => [
          clave,
          Object.fromEntries(Object.keys(seleccion).map((id) => [id, true])),
        ])));
        const valor = (texto) => (String(texto || '').trim() === VACIO ? '' : String(texto || ''));
        setDatosGenerales({ tmb: valor(dieta.tmb), macros: valor(dieta.macros), notas: valor(dieta.notas) });
        setDietaAnteriorId(String(dieta.idDieta || ''));
        setEditandoPlan(true);
        setAviso('');
      })
      .catch((error) => { if (activa) setAviso(error?.message || 'No se pudo cargar el plan del cliente.'); })
      .finally(() => { if (activa) setCargando(false); });
    return () => { activa = false; };
    // El plan se vuelve a leer solo al cambiar de cliente.
  }, [clienteId]);

  const claveActiva = claveComida(tipoDia, comidaActiva);
  const seleccionActual = planPorComida[claveActiva] || {};
  // Comidas con alimentos agregados, contando los dos tipos de día.
  const cantidadComidasAgregadas = useMemo(
    () => Object.values(alimentosAgregadosPorComida).filter((comida) => Object.keys(comida || {}).length > 0).length,
    [alimentosAgregadosPorComida]
  );
  const cantidadAlimentosAgregados = useMemo(
    () => Object.values(alimentosAgregadosPorComida).reduce((total, comida) => total + Object.keys(comida || {}).length, 0),
    [alimentosAgregadosPorComida]
  );
  // Cuántos alimentos tiene cada comida en el tipo de día elegido (para los chips).
  const cantidadEnComida = (comida) => Object.keys(alimentosAgregadosPorComida[claveComida(tipoDia, comida)] || {}).length;

  const alternarAlimento = (alimento) => {
    const id = String(alimento.id || '');
    if (!id) return;
    setPlanPorComida((actual) => {
      const comida = { ...(actual[claveActiva] || {}) };
      if (comida[id] !== undefined) delete comida[id];
      else comida[id] = String(alimento.gramos || 100);
      return { ...actual, [claveActiva]: comida };
    });
    setAlimentosAgregadosPorComida((actual) => {
      const comida = { ...(actual[claveActiva] || {}) };
      delete comida[id];
      return { ...actual, [claveActiva]: comida };
    });
  };

  const cambiarGramos = (id, gramos) => {
    setPlanPorComida((actual) => ({
      ...actual,
      [claveActiva]: { ...(actual[claveActiva] || {}), [id]: gramos.replace(/[^0-9]/g, '') },
    }));
    setAlimentosAgregadosPorComida((actual) => {
      const comida = { ...(actual[claveActiva] || {}) };
      delete comida[id];
      return { ...actual, [claveActiva]: comida };
    });
  };

  // Confirma un alimento de la comida actual solo después de revisar sus gramos.
  const agregarAlimento = (id) => {
    const gramos = Number(seleccionActual[id]);
    if (!Number.isInteger(gramos) || gramos < 1) {
      Alert.alert('Revisa los gramos', 'Ingresa una cantidad mayor a cero antes de agregar el alimento.');
      return;
    }
    setAlimentosAgregadosPorComida((actual) => ({
      ...actual,
      [claveActiva]: { ...(actual[claveActiva] || {}), [id]: true },
    }));
  };

  // Texto de una comida con solo los alimentos que el coach confirmó con "Agregar".
  const textoComida = (clave) => {
    const elegidos = Object.entries(planPorComida[clave] || {})
      .filter(([id]) => alimentosAgregadosPorComida[clave]?.[id])
      .map(([id, gramos]) => ({ nombre: catalogo.find((a) => String(a.id) === id)?.nombreAlimento || 'Alimento', gramos: Number(gramos) }));
    return elegidos.length ? textoDeComida(elegidos) : VACIO;
  };

  const guardarPlan = async () => {
    if (!clienteId) {
      Alert.alert('Falta el cliente', 'Elige arriba a qué cliente le asignas el plan.');
      return;
    }
    // Si el cliente ya tenía plan, se permite guardarlo vacío (el coach quitó todos los alimentos).
    if (!cantidadAlimentosAgregados && !editandoPlan) {
      Alert.alert('Plan vacío', 'Presiona el botón + en al menos un alimento para incluirlo en el plan.');
      return;
    }
    const litrosMin = Number(String(aguaMinima).replace(',', '.'));
    const litrosMax = Number(String(aguaMaxima || aguaMinima).replace(',', '.'));
    if (!(litrosMin > 0 && litrosMin <= 10) || !(litrosMax >= litrosMin && litrosMax <= 10)) {
      Alert.alert('Revisa el agua', 'Ingresa los litros de agua diarios (por ejemplo, de 2 a 3 litros).');
      return;
    }
    const conGramosInvalidos = Object.entries(planPorComida).some(([clave, seleccion]) => Object.entries(seleccion || {})
      .some(([id, gramos]) => alimentosAgregadosPorComida[clave]?.[id] && (!Number.isInteger(Number(gramos)) || Number(gramos) < 1)));
    if (conGramosInvalidos) {
      Alert.alert('Revisa las cantidades', 'Cada alimento debe tener una cantidad en gramos mayor a cero.');
      return;
    }

    const agua = litrosMax > litrosMin ? `${litrosMin}–${litrosMax} L` : `${litrosMin} L`;
    const dieta = {
      tmb: datosGenerales.tmb.trim() || VACIO,
      macros: datosGenerales.macros.trim() || VACIO,
      notas: datosGenerales.notas.trim() || VACIO,
      // Los suplementos ahora van en cada día; este campo general queda con "-".
      suplementos: VACIO,
      // Un día por tipo: así el cliente filtra por Días de entrenamiento / Días de descanso.
      dias: TIPOS_DIA.map(({ key }) => ({
        tipo_dia: key,
        ...Object.fromEntries(Object.entries(CAMPO_COMIDA).map(([comida, campo]) => [campo, textoComida(claveComida(key, comida))])),
        agua,
      })),
    };

    // Límites de largo de la base de datos (comidas 500, notas 350, macros 250, TMB 150 caracteres).
    const muyLargo = [
      ...dieta.dias.flatMap((dia) => Object.keys(CAMPO_COMIDA).map((comida) => [`${comida} (${dia.tipo_dia})`, dia[CAMPO_COMIDA[comida]], 500])),
      ['Notas', dieta.notas, 350],
      ['Macros', dieta.macros, 250],
      ['TMB', dieta.tmb, 150],
    ].find(([, texto, limite]) => String(texto).length > limite);
    if (muyLargo) {
      Alert.alert('Demasiado largo', `${muyLargo[0]} supera los ${muyLargo[2]} caracteres que acepta la base de datos. Quita algunos alimentos o acorta el texto.`);
      return;
    }

    setGuardando(true);
    try {
      await api(`/dietas/crear/${clienteId}/`, { method: 'POST', body: dieta });
      // La dieta nueva reemplaza a la anterior (se borra después de guardar la nueva, para no perder nada si algo falla).
      if (dietaAnteriorId) {
        await api(`/dietas/eliminar/${clienteId}/${dietaAnteriorId}/`, { method: 'DELETE' }).catch(() => {});
      }
      if (clienteDesdePerfil) {
        Alert.alert(editandoPlan ? 'Plan actualizado' : 'Plan asignado', `La nutrición de ${nombreCliente} quedó guardada.`, [
          { text: 'Volver al perfil', onPress: () => router.back() },
        ]);
      } else {
        // Desde el inicio: queda lista para asignar el plan de otro cliente.
        Alert.alert(editandoPlan ? 'Plan actualizado' : 'Plan asignado', `La nutrición de ${nombreCliente} quedó guardada.`);
        setPlanPorComida({});
        setAlimentosAgregadosPorComida({});
        setClienteElegido(null);
      }
    } catch (error) {
      Alert.alert('No se pudo asignar', String(error?.message || '') || 'Revisa la conexión con el servidor e inténtalo nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  // Los alimentos nuevos se guardan en el catálogo de este teléfono.
  const crearAlimento = async () => {
    const gramos = Number(nuevoAlimento.gramos);
    const calorias = Number(nuevoAlimento.calorias);
    if (!nuevoAlimento.nombreAlimento.trim() || !nuevoAlimento.calorias.trim() || !Number.isInteger(gramos) || gramos < 1 || !Number.isFinite(calorias) || calorias < 0) {
      Alert.alert('Completa los datos', 'Ingresa el nombre, los gramos de referencia y las calorías del alimento.');
      return;
    }

    setGuardandoAlimento(true);
    try {
      const alimento = {
        id: `coach-${Date.now()}`,
        nombreAlimento: nuevoAlimento.nombreAlimento.trim(),
        tipo: nuevoAlimento.tipo.trim() || 'General',
        gramos,
        calorias: Math.round(calorias),
      };
      const lista = [...alimentos.filter((a) => !String(a.id).startsWith('extra-')), alimento];
      await AsyncStorage.setItem(CLAVE_ALIMENTOS_COACH, JSON.stringify(lista));
      setAlimentos((actuales) => [...actuales, alimento]);
      setPlanPorComida((actual) => ({
        ...actual,
        [claveActiva]: { ...(actual[claveActiva] || {}), [String(alimento.id)]: String(alimento.gramos || gramos) },
      }));
      setNuevoAlimento({ nombreAlimento: '', tipo: 'General', gramos: '100', calorias: '' });
      setModalAlimento(false);
    } catch (error) {
      Alert.alert('No se pudo guardar el alimento', error?.message || 'Inténtalo nuevamente.');
    } finally {
      setGuardandoAlimento(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_perfil.jpg')} />
      <View className="flex-row items-center px-5 pt-2 pb-3">
        <TouchableOpacity accessibilityLabel="Volver" onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={26} color={colors.blanco} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text numberOfLines={1} className="text-blanco text-xl font-masthead">{editandoPlan ? 'Editar plan de nutrición' : 'Plan de nutrición'}</Text>
          <Text numberOfLines={1} className="text-blanco/50 text-xs mt-1">{clienteElegido ? `Para ${nombreCliente}` : 'Elige un cliente'}</Text>
        </View>
        <LogoMarca />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        {/* Selección del cliente cuando se entra desde "Nutrición" en el inicio del coach */}
        {!clienteDesdePerfil && (
          <View className="bg-grafito rounded-2xl p-4 mb-4">
            <Text className="text-blanco text-sm font-bold">Cliente</Text>
            <Text className="text-blanco/50 text-xs mt-1">Elige a quién le asignas este plan de nutrición. Solo aparecen clientes con Plan Avanzado.</Text>
            {clientes.length ? (
              <View className="flex-row flex-wrap mt-4" style={{ gap: 8 }}>
                {clientes.map((cliente) => {
                  const activo = clienteElegido?.id === cliente.id;
                  return (
                    <TouchableOpacity
                      key={cliente.id}
                      onPress={() => setClienteElegido(cliente)}
                      className={`flex-row items-center rounded-full px-3 py-2 ${activo ? 'bg-azulClaro' : 'bg-carbon'}`}
                    >
                      <Ionicons name={activo ? 'checkmark-circle' : 'person-outline'} size={15} color={colors.blanco} style={{ opacity: activo ? 1 : 0.6 }} />
                      <Text className={`text-xs ml-1 ${activo ? 'text-blanco font-bold' : 'text-blanco/60'}`}>{cliente.nombre}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text className="text-blanco/40 text-xs mt-3">No hay clientes con Plan Avanzado activo todavía.</Text>
            )}
          </View>
        )}

        {/* Agua diaria: aplica a todos los días, no es una comida */}
        <View className="bg-grafito rounded-2xl p-4 mb-4">
          <View className="flex-row items-center">
            <Ionicons name="water-outline" size={20} color={colors.azulClaro} />
            <Text className="text-blanco text-sm font-bold ml-2">Cantidad de agua asignada</Text>
          </View>
          <Text className="text-blanco/50 text-xs mt-1">Litros de agua que el cliente debe tomar al día, como mínimo.</Text>
          <View className="flex-row items-center mt-4">
            <TextInput
              accessibilityLabel="Litros de agua mínimos"
              value={aguaMinima}
              onChangeText={(v) => setAguaMinima(v.replace(/[^0-9.,]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="2"
              placeholderTextColor={colors.gris}
              className="bg-carbon rounded-lg text-blanco text-base text-center px-3 py-2"
              style={{ width: 70 }}
            />
            <Text className="text-blanco/60 text-sm mx-3">a</Text>
            <TextInput
              accessibilityLabel="Litros de agua máximos"
              value={aguaMaxima}
              onChangeText={(v) => setAguaMaxima(v.replace(/[^0-9.,]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="3"
              placeholderTextColor={colors.gris}
              className="bg-carbon rounded-lg text-blanco text-base text-center px-3 py-2"
              style={{ width: 70 }}
            />
            <Text className="text-blanco/60 text-sm ml-3">litros diarios</Text>
          </View>
        </View>

        {/* Tipo de día: el coach arma por separado las comidas de días de entrenamiento y de descanso.
            Es el mismo filtro que ve el cliente en Mi Nutrición. */}
        <View className="mb-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Tipo de día seleccionado: ${TIPOS_DIA.find((opcion) => opcion.key === tipoDia)?.label}`}
            accessibilityState={{ expanded: selectorTipoDiaAbierto }}
            onPress={() => setSelectorTipoDiaAbierto((abierto) => !abierto)}
            className="flex-row items-center bg-grafito rounded-2xl px-4 py-4"
            style={{ borderWidth: 1, borderColor: colors.azulOscuro }}
          >
            <Ionicons name={TIPOS_DIA.find((opcion) => opcion.key === tipoDia)?.icono || 'barbell-outline'} size={22} color={colors.azulClaro} />
            <Text className="text-blanco text-sm font-bold flex-1 ml-3">
              {TIPOS_DIA.find((opcion) => opcion.key === tipoDia)?.label}
            </Text>
            <Ionicons name={selectorTipoDiaAbierto ? 'chevron-up' : 'chevron-down'} size={20} color={colors.blanco} />
          </TouchableOpacity>

          {selectorTipoDiaAbierto && (
            <View className="bg-grafito rounded-2xl mt-2 overflow-hidden" style={{ borderWidth: 1, borderColor: colors.azulOscuro }}>
              {TIPOS_DIA.map((opcion, indice) => {
                const activa = tipoDia === opcion.key;
                return (
                  <TouchableOpacity
                    key={opcion.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activa }}
                    onPress={() => {
                      setTipoDia(opcion.key);
                      setSelectorTipoDiaAbierto(false);
                    }}
                    className="flex-row items-center px-4 py-4"
                    style={indice > 0 ? { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' } : undefined}
                  >
                    <Ionicons name={opcion.icono} size={21} color={activa ? colors.azulClaro : colors.gris} />
                    <Text className={`text-sm flex-1 ml-3 ${activa ? 'text-blanco font-bold' : 'text-blanco/70'}`}>{opcion.label}</Text>
                    {activa && <Ionicons name="checkmark" size={20} color={colors.azulClaro} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Datos generales de la dieta (opcionales): TMB, macros y notas para el cliente. */}
        <View className="bg-grafito rounded-2xl p-4 mb-4">
          <Text className="text-blanco text-sm font-bold">Datos generales (opcional)</Text>
          <Text className="text-blanco/50 text-xs mt-1 mb-3">Se muestran al cliente en Mi Nutrición.</Text>
          <CampoAlimento label="TMB" value={datosGenerales.tmb} placeholder="Ej. 1.850 kcal" onChangeText={(tmb) => setDatosGenerales((actual) => ({ ...actual, tmb }))} />
          <CampoAlimento label="Macros" value={datosGenerales.macros} placeholder="Ej. P 180 g · C 250 g · G 60 g" onChangeText={(macros) => setDatosGenerales((actual) => ({ ...actual, macros }))} />
          <CampoAlimento label="Notas" value={datosGenerales.notas} placeholder="Indicaciones para el cliente" onChangeText={(notas) => setDatosGenerales((actual) => ({ ...actual, notas }))} />
        </View>

        <View className="bg-grafito rounded-2xl p-4 mb-4">
          {editandoPlan && (
            <View className="flex-row items-center rounded-xl px-3 py-2 mb-3" style={{ backgroundColor: `${colors.verde}1F` }}>
              <Ionicons name="create-outline" size={16} color={colors.verde} />
              <Text className="text-xs ml-2 flex-1" style={{ color: colors.verde }}>
                {nombreCliente} ya tiene un plan. Cambia, agrega o quita alimentos (ícono de basurero) y vuelve a guardar para actualizarlo.
              </Text>
            </View>
          )}
          <Text className="text-blanco text-sm font-bold">Organiza las comidas</Text>
          <Text className="text-blanco/50 text-xs mt-1">Elige arriba el tipo de día y agrega alimentos a sus comidas.</Text>
          <View className="flex-row flex-wrap mt-4" style={{ gap: 8 }}>
            {COMIDAS.map((comida) => {
              const activa = comidaActiva === comida;
              const cantidad = cantidadEnComida(comida);
              return (
                <TouchableOpacity key={comida} onPress={() => setComidaActiva(comida)} className={`rounded-full px-3 py-2 ${activa ? 'bg-azulClaro' : 'bg-carbon'}`}>
                  <Text className={`text-xs ${activa ? 'text-blanco font-bold' : 'text-blanco/60'}`}>{comida}{cantidad ? ` · ${cantidad}` : ''}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-blanco text-base font-bold">{`${comidaActiva} · ${TIPOS_DIA.find((opcion) => opcion.key === tipoDia)?.label}`}</Text>
            <Text className="text-blanco/40 text-xs mt-1">{Object.keys(seleccionActual).length} seleccionados</Text>
          </View>
          {/* Botón "+" igual al de las otras pantallas del coach (Videos, Rutinas) */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Crear alimento"
            onPress={() => setModalAlimento(true)}
            style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.azulClaro }}
          >
            <Ionicons name="add" size={27} color={colors.blanco} />
          </TouchableOpacity>
        </View>

        {!!aviso && <Text className="text-rojo text-xs mb-3">{aviso}</Text>}
        {cargando ? (
          <View className="bg-grafito rounded-2xl p-5"><Text className="text-blanco/60 text-sm">Cargando plan…</Text></View>
        ) : catalogo.some((a) => delApartado(a, comidaActiva)) ? catalogo.filter((a) => delApartado(a, comidaActiva)).map((alimento) => {
          const id = String(alimento.id);
          const seleccionado = seleccionActual[id] !== undefined;
          return (
            <View key={id} className="bg-grafito rounded-2xl p-4 mb-3">
              <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: seleccionado }} onPress={() => alternarAlimento(alimento)} className="flex-row items-center">
                <Ionicons name={seleccionado ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={seleccionado ? colors.azulClaro : colors.gris} />
                <View className="flex-1 ml-3">
                  <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
                    <Text className="text-blanco text-sm font-bold">{alimento.nombreAlimento}</Text>
                    {String(alimento.id).startsWith('dieta-') && (
                      <View className="rounded-full px-2" style={{ backgroundColor: `${colors.azulClaro}33`, paddingVertical: 1 }}>
                        <Text className="text-azulClaro text-[11px] font-bold">Plan Dieta A</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-blanco/45 text-xs mt-1">{alimento.tipo || 'Alimento'} · {alimento.calorias || 0} kcal por {alimento.gramos || 100} g</Text>
                </View>
              </TouchableOpacity>
              {seleccionado && (
                <View className="flex-row items-center mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' }}>
                  <Text className="text-blanco/60 text-xs flex-1">Gramos</Text>
                  <TextInput
                    accessibilityLabel={`Gramos de ${alimento.nombreAlimento}`}
                    value={String(seleccionActual[id])}
                    onChangeText={(valor) => cambiarGramos(id, valor)}
                    keyboardType="number-pad"
                    placeholder="100"
                    placeholderTextColor={colors.gris}
                    className="bg-carbon rounded-lg text-blanco text-sm text-center px-3 py-2"
                    style={{ width: 76 }}
                  />
                  <Text className="text-blanco/50 text-xs ml-2">g</Text>
                  {/* Botón "+" para agregar: azul si falta agregarlo, verde cuando ya está en el plan. */}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Agregar ${alimento.nombreAlimento}`}
                    accessibilityState={{ selected: Boolean(alimentosAgregadosPorComida[claveActiva]?.[id]) }}
                    onPress={() => agregarAlimento(id)}
                    className="items-center justify-center rounded-lg ml-3"
                    style={{ minHeight: 40, width: 40, backgroundColor: alimentosAgregadosPorComida[claveActiva]?.[id] ? `${colors.verde}22` : colors.azulClaro, borderWidth: alimentosAgregadosPorComida[claveActiva]?.[id] ? 1 : 0, borderColor: colors.verde }}
                  >
                    <Ionicons name="add" size={22} color={alimentosAgregadosPorComida[claveActiva]?.[id] ? colors.verde : colors.blanco} />
                  </TouchableOpacity>
                  {/* Quita el alimento del plan del cliente (se aplica al guardar). */}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${alimento.nombreAlimento}`}
                    onPress={() => alternarAlimento(alimento)}
                    className="items-center justify-center rounded-lg ml-2"
                    style={{ minHeight: 40, width: 40, borderWidth: 1, borderColor: colors.rojo }}
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.rojo} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }) : (
          <View className="bg-grafito rounded-2xl p-5 items-center">
            <Ionicons name="nutrition-outline" size={32} color={colors.azulClaro} />
            <Text className="text-blanco text-sm font-bold mt-3">Aún no hay alimentos</Text>
            <Text className="text-blanco/50 text-xs text-center mt-1">Agrega alimentos al catálogo para incluirlos en el plan de {nombreCliente}.</Text>
          </View>
        )}

        <View className="bg-grafito rounded-xl px-4 py-3 mt-2 mb-4">
          <Text className="text-blanco/60 text-xs">Alimentos agregados al plan: <Text className="text-azulClaro font-bold">{cantidadAlimentosAgregados}</Text></Text>
        </View>
      </ScrollView>

      {/* La acción permanece fija y muestra cuántas comidas ya están listas para guardar. */}
      <View className="px-5 pt-3 pb-2" style={{ backgroundColor: colors.carbon, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
        <Text className="text-blanco/60 text-xs text-center mb-2">
          {cantidadComidasAgregadas} {cantidadComidasAgregadas === 1 ? 'comida agregada' : 'comidas agregadas'} · {cantidadAlimentosAgregados} {cantidadAlimentosAgregados === 1 ? 'alimento' : 'alimentos'}
        </Text>
        <TouchableOpacity
          disabled={guardando || cargando || !clienteId || (cantidadComidasAgregadas === 0 && !editandoPlan)}
          onPress={guardarPlan}
          className="flex-row items-center justify-center rounded-xl bg-azulClaro"
          style={{ minHeight: 52, opacity: guardando || cargando || !clienteId || (cantidadComidasAgregadas === 0 && !editandoPlan) ? 0.55 : 1 }}
        >
          <Ionicons name={guardando ? 'hourglass-outline' : 'checkmark-circle-outline'} size={20} color={colors.blanco} />
          <Text className="text-blanco text-sm font-bold ml-2">
            {guardando ? 'Guardando plan…' : editandoPlan ? 'Guardar todas las comidas' : 'Agregar todas las comidas'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalAlimento} transparent animationType="fade" onRequestClose={() => setModalAlimento(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 items-center justify-center px-5" style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}>
          <View className="w-full max-w-lg bg-grafito rounded-2xl p-5">
            <View className="flex-row items-center mb-4">
              <View className="flex-1">
                <Text className="text-blanco text-lg font-bold">Agregar alimento</Text>
                <Text className="text-blanco/50 text-xs mt-1">Quedará en el catálogo disponible para los planes.</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Cerrar" onPress={() => setModalAlimento(false)}><Ionicons name="close" size={24} color={colors.gris} /></TouchableOpacity>
            </View>
            <CampoAlimento label="Nombre" value={nuevoAlimento.nombreAlimento} placeholder="Ej. Avena" onChangeText={(valor) => setNuevoAlimento((actual) => ({ ...actual, nombreAlimento: valor }))} />
            <CampoAlimento label="Tipo" value={nuevoAlimento.tipo} placeholder="Ej. Cereal" onChangeText={(valor) => setNuevoAlimento((actual) => ({ ...actual, tipo: valor }))} />
            <View className="flex-row" style={{ gap: 10 }}>
              <View className="flex-1"><CampoAlimento label="Porción (g)" value={nuevoAlimento.gramos} placeholder="100" keyboardType="number-pad" onChangeText={(valor) => setNuevoAlimento((actual) => ({ ...actual, gramos: valor }))} /></View>
              <View className="flex-1"><CampoAlimento label="Calorías" value={nuevoAlimento.calorias} placeholder="380" keyboardType="number-pad" onChangeText={(valor) => setNuevoAlimento((actual) => ({ ...actual, calorias: valor }))} /></View>
            </View>
            <View className="flex-row mt-2" style={{ gap: 10 }}>
              <TouchableOpacity onPress={() => setModalAlimento(false)} className="flex-1 items-center justify-center rounded-xl bg-carbon" style={{ minHeight: 46 }}><Text className="text-blanco/70 text-sm">Cancelar</Text></TouchableOpacity>
              <TouchableOpacity disabled={guardandoAlimento} onPress={crearAlimento} className="flex-1 items-center justify-center rounded-xl bg-azulClaro" style={{ minHeight: 46, opacity: guardandoAlimento ? 0.6 : 1 }}><Text className="text-blanco text-sm font-bold">{guardandoAlimento ? 'Guardando…' : 'Guardar alimento'}</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// Los campos numéricos y de texto comparten el mismo estilo de la interfaz oscura.
function CampoAlimento({ label, value, placeholder, keyboardType = 'default', onChangeText }) {
  return (
    <View className="mb-3">
      <Text className="text-blanco/60 text-xs mb-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gris}
        keyboardType={keyboardType}
        className="bg-carbon rounded-xl px-3 py-3 text-blanco text-sm"
      />
    </View>
  );
}
