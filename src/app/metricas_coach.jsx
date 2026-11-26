import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import LineChart from '../components/LineChart';
import LogoMarca from '../components/LogoMarca';
import { colors } from '../constants/theme';
import '../global.css';

// Los registros nuevos del entrenador y los datos recientes se conservan en este dispositivo.
const CLAVE_DATOS_EDITADOS = 'ptrainer_datos_clientes_coach';
const CLAVE_HISTORIAL_PESO = 'ptrainer_historial_peso_clientes_coach';
const CLAVE_HISTORIAL_GRASA = 'ptrainer_historial_grasa_clientes_coach';

// Lee mapas guardados en el teléfono y devuelve un objeto vacío cuando no existe información.
async function leerMapa(clave) {
  try {
    const texto = await AsyncStorage.getItem(clave);
    const datos = texto ? JSON.parse(texto) : {};
    return datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};
  } catch {
    return {};
  }
}

// La fecha del backend puede venir como ISO o como día/mes/año; ambas formas se ordenan correctamente.
function fechaATimestamp(valor) {
  if (!valor) return 0;
  const texto = String(valor);
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const local = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12).getTime();
  if (local) return new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]), 12).getTime();
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? 0 : fecha.getTime();
}

// Muestra las fechas con el formato breve usado en el resto de la aplicación.
function etiquetaFecha(valor) {
  if (valor === 'Actual') return valor;
  const fecha = new Date(fechaATimestamp(valor));
  return Number.isNaN(fecha.getTime()) || !fechaATimestamp(valor)
    ? String(valor || 'Sin fecha')
    : fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }).replace('.', '');
}

