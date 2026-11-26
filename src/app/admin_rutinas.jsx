import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminShell, { adminColors as c } from '../components/AdminShell';
import FondoThomas from '../components/FondoThomas';
import '../global.css';
import { apiAdmin, cerrarSesionAdmin } from '../lib/admin';
import { irSinHistorial } from '../lib/navegacion';
import { contarEjercicios, cuerpoRutinaAdmin, diasDeRutina, filasDeRutina, textoSplit } from '../lib/rutinasPredeterminadas';
import { useRouter } from 'expo-router';

const niveles = [
  { key: 'Basico', label: 'Básico', color: c.success },
  { key: 'Intermedio', label: 'Intermedio', color: c.blue },
  { key: 'Avanzado', label: 'Avanzado', color: c.danger },
];

const nuevoEjercicio = () => ({ nombreEjercicio: '', equipo: '', video: '' });
const nuevaRutina = () => ({ nombre: '', nivel: '', split: '', dias: [] });

function Campo({ label, value, onChangeText, placeholder, multiline = false, keyboardType = 'default' }) {
  return (
    <View style={{ marginBottom: 13 }}>
      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 5 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={{ minHeight: multiline ? 76 : 45, color: c.text, backgroundColor: c.background, borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: multiline ? 'top' : 'center' }}
      />
    </View>
  );
}

function Boton({ titulo, icono, onPress, secundario = false, disabled = false }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={{ flex: 1, minHeight: 82, borderRadius: 15, borderWidth: 1.5, borderColor: c.primary, backgroundColor: secundario ? 'rgba(18,22,29,0.86)' : c.surface, alignItems: 'center', justifyContent: 'center', gap: 7, opacity: disabled ? 0.55 : 1 }}
    >
      <Ionicons name={icono} size={28} color={c.primary} />
      <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{titulo}</Text>
    </TouchableOpacity>
  );
}

