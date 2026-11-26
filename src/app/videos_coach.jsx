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
import VideoEjercicio from '../components/VideoEjercicio';
import { colors } from '../constants/theme';
import '../global.css';
import {
  eliminarVideoLocal,
  guardarVideoLocal,
  obtenerUriVideoLocal,
} from '../lib/videosLocales';

// La biblioteca de videos del entrenador se guarda en el dispositivo sin cambiar MongoDB.
const CLAVE_VIDEOS = 'ptrainer_videos_coach_v1';
const NIVELES = ['Inicial', 'Intermedio', 'Avanzado'];
const FORMULARIO_VACIO = {
  titulo: '',
  descripcion: '',
  categoria: '',
  nivel: 'Inicial',
  duracion: '',
  url: '',
  ejercicio: '',
  archivoLocal: null,
};

// Los tonos del nivel ayudan a distinguir el público recomendado para cada video.
const colorNivel = (nivel) => ({
  Inicial: colors.verde,
  Intermedio: colors.azulClaro,
  Avanzado: colors.rojo,
}[nivel] || colors.gris);

// Convierte cualquier texto a una forma sencilla para comparar búsquedas con o sin tilde.
const normalizar = (texto = '') => texto
  .toLocaleLowerCase('es-CL')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

// Obtiene un identificador estable aunque la respuesta del servidor use id o _id.
const idCliente = (cliente) => String(cliente?.id || cliente?._id || '');

