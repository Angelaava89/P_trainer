import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import AdminShell, { adminColors as c } from '../components/AdminShell';
import FondoThomas from '../components/FondoThomas';
import { prepararUrlVideo } from '../components/VideoEjercicio';
import '../global.css';
import { apiAdmin, cerrarSesionAdmin } from '../lib/admin';
import { cargarApariencia } from '../lib/apariencia';
import { irSinHistorial } from '../lib/navegacion';

// Video y fondos que vienen dentro de la app (se usan mientras no haya uno nuevo en la nube).
const VIDEO_ORIGINAL = require('../../assets/videos/gym.mp4');

// Cada fondo con las pantallas donde aparece hoy.
const fondos = [
  { clave: 'fondo_login', nombre: 'Login', pantallas: 'Login, Configuración, Elige cómo empezar, Usuarios (admin)', imagen: require('../../assets/images/fondos/fondo_login.jpg') },
  { clave: 'fondo_bienvenido', nombre: 'Bienvenida', pantallas: 'Inicio, Tu IMC, Perfil (opciones)', imagen: require('../../assets/images/fondos/fondo_bienvenido.jpg') },
  { clave: 'fondo_registro', nombre: 'Registro', pantallas: 'Registro, Agendar, Método de pago, Métricas coach, Resumen (admin)', imagen: require('../../assets/images/fondos/fondo_registro.jpg') },
  { clave: 'fondo_metricas', nombre: 'Métricas', pantallas: 'Tus métricas, Nuevas medidas, Notificaciones, Comprar rutinas', imagen: require('../../assets/images/fondos/fondo_metricas.jpg') },
  { clave: 'fondo_progreso', nombre: 'Progreso', pantallas: 'Progreso, Rutina detalle, Agenda coach, Rutinas coach', imagen: require('../../assets/images/fondos/fondo_progreso.jpg') },
  { clave: 'fondo_rutina', nombre: 'Rutina', pantallas: 'Rutina, Rutinas coach, Mensajes coach', imagen: require('../../assets/images/fondos/fondo_rutina.jpg') },
  { clave: 'fondo_perfil', nombre: 'Perfil', pantallas: 'Perfil, Nutrición, Asignar nutrición', imagen: require('../../assets/images/fondos/fondo_perfil.jpg') },
  { clave: 'fondo_clientes', nombre: 'Clientes', pantallas: 'Mis clientes, Perfil del cliente, Registrar peso, Método de pago', imagen: require('../../assets/images/fondos/fondo_clientes.jpg') },
  { clave: 'fondo_panel_profesional', nombre: 'Panel profesional', pantallas: 'Panel profesional, Ejercicios coach', imagen: require('../../assets/images/fondos/fondo_panel_profesional.jpg') },
  { clave: 'fondo_perfil_profesional', nombre: 'Perfil profesional', pantallas: 'Perfil profesional, Pagos y suscripciones (admin)', imagen: require('../../assets/images/fondos/fondo_perfil_profesional.jpg') },
];

// Se guarda en la colección "multimedia" de Sol (/multimedia/): { nombre, tipo_multimedia, url }.
// "nombre" guarda la clave del espacio (video_inicio o fondo_login, fondo_perfil, etc.).
// El último registro de cada clave es el que está EN USO: no tiene botón de borrar;
// solo deja de usarse cuando el admin lo cambia por otro link o vuelve al original.
const CLAVE_VIDEO = 'video_inicio';
const LARGO_MAX_URL = 255; // MultimediaModel.url es CharField(max_length=255)

