import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Boton_barra_coach from '../components/Boton_barra_coach';
import BotonCerrarSesion from '../components/BotonCerrarSesion';
import FondoThomas from '../components/FondoThomas';
import FotoPerfil from '../components/FotoPerfil';
import LogoMarca from '../components/LogoMarca';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import '../global.css';
import { CLAVE_USUARIO_ACTUAL } from '../lib/agendaCompartida';

// Este prefijo permite guardar una ficha profesional distinta para cada correo del dispositivo.
const CLAVE_FICHA_PROFESIONAL = 'ptrainer_ficha_profesional_';

// Las claves cortas permiten seleccionar los días disponibles para atender asesorías.
const DIAS_DISPONIBLES = [
  { clave: 'lun', nombre: 'Lun' },
  { clave: 'mar', nombre: 'Mar' },
  { clave: 'mie', nombre: 'Mié' },
  { clave: 'jue', nombre: 'Jue' },
  { clave: 'vie', nombre: 'Vie' },
  { clave: 'sab', nombre: 'Sáb' },
  { clave: 'dom', nombre: 'Dom' },
];

// Estos datos corresponden a la información profesional que el entrenador puede editar.
const FICHA_VACIA = {
  especialidad: '',
  experiencia: '',
  certificaciones: '',
  diasDisponibles: [],
  horaInicio: '',
  horaFin: '',
};

// La ficha local se asocia al correo para no mezclar datos de distintos entrenadores.
function obtenerClaveFicha(correo) {
  const identificador = (correo || 'sin-correo').trim().toLowerCase();
  return CLAVE_FICHA_PROFESIONAL + encodeURIComponent(identificador);
}

// Devuelve los minutos de una hora válida para revisar que el horario tenga un orden correcto.
function minutosDesdeHora(hora) {
  const coincidencia = /^(\d{1,2}):(\d{2})$/.exec(hora || '');
  if (!coincidencia) return null;
  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  if (horas > 23 || minutos > 59) return null;
  return horas * 60 + minutos;
}

// Muestra cada dato del perfil con el mismo diseño y abre una acción cuando corresponde.
function FilaPerfil({ icono, titulo, detalle, onPress, ultima = false }) {
  return (
    <TouchableOpacity
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      className={ultima ? 'flex-row items-center py-4' : 'flex-row items-center py-4 border-b border-azulClaro'}
    >
      <Ionicons name={icono} size={20} color={colors.azulClaro} />
      <View className="flex-1 ml-3">
        <Text className="text-blanco text-sm">{titulo}</Text>
        <Text className="text-blanco/50 text-xs mt-1">{detalle || 'Por configurar'}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={17} color={colors.blanco} style={{ opacity: 0.45 }} /> : null}
    </TouchableOpacity>
  );
}

