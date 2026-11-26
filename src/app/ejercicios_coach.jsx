import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import VideoEjercicio from '../components/VideoEjercicio';
import { colors } from '../constants/theme';
import FondoThomas from '../components/FondoThomas';
import '../global.css';
import { CLAVE_EJERCICIOS, EJERCICIOS_INICIALES, actualizarBibliotecaReal } from '../lib/rutinas';
import { guardarVideoLocal, obtenerUriVideoLocal, seleccionarVideo, } from '../lib/videosLocales';


export default function EjerciciosCoach() {
  const router = useRouter();
  const [ejercicios, setEjercicios] = useState(EJERCICIOS_INICIALES);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [idEditando, setIdEditando] = useState('');
  const [formulario, setFormulario] = useState({
    nombre: '',
    grupo: '',
    equipo: '',
    descripcion: '',
    videoLocal: null, //nuevo
  });
  // Código correspondiente a la subida de video
  const [videoPendiente, setVideoPendiente] = useState(null); 
  const [procesandoVideo, setProcesandoVideo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [videoAbierto, setVideoAbierto] = useState(null);

  // La biblioteca usa AsyncStorage mientras el backend todavía no ofrece gestión de ejercicios.
  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        // Cambia los ejercicios de ejemplo por los reales del Split App principiante (una sola vez).
        await actualizarBibliotecaReal();
        const guardados = await AsyncStorage.getItem(CLAVE_EJERCICIOS);
        if (!activo) return;
        const lista = guardados ? JSON.parse(guardados) : EJERCICIOS_INICIALES;
        setEjercicios(Array.isArray(lista) ? lista : EJERCICIOS_INICIALES);
      } catch (error) {
        if (activo) setEjercicios(EJERCICIOS_INICIALES);
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => { activo = false; };
  }, []);

  // Conserva las altas, ediciones y eliminaciones para la próxima apertura de la pantalla.
  {/*useEffect(() => {
    if (!cargando) AsyncStorage.setItem(CLAVE_EJERCICIOS, JSON.stringify(ejercicios)).catch(() => {});
  }, [ejercicios, cargando]); */}

  const eliminarEjercicio = async (id) => {
    try {
      const lista = ejercicios.filter((item) => item.id !== id);

      await AsyncStorage.setItem(
        CLAVE_EJERCICIOS,
        JSON.stringify(lista)
      );

      setEjercicios(lista);
    } catch {
      Alert.alert('Error', 'No se pudo eliminar el ejercicio.');
    }
  };

  const ejerciciosVisibles = useMemo(() => {
    const consulta = normalizar(busqueda);
    return ejercicios.filter((ejercicio) => normalizar([
      ejercicio.id,
      ejercicio.nombre,
      ejercicio.grupo,
      ejercicio.equipo,
    ].join(' ')).includes(consulta));
  }, [ejercicios, busqueda]);

  const abrirFormulario = (ejercicio = null) => {
    setIdEditando(ejercicio?.id || '');
    setFormulario({
      nombre: ejercicio?.nombre || '',
      grupo: ejercicio?.grupo || '',
      equipo: ejercicio?.equipo || '',
      descripcion: ejercicio?.descripcion || '',
      videoLocal: ejercicio?.videoLocal || null, //nuevo
    });
    setVideoPendiente(null); //nuevo
    setModalVisible(true);
  };

  const guardarEjercicio = async () => {
    if (guardando || procesandoVideo) return; // nuevo

    const nombre = formulario.nombre.trim();
    const grupo = formulario.grupo.trim();
    if (!nombre || !grupo) {
      Alert.alert('Completa los datos', 'Ingresa el nombre del ejercicio y el grupo muscular.');
      return;
    }
    setGuardando(true); //nuevo
  
  {/*nuevo*/}  
  try {
    let videoLocal = formulario.videoLocal || null;

    if (videoPendiente) {
      videoLocal = await guardarVideoLocal(videoPendiente);
    }

    const datos = {
      ...formulario,
      nombre,
      grupo,
      equipo: formulario.equipo.trim() || 'Sin equipamiento',
      descripcion: (formulario.descripcion || '').trim(),
      videoLocal,
    };
    {/*hasta aqui*/}

    const lista = idEditando
      ? ejercicios.map((ejercicio) =>
          ejercicio.id === idEditando
            ? { ...ejercicio, ...datos }
            : ejercicio
        )
      : [
          {
            ...datos,
            id: `EJ-${Date.now()}`,
          },
          ...ejercicios,
        ];

    // Primero confirmamos que el ejercicio quedó guardado.
      await AsyncStorage.setItem(
        CLAVE_EJERCICIOS,
        JSON.stringify(lista)
      );

      setEjercicios(lista);
      setVideoPendiente(null);
      setModalVisible(false);
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error.message || 'Intenta nuevamente.'
      );
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = (ejercicio) => {
    Alert.alert(
      'Eliminar ejercicio',
      `Se quitará “${ejercicio.nombre}” de la biblioteca. Las copias que ya están en rutinas se conservarán.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => setEjercicios((actuales) => actuales.filter((item) => item.id !== ejercicio.id)),
        },
      ]
    );
  };

  //Nuevo
  const elegirVideo = async () => {
  if (procesandoVideo || guardando) return;

  setProcesandoVideo(true);

  try {
    const video = await seleccionarVideo();

    // Cancelar el selector conserva la selección anterior.
    if (video) setVideoPendiente(video);
  } catch (error) {
    Alert.alert('No se pudo elegir el video', error.message);
  } finally {
    setProcesandoVideo(false);
  }
};

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_panel_profesional.jpg')} />
      <View style={styles.page}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={23} color={colors.blanco} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>Ejercicios</Text>
            <Text style={styles.subtitle}>Biblioteca del personal trainer</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Crear ejercicio" onPress={() => abrirFormulario()} style={styles.createButton}>
            <Ionicons name="add" size={22} color={colors.blanco} />
            <Text style={styles.createText}>Crear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchArea}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={colors.gris} />
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar por ejercicio, ID o grupo"
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
          <Text style={styles.resultCount}>{ejerciciosVisibles.length} {ejerciciosVisibles.length === 1 ? 'ejercicio' : 'ejercicios'}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {cargando ? (
            <View style={styles.emptyState}><Text style={styles.emptyText}>Cargando ejercicios…</Text></View>
          ) : ejerciciosVisibles.length ? ejerciciosVisibles.map((ejercicio) => (
            <View key={ejercicio.id} style={styles.exerciseCard}>
              <View style={styles.exerciseIcon}>
                <Ionicons name="barbell-outline" size={21} color={colors.azulClaro} />
              </View>
              <View style={styles.exerciseCopy}>
                <Text numberOfLines={2} style={styles.exerciseName}>{ejercicio.nombre}</Text>
                <Text numberOfLines={2} style={styles.exerciseMeta}>{ejercicio.grupo} · {ejercicio.equipo || 'Sin equipamiento'}</Text>
                {!!ejercicio.series && (
                  <Text style={styles.exercisePrescription}>
                    {ejercicio.series} series · {ejercicio.repeticiones} · descanso {ejercicio.descanso}
                  </Text>
                )}
                {!!ejercicio.descripcion && <Text style={styles.exerciseDescription}>{ejercicio.descripcion}</Text>}
                <Text style={styles.exerciseId}>ID {ejercicio.id}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Editar ${ejercicio.nombre}`} onPress={() => abrirFormulario(ejercicio)} style={styles.iconButton}>
                  <Ionicons name="create-outline" size={18} color={colors.azulClaro} />
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Eliminar ${ejercicio.nombre}`} onPress={() => eliminarEjercicio(ejercicio.id)} style={styles.iconButton}>
                  <Ionicons name="trash-outline" size={18} color={colors.rojo} />
                </TouchableOpacity>
              </View>
            </View>
          )) : (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={28} color={colors.azulClaro} />
              <Text style={styles.emptyTitle}>No encontramos ejercicios</Text>
              <Text style={styles.emptyText}>Prueba otra búsqueda o crea un ejercicio nuevo.</Text>
            </View>
          )}
        </ScrollView>
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{idEditando ? 'Editar ejercicio' : 'Crear ejercicio'}</Text>
                <Text style={styles.modalSubtitle}>Se podrá agregar a las rutinas del entrenador.</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Cerrar" onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={21} color={colors.gris} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
              {!!idEditando && <Text style={styles.readOnlyId}>ID de ejercicio: {idEditando}</Text>}
              <CampoFormulario label="Nombre" campo="nombre" formulario={formulario} setFormulario={setFormulario} placeholder="Ej. Press de banca" />
              <CampoFormulario label="Grupo muscular" campo="grupo" formulario={formulario} setFormulario={setFormulario} placeholder="Ej. Pecho" />
              <CampoFormulario label="Equipamiento" campo="equipo" formulario={formulario} setFormulario={setFormulario} placeholder="Ej. Barra, polea o peso corporal" />
              <CampoFormulario label="Descripción" campo="descripcion" formulario={formulario} setFormulario={setFormulario} placeholder="En qué consiste el ejercicio" multiline />


              {/* Nuevo */} 
              <Text style={styles.fieldLabel}>Video del ejercicio</Text>

              <TouchableOpacity
                onPress={elegirVideo}
                disabled={procesandoVideo || guardando}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>
                  {procesandoVideo
                    ? 'Abriendo galería…'
                    : videoPendiente || formulario.videoLocal
                      ? 'Cambiar video'
                      : 'Elegir video de la galería'}
                </Text>
              </TouchableOpacity>

              {(videoPendiente || formulario.videoLocal) && (
                <>
                  <Text style={styles.modalSubtitle}>
                    {videoPendiente
                      ? 'Video seleccionado. Se importará al guardar.'
                      : 'Este ejercicio ya tiene un video local.'}
                  </Text>

                  <TouchableOpacity
                    disabled={guardando}
                    onPress={() => {
                      const uri =
                        videoPendiente?.uri ||
                        obtenerUriVideoLocal(formulario.videoLocal);

                      if (!uri) {
                        Alert.alert(
                          'Video no disponible',
                          'El archivo ya no está en este dispositivo.'
                        );
                        return;
                      }

                      setVideoAbierto(uri);
                    }}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelText}>Ver video</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={guardando}
                    onPress={() => {
                      setVideoPendiente(null);
                      setFormulario((actual) => ({
                        ...actual,
                        videoLocal: null,
                      }));
                    }}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelText}>Quitar video</Text>
                  </TouchableOpacity>
                </>
              )}
              {/* Hasta aquí*/}


              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity onPress={guardarEjercicio} disabled={guardando || procesandoVideo} style={styles.saveButton}><Text style={styles.saveText}> {guardando ? 'Guardando…' : 'Guardar ejercicio'}</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
        {/* Reproductor del video seleccionado */}
        {videoAbierto && (
          <VideoEjercicio
            key={videoAbierto}
            uri={videoAbierto}
            onCerrar={() => setVideoAbierto(null)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

function CampoFormulario({ label, campo, formulario, setFormulario, placeholder, multiline = false }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={formulario[campo]}
        onChangeText={(valor) => setFormulario((actual) => ({ ...actual, [campo]: valor }))}
        placeholder={placeholder}
        placeholderTextColor={colors.gris}
        multiline={multiline}
        style={[styles.input, multiline && { minHeight: 90, paddingTop: 10, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

const normalizar = (texto = '') => texto
  .toLocaleLowerCase('es-CL')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

// Estilos locales con la misma paleta oscura y azul del panel del entrenador.
const styles = {
  page: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12 },
  backButton: { width: 36, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  title: { color: colors.blanco, fontSize: 22, fontFamily: 'SundayMasthead-Regular' },
  subtitle: { color: colors.gris, fontSize: 14, marginTop: 3 },
  createButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.azulClaro },
  createText: { color: colors.blanco, fontSize: 16, fontWeight: '700' },
  searchArea: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 10 },
  searchBox: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 11, backgroundColor: colors.grafito, borderWidth: 1, borderColor: colors.azulOscuro },
  searchInput: { flex: 1, minWidth: 0, color: colors.blanco, fontSize: 14, paddingVertical: 8, outlineStyle: 'none' },
  resultCount: { color: colors.gris, fontSize: 15, marginTop: 10 },
  list: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 18, gap: 12 },
  exerciseCard: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.grafito },
  exerciseIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.carbon },
  exerciseCopy: { flex: 1, minWidth: 0 },
  exerciseName: { color: colors.blanco, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  exerciseMeta: { color: colors.gris, fontSize: 15, lineHeight: 20, marginTop: 5 },
  exercisePrescription: { color: colors.blanco, fontSize: 15, lineHeight: 20, marginTop: 6 },
  exerciseDescription: { color: colors.blanco, opacity: 0.7, fontSize: 14, lineHeight: 19, marginTop: 6 },
  exerciseId: { color: colors.gris, fontSize: 14, marginTop: 4 },
  cardActions: { alignItems: 'center', gap: 5 },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  emptyState: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  emptyTitle: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
  emptyText: { color: colors.gris, fontSize: 16, textAlign: 'center', lineHeight: 23 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(0, 0, 0, 0.72)' },
  modalCard: { width: '100%', maxWidth: 540, maxHeight: '92%', overflow: 'hidden', borderRadius: 16, backgroundColor: colors.grafito, borderWidth: 1, borderColor: colors.azulOscuro },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  modalTitle: { color: colors.blanco, fontSize: 17, fontFamily: 'SundayMasthead-Regular' },
  modalSubtitle: { color: colors.gris, fontSize: 13, marginTop: 4, lineHeight: 18 },
  closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  formContent: { paddingHorizontal: 18, paddingBottom: 18 },
  readOnlyId: { color: colors.azulClaro, fontSize: 13, marginBottom: 5 },
  fieldLabel: { color: colors.blanco, fontSize: 14, fontWeight: '700', marginTop: 11, marginBottom: 7 },
  input: { minHeight: 43, color: colors.blanco, fontSize: 15, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.azulOscuro, borderRadius: 9, backgroundColor: colors.carbon },
  levelOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  levelChip: { minHeight: 31, justifyContent: 'center', alignItems: 'center', borderRadius: 99, borderWidth: 1, borderColor: colors.azulOscuro, paddingHorizontal: 12, backgroundColor: colors.carbon },
  levelChipActive: { backgroundColor: colors.azulOscuro, borderColor: colors.azulClaro },
  levelChipText: { color: colors.gris, fontSize: 13, fontWeight: '600' },
  levelChipTextActive: { color: colors.blanco },
  numberFields: { flexDirection: 'row', gap: 10 },
  modalActions: { flexDirection: 'row', gap: 9, marginTop: 20 },
  cancelButton: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.azulOscuro, borderRadius: 9 },
  cancelText: { color: colors.gris, fontSize: 14, fontWeight: '700' },
  saveButton: { flex: 1.3, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.azulClaro },
  saveText: { color: colors.blanco, fontSize: 14, fontWeight: '700' },
};