export default function VideosCoach() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const clienteDestinoId = String(Array.isArray(params.clienteId) ? params.clienteId[0] || '' : params.clienteId || '');
  const nombreDestino = String(Array.isArray(params.nombre) ? params.nombre[0] || '' : params.nombre || '');
  const [videos, setVideos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [videosSeleccionados, setVideosSeleccionados] = useState([]);
  const [modalVideoVisible, setModalVideoVisible] = useState(false);
  const [modalClientesVisible, setModalClientesVisible] = useState(false);
  const [idEditando, setIdEditando] = useState('');
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [videoPendiente, setVideoPendiente] = useState(null);
  const [clientesSeleccionados, setClientesSeleccionados] = useState([]);
  const [videoAbierto, setVideoAbierto] = useState(null);
  const [procesando, setProcesando] = useState(false);

  // Al abrir la biblioteca desde un cliente, activa la selección de videos para asignarle.
  useEffect(() => {
    if (clienteDestinoId) {
      setModoSeleccion(true);
      setVideosSeleccionados([]);
    }
  }, [clienteDestinoId]);

  // Al entrar a la sección se recuperan los videos del dispositivo y los clientes disponibles.
  useFocusEffect(useCallback(() => {
    let activo = true;
    setCargando(true);

    const cargar = async () => {
      const [videosGuardados, clientesServidor] = await Promise.all([
        AsyncStorage.getItem(CLAVE_VIDEOS).catch(() => null),
        api('/alumnos/').catch(() => []),
      ]);

      if (!activo) return;

      try {
        const lista = videosGuardados ? JSON.parse(videosGuardados) : [];
        setVideos(Array.isArray(lista) ? lista : []);
      } catch {
        setVideos([]);
      }

      const listaClientes = Array.isArray(clientesServidor) ? clientesServidor : [];
      setClientes(listaClientes.map((cliente) => ({
        id: idCliente(cliente),
        nombre: cliente.nombre || cliente.correo || 'Cliente',
        experiencia: cliente.datos?.experiencia || '',
      })).filter((cliente) => cliente.id));
      setCargando(false);
    };

    cargar();
    return () => { activo = false; };
  }, []));

  // Mantiene el listado actualizado en el almacenamiento local cada vez que cambia.
  const guardarBiblioteca = async (lista) => {
    await AsyncStorage.setItem(CLAVE_VIDEOS, JSON.stringify(lista));
    setVideos(lista);
  };

  // El buscador encuentra videos por nombre, descripción, categoría y nivel.
  const videosVisibles = useMemo(() => {
    const consulta = normalizar(busqueda);
    return videos.filter((video) => normalizar([
      video.titulo,
      video.descripcion,
      video.categoria,
      video.nivel,
      video.duracion,
      video.id,
    ].join(' ')).includes(consulta));
  }, [videos, busqueda]);

  // Abre el formulario vacío o relleno con los datos guardados para editar.
  const abrirFormulario = (video = null) => {
    setIdEditando(video?.id || '');
    setFormulario(video ? {
      titulo: video.titulo || '',
      descripcion: video.descripcion || '',
      categoria: video.categoria || '',
      nivel: video.nivel || 'Inicial',
      duracion: video.duracion || '',
      url: video.url || '',
      ejercicio: video.ejercicio || '',
      archivoLocal: video.archivoLocal || null,
    } : FORMULARIO_VACIO);
    setVideoPendiente(null);
    setModalVideoVisible(true);
  };

  // Guarda título, descripción y datos de clasificación junto al archivo local elegido.
  const guardarVideo = async () => {
    const titulo = formulario.titulo.trim();
    if (!titulo) {
      Alert.alert('Falta el título', 'Escribe un título para identificar el video.');
      return;
    }
    const url = formulario.url.trim();
    if (!url && !formulario.archivoLocal) {
      Alert.alert('Falta la URL', 'Pega el link del video de Cloudinary.');
      return;
    }
    if (url && !/^https:\/\//i.test(url)) {
      Alert.alert('URL no válida', 'El link debe empezar con https://');
      return;
    }
    if (!formulario.ejercicio.trim()) {
      Alert.alert('Falta el ejercicio', 'Escribe el ejercicio al que corresponde el video (ej. Plano Banca).');
      return;
    }

    setProcesando(true);
    let archivoNuevo = null;
    try {
      archivoNuevo = videoPendiente
        ? await guardarVideoLocal(videoPendiente)
        : formulario.archivoLocal;
      const anterior = videos.find((video) => video.id === idEditando);
      const datos = {
        id: idEditando || `VIDEO-${Date.now()}`,
        titulo,
        descripcion: formulario.descripcion.trim(),
        categoria: formulario.categoria.trim(),
        nivel: formulario.nivel,
        duracion: formulario.duracion.trim(),
        url,
        ejercicio: formulario.ejercicio.trim(),
        archivoLocal: archivoNuevo,
        nombreArchivo: videoPendiente?.fileName || anterior?.nombreArchivo || '',
        asignadoA: anterior?.asignadoA || [],
        fechaActualizacion: new Date().toISOString(),
      };
      const lista = idEditando
        ? videos.map((video) => video.id === idEditando ? datos : video)
        : [datos, ...videos];

      await guardarBiblioteca(lista);
      if (anterior?.archivoLocal && anterior.archivoLocal !== archivoNuevo) {
        await eliminarVideoLocal(anterior.archivoLocal).catch(() => {});
      }
      setModalVideoVisible(false);
      setVideoPendiente(null);
    } catch (error) {
      if (archivoNuevo && archivoNuevo !== formulario.archivoLocal) {
        await eliminarVideoLocal(archivoNuevo).catch(() => {});
      }
      Alert.alert('No se pudo guardar', error.message || 'Intenta nuevamente.');
    } finally {
      setProcesando(false);
    }
  };

  // Activa o desactiva una ficha dentro de la selección múltiple.
  const alternarVideo = (id) => setVideosSeleccionados((seleccionados) => (
    seleccionados.includes(id)
      ? seleccionados.filter((actual) => actual !== id)
      : [...seleccionados, id]
  ));

  // Elimina del listado y del teléfono los archivos asociados a los videos seleccionados.
  const eliminarSeleccionados = () => {
    if (!videosSeleccionados.length) {
      Alert.alert('Selecciona videos', 'Marca uno o más videos para eliminarlos.');
      return;
    }
    Alert.alert('Eliminar videos', `Se eliminarán ${videosSeleccionados.length} video(s) de esta biblioteca.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const eliminados = videos.filter((video) => videosSeleccionados.includes(video.id));
          const lista = videos.filter((video) => !videosSeleccionados.includes(video.id));
          try {
            await guardarBiblioteca(lista);
            await Promise.all(eliminados.map((video) => eliminarVideoLocal(video.archivoLocal).catch(() => {})));
            setVideosSeleccionados([]);
            setModoSeleccion(false);
          } catch {
            Alert.alert('No se pudieron eliminar', 'Intenta nuevamente.');
          }
        },
      },
    ]);
  };

  // Abre el selector de clientes para asociar los videos que están marcados.
  const abrirAsignacion = () => {
    if (!videosSeleccionados.length) {
      Alert.alert('Selecciona videos', 'Marca uno o más videos antes de asignarlos.');
      return;
    }
    // Desde un perfil se asignan los videos marcados directamente a ese cliente.
    if (clienteDestinoId) {
      guardarAsignaciones();
      return;
    }
    setClientesSeleccionados([]);
    setModalClientesVisible(true);
  };

  // Guarda en cada ficha los clientes elegidos sin modificar la estructura de MongoDB.
  const guardarAsignaciones = async () => {
    const idsClientesAsignados = clienteDestinoId ? [clienteDestinoId] : clientesSeleccionados;
    if (!idsClientesAsignados.length) {
      Alert.alert('Selecciona clientes', 'Marca al menos un cliente para continuar.');
      return;
    }
    const nombresClientes = clientes
      .filter((cliente) => idsClientesAsignados.includes(cliente.id))
      .map(({ id, nombre }) => ({ id, nombre }));
    if (clienteDestinoId && !nombresClientes.some((cliente) => cliente.id === clienteDestinoId)) {
      nombresClientes.push({ id: clienteDestinoId, nombre: nombreDestino || 'Cliente' });
    }
    const lista = videos.map((video) => {
      if (!videosSeleccionados.includes(video.id)) return video;
      const asignadosPrevios = Array.isArray(video.asignadoA) ? video.asignadoA : [];
      const combinados = new Map(asignadosPrevios.map((cliente) => [String(cliente.id), cliente]));
      nombresClientes.forEach((cliente) => combinados.set(String(cliente.id), cliente));
      return { ...video, asignadoA: [...combinados.values()] };
    });

    try {
      // Envía el link de cada video al ejercicio con el mismo nombre en las rutinas de cada cliente.
      const videosConUrl = videos.filter((video) => videosSeleccionados.includes(video.id) && video.url && video.ejercicio);
      const sinEjercicio = [];
      for (const cliente of nombresClientes) {
        for (const video of videosConUrl) {
          const respuesta = await api(`/videos-ejercicio/${cliente.id}/`, {
            method: 'POST',
            body: { ejercicio: video.ejercicio, video: video.url },
          });
          if (!respuesta?.actualizados) sinEjercicio.push(`${cliente.nombre}: ${video.ejercicio}`);
        }
      }

      await guardarBiblioteca(lista);
      setModalClientesVisible(false);
      setVideosSeleccionados([]);
      setModoSeleccion(false);
      Alert.alert(
        'Videos asignados',
        sinEjercicio.length
          ? `Listo, pero estos clientes no tienen ese ejercicio en sus rutinas:\n${sinEjercicio.join('\n')}`
          : 'El cliente ya puede ver el video en Mi rutina (si tiene Plan Avanzado).'
      );
    } catch (error) {
      Alert.alert('No se pudieron asignar', error?.message || 'Intenta nuevamente.');
    }
  };

  // Elimina una sola ficha después de pedir confirmación.
  const eliminarUno = (video) => Alert.alert('Eliminar video', `¿Quieres eliminar “${video.titulo}”?`, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Eliminar',
      style: 'destructive',
      onPress: async () => {
        try {
          await guardarBiblioteca(videos.filter((item) => item.id !== video.id));
          await eliminarVideoLocal(video.archivoLocal).catch(() => {});
        } catch {
          Alert.alert('No se pudo eliminar', 'Intenta nuevamente.');
        }
      },
    },
  ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_panel_profesional.jpg')} />
      <View style={styles.page}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver al inicio" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.blanco} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Videos</Text>
            <Text style={styles.subtitle}>{clienteDestinoId ? `Selecciona videos para ${nombreDestino || 'este cliente'}` : 'Biblioteca del personal trainer'}</Text>
          </View>
          <LogoMarca />
        </View>

        <View style={styles.tools}>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={19} color={colors.gris} />
              <TextInput
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Buscar por título, descripción o categoría"
                placeholderTextColor={colors.gris}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {!!busqueda && <TouchableOpacity accessibilityLabel="Limpiar búsqueda" onPress={() => setBusqueda('')}><Ionicons name="close-circle" size={19} color={colors.gris} /></TouchableOpacity>}
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Crear video" onPress={() => abrirFormulario()} style={styles.createButton}>
              <Ionicons name="add" size={27} color={colors.blanco} />
            </TouchableOpacity>
          </View>

          <View style={styles.selectionRow}>
            <Text style={styles.resultCount}>{videosVisibles.length} {videosVisibles.length === 1 ? 'video' : 'videos'}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => { setModoSeleccion((actual) => !actual); setVideosSeleccionados([]); }}
              style={styles.selectionButton}
            >
              <Ionicons name={modoSeleccion ? 'close' : 'checkmark-circle-outline'} size={18} color={colors.azulClaro} />
              <Text style={styles.selectionButtonText}>{modoSeleccion ? 'Cancelar selección' : 'Seleccionar'}</Text>
            </TouchableOpacity>
          </View>

          {modoSeleccion && (
            <View style={styles.bulkActions}>
              <Text style={styles.selectionHint}>{videosSeleccionados.length} seleccionados</Text>
              <TouchableOpacity onPress={abrirAsignacion} style={styles.assignButton}>
                <Ionicons name="people-outline" size={18} color={colors.blanco} />
                <Text style={styles.actionText}>{clienteDestinoId ? `Asignar a ${nombreDestino || 'cliente'}` : 'Asignar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={eliminarSeleccionados} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={18} color={colors.rojo} />
                <Text style={styles.deleteText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {cargando ? (
            <View style={styles.emptyState}><Text style={styles.emptyText}>Cargando videos…</Text></View>
          ) : videosVisibles.length ? videosVisibles.map((video) => {
            const seleccionado = videosSeleccionados.includes(video.id);
            const uri = video.url || obtenerUriVideoLocal(video.archivoLocal);
            return (
              <View key={video.id} style={styles.videoCard}>
                {modoSeleccion && (
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: seleccionado }}
                    accessibilityLabel={`${seleccionado ? 'Quitar' : 'Seleccionar'} ${video.titulo}`}
                    onPress={() => alternarVideo(video.id)}
                    style={styles.checkbox}
                  >
                    <Ionicons name={seleccionado ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={seleccionado ? colors.azulClaro : colors.gris} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Reproducir ${video.titulo}`}
                  onPress={() => uri ? setVideoAbierto(uri) : Alert.alert('Video no disponible', 'El archivo ya no está guardado en este dispositivo.')}
                  style={styles.playButton}
                >
                  <Ionicons name="play" size={22} color={colors.azulClaro} />
                </TouchableOpacity>
                <View style={styles.videoCopy}>
                  <Text style={styles.videoTitle}>{video.titulo}</Text>
                  {!!video.descripcion && <Text style={styles.description} numberOfLines={3}>{video.descripcion}</Text>}
                  <View style={styles.metadataRow}>
                    {!!video.categoria && <MetaChip icon="pricetag-outline" text={video.categoria} />}
                    {!!video.duracion && <MetaChip icon="time-outline" text={`${video.duracion} min`} />}
                    <MetaChip icon="barbell-outline" text={video.nivel || 'Inicial'} color={colorNivel(video.nivel)} />
                  </View>
                  {!!video.asignadoA?.length && (
                    <Text style={styles.assignedText} numberOfLines={2}>
                      Asignado a: {video.asignadoA.map((cliente) => cliente.nombre).join(', ')}
                    </Text>
                  )}
                </View>
                {!modoSeleccion && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Editar ${video.titulo}`} onPress={() => abrirFormulario(video)} style={styles.iconButton}>
                      <Ionicons name="create-outline" size={20} color={colors.azulClaro} />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Eliminar ${video.titulo}`} onPress={() => eliminarUno(video)} style={styles.iconButton}>
                      <Ionicons name="trash-outline" size={19} color={colors.rojo} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }) : (
            <View style={styles.emptyState}>
              <Ionicons name={busqueda ? 'search-outline' : 'videocam-outline'} size={34} color={colors.azulClaro} />
              <Text style={styles.emptyTitle}>{busqueda ? 'No encontramos videos' : 'Todavía no hay videos'}</Text>
              <Text style={styles.emptyText}>{busqueda ? 'Prueba con otro título o categoría.' : 'Cuando se carguen videos, aquí aparecerán su título, descripción y detalles.'}</Text>
              {!busqueda && <TouchableOpacity onPress={() => abrirFormulario()} style={styles.emptyCreate}><Ionicons name="add" size={19} color={colors.blanco} /><Text style={styles.actionText}>Crear video</Text></TouchableOpacity>}
            </View>
          )}
        </ScrollView>
      </View>

      {/* El formulario reúne los datos visibles de la ficha y su archivo de video. */}
      <Modal visible={modalVideoVisible} transparent animationType="fade" onRequestClose={() => !procesando && setModalVideoVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{idEditando ? 'Editar video' : 'Crear video'}</Text>
                <Text style={styles.modalSubtitle}>Completa la información para identificarlo y encontrarlo fácilmente.</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Cerrar" disabled={procesando} onPress={() => setModalVideoVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={colors.gris} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
              {!!idEditando && <Text style={styles.readOnlyId}>ID: {idEditando}</Text>}
              <Campo label="Título" value={formulario.titulo} onChangeText={(titulo) => setFormulario((actual) => ({ ...actual, titulo }))} placeholder="Ej. Técnica de sentadilla" />
              <Campo label="Descripción" value={formulario.descripcion} onChangeText={(descripcion) => setFormulario((actual) => ({ ...actual, descripcion }))} placeholder="Describe el contenido o el objetivo del video" multiline />
              <Campo label="Categoría o enfoque" value={formulario.categoria} onChangeText={(categoria) => setFormulario((actual) => ({ ...actual, categoria }))} placeholder="Ej. Piernas, técnica, movilidad" />
              <Text style={styles.fieldLabel}>Nivel recomendado</Text>
              <View style={styles.levelOptions}>
                {NIVELES.map((nivel) => {
                  const activo = formulario.nivel === nivel;
                  return <TouchableOpacity key={nivel} onPress={() => setFormulario((actual) => ({ ...actual, nivel }))} style={[styles.levelChip, activo && { borderColor: colorNivel(nivel), backgroundColor: `${colorNivel(nivel)}22` }]}><Text style={[styles.levelText, activo && { color: colorNivel(nivel) }]}>{nivel}</Text></TouchableOpacity>;
                })}
              </View>
              <Campo label="Duración (minutos)" value={formulario.duracion} onChangeText={(duracion) => setFormulario((actual) => ({ ...actual, duracion: duracion.replace(/[^0-9]/g, '') }))} placeholder="Ej. 8" keyboardType="number-pad" />

              <Campo label="Ingresar URL del video (Cloudinary)" value={formulario.url} onChangeText={(url) => setFormulario((actual) => ({ ...actual, url }))} placeholder="https://res.cloudinary.com/..." keyboardType="url" />
              <Campo label="Ejercicio de la rutina" value={formulario.ejercicio} onChangeText={(ejercicio) => setFormulario((actual) => ({ ...actual, ejercicio }))} placeholder="Ej. Plano Banca (igual que en la rutina)" />
              <Text style={styles.fileHint}>Al asignarlo, el link se guarda en ese ejercicio de las rutinas del cliente y le aparece el botón «Ver video».</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity disabled={procesando} onPress={() => setModalVideoVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity disabled={procesando} onPress={guardarVideo} style={[styles.saveButton, procesando && { opacity: 0.6 }]}><Text style={styles.saveText}>{procesando ? 'Guardando…' : 'Guardar video'}</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* El selector permite asociar en una sola acción los videos marcados a varios clientes. */}
      <Modal visible={modalClientesVisible} transparent animationType="fade" onRequestClose={() => setModalClientesVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}><Text style={styles.modalTitle}>Asignar videos</Text><Text style={styles.modalSubtitle}>Elige uno o más clientes.</Text></View>
              <TouchableOpacity accessibilityLabel="Cerrar" onPress={() => setModalClientesVisible(false)} style={styles.closeButton}><Ionicons name="close" size={22} color={colors.gris} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.clientList} contentContainerStyle={{ gap: 8 }}>
              {clientes.length ? clientes.map((cliente) => {
                const activo = clientesSeleccionados.includes(cliente.id);
                return (
                  <TouchableOpacity key={cliente.id} onPress={() => setClientesSeleccionados((actuales) => activo ? actuales.filter((id) => id !== cliente.id) : [...actuales, cliente.id])} style={styles.clientRow}>
                    <Ionicons name={activo ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={activo ? colors.azulClaro : colors.gris} />
                    <View style={{ flex: 1 }}><Text style={styles.clientName}>{cliente.nombre}</Text>{!!cliente.experiencia && <Text style={styles.clientLevel}>Nivel {cliente.experiencia}</Text>}</View>
                  </TouchableOpacity>
                );
              }) : <Text style={styles.emptyText}>No se encontraron clientes disponibles.</Text>}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalClientesVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={guardarAsignaciones} style={styles.saveButton}><Text style={styles.saveText}>Asignar videos</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {!!videoAbierto && <VideoEjercicio uri={videoAbierto} onCerrar={() => setVideoAbierto(null)} />}
    </SafeAreaView>
  );
}

