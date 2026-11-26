import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import Boton_barra from '../components/Boton_barra';
import BotonCerrarSesion from '../components/BotonCerrarSesion';
import FondoThomas from '../components/FondoThomas';
import FotoPerfil from '../components/FotoPerfil';
import LogoMarca from '../components/LogoMarca';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useMetricas } from '../context/MetricasContext';
import '../global.css';
import { CLAVE_USUARIO_ACTUAL } from '../lib/agendaCompartida';
import { calcularTMB } from '../lib/metabolismo';
import { leerSexoUsuario } from '../lib/sexoUsuario';
import { usePlanContratado, useRutinasCompradas } from '../lib/planesCliente';

const OBJETIVOS = ['Ganancia muscular', 'Pérdida de grasa', 'Mantenimiento', 'Resistencia'];
const NIVELES = ['Principiante', 'Intermedio', 'Avanzado'];
const MESES_ESPANOL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Devuelve la fecha local en el formato que acepta el campo DateField del backend.
function fechaActualISO() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
}

// Muestra las fechas de antecedentes en el formato AAAA-MM-DD usado al guardarlas.
function fechaAntecedenteEditable(fecha) {
  if (!fecha) return fechaActualISO();
  if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }

  const texto = String(fecha).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  const fechaNumerica = texto.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (fechaNumerica) {
    const [, dia, mes, anio] = fechaNumerica;
    return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  const mesYAnio = texto.toLowerCase().match(/^([a-záéíóúñ]+)\s+(\d{4})$/);
  if (mesYAnio) {
    const mes = MESES_ESPANOL.indexOf(mesYAnio[1]);
    if (mes >= 0) return `${mesYAnio[2]}-${String(mes + 1).padStart(2, '0')}-01`;
  }

  return texto;
}

// Comprueba que la fecha del antecedente exista realmente en el calendario.
function esFechaISOValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) return false;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const comprobada = new Date(anio, mes - 1, dia);
  return comprobada.getFullYear() === anio && comprobada.getMonth() === mes - 1 && comprobada.getDate() === dia;
}

// Convierte las lesiones y alergias guardadas en la ficha del cliente en un resumen legible.
function resumirAntecedentes(datos) {
  const lesiones = (datos?.lesion || []).map((lesion) => {
    const reposo = lesion.reposo ? ` · Reposo: ${lesion.reposo}` : '';
    const detalle = lesion.detalle ? ` · ${lesion.detalle}` : '';
    return `${lesion.areaCorporal || 'Lesión'}${reposo}${detalle}`;
  });
  const alergias = (datos?.alergia || []).map((alergia) => `Alergia o intolerancia: ${alergia.tipo}`);
  return [...lesiones, ...alergias].filter(Boolean).join('\n');
}

// Mantiene un aspecto igual para cada dato que se muestra en el perfil del cliente.
function FilaPerfil({ icono, titulo, valor, ruta, onPress, ultima = false }) {
  const accionable = Boolean(ruta || onPress);
  return (
    <TouchableOpacity
      accessibilityRole={accionable ? 'button' : undefined}
      disabled={!accionable}
      onPress={onPress}
      className={ultima ? 'flex-row items-center py-4' : 'flex-row items-center py-4 border-b border-azulClaro'}
    >
      <Ionicons name={icono} size={20} color={colors.blanco} style={{ opacity: 0.8 }} />
      <View className="flex-1 ml-3">
        <Text className="text-blanco text-sm">{titulo}</Text>
        <Text className="text-blanco/50 text-xs mt-1">{valor || 'Sin información registrada'}</Text>
      </View>
      {accionable ? <Ionicons name="chevron-forward" size={16} color={colors.blanco} style={{ opacity: 0.35 }} /> : null}
    </TouchableOpacity>
  );
}

