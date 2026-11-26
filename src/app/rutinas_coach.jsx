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
import { ChipsMusculos, ImagenEjercicio } from '../components/FichaEjercicio';
import FondoThomas from '../components/FondoThomas';
import LogoMarca from '../components/LogoMarca';
import VideoEjercicio from '../components/VideoEjercicio';
import { colors } from '../constants/theme';
import '../global.css';
import { infoEjercicio } from '../lib/ejerciciosInfo';
import {
  CLAVE_ASIGNACIONES,
  CLAVE_EJERCICIOS,
  CLAVE_RUTINAS,
  CLAVE_RUTINAS_POR_CLIENTE,
  EJERCICIOS_INICIALES,
  RUTINAS_INICIALES,
  actualizarBibliotecaReal,
} from '../lib/rutinas';
import { obtenerUriVideoLocal } from '../lib/videosLocales';

// La biblioteca se conserva en el teléfono y cada asignación se guarda también en el perfil del alumno del servidor.
const NIVELES = ['Inicial', 'Intermedio', 'Avanzado'];
const TODOS = 'Todos';
const FILTROS_PLAN_CLIENTE = [TODOS, 'Básico', 'Avanzado'];

const valorParametro = (valor) => (Array.isArray(valor) ? valor[0] : valor);

// Normaliza tildes y mayúsculas para que las búsquedas sean más flexibles.
const normalizar = (texto = '') => texto
  .toLocaleLowerCase('es-CL')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

// Determina el plan contratado desde el último plan activo del alumno, sin inferirlo desde su experiencia.
const planContratadoDelAlumno = (planes = []) => {
  const lista = Array.isArray(planes) ? planes : [];
  const plan = [...lista].reverse().find((item) => normalizar(item?.vigencia) === 'activo');
  if (!plan) return null;
  const nombre = normalizar(plan?.nombre || '');
  if (nombre.includes('avanz')) return 'Avanzado';
  if (nombre.includes('basic') || nombre.includes('principiante') || nombre.includes('inicial')) return 'Básico';
  return null;
};

// Convierte tanto las rutinas iniciales como las creadas por el entrenador al formato de la API.
const rutinaParaServidor = (rutina) => {
  // Algunas rutinas predeterminadas pueden venir organizadas por días; el esquema actual guarda ejercicios en una sola lista.
  const ejerciciosPorDia = (rutina.dias || []).flatMap((dia) => (
    (dia.ejercicios || []).map((ejercicio) => ({
      ...ejercicio,
      nombre: `${dia.nombre || 'Día'} · ${ejercicio.nombre || ejercicio.nombreEjercicio || 'Ejercicio'}`,
    }))
  ));
  const ejercicios = Array.isArray(rutina.ejercicios) && rutina.ejercicios.length
    ? rutina.ejercicios
    : ejerciciosPorDia;

  return {
    id: String(rutina.id || rutina.idRutina || rutina.titulo || rutina.nombre || ''),
    titulo: rutina.titulo || rutina.nombre || rutina.enfoqueRutina || 'Rutina',
    nivel: rutina.nivel || '',
    frecuencia: rutina.frecuencia || '',
    ejercicios: ejercicios.map(({ videoLocal, ...ejercicio }) => ({
      ...ejercicio,
      nombre: ejercicio.nombre || ejercicio.nombreEjercicio || 'Ejercicio',
      grupo: ejercicio.grupo || ejercicio.equipo || '',
      equipo: ejercicio.equipo || ejercicio.grupo || '',
    })),
  };
};

