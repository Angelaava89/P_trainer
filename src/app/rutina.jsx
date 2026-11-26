import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import Boton_barra from '../components/Boton_barra';
import { ChipsMusculos, ImagenEjercicio } from '../components/FichaEjercicio';
import FondoThomas from '../components/FondoThomas';
import LogoMarca from '../components/LogoMarca';
import VideoEjercicio from '../components/VideoEjercicio';
import { colors } from '../constants/theme';
import '../global.css';
import { infoEjercicio } from '../lib/ejerciciosInfo';
import { usePlanContratado } from '../lib/planesCliente';
// imágenes de apoyo para las tarjetas de ejercicios (se van turnando)
const IMAGENES = [
  require('../../assets/images/hombre mancuernas.jpg'),
  require('../../assets/images/Mike_Mentzer.jpg'),
  require('../../assets/images/gym.jpg'),
  require('../../assets/images/Piernas BN.jpg'),
];

// "4" + "10" + RER 2 -> "4 series × 10 repeticiones · RER 2 · descanso 90 s"
function detalleEjercicio(e) {
  const partes = [];
  if (e.series) partes.push(`${e.series} series`);
  if (e.repeticiones) partes.push(/[a-z]/i.test(e.repeticiones) ? e.repeticiones : `${e.repeticiones} repeticiones`);
  if (Number(e.peso) > 0) partes.push(`${e.peso} kg`);
  let texto = partes.join(' × ');
  // RER = repeticiones en reserva. Siempre se muestra; si el coach no lo indicó aparece "RER —".
  const rer = String(e.rer ?? '').trim();
  texto = `${texto}${texto ? ' · ' : ''}RER ${rer !== '' ? rer : '—'}`;
  return e.descanso ? `${texto} · descanso ${e.descanso}` : texto;
}

// Entrega una fecha local sin que la conversión UTC la cambie al día siguiente.
function fechaLocalISO() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// La sesión guarda series y repeticiones como números, así que toma el primer número indicado.
function primerNumero(valor, predeterminado = 1) {
  const encontrado = String(valor ?? '').match(/\d+/);
  return encontrado ? Math.max(1, Number(encontrado[0])) : predeterminado;
}

// El RER (repeticiones en reserva) puede ser 0, así que se toma el número tal cual; si no viene, se envía 0.
function numeroRer(valor) {
  const encontrado = String(valor ?? '').match(/\d+/);
  return encontrado ? Number(encontrado[0]) : 0;
}

// asignada hace menos de 3 días
const esNueva = (rutina) => rutina.asignada && Date.now() - new Date(rutina.asignada).getTime() < 3 * 24 * 60 * 60 * 1000;