// El perfil reúne los datos de la cuenta activa y los antecedentes guardados en el servidor.
export default function PerfilCliente() {
  const router = useRouter();
  const { usuario, guardarPerfil: guardarCuenta } = useAuth();
  const { pesoHistorial, guardarPerfil: guardarMetricas } = useMetricas();
  const { planId, esPlanBasico, cargandoPlan } = usePlanContratado();
  const { tieneRutinasCompradas, cargandoRutinas } = useRutinasCompradas();
  const esPlanAvanzado = planId === 'avanzado';
  const puedeVerMedidas = !cargandoPlan && Boolean(planId);
  const puedeCambiarPlan = !cargandoPlan && (esPlanBasico || esPlanAvanzado);
  const puedeComprarPlan = !cargandoPlan && !planId && !cargandoRutinas && tieneRutinasCompradas;
  const puedeMostrarAccionPlan = puedeCambiarPlan || puedeComprarPlan;
  const [datosCuenta, setDatosCuenta] = useState(usuario || null);
  const [datosFisicos, setDatosFisicos] = useState(null);
  const [sexoRegistrado, setSexoRegistrado] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formulario, setFormulario] = useState({ nombre: '', altura: '', objetivo: '', experiencia: '', lesiones: [], alergias: '' });

  // Recarga la cuenta y la ficha física al volver a esta pantalla.
  useFocusEffect(useCallback(() => {
    let activa = true;
    leerSexoUsuario(usuario)
      .then((sexo) => { if (activa) setSexoRegistrado(sexo || ''); })
      .catch(() => { if (activa) setSexoRegistrado(''); });
    api('/perfil/')
      .then((cuenta) => { if (activa) setDatosCuenta(cuenta?.usuario || cuenta); })
      .catch(() => { if (activa) setDatosCuenta(usuario || null); });
    api('/datos/')
      .then((datos) => { if (activa) setDatosFisicos(datos); })
      .catch(() => { if (activa) setDatosFisicos(null); });
    return () => { activa = false; };
  }, [usuario]));

  const abrirEdicion = () => {
    setFormulario({
      nombre: datosCuenta?.nombre || usuario?.nombre || '',
      altura: datosFisicos?.altura ? String(datosFisicos.altura) : '',
      objetivo: datosFisicos?.objetivo || '',
      experiencia: datosFisicos?.experiencia || '',
      lesiones: (datosFisicos?.lesion || []).map((lesion) => ({
        ...lesion,
        fecha: fechaAntecedenteEditable(lesion.fecha),
        areaCorporal: lesion.areaCorporal || '',
        detalle: lesion.detalle || '',
        reposo: lesion.reposo || '',
      })),
      alergias: (datosFisicos?.alergia || []).map((alergia) => alergia.tipo || '').filter(Boolean).join(', '),
    });
    setModalVisible(true);
  };

  // Actualiza un campo de la lesión elegida sin cambiar las demás lesiones.
  const actualizarLesion = (indice, campo, valor) => setFormulario((actual) => ({
    ...actual,
    lesiones: actual.lesiones.map((lesion, posicion) => (
      posicion === indice ? { ...lesion, [campo]: valor } : lesion
    )),
  }));

  // Agrega una fila editable para registrar otro antecedente de lesión.
  const agregarLesion = () => setFormulario((actual) => ({
    ...actual,
    lesiones: [...actual.lesiones, { fecha: fechaActualISO(), areaCorporal: '', detalle: '', reposo: '' }],
  }));

  // Quita la lesión seleccionada de la lista que se enviará al backend.
  const eliminarLesion = (indice) => setFormulario((actual) => ({
    ...actual,
    lesiones: actual.lesiones.filter((_, posicion) => posicion !== indice),
  }));

  // Persiste el nombre en la cuenta y las métricas editables en la ficha física del servidor.
  const guardarCambios = async () => {
    if (guardando) return;
    const nombre = formulario.nombre.trim();
    const altura = formulario.altura.trim() ? Number(formulario.altura.replace(',', '.')) : null;
    if (!nombre) {
      Alert.alert('Falta tu nombre', 'Escribe tu nombre para guardar el perfil.');
      return;
    }
    if (altura !== null && (!Number.isFinite(altura) || altura < 80 || altura > 250)) {
      Alert.alert('Altura inválida', 'Ingresa una altura entre 80 y 250 cm.');
      return;
    }
    if (datosFisicos && (!formulario.objetivo || !formulario.experiencia)) {
      Alert.alert('Completa tus datos', 'Selecciona un objetivo y tu nivel de experiencia.');
      return;
    }

    const lesionesConContenido = formulario.lesiones.filter((lesion) => (
      [lesion.areaCorporal, lesion.detalle, lesion.reposo]
        .some((valor) => String(valor || '').trim())
    ));
    if (lesionesConContenido.some((lesion) => !lesion.areaCorporal.trim() || !lesion.reposo)) {
      Alert.alert('Completa las lesiones', 'Cada lesión debe incluir una zona afectada y señalar si requiere reposo.');
      return;
    }
    if (lesionesConContenido.some((lesion) => !esFechaISOValida(lesion.fecha))) {
      Alert.alert('Fecha inválida', 'Usa el formato AAAA-MM-DD para la fecha de cada lesión.');
      return;
    }
    const lesionesFinales = lesionesConContenido.map((lesion) => ({
      fecha: lesion.fecha,
      areaCorporal: lesion.areaCorporal.trim(),
      detalle: lesion.detalle.trim(),
      reposo: lesion.reposo,
    }));
    const alergiasFinales = formulario.alergias
      .split(/[,;\n]/)
      .map((tipo) => tipo.trim())
      .filter(Boolean)
      .map((tipo) => ({ tipo: tipo.slice(0, 100) }));

    try {
      setGuardando(true);
      const cuentaActualizada = await guardarCuenta({ nombre });
      let fichaActualizada = datosFisicos;
      if (datosFisicos) {
        const respuesta = await api('/datos/', {
          method: 'PATCH',
          body: {
            altura: altura ?? datosFisicos.altura,
            pesoActual: datosFisicos.pesoActual,
            objetivo: formulario.objetivo,
            experiencia: formulario.experiencia,
            lesion: lesionesFinales,
            alergia: alergiasFinales,
          },
        });
        fichaActualizada = respuesta?.datos || respuesta;
        await guardarMetricas({
          altura: fichaActualizada.altura,
          objetivo: fichaActualizada.objetivo,
          nivel: fichaActualizada.experiencia,
        });
      }

      setDatosCuenta(cuentaActualizada || { ...datosCuenta, nombre });
      if (fichaActualizada) setDatosFisicos(fichaActualizada);
      const sesionGuardada = await AsyncStorage.getItem(CLAVE_USUARIO_ACTUAL);
      const sesion = sesionGuardada ? JSON.parse(sesionGuardada) : {};
      await AsyncStorage.setItem(CLAVE_USUARIO_ACTUAL, JSON.stringify({ ...sesion, nombre }));
      setModalVisible(false);
      Alert.alert('Perfil actualizado', 'Tu nombre y tus datos de entrenamiento quedaron guardados.');
    } catch (error) {
      Alert.alert('No se pudo guardar', error?.message || 'Inténtalo nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  // Abre directamente el resumen del plan al que la persona quiere cambiarse.
  const abrirCambioPlan = () => router.push({
    pathname: '/metodo_pago',
    params: {
      id: esPlanBasico ? 'avanzado' : 'inicial',
      origen: esPlanBasico ? 'cambio-plan' : 'baja-nivel',
    },
  });

  const nombre = datosCuenta?.nombre || usuario?.nombre || 'Cliente';
  const correo = datosCuenta?.correo || usuario?.correo || usuario?.email || '';
  const pesoActual = pesoHistorial[pesoHistorial.length - 1]?.kg ?? datosFisicos?.pesoActual;
  const altura = datosFisicos?.altura;
  const tmb = calcularTMB({
    peso: Number(pesoActual),
    altura: Number(altura),
    edad: Number(datosCuenta?.edad ?? usuario?.edad),
    sexo: String(datosFisicos?.sexo || datosCuenta?.sexo || usuario?.sexo || sexoRegistrado || '').toLowerCase(),
  });
  const antecedentes = resumirAntecedentes(datosFisicos);

  const filas = [
    { icono: 'person-outline', titulo: 'Información personal', valor: nombre },
    { icono: 'mail-outline', titulo: 'Correo electrónico', valor: correo },
    { icono: 'flag-outline', titulo: 'Objetivo', valor: datosFisicos?.objetivo },
    { icono: 'bar-chart-outline', titulo: 'Experiencia', valor: datosFisicos?.experiencia },
    { icono: 'document-text-outline', titulo: 'Antecedentes relevantes', valor: antecedentes },
    { icono: 'calendar-outline', titulo: 'Calendario de clases presenciales', ruta: 'agendar' },
  ];
  // El calendario de asesorías solo está incluido en el Plan Avanzado (igual que en el Home).
  // Las medidas y el calendario aparecen solo cuando la cuenta tiene el plan que incluye esas funciones.
  const filasVisibles = filas.filter((fila) => (
    (fila.ruta !== 'agendar' || (!cargandoPlan && esPlanAvanzado))
  ));

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_perfil.jpg')} />
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <View style={{ width: 88, alignItems: 'flex-start' }}>
          <TouchableOpacity accessibilityLabel="Volver" onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color={colors.blanco} />
          </TouchableOpacity>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit className="flex-1 text-blanco text-xl font-masthead text-center">MI PERFIL</Text>
        <View style={{ width: 88, alignItems: 'flex-end' }}>
          <LogoMarca />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <View className="items-center mt-4 mb-6">
          <FotoPerfil tamano={112} />
          <Text className="text-blanco text-2xl font-masthead mt-3">{nombre.toUpperCase()}</Text>
          <Text className="text-blanco/50 text-sm mt-1">Cliente</Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={abrirEdicion}
          className="flex-row items-center justify-center mx-5 mb-6 rounded-xl bg-azulClaro"
          style={{ minHeight: 50, gap: 8 }}
        >
          <Ionicons name="create-outline" size={20} color={colors.blanco} />
          <Text className="text-blanco text-sm font-bold">Editar perfil</Text>
        </TouchableOpacity>

        {puedeVerMedidas && (
          <View className="flex-row bg-grafito rounded-2xl py-4 px-2 mx-5 mb-6">
            {[
              { label: 'Altura', valor: altura ? `${altura} cm` : '—' },
              { label: 'Peso actual', valor: pesoActual ? `${pesoActual} kg` : '—' },
              { label: 'TMB', valor: tmb !== null ? `${tmb} kcal` : '—' },
            ].map((dato) => (
              <View key={dato.label} className="flex-1 items-center">
                <Text className="text-blanco text-base font-bold">{dato.valor}</Text>
                <Text className="text-blanco/40 text-xs mt-0.5">{dato.label}</Text>
              </View>
            ))}
          </View>
        )}

        <View className="px-5">
          {filasVisibles.map((fila, indice) => (
            <FilaPerfil
              key={fila.titulo}
              {...fila}
              ultima={indice === filasVisibles.length - 1 && !puedeMostrarAccionPlan}
              onPress={fila.ruta ? () => router.push(`/${fila.ruta}`) : undefined}
            />
          ))}
        </View>

        {puedeCambiarPlan && (
          <View className="px-5">
            <FilaPerfil
              icono="swap-horizontal-outline"
              titulo="Cambiar plan"
              valor={esPlanBasico ? 'Mejorar al Plan Avanzado' : 'Cambiar al Plan Básico'}
              onPress={abrirCambioPlan}
              ultima
            />
          </View>
        )}

        {puedeComprarPlan && (
          <View className="px-5">
            <FilaPerfil
              icono="pricetag-outline"
              titulo="Comprar un plan"
              valor="Ver Plan Básico y Plan Avanzado"
              onPress={() => router.push('/planes')}
              ultima
            />
          </View>
        )}

        <BotonCerrarSesion />
      </ScrollView>

      <Boton_barra active="mas" />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' }}
        >
          <View className="rounded-t-3xl bg-grafito" style={{ maxHeight: '92%', width: '100%', maxWidth: 720, alignSelf: 'center' }}>
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <Text className="text-blanco text-lg font-masthead">Editar perfil</Text>
              <TouchableOpacity accessibilityLabel="Cerrar" onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.blanco} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              <Text className="text-blanco/70 text-xs font-bold mb-2">Nombre completo</Text>
              <TextInput
                value={formulario.nombre}
                onChangeText={(nombreNuevo) => setFormulario((actual) => ({ ...actual, nombre: nombreNuevo }))}
                placeholder="Tu nombre"
                placeholderTextColor={colors.gris}
                className="bg-carbon rounded-xl px-4 text-blanco text-sm mb-4"
                style={{ minHeight: 50 }}
              />

              <Text className="text-blanco/70 text-xs font-bold mb-2">Altura (cm)</Text>
              <TextInput
                value={formulario.altura}
                onChangeText={(alturaNueva) => setFormulario((actual) => ({ ...actual, altura: alturaNueva }))}
                placeholder="Ej. 178"
                placeholderTextColor={colors.gris}
                keyboardType="decimal-pad"
                className="bg-carbon rounded-xl px-4 text-blanco text-sm mb-4"
                style={{ minHeight: 50 }}
              />

              <Text className="text-blanco/70 text-xs font-bold mb-2">Objetivo</Text>
              <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
                {OBJETIVOS.map((objetivo) => {
                  const seleccionado = formulario.objetivo === objetivo;
                  return (
                    <TouchableOpacity
                      key={objetivo}
                      onPress={() => setFormulario((actual) => ({ ...actual, objetivo }))}
                      className={`rounded-full px-3 py-2 ${seleccionado ? 'bg-azulClaro' : 'bg-carbon'}`}
                    >
                      <Text className={`text-xs ${seleccionado ? 'text-blanco font-bold' : 'text-blanco/60'}`}>{objetivo}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="text-blanco/70 text-xs font-bold mb-2">Nivel de experiencia</Text>
              <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
                {NIVELES.map((nivel) => {
                  const seleccionado = formulario.experiencia === nivel;
                  return (
                    <TouchableOpacity
                      key={nivel}
                      onPress={() => setFormulario((actual) => ({ ...actual, experiencia: nivel }))}
                      className={`rounded-full px-4 py-2 ${seleccionado ? 'bg-azulClaro' : 'bg-carbon'}`}
                    >
                      <Text className={`text-xs ${seleccionado ? 'text-blanco font-bold' : 'text-blanco/60'}`}>{nivel}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="text-blanco/70 text-xs font-bold mb-2">Lesiones registradas</Text>
              {formulario.lesiones.length === 0 && (
                <Text className="text-blanco/40 text-xs mb-3">No hay lesiones registradas.</Text>
              )}
              {formulario.lesiones.map((lesion, indice) => (
                <View key={`${lesion.fecha}-${indice}`} className="bg-carbon rounded-xl p-3 mb-3">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-blanco text-sm font-bold">Lesión {indice + 1}</Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Eliminar lesión ${indice + 1}`}
                      onPress={() => eliminarLesion(indice)}
                      className="flex-row items-center"
                    >
                      <Ionicons name="trash-outline" size={17} color={colors.rojo} />
                      <Text className="text-rojo text-xs ml-1">Quitar</Text>
                    </TouchableOpacity>
                  </View>

                  <Text className="text-blanco/50 text-xs mb-1">Fecha (AAAA-MM-DD)</Text>
                  <TextInput
                    value={String(lesion.fecha || '')}
                    onChangeText={(valor) => actualizarLesion(indice, 'fecha', valor)}
                    placeholder="2026-11-05"
                    placeholderTextColor={colors.gris}
                    className="bg-grafito rounded-lg px-3 text-blanco text-sm mb-3"
                    style={{ minHeight: 44 }}
                  />

                  <Text className="text-blanco/50 text-xs mb-1">Zona afectada</Text>
                  <TextInput
                    value={String(lesion.areaCorporal || '')}
                    onChangeText={(valor) => actualizarLesion(indice, 'areaCorporal', valor)}
                    placeholder="Ej. Rodilla"
                    placeholderTextColor={colors.gris}
                    className="bg-grafito rounded-lg px-3 text-blanco text-sm mb-3"
                    style={{ minHeight: 44 }}
                  />

                  <Text className="text-blanco/50 text-xs mb-1">Detalle (opcional)</Text>
                  <TextInput
                    value={String(lesion.detalle || '')}
                    onChangeText={(valor) => actualizarLesion(indice, 'detalle', valor)}
                    placeholder="Ej. Esguince"
                    placeholderTextColor={colors.gris}
                    className="bg-grafito rounded-lg px-3 text-blanco text-sm mb-3"
                    style={{ minHeight: 44 }}
                  />

                  <Text className="text-blanco/50 text-xs mb-2">¿Requiere reposo?</Text>
                  <View className="flex-row" style={{ gap: 8 }}>
                    {['Sí', 'No'].map((opcion) => {
                      const seleccionado = lesion.reposo === opcion;
                      return (
                        <TouchableOpacity
                          key={opcion}
                          accessibilityRole="button"
                          accessibilityState={{ selected: seleccionado }}
                          onPress={() => actualizarLesion(indice, 'reposo', opcion)}
                          className={`rounded-full px-4 py-2 ${seleccionado ? 'bg-azulClaro' : 'bg-grafito'}`}
                        >
                          <Text className={`text-xs ${seleccionado ? 'text-blanco font-bold' : 'text-blanco/60'}`}>{opcion}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

              <TouchableOpacity onPress={agregarLesion} className="flex-row items-center self-start mb-5">
                <Ionicons name="add-circle-outline" size={19} color={colors.azulClaro} />
                <Text className="text-azulClaro text-xs font-bold ml-1">Agregar lesión</Text>
              </TouchableOpacity>

              <Text className="text-blanco/70 text-xs font-bold mb-2">Alergias o intolerancias</Text>
              <TextInput
                value={formulario.alergias}
                onChangeText={(alergias) => setFormulario((actual) => ({ ...actual, alergias }))}
                placeholder="Ej. lactosa, celiaquía, maní"
                placeholderTextColor={colors.gris}
                multiline
                className="bg-carbon rounded-xl px-4 py-3 text-blanco text-sm mb-1"
                style={{ minHeight: 76, textAlignVertical: 'top' }}
              />
              <Text className="text-blanco/35 text-[14px] mb-5">Separa cada antecedente con coma o punto y coma.</Text>

              <View className="flex-row" style={{ gap: 10 }}>
                <TouchableOpacity onPress={() => setModalVisible(false)} className="flex-1 items-center justify-center rounded-xl bg-carbon" style={{ minHeight: 50 }}>
                  <Text className="text-blanco/70 text-sm font-bold">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={guardando} onPress={guardarCambios} className="flex-1 items-center justify-center rounded-xl bg-azulClaro" style={{ minHeight: 50, opacity: guardando ? 0.6 : 1 }}>
                  <Text className="text-blanco text-sm font-bold">{guardando ? 'Guardando…' : 'Guardar perfil'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