export default function RutinasCoach() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const nombre = valorParametro(params.nombre) || '';
  const clienteId = valorParametro(params.clienteId) || '';
  const claveCliente = clienteId ? String(clienteId) : nombre ? `nombre:${normalizar(nombre)}` : '';

  const [rutinas, setRutinas] = useState(RUTINAS_INICIALES);
  const [ejercicios, setEjercicios] = useState(EJERCICIOS_INICIALES);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [nivelFiltro, setNivelFiltro] = useState(TODOS);
  const [expandida, setExpandida] = useState('');
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [modoSeleccion, setModoSeleccion] = useState(Boolean(claveCliente));
  const [modalClienteVisible, setModalClienteVisible] = useState(false);
  const [clienteAsignacionId, setClienteAsignacionId] = useState('');
  const [clientesDisponibles, setClientesDisponibles] = useState([]);
  const [filtroPlanCliente, setFiltroPlanCliente] = useState(TODOS);
  const [modalRutinaVisible, setModalRutinaVisible] = useState(false);
  const [idRutinaEditando, setIdRutinaEditando] = useState('');
  const [formRutina, setFormRutina] = useState({ titulo: '', nivel: 'Inicial', frecuencia: '', ejercicios: [] });
  const [modalEjercicioVisible, setModalEjercicioVisible] = useState(false);
  const [videoAbierto, setVideoAbierto] = useState(null);
  const [rutinaDelEjercicio, setRutinaDelEjercicio] = useState('');
  const [idEjercicioEditando, setIdEjercicioEditando] = useState('');
  const [formEjercicio, setFormEjercicio] = useState({ nombre: '', series: '3', repeticiones: '10', peso: '', descanso: '60 s', video: '' });
  // Rutinas editadas solo para el cliente abierto (no cambian la biblioteca ni a los demás clientes).
  const [copiasCliente, setCopiasCliente] = useState({});

  // El selector de asignación se alimenta de las cuentas de cliente registradas en el servidor.
  useFocusEffect(useCallback(() => {
    let activo = true;
    api('/alumnos/')
      .then((alumnos) => {
        if (!activo) return;
        const opciones = (Array.isArray(alumnos) ? alumnos : []).map((alumno) => ({
          id: alumno.id,
          nombre: alumno.nombre || 'Cliente',
          estado: 'Activo',
          plan: planContratadoDelAlumno(alumno.plan),
          experiencia: alumno.datos?.experiencia || 'Sin registrar',
        })).filter((cliente) => ['Básico', 'Avanzado'].includes(cliente.plan));
        setClientesDisponibles(opciones);
      })
      .catch(() => { if (activo) setClientesDisponibles([]); });
    return () => { activo = false; };
  }, []));

  // Recupera la biblioteca y la selección del cliente al abrir esta pantalla.
  useEffect(() => {
    let activo = true;
    const cargarDatos = async () => {
      setCargando(true);
      try {
        // Cambia las rutinas de ejemplo por las reales del Split App principiante (una sola vez).
        await actualizarBibliotecaReal();
        const [rutinasGuardadas, ejerciciosGuardados, asignacionesGuardadas, copiasGuardadas] = await Promise.all([
          AsyncStorage.getItem(CLAVE_RUTINAS),
          AsyncStorage.getItem(CLAVE_EJERCICIOS),
          AsyncStorage.getItem(CLAVE_ASIGNACIONES),
          AsyncStorage.getItem(CLAVE_RUTINAS_POR_CLIENTE),
        ]);
        if (!activo) return;

        const listaRutinas = rutinasGuardadas ? JSON.parse(rutinasGuardadas) : RUTINAS_INICIALES;
        const listaEjercicios = ejerciciosGuardados ? JSON.parse(ejerciciosGuardados) : EJERCICIOS_INICIALES;
        const asignaciones = asignacionesGuardadas ? JSON.parse(asignacionesGuardadas) : {};
        const asignacionesValidas = asignaciones && typeof asignaciones === 'object' ? asignaciones : {};
        const rutinasYaAsignadas = claveCliente && Array.isArray(asignacionesValidas[claveCliente])
          ? asignacionesValidas[claveCliente]
          : [];
        setRutinas(Array.isArray(listaRutinas) ? listaRutinas : RUTINAS_INICIALES);
        setEjercicios(Array.isArray(listaEjercicios) ? listaEjercicios : EJERCICIOS_INICIALES);
        setSeleccionadas(claveCliente ? rutinasYaAsignadas : []);
        const todasLasCopias = copiasGuardadas ? JSON.parse(copiasGuardadas) : {};
        setCopiasCliente(claveCliente && todasLasCopias?.[claveCliente] ? todasLasCopias[claveCliente] : {});
        setModoSeleccion(Boolean(claveCliente));
      } catch (error) {
        if (activo) {
          setRutinas(RUTINAS_INICIALES);
          setEjercicios(EJERCICIOS_INICIALES);
        }
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargarDatos();
    return () => { activo = false; };
  }, [claveCliente]);

  // Guarda la biblioteca en este dispositivo para conservar las rutinas entre aperturas.
  useEffect(() => {
    if (!cargando) AsyncStorage.setItem(CLAVE_RUTINAS, JSON.stringify(rutinas)).catch(() => {});
  }, [rutinas, cargando]);

  useEffect(() => {
    if (!cargando) AsyncStorage.setItem(CLAVE_EJERCICIOS, JSON.stringify(ejercicios)).catch(() => {});
  }, [ejercicios, cargando]);

  // Con un cliente abierto se muestra su versión de cada rutina (si el coach la editó para él).
  const rutinasBase = useMemo(
    () => (claveCliente ? rutinas.map((rutina) => copiasCliente[rutina.id] || rutina) : rutinas),
    [rutinas, copiasCliente, claveCliente]
  );

  const clientesFiltradosAsignacion = useMemo(
    () => filtroPlanCliente === TODOS
      ? clientesDisponibles
      : clientesDisponibles.filter((cliente) => cliente.plan === filtroPlanCliente),
    [clientesDisponibles, filtroPlanCliente]
  );

  // Guarda la versión editada para este cliente y la deja seleccionada para enviársela con "Guardar".
  const guardarCopiaCliente = async (rutina) => {
    const nuevas = { ...copiasCliente, [rutina.id]: rutina };
    setCopiasCliente(nuevas);
    setSeleccionadas((actuales) => (actuales.includes(rutina.id) ? actuales : [...actuales, rutina.id]));
    try {
      const guardadas = await AsyncStorage.getItem(CLAVE_RUTINAS_POR_CLIENTE);
      const todas = guardadas ? JSON.parse(guardadas) : {};
      await AsyncStorage.setItem(CLAVE_RUTINAS_POR_CLIENTE, JSON.stringify({ ...todas, [claveCliente]: nuevas }));
    } catch {
      // si no se pudo guardar en el teléfono, la edición igual se envía al presionar Guardar
    }
  };

  // Vuelve a la versión de la biblioteca para este cliente.
  const restaurarRutinaCliente = (rutina) => {
    Alert.alert('Volver a la versión original', `“${rutina.titulo}” volverá a ser igual a la de la biblioteca para ${nombre || 'este cliente'}. Presiona Guardar para enviársela.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Restaurar',
        onPress: async () => {
          const { [rutina.id]: _quitada, ...resto } = copiasCliente;
          setCopiasCliente(resto);
          setSeleccionadas((actuales) => (actuales.includes(rutina.id) ? actuales : [...actuales, rutina.id]));
          try {
            const guardadas = await AsyncStorage.getItem(CLAVE_RUTINAS_POR_CLIENTE);
            const todas = guardadas ? JSON.parse(guardadas) : {};
            await AsyncStorage.setItem(CLAVE_RUTINAS_POR_CLIENTE, JSON.stringify({ ...todas, [claveCliente]: resto }));
          } catch {
            // sin acción: la restauración ya se ve en pantalla
          }
        },
      },
    ]);
  };

  const rutinasVisibles = useMemo(() => {
    const consulta = normalizar(busqueda);
    return rutinasBase.filter((rutina) => {
      const nivelCoincide = nivelFiltro === TODOS || rutina.nivel === nivelFiltro;
      const textoRutina = [
        rutina.id,
        rutina.titulo,
        rutina.nivel,
        rutina.frecuencia,
        ...(rutina.ejercicios || []).flatMap((ejercicio) => [
          ejercicio.nombre,
          ejercicio.series,
          ejercicio.repeticiones,
        ]),
      ].join(' ');
      return nivelCoincide && (!consulta || normalizar(textoRutina).includes(consulta));
    });
  }, [rutinasBase, busqueda, nivelFiltro]);

  // Si se borró un ejercicio del catálogo, conserva la copia que ya estaba en la rutina para poder quitarla o mantenerla.
  const ejerciciosFormulario = useMemo(() => {
    const rutina = rutinasBase.find((item) => item.id === idRutinaEditando);
    const enCatalogo = new Set(ejercicios.map((item) => item.id));
    const archivados = (rutina?.ejercicios || [])
      .filter((item) => !enCatalogo.has(item.ejercicioId || item.id))
      .map((item) => ({ ...item, id: item.ejercicioId || item.id, archivado: true }));
    return [...ejercicios, ...archivados];
  }, [ejercicios, rutinasBase, idRutinaEditando]);

  const abrirFormularioRutina = (rutina = null) => {
    setIdRutinaEditando(rutina?.id || '');
    setFormRutina({
      titulo: rutina?.titulo || '',
      nivel: rutina?.nivel || 'Inicial',
      frecuencia: rutina?.frecuencia || '3 veces por semana',
      ejercicios: (rutina?.ejercicios || []).map((ejercicio) => ejercicio.ejercicioId || ejercicio.id),
    });
    setModalRutinaVisible(true);
  };

  const guardarRutina = () => {
    const titulo = formRutina.titulo.trim();
    const frecuencia = formRutina.frecuencia.trim();
    const ejerciciosSeleccionados = Array.isArray(formRutina.ejercicios) ? formRutina.ejercicios : [];

    if (!titulo || !frecuencia) {
      Alert.alert('Completa los datos', 'Ingresa el nombre y la frecuencia de la rutina.');
      return;
    }
    if (ejerciciosSeleccionados.length === 0) {
      Alert.alert('Agrega ejercicios', 'Selecciona al menos un ejercicio de la biblioteca.');
      return;
    }

    const rutinaId = idRutinaEditando || `RUT-${Date.now()}`;
    const rutinaExistente = rutinasBase.find((rutina) => rutina.id === idRutinaEditando);
    const ejerciciosAsignados = ejerciciosSeleccionados.map((ejercicioId) => {
      const existente = (rutinaExistente?.ejercicios || []).find((item) => (item.ejercicioId || item.id) === ejercicioId);
      const delCatalogo = ejerciciosFormulario.find((item) => item.id === ejercicioId);
      const base = existente || delCatalogo;
      if (!base) return null;
      return {
        ...base,
        id: existente?.id || `${rutinaId}-${ejercicioId}`,
        ejercicioId,
        videoLocal: delCatalogo
          ? delCatalogo.videoLocal || null
          : existente?.videoLocal || null,
      };
    }).filter(Boolean);

    const rutinaGuardada = {
      ...(rutinaExistente || {}),
      id: rutinaId,
      titulo,
      nivel: formRutina.nivel,
      frecuencia,
      ejercicios: ejerciciosAsignados,
    };
    if (claveCliente && idRutinaEditando) {
      // Con un cliente abierto, la edición queda solo para él.
      guardarCopiaCliente(rutinaGuardada);
    } else {
      setRutinas((actuales) => idRutinaEditando
        ? actuales.map((rutina) => rutina.id === idRutinaEditando ? rutinaGuardada : rutina)
        : [rutinaGuardada, ...actuales]);
    }
    setExpandida(rutinaId);

    setModalRutinaVisible(false);
  };

  const abrirEditorEjercicio = (rutina, ejercicio) => {
    setRutinaDelEjercicio(rutina.id);
    setIdEjercicioEditando(ejercicio.id);
    setFormEjercicio({
      nombre: ejercicio.nombre,
      series: String(ejercicio.series || ''),
      repeticiones: String(ejercicio.repeticiones || ''),
      peso: ejercicio.peso ? String(ejercicio.peso) : '',
      descanso: String(ejercicio.descanso || ''),
      video: ejercicio.video || '',
    });
    setModalEjercicioVisible(true);
  };

  // Cada ejercicio tiene un editor propio para cambiar su prescripción sin editar la rutina completa.
  const guardarEjercicio = () => {
    if (!formEjercicio.nombre.trim()) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre del ejercicio.');
      return;
    }
    const cambios = {
      ...formEjercicio,
      nombre: formEjercicio.nombre.trim(),
      peso: String(formEjercicio.peso || '').replace(',', '.').replace(/[^0-9.]/g, ''),
    };
    const editarEjercicios = (rutina) => ({
      ...rutina,
      ejercicios: (rutina.ejercicios || []).map((ejercicio) => (
        ejercicio.id === idEjercicioEditando ? { ...ejercicio, ...cambios } : ejercicio
      )),
    });
    if (claveCliente) {
      // Con un cliente abierto, el cambio (series, repeticiones, peso, descanso) es solo para él.
      const rutina = rutinasBase.find((item) => item.id === rutinaDelEjercicio);
      if (rutina) guardarCopiaCliente(editarEjercicios(rutina));
    } else {
      setRutinas((actuales) => actuales.map((rutina) => (
        rutina.id !== rutinaDelEjercicio ? rutina : editarEjercicios(rutina)
      )));
    }
    setModalEjercicioVisible(false);
  };

  const alternarSeleccion = (idRutina) => {
    setSeleccionadas((actuales) => actuales.includes(idRutina)
      ? actuales.filter((id) => id !== idRutina)
      : [...actuales, idRutina]);
  };

  const eliminarRutinas = async (ids) => {
    const idsEliminar = new Set(ids);
    setRutinas((actuales) => actuales.filter((rutina) => !idsEliminar.has(rutina.id)));
    setSeleccionadas((actuales) => actuales.filter((id) => !idsEliminar.has(id)));
    setExpandida((actual) => idsEliminar.has(actual) ? '' : actual);
    try {
      const guardadas = await AsyncStorage.getItem(CLAVE_ASIGNACIONES);
      const asignaciones = guardadas ? JSON.parse(guardadas) : {};
      const actualizadas = Object.fromEntries(Object.entries(asignaciones).map(([cliente, rutinasCliente]) => [
        cliente,
        (rutinasCliente || []).filter((id) => !idsEliminar.has(id)),
      ]));
      await AsyncStorage.setItem(CLAVE_ASIGNACIONES, JSON.stringify(actualizadas));
    } catch (error) {
      Alert.alert('Rutinas eliminadas', 'Se quitaron de la biblioteca, pero no se pudieron limpiar todas las asignaciones guardadas.');
    }
  };

  const confirmarEliminarRutina = (rutina) => {
    Alert.alert('Eliminar rutina', `¿Quieres eliminar “${rutina.titulo}”?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => eliminarRutinas([rutina.id]) },
    ]);
  };

  const confirmarEliminarSeleccionadas = () => {
    if (!seleccionadas.length) return;
    Alert.alert('Eliminar rutinas', `¿Quieres eliminar ${seleccionadas.length} rutinas seleccionadas?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => eliminarRutinas(seleccionadas) },
    ]);
  };

  // Abre el selector vacío para que el entrenador elija explícitamente al destinatario.
  const abrirSelectorCliente = () => {
    setClienteAsignacionId('');
    setFiltroPlanCliente(TODOS);
    setModalClienteVisible(true);
  };

  const guardarAsignacionCliente = async () => {
    const cliente = clientesDisponibles.find((item) => item.id === clienteAsignacionId);
    if (!cliente) {
      Alert.alert('Elige un cliente', 'Selecciona quién recibirá las rutinas.');
      return;
    }
    if (!seleccionadas.length) {
      Alert.alert('Selecciona una rutina', 'Marca al menos una rutina antes de asignarla.');
      return;
    }

    try {
      if (!/^[0-9a-f]{24}$/i.test(String(cliente.id))) {
        throw new Error('El cliente no tiene un ID válido de la base de datos.');
      }

      const guardadas = await AsyncStorage.getItem(CLAVE_ASIGNACIONES);
      const asignacionesGuardadas = guardadas ? JSON.parse(guardadas) : {};
      const asignaciones = asignacionesGuardadas && typeof asignacionesGuardadas === 'object'
        ? asignacionesGuardadas
        : {};
      const existentes = Array.isArray(asignaciones[cliente.id]) ? asignaciones[cliente.id] : [];
      const idsRutinasAsignadas = [...new Set([...existentes, ...seleccionadas])];
      const rutinasParaEnviar = rutinas
        .filter((rutina) => idsRutinasAsignadas.includes(rutina.id))
        .map(rutinaParaServidor);
      if (!rutinasParaEnviar.length) {
        throw new Error('No se encontraron las rutinas seleccionadas en la biblioteca.');
      }

      // La pantalla confirma la asignación solo después de que Django la guardó en MongoDB.
      await api(`/rutinas-asignadas/${cliente.id}/`, {
        method: 'PUT',
        body: { rutinas: rutinasParaEnviar },
      });

      const actualizadas = {
        ...asignaciones,
        [cliente.id]: idsRutinasAsignadas,
      };
      await AsyncStorage.setItem(CLAVE_ASIGNACIONES, JSON.stringify(actualizadas));
      setModalClienteVisible(false);
      setSeleccionadas([]);
      setModoSeleccion(false);
      router.push('/clientes');
    } catch (error) {
      Alert.alert('No se pudo asignar', error?.message || 'Revisa la conexión con el servidor e inténtalo nuevamente.');
    }
  };

  const guardarAsignacion = async () => {
    try {
      if (!/^[0-9a-f]{24}$/i.test(String(clienteId))) {
        throw new Error('No se encontró el ID del cliente en la base de datos.');
      }
      if (!seleccionadas.length) {
        throw new Error('Selecciona al menos una rutina para el cliente.');
      }

      // Se envían las versiones editadas para este cliente (si las hay); el servidor reemplaza
      // la rutina que ya tenía y le avisa con "Rutina actualizada".
      const rutinasParaEnviar = rutinasBase
        .filter((rutina) => seleccionadas.includes(rutina.id))
        .map(rutinaParaServidor);
      if (!rutinasParaEnviar.length) {
        throw new Error('No se encontraron las rutinas seleccionadas en la biblioteca.');
      }

      // El perfil del cliente se actualiza primero; así una falla de red no deja una asignación solo local.
      await api(`/rutinas-asignadas/${clienteId}/`, {
        method: 'PUT',
        body: { rutinas: rutinasParaEnviar },
      });

      const guardadas = await AsyncStorage.getItem(CLAVE_ASIGNACIONES);
      const asignacionesGuardadas = guardadas ? JSON.parse(guardadas) : {};
      const asignaciones = asignacionesGuardadas && typeof asignacionesGuardadas === 'object'
        ? asignacionesGuardadas
        : {};
      const actualizadas = { ...asignaciones, [claveCliente]: seleccionadas };
      await AsyncStorage.setItem(CLAVE_ASIGNACIONES, JSON.stringify(actualizadas));
      router.back();
    } catch (error) {
      Alert.alert('No se pudo asignar', error?.message || 'Revisa la conexión con el servidor e inténtalo nuevamente.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_progreso.jpg')} />
      <View style={styles.page}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={23} color={colors.blanco} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>Rutinas</Text>
            <Text numberOfLines={1} style={styles.subtitle}>{nombre ? `Cliente: ${nombre}` : 'Biblioteca de rutinas'}</Text>
          </View>
          <LogoMarca />
        </View>

        <View style={styles.filters}>
          {/* El buscador y la acción de crear comparten una fila para tener ambas herramientas a mano. */}
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={colors.gris} />
              <TextInput
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Buscar por rutina, ID o ejercicio"
                placeholderTextColor={colors.gris}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {!!busqueda && (
                <TouchableOpacity accessibilityLabel="Limpiar búsqueda" onPress={() => setBusqueda('')}>
                  <Ionicons name="close-circle" size={18} color={colors.gris} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Crear rutina" onPress={() => abrirFormularioRutina()} style={styles.createButton} hitSlop={6}>
              <Ionicons name="add" size={28} color={colors.blanco} />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelFilters}>
            {[TODOS, ...NIVELES].map((nivel) => {
              const activo = nivelFiltro === nivel;
              return (
                <TouchableOpacity key={nivel} onPress={() => setNivelFiltro(nivel)} style={[styles.levelChip, activo && styles.levelChipActive]}>
                  <Text style={[styles.levelChipText, activo && styles.levelChipTextActive]}>{nivel}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.resultRow}>
            <Text style={styles.resultCount}>{rutinasVisibles.length} {rutinasVisibles.length === 1 ? 'rutina' : 'rutinas'}</Text>
            {!claveCliente && (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  setModoSeleccion((actual) => !actual);
                  setSeleccionadas([]);
                }}
                style={styles.selectionModeButton}
              >
                <Ionicons name={modoSeleccion ? 'close' : 'checkmark-circle-outline'} size={15} color={colors.azulClaro} />
                <Text style={styles.selectionModeText}>{modoSeleccion ? 'Cancelar' : 'Seleccionar'}</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!claveCliente && <Text style={styles.selectionHint}>Selecciona una o más rutinas para asignarlas a {nombre}.</Text>}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {cargando ? (
            <View style={styles.emptyState}><Text style={styles.emptyText}>Cargando rutinas…</Text></View>
          ) : rutinasVisibles.length ? rutinasVisibles.map((rutina) => {
            const abierta = expandida === rutina.id;
            const seleccionada = seleccionadas.includes(rutina.id);
            return (
              <View key={rutina.id} style={styles.routineCard}>
                <View style={styles.routineHeader}>
                  {(!!claveCliente || modoSeleccion) && (
                    <TouchableOpacity
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: seleccionada }}
                      accessibilityLabel={`${seleccionada ? 'Quitar' : 'Seleccionar'} ${rutina.titulo}`}
                      onPress={() => alternarSeleccion(rutina.id)}
                      style={styles.selectButton}
                    >
                      <Ionicons name={seleccionada ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={seleccionada ? colors.azulClaro : colors.gris} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity activeOpacity={0.8} onPress={() => setExpandida(abierta ? '' : rutina.id)} style={styles.routineSummary}>
                    <View style={styles.routineIcon}><Ionicons name="barbell-outline" size={21} color={colors.azulClaro} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={styles.routineName}>{rutina.titulo}</Text>
                      <Text numberOfLines={2} style={styles.routineMeta}>ID {rutina.id} · {rutina.nivel} · {rutina.frecuencia}</Text>
                      {!!claveCliente && !!copiasCliente[rutina.id] && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                          <View style={{ backgroundColor: `${colors.verde}26`, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ color: colors.verde, fontSize: 12, fontWeight: '700' }}>Editada para {nombre || 'este cliente'}</Text>
                          </View>
                          <TouchableOpacity onPress={() => restaurarRutinaCliente(rutina)} hitSlop={6}>
                            <Text style={{ color: colors.azulClaro, fontSize: 12, fontWeight: '700' }}>Volver a la original</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    <Ionicons name={abierta ? 'chevron-up' : 'chevron-down'} size={19} color={colors.gris} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Editar rutina ${rutina.titulo}`} onPress={() => abrirFormularioRutina(rutina)} style={styles.editButton}>
                    <Ionicons name="create-outline" size={19} color={colors.azulClaro} />
                  </TouchableOpacity>
                  {!claveCliente && !modoSeleccion && (
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Eliminar rutina ${rutina.titulo}`} onPress={() => confirmarEliminarRutina(rutina)} style={styles.deleteButton}>
                      <Ionicons name="trash-outline" size={18} color={colors.rojo} />
                    </TouchableOpacity>
                  )}
                </View>

                {abierta && (
                  <View style={styles.expandedContent}>
                    <View style={styles.expandedHeading}>
                      <Text style={styles.sectionTitle}>Ejercicios asignados</Text>
                      <Text style={styles.exerciseCount}>{(rutina.ejercicios || []).length}</Text>
                    </View>
                    {(rutina.ejercicios || []).map((ejercicio, indice) => (
                      <View key={ejercicio.id} style={styles.exerciseRow}>
                        <View style={styles.exerciseNumber}><Text style={styles.exerciseNumberText}>{indice + 1}</Text></View>
                        {/* Imagen del ejercicio (toca para ver músculos y en qué consiste). */}
                        <ImagenEjercicio nombre={ejercicio.nombre} info={infoEjercicio(ejercicio.nombre)} tamano={48} />
                        <View style={{ flex: 1, minWidth: 0 }}>{/* nuevo */}
                          <Text numberOfLines={1} style={styles.exerciseName}>
                            {ejercicio.nombre}
                          </Text>
                          <ChipsMusculos musculos={infoEjercicio(ejercicio.nombre)?.musculos} pequeno />
                          {!!(ejercicio.descripcion || infoEjercicio(ejercicio.nombre)?.descripcion) && (
                            <Text style={{ color: colors.gris, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
                              {ejercicio.descripcion || infoEjercicio(ejercicio.nombre)?.descripcion}
                            </Text>
                          )}

                          <Text style={styles.exerciseDetails}>
                            {ejercicio.series} series · {ejercicio.repeticiones} repeticiones
                            {Number(ejercicio.peso) > 0 ? ` · ${ejercicio.peso} kg` : ''}
                            {' · '}Descanso {ejercicio.descanso}
                          </Text>

                          {!!ejercicio.videoLocal && (
                            <TouchableOpacity
                              style={{ marginTop: 8, paddingVertical: 6 }}
                              onPress={() => {
                                const uri = obtenerUriVideoLocal(ejercicio.videoLocal);

                                if (!uri) {
                                  Alert.alert(
                                    'Video no disponible',
                                    'El archivo ya no está en este dispositivo.'
                                  );
                                  return;
                                }

                                setVideoAbierto(uri);
                              }}
                            >
                              <Text style={{ color: colors.azulClaro }}>
                                Ver video
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>{/*Hasta aqui*/}
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Editar ejercicio ${ejercicio.nombre}`} onPress={() => abrirEditorEjercicio(rutina, ejercicio)} style={styles.exerciseEditButton}>
                          <Ionicons name="pencil-outline" size={16} color={colors.azulClaro} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }) : (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={28} color={colors.azulClaro} />
              <Text style={styles.emptyTitle}>No encontramos rutinas</Text>
              <Text style={styles.emptyText}>Prueba otra búsqueda o crea una nueva rutina.</Text>
            </View>
          )}
        </ScrollView>

        {(!!claveCliente || (modoSeleccion && seleccionadas.length > 0)) && (
          <View style={styles.assignmentBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.assignmentCount}>{seleccionadas.length} seleccionadas</Text>
              <Text style={styles.assignmentCaption}>{claveCliente ? `Para ${nombre || 'este cliente'} · edita con el lápiz y luego Guardar` : 'Después elige un cliente'}</Text>
            </View>
            {!claveCliente && (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Eliminar rutinas seleccionadas" onPress={confirmarEliminarSeleccionadas} style={styles.deleteSelectedButton}>
                <Ionicons name="trash-outline" size={16} color={colors.rojo} />
              </TouchableOpacity>
            )}
            <TouchableOpacity accessibilityRole="button" onPress={claveCliente ? guardarAsignacion : abrirSelectorCliente} style={styles.saveAssignmentButton}>
              <Text style={styles.saveAssignmentText}>{claveCliente ? 'Guardar' : 'Elegir cliente'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={modalClienteVisible} transparent animationType="fade" onRequestClose={() => setModalClienteVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Elegir cliente</Text>
                <Text style={styles.modalSubtitle}>{seleccionadas.length} {seleccionadas.length === 1 ? 'rutina seleccionada' : 'rutinas seleccionadas'}. Elige quién las recibirá.</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Cerrar" onPress={() => setModalClienteVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={26} color={colors.gris} />
              </TouchableOpacity>
            </View>
            <View style={styles.clientPlanFilters}>
              <Text style={styles.clientPlanFilterLabel}>Filtrar clientes por plan</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientPlanFilterChips}>
                {FILTROS_PLAN_CLIENTE.map((filtro) => {
                  const activo = filtroPlanCliente === filtro;
                  return (
                    <TouchableOpacity
                      key={filtro}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activo }}
                      onPress={() => {
                        setFiltroPlanCliente(filtro);
                        setClienteAsignacionId('');
                      }}
                      style={[styles.levelChip, activo && styles.levelChipActive]}
                    >
                      <Text style={[styles.levelChipText, activo && styles.levelChipTextActive]}>{filtro}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            <ScrollView style={styles.clientPickerScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.clientPickerList}>
              {clientesDisponibles.length === 0 ? (
                <View style={styles.emptyClientPicker}>
                  <Ionicons name="people-outline" size={28} color={colors.azulClaro} />
                  <Text style={styles.emptyClientPickerText}>No hay clientes con un Plan Básico o Avanzado vigente para asignar rutinas.</Text>
                  <TouchableOpacity onPress={() => { setModalClienteVisible(false); router.push('/clientes'); }}>
                    <Text style={styles.emptyClientPickerLink}>Revisar mis clientes</Text>
                  </TouchableOpacity>
                </View>
              ) : clientesFiltradosAsignacion.length === 0 ? (
                <View style={styles.emptyClientPicker}>
                  <Ionicons name="filter-outline" size={26} color={colors.azulClaro} />
                  <Text style={styles.emptyClientPickerText}>No hay clientes con Plan {filtroPlanCliente}.</Text>
                </View>
              ) : clientesFiltradosAsignacion.map((cliente) => {
                const seleccionado = clienteAsignacionId === cliente.id;
                const estado = cliente.estado.charAt(0).toUpperCase() + cliente.estado.slice(1);
                return (
                  <TouchableOpacity
                    key={cliente.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: seleccionado }}
                    onPress={() => setClienteAsignacionId(cliente.id)}
                    style={[styles.clientPickerItem, seleccionado && styles.clientPickerItemActive]}
                  >
                    <View style={styles.clientPickerAvatar}>
                      <Text style={styles.clientPickerInitials}>{cliente.nombre.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('')}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={styles.clientPickerName}>{cliente.nombre}</Text>
                      <Text numberOfLines={1} style={styles.clientPickerMeta}>{estado} · Plan {cliente.plan}</Text>
                      <Text numberOfLines={1} style={styles.clientPickerMeta}>Experiencia: {cliente.experiencia}</Text>
                    </View>
                    <Ionicons name={seleccionado ? 'radio-button-on' : 'radio-button-off'} size={20} color={seleccionado ? colors.azulClaro : colors.gris} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalClienteVisible(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!clienteAsignacionId}
                onPress={guardarAsignacionCliente}
                style={[styles.saveButton, !clienteAsignacionId && styles.disabledSaveButton]}
              >
                <Text style={styles.saveText}>Asignar rutinas</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalRutinaVisible} transparent animationType="fade" onRequestClose={() => setModalRutinaVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <FondoThomas imagen={require('../../assets/images/fondos/fondo_rutina.jpg')} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{idRutinaEditando ? 'Editar rutina' : 'Crear rutina'}</Text>
                <Text style={styles.modalSubtitle}>Completa los datos y elige ejercicios de tu biblioteca.</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Cerrar" onPress={() => setModalRutinaVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={26} color={colors.gris} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
              {!!idRutinaEditando && <Text style={styles.readOnlyId}>ID de rutina: {idRutinaEditando}</Text>}
              <Text style={styles.fieldLabel}>Nombre de la rutina</Text>
              <TextInput value={formRutina.titulo} onChangeText={(titulo) => setFormRutina((actual) => ({ ...actual, titulo }))} placeholder="Ej. Pecho y tríceps" placeholderTextColor={colors.gris} style={styles.input} />

              <Text style={styles.fieldLabel}>Nivel</Text>
              {/* Los tres niveles en una sola fila, del mismo ancho */}
              <View style={styles.levelRow}>
                {NIVELES.map((nivel) => (
                  <TouchableOpacity key={nivel} onPress={() => setFormRutina((actual) => ({ ...actual, nivel }))} style={[styles.levelChip, styles.levelChipFila, formRutina.nivel === nivel && styles.levelChipActive]}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.levelChipText, formRutina.nivel === nivel && styles.levelChipTextActive]}>{nivel}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Frecuencia</Text>
              <TextInput value={formRutina.frecuencia} onChangeText={(frecuencia) => setFormRutina((actual) => ({ ...actual, frecuencia }))} placeholder="Ej. 3 veces por semana" placeholderTextColor={colors.gris} style={styles.input} />

              <View style={styles.exercisePickerHeading}>
                <Text style={styles.fieldLabel}>Ejercicios</Text>
                <Text style={styles.exercisePickerCount}>{formRutina.ejercicios.length} elegidos</Text>
              </View>
              <View style={styles.exercisePickerList}>
                {ejerciciosFormulario.length ? ejerciciosFormulario.map((ejercicio) => {
                  const marcado = formRutina.ejercicios.includes(ejercicio.id);
                  return (
                    <TouchableOpacity
                      key={ejercicio.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: marcado }}
                      onPress={() => setFormRutina((actual) => ({
                        ...actual,
                        ejercicios: marcado
                          ? actual.ejercicios.filter((id) => id !== ejercicio.id)
                          : [...actual.ejercicios, ejercicio.id],
                      }))}
                      style={[styles.exercisePickerItem, marcado && styles.exercisePickerItemActive]}
                    >
                      <Ionicons name={marcado ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={marcado ? colors.azulClaro : colors.gris} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={styles.exercisePickerName}>{ejercicio.nombre}</Text>
                        <Text numberOfLines={1} style={styles.exercisePickerMeta}>
                          {ejercicio.archivado ? 'Ya asignado · fuera de la biblioteca' : `${ejercicio.grupo} · ${ejercicio.series} × ${ejercicio.repeticiones}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }) : <Text style={styles.emptyText}>Todavía no hay ejercicios. Crea algunos desde la opción Ejercicios del inicio del entrenador.</Text>}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setModalRutinaVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity onPress={guardarRutina} style={styles.saveButton}><Text style={styles.saveText}>Guardar rutina</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalEjercicioVisible} transparent animationType="fade" onRequestClose={() => setModalEjercicioVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Editar ejercicio</Text>
                <Text style={styles.modalSubtitle}>{claveCliente ? `El cambio es solo para ${nombre || 'este cliente'}.` : 'Ajusta el ejercicio asignado a esta rutina.'}</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Cerrar" onPress={() => setModalEjercicioVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={26} color={colors.gris} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
              {[
                ['Nombre del ejercicio', 'nombre', 'Ej. Press de banca'],
                ['Series', 'series', 'Ej. 4'],
                ['Repeticiones', 'repeticiones', 'Ej. 10-12'],
                ['Peso (kg)', 'peso', 'Ej. 40'],
                ['Descanso', 'descanso', 'Ej. 90 s'],
                ['Link del video (Cloudinary)', 'video', 'https://res.cloudinary.com/...'],
              ].map(([label, campo, placeholder]) => (
                <View key={campo}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput
                    value={formEjercicio[campo]}
                    onChangeText={(valor) => setFormEjercicio((actual) => ({ ...actual, [campo]: valor }))}
                    placeholder={placeholder}
                    placeholderTextColor={colors.gris}
                    style={styles.input}
                  />
                </View>
              ))}
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setModalEjercicioVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity onPress={guardarEjercicio} style={styles.saveButton}><Text style={styles.saveText}>Guardar ejercicio</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

       {/* Reproductor de los ejercicios de la rutina */}
      {videoAbierto && (
        <VideoEjercicio
          key={videoAbierto}
          uri={videoAbierto}
          onCerrar={() => setVideoAbierto(null)}
        />
      )}

    </SafeAreaView>
  );
}

// Estilos locales siguen la paleta carbón/grafito/azul que comparte toda la app.
const styles = {
  page: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12 },
  backButton: { width: 36, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  title: { color: colors.blanco, fontSize: 22, fontFamily: 'SundayMasthead-Regular' },
  subtitle: { color: colors.gris, fontSize: 14, marginTop: 3 },
  createButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.azulClaro },
  createText: { color: colors.blanco, fontSize: 16, fontWeight: '700' },
  filters: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchBox: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 11, backgroundColor: colors.grafito, borderWidth: 1, borderColor: colors.azulOscuro },
  searchInput: { flex: 1, minWidth: 0, color: colors.blanco, fontSize: 14, paddingVertical: 8, outlineStyle: 'none' },
  levelFilters: { flexDirection: 'row', gap: 9, paddingVertical: 12 },
  levelChip: { minHeight: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 99, borderWidth: 1, borderColor: colors.azulOscuro, paddingHorizontal: 18, backgroundColor: colors.grafito },
  levelChipActive: { backgroundColor: colors.azulOscuro, borderColor: colors.azulClaro },
  levelChipText: { color: colors.gris, fontSize: 16, fontWeight: '600' },
  levelChipTextActive: { color: colors.blanco },
  resultRow: { minHeight: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultCount: { color: colors.gris, fontSize: 15 },
  selectionModeButton: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6 },
  selectionModeText: { color: colors.azulClaro, fontSize: 15, fontWeight: '700' },
  selectionHint: { color: colors.azulClaro, fontSize: 15, marginTop: 7, lineHeight: 21 },
  list: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 18, gap: 12 },
  routineCard: { overflow: 'hidden', backgroundColor: colors.grafito, borderRadius: 14, borderWidth: 1, borderColor: colors.azulOscuro },
  routineHeader: { minHeight: 88, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 12, gap: 8 },
  selectButton: { width: 28, height: 42, justifyContent: 'center', alignItems: 'center' },
  routineSummary: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  routineIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.carbon },
  routineName: { color: colors.blanco, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  routineMeta: { color: colors.gris, fontSize: 14, lineHeight: 19, marginTop: 5 },
  editButton: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { width: 30, height: 38, alignItems: 'center', justifyContent: 'center' },
  expandedContent: { marginHorizontal: 14, paddingTop: 12, paddingBottom: 3, borderTopWidth: 1, borderTopColor: colors.azulOscuro },
  expandedHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  sectionTitle: { color: colors.blanco, fontSize: 14, fontWeight: '700' },
  exerciseCount: { color: colors.azulClaro, fontSize: 15, fontWeight: '700' },
  exerciseRow: { minHeight: 65, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(138, 147, 163, 0.14)' },
  exerciseNumber: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.carbon },
  exerciseNumberText: { color: colors.azulClaro, fontSize: 15, fontWeight: '700' },
  exerciseName: { color: colors.blanco, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  exerciseDetails: { color: colors.gris, fontSize: 15, lineHeight: 20, marginTop: 5 },
  exerciseEditButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  emptyState: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  emptyTitle: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
  emptyText: { color: colors.gris, fontSize: 16, textAlign: 'center', lineHeight: 23 },
  assignmentBar: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 9, backgroundColor: colors.grafito, borderTopWidth: 1, borderTopColor: colors.azulOscuro },
  assignmentCount: { color: colors.blanco, fontSize: 16, fontWeight: '700' },
  assignmentCaption: { color: colors.gris, fontSize: 14, marginTop: 3 },
  deleteSelectedButton: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: colors.rojo },
  saveAssignmentButton: { minHeight: 40, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, borderRadius: 9, backgroundColor: colors.azulClaro },
  saveAssignmentText: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 12, backgroundColor: 'rgba(0, 0, 0, 0.72)' },
  modalCard: { width: '100%', maxWidth: 600, maxHeight: '95%', overflow: 'hidden', borderRadius: 20, backgroundColor: colors.grafito, borderWidth: 1, borderColor: colors.azulOscuro },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 14 },
  modalTitle: { color: colors.blanco, fontSize: 26, fontFamily: 'SundayMasthead-Regular' },
  modalSubtitle: { color: colors.gris, fontSize: 15, marginTop: 6, lineHeight: 21 },
  modalClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  clientPlanFilters: { paddingHorizontal: 18, paddingBottom: 2 },
  clientPlanFilterLabel: { color: colors.gris, fontSize: 13, fontWeight: '700' },
  clientPlanFilterChips: { flexDirection: 'row', gap: 9, paddingVertical: 10 },
  formContent: { paddingHorizontal: 22, paddingBottom: 22 },
  readOnlyId: { color: colors.azulClaro, fontSize: 14, marginBottom: 14 },
  fieldLabel: { color: colors.blanco, fontSize: 16, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  input: { minHeight: 50, color: colors.blanco, fontSize: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.azulOscuro, borderRadius: 12, backgroundColor: colors.carbon },
  formChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  levelRow: { flexDirection: 'row', gap: 8 },
  levelChipFila: { flex: 1, paddingHorizontal: 6 },
  exercisePickerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exercisePickerCount: { color: colors.azulClaro, fontSize: 15, fontWeight: '700', marginTop: 14 },
  exercisePickerList: { gap: 8 },
  exercisePickerItem: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.azulOscuro, borderRadius: 12, backgroundColor: colors.carbon },
  exercisePickerItemActive: { borderColor: colors.azulClaro, backgroundColor: colors.azulOscuro },
  exercisePickerName: { color: colors.blanco, fontSize: 16, fontWeight: '700' },
  exercisePickerMeta: { color: colors.gris, fontSize: 14, marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.azulOscuro, borderRadius: 12, backgroundColor: colors.grafito },
  cancelText: { color: colors.gris, fontSize: 16, fontWeight: '700' },
  saveButton: { flex: 1.3, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.azulClaro },
  disabledSaveButton: { opacity: 0.45 },
  saveText: { color: colors.blanco, fontSize: 16, fontWeight: '700' },
  clientPickerScroll: { maxHeight: 420 },
  clientPickerList: { gap: 8, paddingHorizontal: 18, paddingBottom: 3 },
  emptyClientPicker: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  emptyClientPickerText: { color: colors.gris, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyClientPickerLink: { color: colors.azulClaro, fontSize: 14, fontWeight: '700', marginTop: 3 },
  clientPickerItem: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.azulOscuro, borderRadius: 11, backgroundColor: colors.carbon },
  clientPickerItemActive: { borderColor: colors.azulClaro, backgroundColor: 'rgba(47, 111, 224, 0.2)' },
  clientPickerAvatar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.azulOscuro },
  clientPickerInitials: { color: colors.blanco, fontSize: 13, fontWeight: '700' },
  clientPickerName: { color: colors.blanco, fontSize: 14, fontWeight: '700' },
  clientPickerMeta: { color: colors.gris, fontSize: 12, marginTop: 3 },
};
