import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { api } from '../api/client';
import { CLAVE_USUARIO_ACTUAL } from '../lib/agendaCompartida';
import { abrirAppWhatsApp } from '../lib/whatsapp';
import { usePlanContratado } from '../lib/planesCliente';
import '../global.css';
import FondoThomas from '../components/FondoThomas';

// Ícono y color de cada tipo de aviso (los avisos vienen de Atlas: /api/notificaciones/)
const ESTILO_POR_TIPO = {
  asesoria_nueva: { icon: 'calendar', color: colors.azulClaro },
  asesoria_cambio_cliente: { icon: 'swap-horizontal', color: colors.azulClaro },
  asesoria_confirmada: { icon: 'checkmark-circle', color: colors.verde },
  asesoria_confirmada_cliente: { icon: 'checkmark-circle', color: colors.verde },
  asesoria_reagendada: { icon: 'calendar', color: colors.azulClaro },
  rutina_actualizada: { icon: 'barbell', color: colors.azulClaro },
  rutina_nueva: { icon: 'barbell', color: colors.verde },
  usuario_registrado: { icon: 'person-add', color: colors.azulClaro },
  plan_contratado: { icon: 'card', color: colors.verde },
  nutricion_nueva: { icon: 'nutrition', color: colors.verde },
  mensaje_profesor: { icon: 'logo-whatsapp', color: colors.verde },
  asesoria_cancelada: { icon: 'close-circle', color: colors.rojo },
  asesoria_cancelada_cliente: { icon: 'close-circle', color: colors.rojo },
  objetivo_alcanzado: { icon: 'trophy', color: colors.verde },
  lesion_registrada: { icon: 'bandage', color: colors.rojo },
  whatsapp: { icon: 'logo-whatsapp', color: colors.verde },
};

// "2026-11-02T03:10:00Z" -> "Hace 5 min" / "Hace 2 horas" / "Ayer" / "Hace 3 días"
function tiempoRelativo(iso) {
  if (!iso) return '';
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'Ayer';
  return `Hace ${dias} días`;
}