// El link debe venir de Cloudinary (https://res.cloudinary.com/... o player.cloudinary.com).
function validarUrlCloudinary(texto) {
  const url = String(texto || '').trim();
  if (!url) return 'Pega el link de Cloudinary.';
  if (!/^https:\/\/(res|player)\.cloudinary\.com\//i.test(url)) return 'El link debe ser de Cloudinary (https://res.cloudinary.com/...).';
  if (url.length > LARGO_MAX_URL) return `El link es demasiado largo (máx. ${LARGO_MAX_URL} caracteres).`;
  return '';
}

// Vista previa del video en silencio y en bucle. Se vuelve a montar (key) cuando cambia el archivo.
function VistaVideo({ fuente, alto = 170 }) {
  const player = useVideoPlayer(fuente, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View style={[styles.videoBox, { height: alto }]}>
      <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />
    </View>
  );
}

export default function AdminApariencia() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const anchoContenido = width >= 760 ? 28 : 16;

  // URLs en uso: { video: 'https://...' | null, fondos: { fondo_login: 'https://...' } }
  const [enNube, setEnNube] = useState({ video: null, fondos: {} });
  // Registros de /multimedia/ agrupados por clave (para borrar los que dejan de usarse).
  const [registros, setRegistros] = useState({});
  const [servidorListo, setServidorListo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [pendiente, setPendiente] = useState(null); // { clave, nombre, tipo, url } esperando confirmación
  const [restaurando, setRestaurando] = useState(null); // { clave, nombre }
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');
  const [aviso, setAviso] = useState('');

  const mensajeFallo = (fallo, accion) => {
    if (fallo?.status === 404 || fallo?.status === 405) {
      return `El servidor todavía no permite ${accion}. Revisa la ruta /multimedia/ en el backend.`;
    }
    return fallo?.message || `No se pudo ${accion}.`;
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await apiAdmin('/multimedia/');
      // Agrupa por clave en el orden en que se guardaron: el último de cada clave es el que está en uso.
      const porClave = {};
      (datos?.multimedia || []).forEach((m) => {
        if (!m?.nombre) return;
        (porClave[m.nombre] = porClave[m.nombre] || []).push(m);
      });
      const enUso = (clave) => porClave[clave]?.[porClave[clave].length - 1]?.url || null;
      const fondosEnUso = {};
      fondos.forEach((f) => { const url = enUso(f.clave); if (url) fondosEnUso[f.clave] = url; });
      setRegistros(porClave);
      setEnNube({ video: enUso(CLAVE_VIDEO), fondos: fondosEnUso });
      setServidorListo(true);
    } catch (fallo) {
      if (fallo.status === 401 || fallo.status === 403) {
        await cerrarSesionAdmin();
        irSinHistorial(router, '/login');
        return;
      }
      setEnNube({ video: null, fondos: {} });
      setServidorListo(false);
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => { cargar(); }, [cargar]);

  // Abre el cuadro para pegar el link de Cloudinary de la imagen o del video.
  const elegirArchivo = (clave, nombre, tipo) => {
    setErrorAccion('');
    setPendiente({ clave, nombre, tipo, url: '' });
  };

  // Borra en /multimedia/ los registros de una clave que ya no están en uso.
  const borrarRegistros = async (lista) => {
    for (const m of lista) {
      if (m?.id && !m.activo) await apiAdmin(`/multimedia/${m.id}/eliminar/`, { method: 'DELETE' });
    }
  };

  const confirmarCambio = async () => {
    if (procesando || !pendiente) return;
    const problema = validarUrlCloudinary(pendiente.url);
    if (problema) { setErrorAccion(problema); return; }
    setProcesando(true);
    try {
      const url = pendiente.url.trim();
      const clave = pendiente.clave === 'video' ? CLAVE_VIDEO : pendiente.clave;
      await apiAdmin('/multimedia/', {
        method: 'POST',
        body: { nombre: clave, tipo_multimedia: pendiente.tipo === 'video' ? 'video' : 'foto', url },
      });
      // El link anterior de este espacio deja de usarse, así que recién ahora se puede borrar.
      try { await borrarRegistros(registros[clave] || []); } catch { /* si falla, queda guardado pero sin uso */ }
      await cargar();
      cargarApariencia(true); // el resto de la app toma el cambio al tiro
      setEnNube((previo) => (pendiente.clave === 'video'
        ? { ...previo, video: url }
        : { ...previo, fondos: { ...previo.fondos, [pendiente.clave]: url } }));
      setAviso(pendiente.tipo === 'video' ? 'Video de inicio actualizado.' : `Fondo "${pendiente.nombre}" actualizado.`);
      setPendiente(null);
    } catch (fallo) {
      setErrorAccion(mensajeFallo(fallo, pendiente.tipo === 'video' ? 'cambiar el video' : 'cambiar los fondos'));
    } finally {
      setProcesando(false);
    }
  };

  const confirmarRestaurar = async () => {
    if (procesando || !restaurando) return;
    setProcesando(true);
    try {
      // Volver al original es un cambio de fondo: se quitan los links de ese espacio y se usa la imagen de la app.
      const clave = restaurando.clave === 'video' ? CLAVE_VIDEO : restaurando.clave;
      await borrarRegistros(registros[clave] || []);
      setRegistros((previo) => ({ ...previo, [clave]: [] }));
      cargarApariencia(true);
      setEnNube((previo) => {
        if (restaurando.clave === 'video') return { ...previo, video: null };
        const siguientes = { ...previo.fondos };
        delete siguientes[restaurando.clave];
        return { ...previo, fondos: siguientes };
      });
      setAviso(`${restaurando.nombre} volvió al original.`);
      setRestaurando(null);
    } catch (fallo) {
      setErrorAccion(mensajeFallo(fallo, 'restaurar el original'));
    } finally {
      setProcesando(false);
    }
  };

  const fuenteVideo = enNube.video ? { uri: prepararUrlVideo(enNube.video) } : VIDEO_ORIGINAL;

  return (
    <AdminShell active="apariencia" title="Apariencia">
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_bienvenido.jpg')} />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={c.primary} />}
        contentContainerStyle={{ paddingHorizontal: anchoContenido, paddingTop: 18, paddingBottom: 26, width: '100%', maxWidth: 1320, alignSelf: 'center' }}
      >
        <View style={styles.headingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>Apariencia</Text>
            <Text style={styles.subtitle}>Video de inicio y fondos de la app</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Actualizar apariencia" onPress={cargar} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={25} color={c.primary} />
          </TouchableOpacity>
        </View>

        {!servidorListo && !cargando && (
          <View style={styles.noteCard}>
            <Ionicons name="information-circle-outline" size={22} color={c.primary} />
            <Text style={styles.bodyText}>
              Se muestran el video y los fondos originales de la app: no se pudo leer /multimedia/ del servidor.
            </Text>
          </View>
        )}

        {!!aviso && (
          <TouchableOpacity onPress={() => setAviso('')} style={styles.successBox}>
            <Ionicons name="checkmark-circle-outline" size={18} color={c.success} />
            <Text style={styles.successText}>{aviso}</Text>
          </TouchableOpacity>
        )}

        {/* Video de inicio */}
        <Text style={styles.sectionTitle}>Video de inicio</Text>
        <View style={styles.card}>
          <VistaVideo key={enNube.video || 'original'} fuente={fuenteVideo} />
          <View style={styles.videoInfo}>
            <Text style={styles.itemName}>{enNube.video ? 'Video personalizado' : 'gym.mp4'}</Text>
            {!!enNube.video && <View style={[styles.badge, { flexDirection: 'row', alignItems: 'center', gap: 3 }]}><Ionicons name="lock-closed" size={11} color={c.primary} /><Text style={styles.badgeText}>En uso</Text></View>}
          </View>
          <View style={styles.botonesFila}>
            <TouchableOpacity onPress={() => elegirArchivo('video', 'Video de inicio', 'video')} style={[styles.botonPrimario, { flexDirection: 'row', gap: 6 }]}>
              <Ionicons name="link-outline" size={19} color={c.text} />
              <Text style={styles.botonPrimarioTexto}>Cambiar video</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setErrorAccion(''); setRestaurando({ clave: 'video', nombre: 'El video de inicio' }); }}
              disabled={!enNube.video}
              style={[styles.botonSecundario, { flexDirection: 'row', gap: 6 }, !enNube.video && { opacity: 0.45 }]}
            >
              <Ionicons name="arrow-undo-outline" size={19} color={c.text} />
              <Text style={styles.botonSecundarioTexto}>Restaurar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.footnote}>Link de un video de Cloudinary. Se ve al abrir la app. El video en uso no se puede borrar: solo cambiar o restaurar.</Text>
        </View>

        {/* Fondos de pantalla */}
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Fondos de pantalla</Text>
          <Text style={styles.sectionNote}>{fondos.length} fondos</Text>
        </View>
        <View style={styles.list}>
          {fondos.map((fondo, indice) => {
            const url = enNube.fondos[fondo.clave];
            return (
              <View key={fondo.clave} style={[styles.row, indice === fondos.length - 1 && { borderBottomWidth: 0 }]}>
                <Image source={url ? { uri: url } : fondo.imagen} style={styles.thumb} resizeMode="cover" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text numberOfLines={1} style={styles.itemName}>{fondo.nombre}</Text>
                    {!!url && <View style={[styles.badge, { flexDirection: 'row', alignItems: 'center', gap: 3 }]}><Ionicons name="lock-closed" size={11} color={c.primary} /><Text style={styles.badgeText}>En uso</Text></View>}
                  </View>
                  <Text numberOfLines={2} style={styles.itemNote}>{fondo.pantallas}</Text>
                </View>
                {!!url && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Restaurar fondo ${fondo.nombre}`}
                    onPress={() => { setErrorAccion(''); setRestaurando({ clave: fondo.clave, nombre: `El fondo "${fondo.nombre}"` }); }}
                    style={styles.actionButton}
                  >
                    <Ionicons name="arrow-undo-outline" size={19} color={c.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Cambiar fondo ${fondo.nombre}`}
                  onPress={() => elegirArchivo(fondo.clave, fondo.nombre, 'imagen')}
                  style={styles.changeButton}
                >
                  <Ionicons name="image-outline" size={18} color={c.primary} />
                  <Text style={styles.changeText}>Cambiar</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
        <Text style={styles.footnote}>Link de una imagen vertical de Cloudinary. Se oscurece igual que el original para que los textos se lean bien. Los fondos en uso no se pueden borrar: solo cambiar o restaurar.</Text>
      </ScrollView>

      {/* Confirmación con vista previa antes de reemplazar */}
      <Modal visible={!!pendiente} transparent animationType="fade" onRequestClose={() => setPendiente(null)}>
        <View style={styles.modalFondo}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCaja}>
              <Text style={styles.modalTitulo}>{pendiente?.tipo === 'video' ? 'Cambiar video de inicio' : `Cambiar fondo "${pendiente?.nombre}"`}</Text>
              <Text style={styles.modalSubtitulo}>Pega el link de Cloudinary, revisa la vista previa y presiona Guardar.</Text>
              <TextInput
                value={pendiente?.url || ''}
                onChangeText={(texto) => { setErrorAccion(''); setPendiente((previo) => (previo ? { ...previo, url: texto } : previo)); }}
                placeholder={pendiente?.tipo === 'video' ? 'https://res.cloudinary.com/.../video/upload/...' : 'https://res.cloudinary.com/.../image/upload/...'}
                placeholderTextColor={c.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.campoUrl}
              />
              {!!pendiente?.url && !validarUrlCloudinary(pendiente.url) && (
                pendiente.tipo === 'video'
                  ? <View style={{ marginTop: 14 }}><VistaVideo key={pendiente.url} fuente={{ uri: prepararUrlVideo(pendiente.url) }} alto={200} /></View>
                  : (
                    <View style={styles.previewBox}>
                      <Image source={{ uri: pendiente.url.trim() }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </View>
                  )
              )}
              {!!errorAccion && <Text style={[styles.errorText, { marginTop: 12 }]}>{errorAccion}</Text>}
              <View style={styles.modalBotones}>
                <TouchableOpacity onPress={() => setPendiente(null)} style={styles.botonSecundario}>
                  <Text style={styles.botonSecundarioTexto}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmarCambio}
                  disabled={procesando || !pendiente?.url}
                  style={[styles.botonPrimario, (procesando || !pendiente?.url) && { opacity: 0.6 }]}
                >
                  {procesando ? <ActivityIndicator color={c.text} /> : <Text style={styles.botonPrimarioTexto}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Confirmación antes de volver al original */}
      <Modal visible={!!restaurando} transparent animationType="fade" onRequestClose={() => setRestaurando(null)}>
        <View style={styles.modalFondo}>
          <View style={styles.modalCaja}>
            <Ionicons name="arrow-undo-outline" size={28} color={c.primary} />
            <Text style={[styles.modalTitulo, { marginTop: 8 }]}>¿Restaurar el original?</Text>
            <Text style={styles.modalSubtitulo}>{restaurando?.nombre} volverá a verse como venía en la app.</Text>
            {!!errorAccion && <Text style={[styles.errorText, { marginTop: 12 }]}>{errorAccion}</Text>}
            <View style={styles.modalBotones}>
              <TouchableOpacity onPress={() => setRestaurando(null)} style={styles.botonSecundario}>
                <Text style={styles.botonSecundarioTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmarRestaurar} disabled={procesando} style={[styles.botonPrimario, procesando && { opacity: 0.6 }]}>
                {procesando ? <ActivityIndicator color={c.text} /> : <Text style={styles.botonPrimarioTexto}>Restaurar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

// Mismos tamaños, colores y tipografía que Resumen, Usuarios y Pagos.
const styles = {
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  heading: { color: c.text, fontSize: 25, fontFamily: 'SundayMasthead-Regular' },
  subtitle: { color: c.muted, fontSize: 14, marginTop: 4 },
  refreshButton: { width: 50, height: 50, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: c.primarySoft, borderRadius: 10, padding: 15, marginBottom: 12 },
  bodyText: { flex: 1, color: c.muted, fontSize: 14, lineHeight: 20 },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.successSoft, borderRadius: 9, padding: 11, marginBottom: 12 },
  successText: { color: c.success, fontSize: 14, fontWeight: '600' },
  sectionTitle: { color: c.text, fontSize: 16, fontWeight: '700', marginTop: 6, marginBottom: 10 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  sectionNote: { color: c.muted, fontSize: 14 },
  card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 15 },
  videoBox: { width: '100%', borderRadius: 10, overflow: 'hidden', backgroundColor: c.background },
  videoInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11 },
  botonesFila: { flexDirection: 'row', gap: 10, marginTop: 12 },
  list: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 14 },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 12 },
  thumb: { width: 54, height: 64, borderRadius: 9, backgroundColor: c.background },
  itemName: { color: c.text, fontSize: 14, fontWeight: '700' },
  itemNote: { color: c.muted, fontSize: 13, marginTop: 3, lineHeight: 17 },
  badge: { backgroundColor: c.primarySoft, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: c.primary, fontSize: 12, fontWeight: '700' },
  actionButton: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  changeButton: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, borderColor: c.primaryBorder, paddingHorizontal: 11 },
  changeText: { color: c.primary, fontSize: 14, fontWeight: '700' },
  footnote: { color: c.muted, fontSize: 13, marginTop: 10, lineHeight: 18 },
  errorText: { color: c.danger, fontSize: 14 },
  campoUrl: { height: 50, marginTop: 14, borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 12, color: c.text, backgroundColor: c.background, fontSize: 14 },
  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modalCaja: { width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 18 },
  modalTitulo: { color: c.text, fontSize: 19, fontWeight: '800' },
  modalSubtitulo: { color: c.muted, fontSize: 14, marginTop: 4 },
  previewBox: { width: '62%', aspectRatio: 9 / 16, alignSelf: 'center', borderRadius: 10, overflow: 'hidden', marginTop: 14, backgroundColor: c.background },
  modalBotones: { flexDirection: 'row', gap: 10, marginTop: 18 },
  botonSecundario: { flex: 1, height: 50, borderRadius: 10, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  botonSecundarioTexto: { color: c.text, fontWeight: '700' },
  botonPrimario: { flex: 1, height: 50, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  botonPrimarioTexto: { color: c.text, fontWeight: '800' },
};