// Mantiene la apariencia uniforme de los campos del formulario de edición.
function CampoPerfil({ etiqueta, valor, alCambiar, ejemplo, teclado, multilinea = false, soloLectura = false }) {
  return (
    <View className="mb-4">
      <Text className="text-blanco/70 text-xs mb-2">{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={alCambiar}
        placeholder={ejemplo}
        placeholderTextColor={colors.gris}
        keyboardType={teclado || 'default'}
        autoCapitalize={etiqueta === 'Correo electrónico' ? 'none' : 'sentences'}
        autoCorrect={etiqueta === 'Correo electrónico' ? false : true}
        editable={!soloLectura}
        multiline={multilinea}
        textAlignVertical={multilinea ? 'top' : 'center'}
        className={soloLectura ? 'bg-grafito rounded-xl px-4 py-3 text-blanco opacity-60' : 'bg-grafito rounded-xl px-4 py-3 text-blanco'}
        style={{ minHeight: multilinea ? 96 : 48 }}
      />
    </View>
  );
}

// Este perfil reúne la cuenta, la información profesional y la disponibilidad del entrenador.
export default function PerfilProfesional() {
  const router = useRouter();
  const { usuario: usuarioAutenticado } = useAuth();
  const [cuenta, setCuenta] = useState({ nombre: '', correo: '' });
  const [ficha, setFicha] = useState(FICHA_VACIA);
  const [modalVisible, setModalVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formulario, setFormulario] = useState({ nombre: '', ...FICHA_VACIA });

  // Al abrir el perfil se recupera el nombre de sesión y los datos profesionales locales.
  useFocusEffect(useCallback(() => {
    let activa = true;

    const cargarPerfil = async () => {
      let sesionLocal = {};
      try {
        const guardada = await AsyncStorage.getItem(CLAVE_USUARIO_ACTUAL);
        sesionLocal = guardada ? JSON.parse(guardada) : {};
      } catch {
        sesionLocal = {};
      }

      const correo = sesionLocal.correo || usuarioAutenticado?.correo || usuarioAutenticado?.email || '';
      let fichaLocal = FICHA_VACIA;
      try {
        const claveFicha = obtenerClaveFicha(correo);
        const guardada = await AsyncStorage.getItem(claveFicha);
        if (guardada) {
          const datosGuardados = JSON.parse(guardada);
          const habiaTelefono = Object.prototype.hasOwnProperty.call(datosGuardados, 'telefono');
          delete datosGuardados.telefono;
          fichaLocal = { ...FICHA_VACIA, ...datosGuardados };
          if (habiaTelefono) await AsyncStorage.setItem(claveFicha, JSON.stringify(fichaLocal));
        }
      } catch {
        fichaLocal = FICHA_VACIA;
      }

      if (!Array.isArray(fichaLocal.diasDisponibles)) fichaLocal.diasDisponibles = [];
      if (!activa) return;
      setCuenta({
        nombre: sesionLocal.nombre || usuarioAutenticado?.nombre || '',
        correo,
      });
      setFicha(fichaLocal);
    };

    cargarPerfil();
    return () => { activa = false; };
  }, [usuarioAutenticado]));

  // El formulario parte con los datos que aparecen actualmente en el perfil.
  const abrirEdicion = () => {
    setFormulario({ nombre: cuenta.nombre, ...ficha });
    setModalVisible(true);
  };

  // Guarda la información profesional en el dispositivo y actualiza el nombre de la sesión local.
  const guardarCambios = async () => {
    const nombre = formulario.nombre.trim();
    const especialidad = formulario.especialidad.trim();
    const experiencia = formulario.experiencia.trim();
    const certificaciones = formulario.certificaciones.trim();
    const horaInicio = formulario.horaInicio.trim();
    const horaFin = formulario.horaFin.trim();

    if (!nombre) {
      Alert.alert('Falta tu nombre', 'Escribe el nombre que quieres mostrar en tu perfil.');
      return;
    }
    if (experiencia && (!/^\d+$/.test(experiencia) || Number(experiencia) > 80)) {
      Alert.alert('Experiencia inválida', 'Ingresa los años de experiencia como un número entre 0 y 80.');
      return;
    }
    if ((horaInicio && !horaFin) || (!horaInicio && horaFin)) {
      Alert.alert('Horario incompleto', 'Completa tanto la hora de inicio como la de término.');
      return;
    }
    if (horaInicio || horaFin) {
      const inicio = minutosDesdeHora(horaInicio);
      const fin = minutosDesdeHora(horaFin);
      if (inicio === null || fin === null || inicio >= fin) {
        Alert.alert('Horario inválido', 'Usa horas entre 00:00 y 23:59, con el término después del inicio.');
        return;
      }
    }

    const fichaActualizada = {
      especialidad,
      experiencia,
      certificaciones,
      diasDisponibles: formulario.diasDisponibles,
      horaInicio,
      horaFin,
    };

    try {
      setGuardando(true);
      let sesionLocal = {};
      try {
        const guardada = await AsyncStorage.getItem(CLAVE_USUARIO_ACTUAL);
        sesionLocal = guardada ? JSON.parse(guardada) : {};
      } catch {
        sesionLocal = {};
      }

      const correo = cuenta.correo || usuarioAutenticado?.correo || usuarioAutenticado?.email || '';
      const sesionActualizada = { ...sesionLocal, nombre, correo, rol: 'profesional' };
      await AsyncStorage.multiSet([
        [CLAVE_USUARIO_ACTUAL, JSON.stringify(sesionActualizada)],
        [obtenerClaveFicha(correo), JSON.stringify(fichaActualizada)],
      ]);

      setCuenta({ nombre, correo });
      setFicha(fichaActualizada);
      setModalVisible(false);
      Alert.alert('Perfil guardado', 'Tu información profesional quedó guardada en este dispositivo.');
    } catch {
      Alert.alert('No se pudo guardar', 'Inténtalo nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  // Abre un mensaje de correo dirigido a la cuenta que inició sesión.
  const abrirCorreo = async () => {
    if (!cuenta.correo) {
      Alert.alert('Correo no disponible', 'Inicia sesión nuevamente para ver el correo de tu cuenta.');
      return;
    }
    try {
      await Linking.openURL('mailto:' + cuenta.correo);
    } catch {
      Alert.alert('No se pudo abrir el correo', 'Configura una aplicación de correo en el dispositivo.');
    }
  };

  // Lleva al calendario del personal trainer para gestionar las asesorías.
  const abrirCalendario = () => router.push('/agenda_coach');

  const diasVisible = ficha.diasDisponibles
    .map((clave) => DIAS_DISPONIBLES.find((dia) => dia.clave === clave)?.nombre)
    .filter(Boolean)
    .join(', ');
  const horarioVisible = ficha.horaInicio && ficha.horaFin
    ? ficha.horaInicio + ' a ' + ficha.horaFin
    : 'Por configurar';
  const nombreVisible = (cuenta.nombre || 'Personal Trainer').toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_perfil_profesional.jpg')} />
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <View style={{ width: 88, alignItems: 'flex-start' }}>
          <TouchableOpacity accessibilityLabel="Volver" onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color={colors.blanco} />
          </TouchableOpacity>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit className="flex-1 text-blanco text-lg font-masthead text-center">MI PERFIL</Text>
        <View style={{ width: 88, alignItems: 'flex-end' }}>
          <LogoMarca />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <View className="items-center mt-3 mb-5">
          <FotoPerfil tamano={112} />
          <Text className="text-blanco text-xl font-masthead mt-3">{nombreVisible}</Text>
          <Text className="text-azulClaro text-sm mt-1">Personal Trainer</Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={abrirEdicion}
          className="flex-row items-center justify-center mx-5 mb-6 rounded-xl bg-azulClaro"
          style={{ minHeight: 48, gap: 8 }}
        >
          <Ionicons name="create-outline" size={19} color={colors.blanco} />
          <Text className="text-blanco text-sm font-bold">Editar perfil</Text>
        </TouchableOpacity>

        <View className="px-5">
          <Text className="text-blanco text-sm font-bold mb-2">Información profesional</Text>
          <View className="bg-grafito rounded-2xl px-4 mb-6">
            <FilaPerfil icono="barbell-outline" titulo="Especialidad" detalle={ficha.especialidad} />
            <FilaPerfil icono="time-outline" titulo="Experiencia" detalle={ficha.experiencia ? ficha.experiencia + ' años' : ''} />
            <FilaPerfil icono="ribbon-outline" titulo="Certificaciones y formación" detalle={ficha.certificaciones} ultima />
          </View>

          <Text className="text-blanco text-sm font-bold mb-2">Contacto</Text>
          <View className="bg-grafito rounded-2xl px-4 mb-6">
            <FilaPerfil icono="mail-outline" titulo="Correo electrónico" detalle={cuenta.correo || 'Por configurar'} onPress={abrirCorreo} ultima />
          </View>

          <Text className="text-blanco text-sm font-bold mb-2">Disponibilidad para clases presenciales</Text>
          <View className="bg-grafito rounded-2xl px-4 mb-6">
            <FilaPerfil icono="calendar-outline" titulo="Días disponibles" detalle={diasVisible || 'Por configurar'} />
            <FilaPerfil icono="time-outline" titulo="Horario" detalle={horarioVisible} ultima />
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={abrirCalendario}
            className="flex-row items-center bg-grafito rounded-xl px-4 py-4 mb-4"
          >
            <Ionicons name="calendar-outline" size={21} color={colors.azulClaro} />
            <Text className="text-blanco text-sm font-bold ml-3 flex-1">Ver calendario de clases presenciales</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.blanco} style={{ opacity: 0.45 }} />
          </TouchableOpacity>
        </View>

        <BotonCerrarSesion />
      </ScrollView>

      <Boton_barra_coach active="perfil" />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/70">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View className="max-h-[90%] bg-carbon rounded-t-3xl px-5 pt-5 pb-7">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-blanco text-lg font-masthead">Editar perfil</Text>
                <TouchableOpacity accessibilityLabel="Cerrar formulario" onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.blanco} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <CampoPerfil
                  etiqueta="Nombre"
                  valor={formulario.nombre}
                  alCambiar={(nombre) => setFormulario((actual) => ({ ...actual, nombre }))}
                  ejemplo="Tu nombre"
                />
                <CampoPerfil etiqueta="Correo electrónico" valor={cuenta.correo} ejemplo="Correo de la cuenta" soloLectura />
                <CampoPerfil
                  etiqueta="Especialidad"
                  valor={formulario.especialidad}
                  alCambiar={(especialidad) => setFormulario((actual) => ({ ...actual, especialidad }))}
                  ejemplo="Ej. Hipertrofia y Classic Physique"
                />
                <CampoPerfil
                  etiqueta="Años de experiencia"
                  valor={formulario.experiencia}
                  alCambiar={(experiencia) => setFormulario((actual) => ({ ...actual, experiencia: experiencia.replace(/\D/g, '') }))}
                  ejemplo="Ej. 5"
                  teclado="number-pad"
                />
                <CampoPerfil
                  etiqueta="Certificaciones y formación"
                  valor={formulario.certificaciones}
                  alCambiar={(certificaciones) => setFormulario((actual) => ({ ...actual, certificaciones }))}
                  ejemplo="Escribe tus certificaciones"
                  multilinea
                />

                <Text className="text-blanco/70 text-xs mb-2">Días disponibles</Text>
                <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
                  {DIAS_DISPONIBLES.map((dia) => {
                    const seleccionado = formulario.diasDisponibles.includes(dia.clave);
                    return (
                      <TouchableOpacity
                        key={dia.clave}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: seleccionado }}
                        onPress={() => setFormulario((actual) => ({
                          ...actual,
                          diasDisponibles: seleccionado
                            ? actual.diasDisponibles.filter((clave) => clave !== dia.clave)
                            : [...actual.diasDisponibles, dia.clave],
                        }))}
                        className={seleccionado ? 'rounded-full px-4 py-2 bg-azulClaro' : 'rounded-full px-4 py-2 bg-grafito'}
                      >
                        <Text className={seleccionado ? 'text-xs text-blanco font-bold' : 'text-xs text-blanco/60'}>{dia.nombre}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View className="flex-row" style={{ gap: 10 }}>
                  <View className="flex-1">
                    <CampoPerfil
                      etiqueta="Desde"
                      valor={formulario.horaInicio}
                      alCambiar={(horaInicio) => setFormulario((actual) => ({ ...actual, horaInicio }))}
                      ejemplo="09:00"
                    />
                  </View>
                  <View className="flex-1">
                    <CampoPerfil
                      etiqueta="Hasta"
                      valor={formulario.horaFin}
                      alCambiar={(horaFin) => setFormulario((actual) => ({ ...actual, horaFin }))}
                      ejemplo="18:00"
                    />
                  </View>
                </View>

                <View className="flex-row mt-2 mb-2" style={{ gap: 10 }}>
                  <TouchableOpacity onPress={() => setModalVisible(false)} className="flex-1 items-center justify-center rounded-xl bg-grafito" style={{ minHeight: 48 }}>
                    <Text className="text-blanco/70 text-sm font-bold">Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={guardando} onPress={guardarCambios} className="flex-1 items-center justify-center rounded-xl bg-azulClaro" style={{ minHeight: 48, opacity: guardando ? 0.6 : 1 }}>
                    <Text className="text-blanco text-sm font-bold">{guardando ? 'Guardando…' : 'Guardar perfil'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