export default function AdminRutinas() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [rutinas, setRutinas] = useState([]);
  const [ejercicios, setEjercicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [modalEjercicio, setModalEjercicio] = useState(false);
  const [modalRutina, setModalRutina] = useState(false);
  const [ejercicioForm, setEjercicioForm] = useState(nuevoEjercicio());
  const [rutinaForm, setRutinaForm] = useState(nuevaRutina());
  const [rutinaEditando, setRutinaEditando] = useState(null);
  const [busquedaEjercicio, setBusquedaEjercicio] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [respuestaRutinas, respuestaEjercicios] = await Promise.all([
        apiAdmin('/admin/rutinas-predeterminadas/'),
        apiAdmin('/admin/ejercicios/'),
      ]);
      setRutinas(Array.isArray(respuestaRutinas) ? respuestaRutinas : respuestaRutinas?.rutinas || []);
      setEjercicios(Array.isArray(respuestaEjercicios) ? respuestaEjercicios : respuestaEjercicios?.ejercicios || []);
      setError('');
    } catch (fallo) {
      if (fallo.status === 401 || fallo.status === 403) {
        await cerrarSesionAdmin();
        irSinHistorial(router, '/login');
      } else {
        setError(fallo.message || 'No se pudo cargar el catálogo de rutinas y ejercicios.');
      }
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => { cargar(); }, [cargar]);

  const ejerciciosFiltrados = useMemo(() => {
    const termino = busquedaEjercicio.trim().toLocaleLowerCase('es-CL');
    if (!termino) return ejercicios;
    return ejercicios.filter((item) => `${item.nombreEjercicio} ${item.equipo}`.toLocaleLowerCase('es-CL').includes(termino));
  }, [busquedaEjercicio, ejercicios]);

  const abrirNuevaRutina = () => {
    setRutinaEditando(null);
    setRutinaForm(nuevaRutina());
    setBusquedaEjercicio('');
    setModalRutina(true);
  };

  const abrirEdicionRutina = (rutina) => {
    setRutinaEditando(rutina);
    // El servidor manda split como objeto y los días con sus ejercicios adentro;
    // el formulario trabaja con texto y una fila por ejercicio.
    setRutinaForm({
      nombre: rutina.nombre || '',
      nivel: rutina.nivel || '',
      split: textoSplit(rutina.split),
      dias: filasDeRutina(rutina),
    });
    setBusquedaEjercicio('');
    setModalRutina(true);
  };

  const guardarEjercicio = async () => {
    const nombreEjercicio = ejercicioForm.nombreEjercicio.trim();
    const equipo = ejercicioForm.equipo.trim();
    if (!nombreEjercicio || !equipo) {
      Alert.alert('Faltan datos', 'Completa el nombre y el equipo del ejercicio.');
      return;
    }
    setGuardando(true);
    try {
      await apiAdmin('/admin/ejercicios/', { method: 'POST', body: { ...ejercicioForm, nombreEjercicio, equipo, video: ejercicioForm.video.trim() } });
      setEjercicioForm(nuevoEjercicio());
      setModalEjercicio(false);
      await cargar();
      Alert.alert('Ejercicio guardado', 'Quedó disponible en el catálogo global para reutilizarlo en las rutinas.');
    } catch (fallo) {
      Alert.alert('No se pudo guardar', fallo.message || 'Revisa los datos e inténtalo nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  const agregarEjercicio = (ejercicio) => {
    const id = String(ejercicio.id || '');
    if (!id || rutinaForm.dias.some((item) => String(item.idEjercicio) === id)) return;
    setRutinaForm((actual) => ({
      ...actual,
      dias: [...actual.dias, {
        idEjercicio: id,
        dia: '1',
        nombre_ejercicio: ejercicio.nombreEjercicio || 'Ejercicio',
        equipo: ejercicio.equipo || '',
        series: '3',
        repeticiones: '8-12',
        descanso: '2 min',
        extra: {},
      }],
    }));
  };

  const actualizarDia = (indice, campo, valor) => {
    setRutinaForm((actual) => ({
      ...actual,
      dias: actual.dias.map((item, posicion) => posicion === indice ? { ...item, [campo]: valor } : item),
    }));
  };

  const guardarRutina = async () => {
    const nombre = rutinaForm.nombre.trim();
    const split = rutinaForm.split.trim();
    if (!nombre || !split || !rutinaForm.nivel || !rutinaForm.dias.length) {
      Alert.alert('Completa la rutina', 'Ingresa un nombre, selecciona el nivel y agrega un ejercicio global con su enfoque.');
      return;
    }
    // Se agrupan las filas por día y se conservan el nombre de cada día y los campos
    // que el formulario no muestra (RER, tempo, detalle...).
    const body = cuerpoRutinaAdmin(
      { nombre, nivel: rutinaForm.nivel, split, filas: rutinaForm.dias },
      rutinaEditando
    );

    setGuardando(true);
    try {
      const ruta = rutinaEditando?.id ? `/admin/rutinas-predeterminadas/${rutinaEditando.id}/` : '/admin/rutinas-predeterminadas/';
      await apiAdmin(ruta, { method: rutinaEditando ? 'PATCH' : 'POST', body });
      setModalRutina(false);
      await cargar();
      Alert.alert(rutinaEditando ? 'Rutina actualizada' : 'Rutina creada', 'La rutina quedó publicada para que los alumnos puedan comprarla.');
    } catch (fallo) {
      Alert.alert('No se pudo guardar', fallo.message || 'Revisa los datos de la rutina e inténtalo nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  const borrarRutina = (rutina) => {
    Alert.alert('Eliminar rutina', `¿Quieres eliminar “${rutina.nombre || textoSplit(rutina.split)}” del catálogo?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await apiAdmin(`/admin/rutinas-predeterminadas/${rutina.id}/`, { method: 'DELETE' });
          await cargar();
        } catch (fallo) {
          Alert.alert('No se pudo eliminar', fallo.message || 'Inténtalo nuevamente.');
        }
      } },
    ]);
  };

  const ancho = width >= 760 ? 720 : width - 32;

  return (
    <AdminShell active="rutinas" title="Rutinas predeterminadas">
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={[]}>
        <FondoThomas imagen={require('../../assets/images/fondos/fondo_registro.jpg')} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={c.primary} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 30, width: '100%', maxWidth: 1080, alignSelf: 'center' }}
        >
          <Text style={{ color: c.text, fontSize: width < 400 ? 23 : 28, fontFamily: 'SundayMasthead-Regular' }}>Rutinas predeterminadas</Text>
          <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22, marginTop: 5, marginBottom: 18 }}>Gestiona los ejercicios globales y las rutinas que los alumnos pueden comprar.</Text>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 25 }}>
            <Boton titulo="Crear ejercicio" icono="barbell-outline" onPress={() => setModalEjercicio(true)} />
            <Boton titulo="Crear rutina" icono="layers-outline" onPress={abrirNuevaRutina} />
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            <View style={{ width: 5, borderRadius: 6, backgroundColor: c.primary, marginRight: 12 }} />
            <View>
              <Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>Listado de rutinas</Text>
              <Text style={{ color: c.muted, fontSize: 14, fontStyle: 'italic', marginTop: 3 }}>Rutinas predeterminadas del sistema.</Text>
            </View>
          </View>

          {!!error && <Text style={{ color: c.danger, backgroundColor: c.surface, padding: 13, borderRadius: 10, marginBottom: 14 }}>{error}</Text>}
          {cargando && rutinas.length === 0 ? (
            <View style={{ minHeight: 180, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.primary} /><Text style={{ color: c.muted, marginTop: 9 }}>Cargando rutinas…</Text></View>
          ) : rutinas.length === 0 ? (
            <View style={{ minHeight: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
              <View style={{ width: 112, height: 112, borderRadius: 28, borderWidth: 1, borderColor: c.line, backgroundColor: 'rgba(11,45,91,0.24)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="layers-outline" size={52} color={c.primary} />
              </View>
              <Text style={{ color: c.text, fontSize: 21, fontWeight: '700', textAlign: 'center', marginTop: 18 }}>Aún no hay rutinas creadas</Text>
              <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 7 }}>Crea la primera rutina predeterminada para que esté disponible en la app.</Text>
            </View>
          ) : (
            <View style={{ width: '100%', maxWidth: ancho, alignSelf: 'center', gap: 11 }}>
              {rutinas.map((rutina) => {
                const nivel = niveles.find((item) => item.key.toLowerCase() === String(rutina.nivel).toLowerCase());
                const enfoque = textoSplit(rutina.split);
                const numeroDias = diasDeRutina(rutina).length;
                const numeroEjercicios = contarEjercicios(rutina);
                return (
                  <View key={rutina.id} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: nivel?.color || c.line, borderRadius: 15, padding: 15 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,45,91,0.55)' }}><Ionicons name="layers-outline" size={24} color={nivel?.color || c.muted} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{rutina.nombre || enfoque || 'Rutina predeterminada'}</Text>
                        <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }} numberOfLines={2}>{enfoque || 'Sin descripción del split'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                          <View style={{ backgroundColor: nivel ? `${nivel.color}24` : c.background, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}><Text style={{ color: nivel?.color || c.muted, fontSize: 12, fontWeight: '800' }}>{nivel?.label.toUpperCase() || 'NIVEL PENDIENTE'}</Text></View>
                          <Text style={{ color: c.muted, fontSize: 12 }}>{numeroEjercicios} {numeroEjercicios === 1 ? 'ejercicio' : 'ejercicios'} · {numeroDias} {numeroDias === 1 ? 'día' : 'días'}</Text>
                        </View>
                      </View>
                      <TouchableOpacity accessibilityLabel="Editar rutina" onPress={() => abrirEdicionRutina(rutina)} style={{ padding: 7 }}><Ionicons name="create-outline" size={21} color={c.primary} /></TouchableOpacity>
                      <TouchableOpacity accessibilityLabel="Eliminar rutina" onPress={() => borrarRutina(rutina)} style={{ padding: 7 }}><Ionicons name="trash-outline" size={21} color={c.danger} /></TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={modalEjercicio} transparent animationType="slide" onRequestClose={() => setModalEjercicio(false)}>
        <View style={modalStyles.backdrop}>
          <View style={[modalStyles.sheet, { width: Math.min(width - 28, 580) }]}>
            <View style={modalStyles.titleRow}><Text style={modalStyles.title}>Crear ejercicio global</Text><TouchableOpacity onPress={() => setModalEjercicio(false)}><Ionicons name="close" size={24} color={c.muted} /></TouchableOpacity></View>
            <Text style={modalStyles.note}>Este ejercicio queda disponible para reutilizarlo en cualquier rutina predeterminada.</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Campo label="Nombre del ejercicio" value={ejercicioForm.nombreEjercicio} onChangeText={(v) => setEjercicioForm((a) => ({ ...a, nombreEjercicio: v }))} placeholder="Ej. Press de banca" />
              <Campo label="Equipo" value={ejercicioForm.equipo} onChangeText={(v) => setEjercicioForm((a) => ({ ...a, equipo: v }))} placeholder="Ej. Barra y banco" />
              <Campo label="Video (opcional)" value={ejercicioForm.video} onChangeText={(v) => setEjercicioForm((a) => ({ ...a, video: v }))} placeholder="https://..." />
            </ScrollView>
            <TouchableOpacity disabled={guardando} onPress={guardarEjercicio} style={modalStyles.primaryButton}><Text style={modalStyles.primaryText}>{guardando ? 'Guardando…' : 'Guardar ejercicio'}</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalRutina} transparent animationType="slide" onRequestClose={() => setModalRutina(false)}>
        <View style={modalStyles.backdrop}>
          <View style={[modalStyles.sheet, { width: Math.min(width - 28, 680), maxHeight: '92%' }]}>
            <View style={modalStyles.titleRow}><Text style={modalStyles.title}>{rutinaEditando ? 'Editar rutina' : 'Crear rutina'}</Text><TouchableOpacity onPress={() => setModalRutina(false)}><Ionicons name="close" size={24} color={c.muted} /></TouchableOpacity></View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Campo label="Nombre de la rutina" value={rutinaForm.nombre} onChangeText={(v) => setRutinaForm((a) => ({ ...a, nombre: v }))} placeholder="Ej. Fuerza inicial" />
              <Text style={modalStyles.fieldLabel}>Nivel</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {niveles.map((nivel) => (
                  <TouchableOpacity key={nivel.key} onPress={() => setRutinaForm((a) => ({ ...a, nivel: nivel.key }))} style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 99, borderWidth: 1, borderColor: rutinaForm.nivel === nivel.key ? nivel.color : c.line, backgroundColor: rutinaForm.nivel === nivel.key ? `${nivel.color}25` : c.background }}><Text style={{ color: rutinaForm.nivel === nivel.key ? nivel.color : c.muted, fontWeight: '700' }}>{nivel.label}</Text></TouchableOpacity>
                ))}
              </View>
              <Campo label="Split / enfoque" value={rutinaForm.split} onChangeText={(v) => setRutinaForm((a) => ({ ...a, split: v }))} placeholder="Ej. Pecho-empuje y espalda-tirón" />
              <View style={modalStyles.sectionRow}><Text style={modalStyles.sectionTitle}>Ejercicios globales</Text><Text style={modalStyles.note}>{rutinaForm.dias.length} seleccionados</Text></View>
              <Campo label="Buscar ejercicio" value={busquedaEjercicio} onChangeText={setBusquedaEjercicio} placeholder="Nombre o equipo" />
              {ejerciciosFiltrados.map((ejercicio) => {
                const seleccionado = rutinaForm.dias.some((item) => String(item.idEjercicio) === String(ejercicio.id));
                return (
                  <TouchableOpacity key={ejercicio.id} disabled={seleccionado} onPress={() => agregarEjercicio(ejercicio)} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: c.background, marginBottom: 7, opacity: seleccionado ? 0.55 : 1 }}>
                    <Ionicons name={seleccionado ? 'checkmark-circle' : 'add-circle-outline'} size={20} color={seleccionado ? c.success : c.primary} />
                    <View style={{ marginLeft: 9, flex: 1 }}><Text style={{ color: c.text, fontWeight: '700' }}>{ejercicio.nombreEjercicio}</Text><Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>{ejercicio.equipo}</Text></View>
                    <Text style={{ color: c.primary, fontSize: 12 }}>{seleccionado ? 'Agregado' : 'Agregar'}</Text>
                  </TouchableOpacity>
                );
              })}
              {!ejercicios.length && <Text style={modalStyles.note}>Primero crea ejercicios globales para agregarlos a esta rutina.</Text>}

              {rutinaForm.dias.map((dia, indice) => (
                <View key={`${dia.idEjercicio}-${indice}`} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 11, marginTop: 8, backgroundColor: c.surface }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '700' }}>{dia.nombre_ejercicio}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{dia.equipo}</Text></View>
                    <TouchableOpacity accessibilityLabel={`Quitar ${dia.nombre_ejercicio}`} onPress={() => setRutinaForm((a) => ({ ...a, dias: a.dias.filter((_, posicion) => posicion !== indice) }))}><Ionicons name="close-circle-outline" size={21} color={c.danger} /></TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <MiniCampo label="Día" value={String(dia.dia)} onChange={(v) => actualizarDia(indice, 'dia', v)} />
                    <MiniCampo label="Series" value={String(dia.series)} onChange={(v) => actualizarDia(indice, 'series', v)} />
                    <MiniCampo label="Repeticiones" value={String(dia.repeticiones)} onChange={(v) => actualizarDia(indice, 'repeticiones', v)} />
                    <MiniCampo label="Descanso" value={String(dia.descanso ?? '')} onChange={(v) => actualizarDia(indice, 'descanso', v)} />
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity disabled={guardando} onPress={guardarRutina} style={modalStyles.primaryButton}><Text style={modalStyles.primaryText}>{guardando ? 'Guardando…' : rutinaEditando ? 'Guardar cambios' : 'Publicar rutina'}</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

function MiniCampo({ label, value, onChange }) {
  return (
    <View style={{ flex: 1, minWidth: 58 }}>
      <Text style={{ color: c.muted, fontSize: 11, marginBottom: 3 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} style={{ minHeight: 38, color: c.text, backgroundColor: c.background, borderWidth: 1, borderColor: c.line, borderRadius: 8, paddingHorizontal: 7, textAlign: 'center', fontSize: 12 }} />
    </View>
  );
}

const modalStyles = {
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  sheet: { maxHeight: '90%', backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  title: { flex: 1, color: c.text, fontSize: 20, fontWeight: '800' },
  note: { color: c.muted, fontSize: 13, lineHeight: 19, marginBottom: 13 },
  fieldLabel: { color: c.muted, fontSize: 13, marginBottom: 6 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6, marginBottom: 6 },
  sectionTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, borderRadius: 11, marginTop: 10 },
  primaryText: { color: c.text, fontSize: 15, fontWeight: '800' },
};