export default function Notificaciones() {
  const router = useRouter();
  const { esPlanBasico, cargandoPlan } = usePlanContratado();
  const [filtro, setFiltro] = useState('Todas');
  const [notificaciones, setNotificaciones] = useState([]);
  const [esProfesional, setEsProfesional] = useState(false);
  const [aviso, setAviso] = useState('');
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [borrandoSeleccionadas, setBorrandoSeleccionadas] = useState(false);

  useFocusEffect(useCallback(() => {
    let activo = true;
    const cargarNotificaciones = async () => {
      try {
        const guardado = await AsyncStorage.getItem(CLAVE_USUARIO_ACTUAL);
        if (activo) setEsProfesional(JSON.parse(guardado || 'null')?.rol === 'profesional');
      } catch {}
      try {
        const lista = await api('/notificaciones/');
        if (!activo) return;
        setNotificaciones(Array.isArray(lista) ? lista : []);
        setSeleccionadas([]);
        setModoSeleccion(false);
        setAviso('');
      } catch (error) {
        if (!activo) return;
        setNotificaciones([]);
        setAviso(
          error?.status === 401 || error?.status === 403
            ? 'Inicia sesión para ver tus notificaciones.'
            : 'No se pudo conectar con el servidor.'
        );
      }
    };
    cargarNotificaciones();
    return () => { activo = false; };
  }, []));

  const actualizarLocal = (id, cambios) =>
    setNotificaciones((actuales) => actuales.map((item) => (item.id === id ? { ...item, ...cambios } : item)));

  const marcarLeida = (notificacion) => {
    if (notificacion.leida) return;
    actualizarLocal(notificacion.id, { leida: true });
    api(`/notificaciones/${notificacion.id}/`, { method: 'PATCH', body: { leida: true } }).catch(() => {});
  };

  const marcarTodas = async () => {
    setNotificaciones((actuales) => actuales.map((item) => ({ ...item, leida: true })));
    api('/notificaciones/leer-todas/', { method: 'POST' }).catch(() => {});
  };

  // Alterna una notificación entre seleccionada y no seleccionada.
  const alternarSeleccion = (id) => {
    const idTexto = String(id);
    setSeleccionadas((actuales) => actuales.includes(idTexto)
      ? actuales.filter((seleccionada) => seleccionada !== idTexto)
      : [...actuales, idTexto]);
  };

  // Pide confirmación y elimina del servidor solo los avisos que la persona seleccionó.
  const borrarSeleccionadas = () => {
    const ids = [...new Set(seleccionadas)];
    if (!ids.length || borrandoSeleccionadas) return;

    Alert.alert(
      `¿Eliminar ${ids.length === 1 ? 'esta notificación' : `estas ${ids.length} notificaciones`}?`,
      esProfesional
        ? 'Se eliminarán solo las seleccionadas de la bandeja compartida del personal trainer. Esta acción no se puede deshacer.'
        : 'Se eliminarán solo las notificaciones seleccionadas de tu cuenta. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: ids.length === 1 ? 'Eliminar' : `Eliminar (${ids.length})`,
          style: 'destructive',
          onPress: async () => {
            if (borrandoSeleccionadas) return;
            setBorrandoSeleccionadas(true);
            try {
              const resultados = await Promise.all(ids.map(async (id) => {
                try {
                  await api(`/notificaciones/${encodeURIComponent(id)}/`, { method: 'DELETE' });
                  return { id, eliminada: true };
                } catch {
                  return { id, eliminada: false };
                }
              }));
              const idsEliminados = resultados.filter((resultado) => resultado.eliminada).map((resultado) => resultado.id);
              const idsFallidos = resultados.filter((resultado) => !resultado.eliminada).map((resultado) => resultado.id);

              setNotificaciones((actuales) => actuales.filter((item) => !idsEliminados.includes(String(item.id))));
              setSeleccionadas(idsFallidos);

              if (idsFallidos.length > 0) {
                Alert.alert('Eliminación parcial', `Se eliminaron ${idsEliminados.length} de ${ids.length}. Puedes volver a intentar con las restantes.`);
              } else {
                setModoSeleccion(false);
              }
            } finally {
              setBorrandoSeleccionadas(false);
            }
          },
        },
      ]
    );
  };

  // Cancela el modo de selección sin modificar las notificaciones guardadas.
  const cancelarSeleccion = () => {
    setSeleccionadas([]);
    setModoSeleccion(false);
  };

  // al tocar un aviso se marca como leído y se abre la pantalla relacionada
  const abrir = (n) => {
    marcarLeida(n);
    const esEventoDeCliente = n.tipo === 'usuario_registrado'
      || n.tipo === 'plan_contratado'
      || String(n.titulo || '').trim().toLocaleLowerCase('es-CL') === 'nuevo usuario registrado';
    const alumnoId = n.alumnoId || n.alumno_id;
    if (esEventoDeCliente) {
      // Los avisos de alta y de contratación abren la ficha del alumno cuando incluyen su identificador.
      if (alumnoId) router.push({ pathname: '/perfil_cliente_coach', params: { clienteId: String(alumnoId) } });
      else router.push('/clientes');
      return;
    }
    if (esProfesional) {
      if (['Clases presenciales', 'Asesorías'].includes(n.categoria)) router.push('/agenda_coach');
      else if (n.categoria === 'Clientes') router.push('/clientes');
    } else if (n.tipo === 'rutina_actualizada' || n.tipo === 'rutina_nueva') router.push('/rutina');
    else if (n.tipo === 'nutricion_nueva') router.push('/nutricion');
    else if (n.tipo === 'mensaje_profesor') abrirAppWhatsApp();
    else if (['Clases presenciales', 'Asesorías'].includes(n.categoria)) router.push('/agendar');
    else if (n.tipo === 'objetivo_alcanzado') router.push('/progreso');
  };

  // el cliente acepta el nuevo horario que propuso el entrenador
  const confirmarAsesoria = async (notificacion) => {
    try {
      await api(`/asesorias/${notificacion.asesoriaId}/`, { method: 'PATCH', body: { estado: 'confirmada' } });
      await api(`/notificaciones/${notificacion.id}/`, {
        method: 'PATCH',
        body: { leida: true, resuelta: true, respuesta: 'confirmada' },
      });
      actualizarLocal(notificacion.id, { leida: true, resuelta: true, respuesta: 'confirmada' });
      Alert.alert('Clase presencial confirmada', 'El personal trainer recibió tu confirmación.');
    } catch (error) {
      Alert.alert('No se pudo confirmar', error?.message || 'Inténtalo nuevamente.');
    }
  };

  const solicitarReagenda = (notificacion) => {
    router.push({
      pathname: '/agendar',
      params: { asesoriaId: notificacion.asesoriaId, notificacionId: notificacion.id },
    });
  };

  // El plan básico muestra todas las notificaciones sin los filtros del cliente.
  const categorias = esProfesional
    ? ['Todas', 'Clases presenciales', 'Clientes']
    : esPlanBasico
      ? []
      : ['Todas', 'Entrenamiento', 'Clases presenciales'];
  const mostrarFiltros = esProfesional || (!cargandoPlan && !esPlanBasico);
  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  const filtradas = !esProfesional && esPlanBasico
    ? notificaciones
    : notificaciones.filter((n) => filtro === 'Todas' || n.categoria === filtro);
  const idsVisibles = filtradas.map((notificacion) => String(notificacion.id));
  const todasVisiblesSeleccionadas = idsVisibles.length > 0
    && idsVisibles.every((id) => seleccionadas.includes(id));

  // Marca todos los avisos que están visibles; al repetir la acción, los desmarca.
  const alternarSeleccionTodas = () => {
    setSeleccionadas((actuales) => todasVisiblesSeleccionadas
      ? actuales.filter((id) => !idsVisibles.includes(id))
      : [...new Set([...actuales, ...idsVisibles])]);
  };

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_metricas.jpg')} />
      {/* encabezado */}
      <View className="flex-row items-center px-5 pt-2 mb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={26} color={colors.blanco} />
        </TouchableOpacity>
        <Text className="text-blanco text-xl font-masthead flex-1">Notificaciones</Text>
        {filtradas.length > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={modoSeleccion ? 'Cancelar selección' : 'Seleccionar notificaciones para eliminar'}
            onPress={() => modoSeleccion ? cancelarSeleccion() : setModoSeleccion(true)}
            disabled={borrandoSeleccionadas}
            className="items-center px-1 py-2"
            style={{ opacity: borrandoSeleccionadas ? 0.55 : 1 }}
          >
            <Text className="text-blanco text-xs font-bold">
              {modoSeleccion ? 'Cancelar' : 'Seleccionar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {modoSeleccion && filtradas.length > 0 && (
        <View className="flex-row items-center justify-between px-5 mb-2" style={{ gap: 8 }}>
          <View className="flex-row items-center flex-1">
            <Ionicons name="checkmark-circle-outline" size={17} color={colors.azulClaro} />
            <Text className="text-blanco/60 text-xs ml-1">
              {seleccionadas.length} seleccionada{seleccionadas.length === 1 ? '' : 's'}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={todasVisiblesSeleccionadas ? 'Quitar selección a todas las notificaciones' : 'Seleccionar todas las notificaciones'}
              onPress={alternarSeleccionTodas}
              disabled={borrandoSeleccionadas}
              className="ml-3 px-1 py-2"
            >
              <Text className="text-blanco text-xs font-bold">
                {todasVisiblesSeleccionadas ? 'Quitar todas' : 'Todas'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Eliminar ${seleccionadas.length} notificaciones seleccionadas`}
            disabled={seleccionadas.length === 0 || borrandoSeleccionadas}
            onPress={borrarSeleccionadas}
            className="flex-row items-center rounded-full px-3 py-2"
            style={{ backgroundColor: seleccionadas.length ? colors.rojo : 'rgba(255,255,255,0.08)', opacity: borrandoSeleccionadas ? 0.55 : 1 }}
          >
            <Ionicons name="trash-outline" size={14} color={colors.blanco} />
            <Text className="text-blanco text-xs font-bold ml-1">
              {borrandoSeleccionadas ? 'Borrando…' : `Eliminar${seleccionadas.length ? ` (${seleccionadas.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!modoSeleccion && noLeidas > 0 && (
        <View className="flex-row justify-end px-5 mb-2">
          <TouchableOpacity onPress={marcarTodas} hitSlop={8}>
            <Text className="text-azulClaro text-xs font-bold">Marcar todas como leídas</Text>
          </TouchableOpacity>
        </View>
      )}

      {mostrarFiltros && !modoSeleccion && (
        <View className="flex-row px-5 mb-2" style={{ gap: 8 }}>
          {categorias.map((f) => <TouchableOpacity key={f} onPress={() => setFiltro(f)} className={`rounded-full px-3 py-2 ${filtro === f ? 'bg-azulClaro' : 'bg-grafito'}`}><Text className={`text-xs ${filtro === f ? 'text-blanco font-bold' : 'text-blanco/50'}`}>{f}</Text></TouchableOpacity>)}
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <View className="px-5 mt-3" style={{ gap: 10 }}>
          {filtradas.length === 0 && (
            <View className="bg-grafito rounded-2xl p-6 items-center">
              <Ionicons name="notifications-off-outline" size={34} color={colors.azulClaro} />
              <Text className="text-blanco/60 text-xs text-center mt-3">{aviso || 'No tienes notificaciones por ahora.'}</Text>
            </View>
          )}
          {filtradas.map((n, index) => {
            const estilo = ESTILO_POR_TIPO[n.tipo] || { icon: 'notifications', color: colors.azulClaro };
            const icono = estilo.icon;
            const color = estilo.color;
            const estaSeleccionada = seleccionadas.includes(String(n.id));
            return (
            <TouchableOpacity
              key={n.id || index}
              activeOpacity={0.85}
              onPress={() => modoSeleccion ? alternarSeleccion(n.id) : abrir(n)}
              className="flex-row bg-grafito rounded-2xl p-4"
              style={{ borderWidth: estaSeleccionada || !n.leida ? 1 : 0, borderColor: colors.azulClaro }}
            >
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 40, height: 40, backgroundColor: `${color}33` }}
              >
                {/* 33 al final del color = ~20% de opacidad, para un fondo suave del ícono */}
                <Ionicons name={icono} size={18} color={color} />
              </View>

              <View className="flex-1 ml-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-blanco text-sm font-bold flex-1">{n.titulo}</Text>
                  {modoSeleccion ? (
                    <Ionicons
                      name={estaSeleccionada ? 'checkmark-circle' : 'ellipse-outline'}
                      size={21}
                      color={estaSeleccionada ? colors.azulClaro : colors.gris}
                      style={{ marginLeft: 8 }}
                    />
                  ) : !n.leida && (
                    <View className="rounded-full bg-azulClaro" style={{ width: 8, height: 8 }} />
                  )}
                </View>
                <Text className="text-blanco/60 text-xs mt-1">{n.mensaje}</Text>
                <Text className="text-blanco/30 text-[14px] mt-2">{tiempoRelativo(n.creada)}</Text>
                {!modoSeleccion && n.tipo === 'asesoria_reagendada' && !n.resuelta && (
                  <View className="flex-row mt-3" style={{ gap: 8 }}>
                    <TouchableOpacity onPress={() => confirmarAsesoria(n)} className="flex-1 flex-row items-center justify-center rounded-xl bg-azulClaro" style={{ minHeight: 40, gap: 5 }}>
                      <Ionicons name="checkmark" size={16} color={colors.blanco} />
                      <Text className="text-blanco text-xs font-bold">Confirmar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => solicitarReagenda(n)} className="flex-1 flex-row items-center justify-center rounded-xl" style={{ minHeight: 40, gap: 5, borderWidth: 1, borderColor: colors.azulClaro }}>
                      <Ionicons name="calendar-outline" size={16} color={colors.azulClaro} />
                      <Text className="text-azulClaro text-xs font-bold">Reagendar</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!modoSeleccion && n.tipo === 'asesoria_reagendada' && n.resuelta && (
                  <Text className="text-azulClaro text-xs font-bold mt-3">{n.respuesta === 'confirmada' ? 'Nuevo horario confirmado' : 'Nuevo horario enviado al entrenador'}</Text>
                )}
              </View>
            </TouchableOpacity>
          );})}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