// Usa la fecha local para que una sesión nocturna no se guarde como el día siguiente por UTC.
function fechaLocalISO() {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

export default function MetricasCoach() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const clienteId = Array.isArray(params.clienteId) ? params.clienteId[0] : params.clienteId;
  const nombreParametro = Array.isArray(params.nombre) ? params.nombre[0] : params.nombre;
  const [nombre, setNombre] = useState(nombreParametro || 'Cliente');
  const [pesoActual, setPesoActual] = useState(null);
  const [grasaActual, setGrasaActual] = useState(null);
  const [historialPeso, setHistorialPeso] = useState([]);
  const [historialGrasa, setHistorialGrasa] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [tipoRegistro, setTipoRegistro] = useState('peso');
  const [valorRegistro, setValorRegistro] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Obtiene las medidas reales del cliente y combina el historial con los registros locales del entrenador.
  useFocusEffect(useCallback(() => {
    let activa = true;
    setCargando(true);

    const cargarMetricas = async () => {
      const [alumnos, datosEditados, pesosLocales, grasasLocales] = await Promise.all([
        api('/alumnos/').catch((error) => ({ error })),
        leerMapa(CLAVE_DATOS_EDITADOS),
        leerMapa(CLAVE_HISTORIAL_PESO),
        leerMapa(CLAVE_HISTORIAL_GRASA),
      ]);
      if (!activa) return;

      const lista = Array.isArray(alumnos) ? alumnos : [];
      const cliente = lista.find((alumno) => String(alumno.id || alumno._id) === String(clienteId));
      const local = datosEditados[String(clienteId)] || {};
      const medidasServidor = Array.isArray(cliente?.medidas) ? cliente.medidas : [];
      const medidasConPeso = medidasServidor
        .map((medida, indice) => ({
          id: `bd-${indice}-${medida.fecha || ''}`,
          kg: Number(medida.peso),
          fecha: medida.fecha || 'Sin fecha',
        }))
        .filter((medida) => Number.isFinite(medida.kg) && medida.kg > 0);
      const registrosLocales = Array.isArray(pesosLocales[String(clienteId)])
        ? pesosLocales[String(clienteId)]
        : [];
      const registrosPeso = [...medidasConPeso, ...registrosLocales]
        .sort((a, b) => fechaATimestamp(a.fecha) - fechaATimestamp(b.fecha));
      const pesoServidor = Number(cliente?.datos?.pesoActual);
      const pesoGuardadoLocal = Number(local.peso);
      const peso = pesoGuardadoLocal > 0 ? pesoGuardadoLocal : pesoServidor > 0 ? pesoServidor : null;

      // El peso actual también sirve como punto inicial si el cliente todavía no tiene medidas fechadas.
      if (!registrosPeso.length && peso) {
        registrosPeso.push({ id: 'peso-inicial', kg: peso, fecha: 'Inicial' });
      } else if (peso && registrosPeso[registrosPeso.length - 1]?.kg !== peso) {
        registrosPeso.push({ id: 'peso-actual', kg: peso, fecha: 'Actual' });
      }

      const grasaServidor = [...medidasServidor].reverse().find((medida) => Number(medida.grasaCorporal) > 0)?.grasaCorporal;
      const grasa = Number(local.grasaCorporal) > 0
        ? Number(local.grasaCorporal)
        : Number(grasaServidor) > 0 ? Number(grasaServidor) : null;
      const grasaLocalLista = Array.isArray(grasasLocales[String(clienteId)])
        ? grasasLocales[String(clienteId)]
        : [];

      setNombre(cliente?.nombre || nombreParametro || 'Cliente');
      setPesoActual(peso);
      setGrasaActual(grasa);
      setHistorialPeso(registrosPeso);
      setHistorialGrasa(grasaLocalLista.length
        ? grasaLocalLista
        : grasa ? [{ id: 'grasa-actual', porcentaje: grasa, fecha: 'Actual' }] : []);
      setErrorCarga(Array.isArray(alumnos)
        ? cliente ? '' : 'No se encontró el perfil de este cliente.'
        : 'No se pudieron cargar las métricas desde el servidor.');
      setCargando(false);
    };

    cargarMetricas();
    return () => { activa = false; };
  }, [clienteId, nombreParametro]));

  // Calcula el cambio entre el primer y el último peso que aparezca en el historial.
  const variacionPeso = useMemo(() => {
    const pesos = historialPeso.map((registro) => Number(registro.kg)).filter((peso) => peso > 0);
    if (pesos.length < 2) return null;
    return pesos[pesos.length - 1] - pesos[0];
  }, [historialPeso]);

  // Abre el formulario para registrar el tipo de dato elegido.
  const abrirRegistro = (tipo) => {
    setTipoRegistro(tipo);
    setValorRegistro('');
    setModalVisible(true);
  };

  // Guarda el valor localmente por cliente y refresca de inmediato la tarjeta, el gráfico y el historial.
  const guardarRegistro = async () => {
    if (guardando) return;
    const valor = Number(valorRegistro.replace(',', '.'));
    const esPeso = tipoRegistro === 'peso';
    const valido = Number.isFinite(valor) && (esPeso ? valor >= 20 && valor <= 350 : valor >= 2 && valor <= 70);
    if (!valido) {
      Alert.alert(esPeso ? 'Peso inválido' : 'Porcentaje inválido', esPeso
        ? 'Ingresa un peso entre 20 y 350 kg.'
        : 'Ingresa un porcentaje de grasa entre 2 y 70 %.');
      return;
    }
    if (!clienteId) {
      Alert.alert('Falta el cliente', 'Vuelve a abrir Seguimiento y métricas desde la lista de clientes.');
      return;
    }

    setGuardando(true);
    const claveCliente = String(clienteId);
    const fecha = fechaLocalISO();
    const id = `${tipoRegistro}-${Date.now()}`;
    try {
      const datosEditados = await leerMapa(CLAVE_DATOS_EDITADOS);
      const valoresActuales = datosEditados[claveCliente] || {};
      if (esPeso) {
        const pesosLocales = await leerMapa(CLAVE_HISTORIAL_PESO);
        const nuevoRegistro = { id, kg: valor, fecha };
        const registros = [...(Array.isArray(pesosLocales[claveCliente]) ? pesosLocales[claveCliente] : []), nuevoRegistro];
        await AsyncStorage.setItem(CLAVE_HISTORIAL_PESO, JSON.stringify({ ...pesosLocales, [claveCliente]: registros }));
        await AsyncStorage.setItem(CLAVE_DATOS_EDITADOS, JSON.stringify({ ...datosEditados, [claveCliente]: { ...valoresActuales, peso: valor } }));
        setHistorialPeso((actual) => [...actual.filter((registro) => registro.id !== 'peso-actual'), nuevoRegistro]);
        setPesoActual(valor);
      } else {
        const grasasLocales = await leerMapa(CLAVE_HISTORIAL_GRASA);
        const nuevoRegistro = { id, porcentaje: valor, fecha };
        const registros = [...(Array.isArray(grasasLocales[claveCliente]) ? grasasLocales[claveCliente] : []), nuevoRegistro];
        await AsyncStorage.setItem(CLAVE_HISTORIAL_GRASA, JSON.stringify({ ...grasasLocales, [claveCliente]: registros }));
        await AsyncStorage.setItem(CLAVE_DATOS_EDITADOS, JSON.stringify({ ...datosEditados, [claveCliente]: { ...valoresActuales, grasaCorporal: valor } }));
        setHistorialGrasa(registros);
        setGrasaActual(valor);
      }
      setModalVisible(false);
      setValorRegistro('');
    } catch {
      Alert.alert('No se pudo guardar', 'Intenta nuevamente. El registro no se guardó.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_registro.jpg')} />

      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver a clientes" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color={colors.blanco} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.headerTitle}>Seguimiento y métricas</Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>Cliente: {nombre}</Text>
        </View>
        <LogoMarca />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {!!errorCarga && <Text style={styles.errorText}>{errorCarga}</Text>}

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>PESO ACTUAL</Text>
              <Text style={styles.weightValue}>{pesoActual ? `${pesoActual} kg` : 'Sin registro'}</Text>
            </View>
            <View style={styles.weightIcon}><Ionicons name="scale-outline" size={25} color={colors.azulClaro} /></View>
          </View>
          {variacionPeso !== null && (
            <View style={styles.changeRow}>
              <Ionicons name={variacionPeso <= 0 ? 'trending-down' : 'trending-up'} size={18} color={variacionPeso <= 0 ? colors.verde : colors.rojo} />
              <Text style={[styles.changeText, { color: variacionPeso <= 0 ? colors.verde : colors.rojo }]}>
                {variacionPeso > 0 ? '+' : ''}{variacionPeso.toFixed(1)} kg desde el primer registro
              </Text>
            </View>
          )}
        </View>

        {/* Cada acción registra una métrica distinta para mantener sus valores e historiales claros. */}
        <View style={styles.registerActions}>
          <TouchableOpacity accessibilityRole="button" onPress={() => abrirRegistro('peso')} style={styles.registerButton}>
            <Ionicons name="add-circle-outline" size={21} color={colors.blanco} />
            <Text style={styles.registerButtonText}>Registrar nuevo peso</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => abrirRegistro('grasa')} style={styles.registerButtonSecondary}>
            <Ionicons name="add-circle-outline" size={21} color={colors.azulClaro} />
            <Text style={styles.registerButtonSecondaryText}>Registrar % de grasa corporal</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.sectionHeading}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Historial del peso</Text>
              <Text style={styles.sectionSubtitle}>Evolución registrada para {nombre}</Text>
            </View>
            <Ionicons name="stats-chart-outline" size={21} color={colors.azulClaro} />
          </View>
          {cargando ? (
            <Text style={styles.emptyText}>Cargando historial…</Text>
          ) : historialPeso.length ? (
            <View style={styles.chartWrap}>
              <LineChart data={historialPeso.map((registro) => ({ kg: Number(registro.kg) }))} color={colors.azulClaro} height={170} />
            </View>
          ) : (
            <Text style={styles.emptyText}>Aún no hay registros de peso para mostrar.</Text>
          )}
        </View>

        <View style={styles.historyCard}>
          <View style={styles.sectionHeading}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Registros de peso</Text>
              <Text style={styles.sectionSubtitle}>{historialPeso.length} {historialPeso.length === 1 ? 'registro' : 'registros'}</Text>
            </View>
            <Text style={styles.currentLabel}>kg</Text>
          </View>
          {historialPeso.length ? historialPeso.slice().reverse().map((registro) => (
            <View key={registro.id || `${registro.fecha}-${registro.kg}`} style={styles.historyRow}>
              <View style={styles.historyDot} />
              <Text style={styles.historyDate}>{etiquetaFecha(registro.fecha)}</Text>
              <Text style={styles.historyValue}>{Number(registro.kg).toLocaleString('es-CL')} kg</Text>
            </View>
          )) : <Text style={styles.emptyText}>El primer registro aparecerá aquí.</Text>}
        </View>

        <View style={styles.fatCard}>
          <View style={styles.fatTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Grasa corporal</Text>
              <Text style={styles.sectionSubtitle}>Último valor registrado</Text>
            </View>
            <Text style={styles.fatValue}>{grasaActual ? `${grasaActual} %` : '—'}</Text>
          </View>
          {!!historialGrasa.length && (
            <View style={styles.fatHistory}>
              {historialGrasa.slice().reverse().slice(0, 4).map((registro) => (
                <View key={registro.id || `${registro.fecha}-${registro.porcentaje}`} style={styles.fatHistoryRow}>
                  <Text style={styles.fatHistoryDate}>{etiquetaFecha(registro.fecha)}</Text>
                  <Text style={styles.fatHistoryValue}>{registro.porcentaje} %</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* El mismo formulario compacto permite registrar peso o grasa corporal. */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => !guardando && setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{tipoRegistro === 'peso' ? 'Registrar nuevo peso' : 'Registrar grasa corporal'}</Text>
                <Text style={styles.modalSubtitle}>Cliente: {nombre}</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Cerrar" disabled={guardando} onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={colors.gris} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.fieldLabel}>{tipoRegistro === 'peso' ? 'Peso actual' : 'Porcentaje de grasa corporal'}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={valorRegistro}
                  onChangeText={setValorRegistro}
                  placeholder={tipoRegistro === 'peso' ? 'Ej. 77.2' : 'Ej. 18.5'}
                  placeholderTextColor={colors.gris}
                  keyboardType="decimal-pad"
                  autoFocus
                  style={styles.input}
                />
                <Text style={styles.inputUnit}>{tipoRegistro === 'peso' ? 'kg' : '%'}</Text>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity disabled={guardando} onPress={() => setModalVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity disabled={guardando} onPress={guardarRegistro} style={[styles.saveButton, guardando && { opacity: 0.65 }]}><Text style={styles.saveText}>{guardando ? 'Guardando…' : 'Guardar'}</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// Estilos adaptables para que el contenido no se corte y mantenga la paleta oscura de la aplicación.
const styles = {
  safeArea: { flex: 1, backgroundColor: colors.carbon },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 12 },
  backButton: { width: 30, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { color: colors.blanco, fontSize: 19, fontFamily: 'SundayMasthead-Regular' },
  headerSubtitle: { color: colors.gris, fontSize: 13, marginTop: 3 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 28, gap: 13 },
  errorText: { color: colors.rojo, fontSize: 14, lineHeight: 20, paddingHorizontal: 4 },
  summaryCard: { padding: 18, borderRadius: 17, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.grafito },
  summaryTop: { flexDirection: 'row', alignItems: 'center' },
  eyebrow: { color: colors.gris, fontSize: 12, letterSpacing: 1.2, fontWeight: '700' },
  weightValue: { color: colors.blanco, fontSize: 31, fontWeight: '800', marginTop: 3 },
  weightIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.carbon },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  changeText: { fontSize: 13, fontWeight: '700' },
  registerActions: { gap: 9 },
  registerButton: { minHeight: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: colors.azulClaro },
  registerButtonText: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
  registerButtonSecondary: { minHeight: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.grafito },
  registerButtonSecondaryText: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
  chartCard: { padding: 16, borderRadius: 17, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.grafito },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.blanco, fontSize: 17, fontWeight: '700' },
  sectionSubtitle: { color: colors.gris, fontSize: 13, marginTop: 3 },
  chartWrap: { marginTop: 14, marginHorizontal: -3 },
  emptyText: { color: colors.gris, fontSize: 14, lineHeight: 21, marginTop: 12 },
  historyCard: { padding: 16, borderRadius: 17, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.grafito },
  currentLabel: { color: colors.gris, fontSize: 13, fontWeight: '700' },
  historyRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: colors.carbon },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.azulClaro },
  historyDate: { flex: 1, color: colors.gris, fontSize: 14 },
  historyValue: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
  fatCard: { padding: 16, borderRadius: 17, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.grafito },
  fatTop: { flexDirection: 'row', alignItems: 'center' },
  fatValue: { color: colors.azulClaro, fontSize: 23, fontWeight: '800' },
  fatHistory: { marginTop: 10 },
  fatHistoryRow: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.carbon },
  fatHistoryDate: { color: colors.gris, fontSize: 13 },
  fatHistoryValue: { color: colors.blanco, fontSize: 14, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.75)' },
  modalCard: { width: '100%', maxWidth: 500, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.grafito },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  modalTitle: { color: colors.blanco, fontSize: 18, fontFamily: 'SundayMasthead-Regular' },
  modalSubtitle: { color: colors.gris, fontSize: 13, marginTop: 4 },
  closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalContent: { paddingHorizontal: 18, paddingBottom: 18 },
  fieldLabel: { color: colors.blanco, fontSize: 14, fontWeight: '700', marginTop: 5, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minHeight: 50, color: colors.blanco, fontSize: 19, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.azulOscuro, borderRadius: 10, backgroundColor: colors.carbon },
  inputUnit: { minWidth: 24, color: colors.gris, fontSize: 16 },
  modalActions: { flexDirection: 'row', gap: 9, marginTop: 18 },
  cancelButton: { flex: 1, minHeight: 45, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.azulOscuro, borderRadius: 9 },
  cancelText: { color: colors.gris, fontSize: 14, fontWeight: '700' },
  saveButton: { flex: 1, minHeight: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.azulClaro },
  saveText: { color: colors.blanco, fontSize: 14, fontWeight: '700' },
};