// Los campos reutilizan los mismos colores y medidas del resto de formularios profesionales.
function Campo({ label, value, onChangeText, placeholder, multiline = false, keyboardType = 'default' }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gris}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

// Las etiquetas pequeñas resumen los datos de cada video en la tarjeta.
function MetaChip({ icon, text, color = colors.azulClaro }) {
  return (
    <View style={[styles.metaChip, { borderColor: `${color}66` }]}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.metaText, { color }]}>{text}</Text>
    </View>
  );
}

// Estilos locales adaptables para que la biblioteca se lea bien en móvil y tablet.
const styles = {
  safeArea: { flex: 1, backgroundColor: colors.carbon },
  page: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10 },
  backButton: { width: 34, height: 40, justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.blanco, fontSize: 22, fontFamily: 'SundayMasthead-Regular' },
  subtitle: { color: colors.gris, fontSize: 14, marginTop: 3 },
  tools: { paddingHorizontal: 18, paddingBottom: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchBox: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 11, backgroundColor: colors.grafito, borderWidth: 1, borderColor: colors.azulOscuro },
  searchInput: { flex: 1, minWidth: 0, color: colors.blanco, fontSize: 14, paddingVertical: 8, outlineStyle: 'none' },
  createButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.azulClaro },
  selectionRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultCount: { color: colors.gris, fontSize: 14 },
  selectionButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingLeft: 10 },
  selectionButtonText: { color: colors.blanco, fontSize: 14, fontWeight: '600' },
  bulkActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  selectionHint: { flex: 1, minWidth: 0, color: colors.gris, fontSize: 13 },
  assignButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 9, backgroundColor: colors.azulClaro },
  deleteButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 9, borderWidth: 1, borderColor: `${colors.rojo}88` },
  actionText: { color: colors.blanco, fontSize: 13, fontWeight: '700' },
  deleteText: { color: colors.rojo, fontSize: 13, fontWeight: '700' },
  list: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 5, paddingBottom: 28, gap: 11 },
  videoCard: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.grafito },
  checkbox: { width: 28, alignItems: 'center' },
  playButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.carbon },
  videoCopy: { flex: 1, minWidth: 0 },
  videoTitle: { color: colors.blanco, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  description: { color: colors.gris, fontSize: 14, lineHeight: 20, marginTop: 4 },
  metadataRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaChip: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 99, borderWidth: 1, backgroundColor: colors.carbon },
  metaText: { fontSize: 12, fontWeight: '600' },
  assignedText: { color: colors.azulClaro, fontSize: 13, marginTop: 7 },
  cardActions: { alignItems: 'center' },
  iconButton: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 22 },
  emptyTitle: { color: colors.blanco, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: colors.gris, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  emptyCreate: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7, paddingHorizontal: 13, borderRadius: 9, backgroundColor: colors.azulClaro },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.76)' },
  modalCard: { width: '100%', maxWidth: 540, maxHeight: '92%', overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.grafito },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  modalTitle: { color: colors.blanco, fontSize: 19, fontFamily: 'SundayMasthead-Regular' },
  modalSubtitle: { color: colors.gris, fontSize: 13, lineHeight: 18, marginTop: 5 },
  closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  formContent: { paddingHorizontal: 18, paddingBottom: 18 },
  readOnlyId: { color: colors.azulClaro, fontSize: 13, marginBottom: 4 },
  fieldLabel: { color: colors.blanco, fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 7 },
  input: { minHeight: 44, color: colors.blanco, fontSize: 15, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.azulOscuro, borderRadius: 9, backgroundColor: colors.carbon },
  multilineInput: { minHeight: 86, paddingTop: 10, textAlignVertical: 'top' },
  levelOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelChip: { minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: colors.azulOscuro, borderRadius: 99, backgroundColor: colors.carbon },
  levelText: { color: colors.gris, fontSize: 14, fontWeight: '600' },
  fileButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.azulOscuro, borderRadius: 9, backgroundColor: colors.carbon },
  fileButtonText: { flex: 1, color: colors.blanco, fontSize: 14 },
  fileHint: { color: colors.gris, fontSize: 12, lineHeight: 17, marginTop: 6 },
  modalActions: { flexDirection: 'row', gap: 9, marginTop: 18 },
  cancelButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.azulOscuro, borderRadius: 9 },
  cancelText: { color: colors.gris, fontSize: 14, fontWeight: '700' },
  saveButton: { flex: 1.2, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.azulClaro },
  saveText: { color: colors.blanco, fontSize: 14, fontWeight: '700' },
  clientList: { maxHeight: 390, paddingHorizontal: 18 },
  clientRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.azulOscuro, borderRadius: 10, backgroundColor: colors.carbon },
  clientName: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
  clientLevel: { color: colors.gris, fontSize: 12, marginTop: 2 },
};