export default function Rutina() {
  const router = useRouter();
  const [rutinas, setRutinas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState('');
  const [seleccionada, setSeleccionada] = useState(null); // id de la rutina abierta
  const [completados, setCompletados] = useState([]);
    // Plan del cliente: solo el Plan Avanzado puede ver los videos explicativos.
  const { planId } = usePlanContratado();
  const esPlanAvanzado = planId === 'avanzado';
  const [ejercicioActivo, setEjercicioActivo] = useState(null);
  const [formularioVisible, setFormularioVisible] = useState(false);
  const [indiceFormulario, setIndiceFormulario] = useState(0);
  const [resultados, setResultados] = useState([]);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [guardandoSesion, setGuardandoSesion] = useState(false);
  const [sesionGuardada, setSesionGuardada] = useState(false);

  // Dirección del video que se está viendo (null = ninguno abierto).
  const [videoAbierto, setVideoAbierto] = useState(null);
  // rutinas que le asignó su entrenador (Atlas)
  useFocusEffect(useCallback(() => {
    let activo = true;
    setCargando(true);
    api('/mis-rutinas/')
      .then((lista) => {
        if (!activo) return;
        const datos = Array.isArray(lista) ? lista : [];
        setRutinas(datos);
        setAviso('');
        setSeleccionada((actual) => (datos.some((r) => r.id === actual) ? actual : datos[0]?.id ?? null));
        // al verlas, dejan de contar como "nuevas" en el inicio
        if (datos.some((r) => !r.vista)) api('/mis-rutinas/vistas/', { method: 'POST' }).catch(() => {});
      })
      .catch((error) => {
        if (!activo) return;
        setRutinas([]);
        setAviso(error?.status === 401 ? 'Inicia sesión para ver tu rutina.' : 'No se pudo conectar con el servidor.');
      })
      .finally(() => activo && setCargando(false));
    return () => { activo = false; };
  }, []));

  const rutina = rutinas.find((r) => r.id === seleccionada);
  const ejercicios = rutina?.ejercicios || [];

  const cambiarRutina = (id) => {
    setSeleccionada(id);
    setCompletados([]);
    setSesionGuardada(false);
    setEjercicioActivo(null);
    setFormularioVisible(false);
  };

  const todosCompletados = ejercicios.length > 0 && completados.length === ejercicios.length;

  // Prepara un formulario separado para cada ejercicio de la rutina terminada.
  const abrirFormularioDeSesion = () => {
    setResultados(ejercicios.map(() => ({ pesoUsado: '', observaciones: '', dificultad: 0 })));
    setIndiceFormulario(0);
    setErrorFormulario('');
    setFormularioVisible(true);
  };

  // Guarda la marca visual y, al completar el último ejercicio, abre el registro de resultados.
  const marcarEjercicioCompletado = (indice) => {
    const clave = `${ejercicios[indice]?.nombre}-${indice}`;
    const actualizados = completados.includes(clave) ? completados : [...completados, clave];
    setCompletados(actualizados);
    setEjercicioActivo(null);

    if (actualizados.length === ejercicios.length && !sesionGuardada) {
      abrirFormularioDeSesion();
    }
  };

  // Actualiza un dato del ejercicio que se está completando en el formulario por pasos.
  const cambiarResultado = (indice, campo, valor) => {
    setResultados((actuales) => actuales.map((resultado, posicion) => (
      posicion === indice ? { ...resultado, [campo]: valor } : resultado
    )));
    setErrorFormulario('');
  };

  // Valida el formulario actual y pasa al ejercicio siguiente o guarda toda la sesión en Mongo.
  const avanzarFormulario = async () => {
    const resultado = resultados[indiceFormulario];
    const pesoUsado = Number(String(resultado?.pesoUsado || '').replace(',', '.'));

    if (String(resultado?.pesoUsado || '').trim() === '' || !Number.isFinite(pesoUsado) || pesoUsado < 0) {
      setErrorFormulario('Ingresa el peso usado en kg. Escribe 0 si hiciste el ejercicio con peso corporal.');
      return;
    }
    if (!Number.isInteger(Number(resultado?.dificultad)) || resultado.dificultad < 1 || resultado.dificultad > 10) {
      setErrorFormulario('Selecciona la dificultad del ejercicio del 1 al 10.');
      return;
    }

    Keyboard.dismiss();
    if (indiceFormulario < ejercicios.length - 1) {
      setIndiceFormulario((actual) => actual + 1);
      setErrorFormulario('');
      return;
    }

    if (!rutina?.id) {
      setErrorFormulario('No se encontró el identificador de la rutina para guardar la sesión.');
      return;
    }

    setGuardandoSesion(true);
    setErrorFormulario('');
    try {
      const ejerciciosSesion = ejercicios.map((item, indice) => {
        const resultadoEjercicio = resultados[indice];
        const peso = Number(String(resultadoEjercicio?.pesoUsado || '').replace(',', '.'));
        const observaciones = String(resultadoEjercicio?.observaciones || '').trim() || 'Sin observaciones';
        return {
          idEjercicio: String(item.id || `${rutina.id}-${indice + 1}`).slice(0, 24),
          nombreEjercicio: String(item.nombre || `Ejercicio ${indice + 1}`).slice(0, 100),
          series: primerNumero(item.series),
          repeticiones: primerNumero(item.repeticiones),
          rer: numeroRer(item.rer),
          equipo: String(item.grupo || item.equipo || 'No especificado').slice(0, 100),
          peso,
          tiempo: String(item.descanso || 'Sin descanso').slice(0, 30),
          detalles: observaciones.slice(0, 200),
          calificacion: Number(resultadoEjercicio?.dificultad),
        };
      });

      await api('/sesiones/', {
        method: 'POST',
        body: { idRutina: String(rutina.id), fecha: fechaLocalISO(), ejercicios: ejerciciosSesion },
      });

      setFormularioVisible(false);
      setSesionGuardada(true);
      Alert.alert('Entrenamiento guardado', 'Se registraron el peso, las observaciones y la dificultad de cada ejercicio.');
    } catch (error) {
      setErrorFormulario(error?.message || 'No se pudo guardar el entrenamiento. Intenta nuevamente.');
    } finally {
      setGuardandoSesion(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_rutina.jpg')} />
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.blanco} /></TouchableOpacity>
        <Text numberOfLines={1} className="text-blanco text-xl font-masthead ml-4 flex-1">Mi Rutina</Text>
        <LogoMarca />
      </View>

      {/* una pestaña por cada rutina asignada */}
      {rutinas.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }} style={{ flexGrow: 0 }} className="mb-4">
          {rutinas.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => cambiarRutina(r.id)}
              className={`flex-row items-center rounded-full px-4 py-2 ${seleccionada === r.id ? 'bg-azulClaro' : 'bg-grafito'}`}
            >
              <Text className={`text-xs ${seleccionada === r.id ? 'text-blanco font-bold' : 'text-blanco/60'}`}>{r.titulo}</Text>
              {esNueva(r) && <View className="rounded-full bg-verde ml-2" style={{ width: 7, height: 7 }} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {cargando && rutinas.length === 0 ? (
          <ActivityIndicator color={colors.azulClaro} style={{ marginTop: 40 }} />
        ) : !rutina ? (
          <View className="bg-grafito rounded-2xl p-6 items-center">
            <Ionicons name="barbell-outline" size={38} color={colors.azulClaro} />
            <Text className="text-blanco font-bold mt-3">Aún no tienes una rutina asignada</Text>
            <Text className="text-blanco/50 text-xs text-center mt-2">
              {aviso || 'Cuando tu entrenador te asigne una, te llegará una notificación y aparecerá aquí.'}
            </Text>
          </View>
        ) : (
          <>
            <View className="bg-grafito rounded-2xl p-4 mb-4">
              <View className="flex-row items-center">
                <Text className="text-blanco text-lg font-bold flex-1">{rutina.titulo}</Text>
                {esNueva(rutina) && (
                  <View className="rounded-full px-2 py-1" style={{ backgroundColor: `${colors.verde}33` }}>
                    <Text className="text-[13px] font-bold" style={{ color: colors.verde }}>NUEVA</Text>
                  </View>
                )}
              </View>
              <Text className="text-blanco/50 text-sm mt-1">
                {ejercicios.length} {ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}
                {rutina.frecuencia ? ` · ${rutina.frecuencia}` : ''}
                {rutina.nivel ? ` · ${rutina.nivel}` : ''}
              </Text>
              <Text className="text-azulClaro text-xs mt-3">Marca cada ejercicio al terminarlo.</Text>
            </View>

            {ejercicios.map((e, i) => {
              const clave = `${e.nombre}-${i}`;
              const done = completados.includes(clave);
              // La información completa se abre al tocar la tarjeta; el check solo refleja la finalización.
              const info = infoEjercicio(e.nombre);
              return (
                <TouchableOpacity
                  key={clave}
                  onPress={() => setEjercicioActivo({ ejercicio: e, indice: i })}
                  className="flex-row items-center bg-grafito rounded-2xl p-3 mb-3"
                >
                  <View style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: info?.imagen ? colors.blanco : colors.carbon, alignItems: 'center', justifyContent: 'center' }}>
                    {info?.imagen
                      ? <Image source={info.imagen} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      : <Image source={IMAGENES[i % IMAGENES.length]} style={{ width: 58, height: 58, borderRadius: 12 }} resizeMode="cover" />}
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-blanco text-sm font-bold">{e.nombre}</Text>
                    {info
                      ? <ChipsMusculos musculos={info.musculos} pequeno />
                      : !!e.grupo && <Text className="text-azulClaro text-[14px] mt-0.5">{e.grupo}</Text>}
                    <Text className="text-blanco/50 text-xs mt-1">{detalleEjercicio(e)}</Text>
                    {!!info && <Text numberOfLines={2} className="text-blanco/45 text-xs mt-1">{info.descripcion}</Text>}
                                          {/* Video explicativo: exclusivo para el Plan Avanzado */}
                    {/* El servidor solo manda el link si el cliente tiene Plan Avanzado; si no, muestra el candado */}
                    {(!!e.video || !!e.tieneVideo) && (
                      e.video ? (
                        <TouchableOpacity
                          onPress={() => setVideoAbierto(e.video)}
                          className="flex-row items-center self-start rounded-full px-3 py-1 mt-2"
                          style={{ backgroundColor: colors.azulClaro }}
                        >
                          <Ionicons name="play-circle" size={16} color={colors.blanco} />
                          <Text className="text-blanco text-xs font-bold ml-1">Ver video</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => router.push('/planes')}
                          className="flex-row items-center self-start rounded-full px-3 py-1 mt-2"
                          style={{ borderWidth: 1, borderColor: colors.rojo }}
                        >
                          <Ionicons name="lock-closed" size={14} color={colors.rojo} />
                          <Text className="text-xs font-bold ml-1" style={{ color: colors.rojo }}>Video exclusivo Plan Avanzado</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                  <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={done ? colors.verde : colors.blanco} />
                </TouchableOpacity>
              );
            })}

            {sesionGuardada && (
              <TouchableOpacity
                onPress={() => {
                  setCompletados([]);
                  setSesionGuardada(false);
                }}
                className="bg-azulClaro rounded-xl py-4 items-center mt-2"
              >
                <Text className="text-blanco font-bold">Comenzar nuevo entrenamiento</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* El detalle reúne la imagen, la pauta y la descripción antes de marcar el ejercicio terminado. */}
      <Modal visible={Boolean(ejercicioActivo)} transparent animationType="fade" onRequestClose={() => setEjercicioActivo(null)}>
        <Pressable onPress={() => setEjercicioActivo(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', padding: 18 }}>
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 480, maxHeight: '90%', alignSelf: 'center', backgroundColor: colors.grafito, borderRadius: 20, borderWidth: 1, borderColor: colors.azulOscuro, overflow: 'hidden' }}>
            {ejercicioActivo && (() => {
              const { ejercicio, indice } = ejercicioActivo;
              const info = infoEjercicio(ejercicio.nombre);
              const estaCompletado = completados.includes(`${ejercicio.nombre}-${indice}`);
              return (
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <View style={{ height: 220, alignItems: 'center', justifyContent: 'center', backgroundColor: info?.imagen ? colors.blanco : colors.carbon, padding: 10 }}>
                    {info?.imagen
                      ? <Image source={info.imagen} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      : <Ionicons name="barbell-outline" size={64} color={colors.azulClaro} />}
                  </View>
                  <View style={{ padding: 18 }}>
                    <Text style={{ color: colors.blanco, fontSize: 22, fontWeight: '800' }}>{ejercicio.nombre}</Text>
                    <Text style={{ color: colors.gris, fontSize: 12, marginTop: 14, fontWeight: '700', letterSpacing: 0.5 }}>MÚSCULOS Y EQUIPO</Text>
                    <ChipsMusculos musculos={info?.musculos || String(ejercicio.grupo || '').split(',').map((item) => item.trim()).filter(Boolean)} />
                    <Text style={{ color: colors.blanco, fontSize: 15, lineHeight: 22, marginTop: 12 }}>{ejercicio.grupo || 'Equipo no especificado'}</Text>
                    <Text style={{ color: colors.gris, fontSize: 12, marginTop: 16, fontWeight: '700', letterSpacing: 0.5 }}>PAUTA DEL EJERCICIO</Text>
                    <Text style={{ color: colors.blanco, fontSize: 15, lineHeight: 22, marginTop: 5 }}>{detalleEjercicio(ejercicio) || 'Sin pauta adicional.'}</Text>
                    <Text style={{ color: colors.gris, fontSize: 12, marginTop: 16, fontWeight: '700', letterSpacing: 0.5 }}>EN QUÉ CONSISTE</Text>
                    <Text style={{ color: colors.blanco, fontSize: 15, lineHeight: 22, marginTop: 5, opacity: 0.9 }}>{info?.descripcion || ejercicio.descripcion || 'Sigue la pauta indicada por tu personal trainer y realiza el movimiento de forma controlada.'}</Text>

                    {/* Video explicativo dentro del detalle: el link solo llega si el cliente tiene Plan Avanzado */}
                    {ejercicio.video ? (
                      <TouchableOpacity
                        onPress={() => { setEjercicioActivo(null); setVideoAbierto(ejercicio.video); }}
                        style={{ flexDirection: 'row', backgroundColor: colors.azulClaro, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 12 }}
                      >
                        <Ionicons name="play-circle" size={20} color={colors.blanco} />
                        <Text style={{ color: colors.blanco, fontWeight: '800', marginLeft: 6 }}>Ver video</Text>
                      </TouchableOpacity>
                    ) : ejercicio.tieneVideo ? (
                      <TouchableOpacity
                        onPress={() => { setEjercicioActivo(null); router.push('/planes'); }}
                        style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.rojo, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 12 }}
                      >
                        <Ionicons name="lock-closed" size={18} color={colors.rojo} />
                        <Text style={{ color: colors.rojo, fontWeight: '800', marginLeft: 6 }}>Ver video · Exclusivo Plan Avanzado</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ flexDirection: 'row', backgroundColor: colors.carbon, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 12, opacity: 0.6 }}>
                        <Ionicons name="videocam-off-outline" size={18} color={colors.blanco} />
                        <Text style={{ color: colors.blanco, fontWeight: '800', marginLeft: 6 }}>Este ejercicio aún no tiene video</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      disabled={estaCompletado && sesionGuardada}
                      onPress={() => marcarEjercicioCompletado(indice)}
                      style={{ backgroundColor: estaCompletado && sesionGuardada ? `${colors.verde}55` : colors.azulClaro, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 12 }}
                    >
                      <Text style={{ color: colors.blanco, fontWeight: '800', textAlign: 'center' }}>{estaCompletado ? 'Ejercicio completado ✓' : 'Ejercicio completado'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEjercicioActivo(null)} style={{ backgroundColor: colors.carbon, borderRadius: 12, height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
                      <Text style={{ color: colors.blanco, fontWeight: '800' }}>Cerrar</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Al terminar la rutina, se solicita el resultado de cada ejercicio antes de guardar la sesión. */}
      <Modal visible={formularioVisible} transparent animationType="slide" onRequestClose={() => !guardandoSesion && setFormularioVisible(false)}>
        <Pressable onPress={() => !guardandoSesion && setFormularioVisible(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', padding: 14 }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', maxWidth: 500, maxHeight: '94%', alignSelf: 'center' }}>
            <Pressable onPress={() => {}} style={{ backgroundColor: colors.grafito, borderRadius: 20, borderWidth: 1, borderColor: colors.azulOscuro, padding: 18, maxHeight: '100%' }}>
              <Text style={{ color: colors.blanco, fontSize: 20, fontWeight: '800' }}>Registro del entrenamiento</Text>
              <Text style={{ color: colors.gris, fontSize: 14, marginTop: 5 }}>Ejercicio {indiceFormulario + 1} de {ejercicios.length}</Text>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ marginTop: 16, flexShrink: 1 }}>
                <Text style={{ color: colors.blanco, fontSize: 17, fontWeight: '700' }}>{ejercicios[indiceFormulario]?.nombre}</Text>
                <Text style={{ color: colors.gris, fontSize: 13, marginTop: 4 }}>{detalleEjercicio(ejercicios[indiceFormulario] || {})}</Text>

                <Text style={{ color: colors.blanco, fontSize: 14, fontWeight: '700', marginTop: 18 }}>¿Cuánto peso usaste? (kg)</Text>
                <TextInput
                  value={resultados[indiceFormulario]?.pesoUsado || ''}
                  onChangeText={(valor) => cambiarResultado(indiceFormulario, 'pesoUsado', valor)}
                  placeholder="Ej.: 20"
                  placeholderTextColor={`${colors.gris}99`}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  style={{ color: colors.blanco, backgroundColor: colors.carbon, borderRadius: 12, borderWidth: 1, borderColor: `${colors.gris}55`, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8, fontSize: 16 }}
                />
                <Text style={{ color: colors.gris, fontSize: 12, marginTop: 4 }}>Si fue con peso corporal, escribe 0.</Text>

                <Text style={{ color: colors.blanco, fontSize: 14, fontWeight: '700', marginTop: 18 }}>Observaciones</Text>
                <TextInput
                  value={resultados[indiceFormulario]?.observaciones || ''}
                  onChangeText={(valor) => cambiarResultado(indiceFormulario, 'observaciones', valor)}
                  placeholder="Anota cómo te fue en este ejercicio"
                  placeholderTextColor={`${colors.gris}99`}
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                  style={{ color: colors.blanco, backgroundColor: colors.carbon, borderRadius: 12, borderWidth: 1, borderColor: `${colors.gris}55`, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8, minHeight: 88, fontSize: 15 }}
                />

                <Text style={{ color: colors.blanco, fontSize: 14, fontWeight: '700', marginTop: 18 }}>Califica la dificultad (1 a 10)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {Array.from({ length: 10 }, (_, posicion) => posicion + 1).map((nota) => {
                    const seleccionada = Number(resultados[indiceFormulario]?.dificultad) === nota;
                    return (
                      <TouchableOpacity
                        key={nota}
                        accessibilityRole="button"
                        accessibilityLabel={`Dificultad ${nota} de 10`}
                        onPress={() => cambiarResultado(indiceFormulario, 'dificultad', nota)}
                        style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: seleccionada ? colors.azulClaro : colors.carbon, borderWidth: 1, borderColor: seleccionada ? colors.azulClaro : `${colors.gris}66` }}
                      >
                        <Text style={{ color: colors.blanco, fontWeight: '800' }}>{nota}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {!!errorFormulario && <Text style={{ color: colors.rojo, fontSize: 13, marginTop: 14 }}>{errorFormulario}</Text>}

                <TouchableOpacity
                  disabled={guardandoSesion}
                  onPress={avanzarFormulario}
                  style={{ backgroundColor: colors.azulClaro, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 6 }}
                >
                  {guardandoSesion
                    ? <ActivityIndicator color={colors.blanco} />
                    : <Text style={{ color: colors.blanco, fontWeight: '800' }}>{indiceFormulario === ejercicios.length - 1 ? 'Guardar entrenamiento' : 'Siguiente ejercicio'}</Text>}
                </TouchableOpacity>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Boton_barra active="rutina" />
            {/* Reproductor del video explicativo (solo se abre desde el botón del Plan Avanzado) */}
      {videoAbierto && (
        <VideoEjercicio uri={videoAbierto} onCerrar={() => setVideoAbierto(null)} />
      )}
    </SafeAreaView>
  );
}
