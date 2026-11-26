import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import Boton_barra_coach from '../components/Boton_barra_coach';
import FondoThomas from '../components/FondoThomas';
import LogoMarca from '../components/LogoMarca';
import { colors } from '../constants/theme';
import '../global.css';
import { escribirleAlCliente } from '../lib/whatsapp';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const NOMBRES_DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const HORARIOS = ['09:00', '10:00', '11:00', '14:00', '16:00', '17:00'];

const fechaISO = (fecha) => {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

const fechaDesdeISO = (valor) => {
  const [anio, mes, dia] = valor.split('-').map(Number);
  return new Date(anio, mes - 1, dia, 12);
};

const etiquetaFecha = (valor) => {
  const fecha = fechaDesdeISO(valor);
  return `${NOMBRES_DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
};

const construirGrilla = (anio, mes) => {
  const primerDia = new Date(anio, mes, 1).getDay();
  const desplazamiento = primerDia === 0 ? 6 : primerDia - 1;
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < desplazamiento; i += 1) celdas.push(null);
  for (let dia = 1; dia <= diasEnMes; dia += 1) celdas.push(fechaISO(new Date(anio, mes, dia, 12)));
  while (celdas.length % 7 !== 0) celdas.push(null);
  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
};

function CalendarioMensual({ fechaVisible, fechaSeleccionada, conteos = {}, onCambiarMes, onSeleccionar, compacto = false }) {
  const semanas = construirGrilla(fechaVisible.getFullYear(), fechaVisible.getMonth());
  const hoyISO = fechaISO(new Date());
  return (
    <View style={[styles.calendar, compacto && styles.calendarCompact]}>
      <View style={styles.monthHeader}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => onCambiarMes(-1)} style={styles.monthArrow}>
          <Ionicons name="chevron-back" size={20} color={colors.blanco} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{MESES[fechaVisible.getMonth()]} {fechaVisible.getFullYear()}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={() => onCambiarMes(1)} style={styles.monthArrow}>
          <Ionicons name="chevron-forward" size={20} color={colors.blanco} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekHeader}>
        {DIAS_SEMANA.map((dia, indice) => <Text key={`${dia}-${indice}`} style={styles.weekday}>{dia}</Text>)}
      </View>

      {semanas.map((semana, indiceSemana) => (
        <View key={`semana-${indiceSemana}`} style={styles.weekRow}>
          {semana.map((dia, indiceDia) => {
            if (!dia) return <View key={`vacio-${indiceSemana}-${indiceDia}`} style={[styles.dayCell, compacto && styles.dayCellCompact]} />;
            const seleccionado = dia === fechaSeleccionada;
            const esPasado = dia < hoyISO;
            const cantidad = conteos[dia] || 0;
            return (
              <TouchableOpacity
                key={dia}
                disabled={esPasado}
                accessibilityRole="button"
                accessibilityLabel={`${etiquetaFecha(dia)}${cantidad ? `, ${cantidad} Clases Presenciales` : ''}`}
                accessibilityState={{ selected: seleccionado, disabled: esPasado }}
                onPress={() => onSeleccionar(dia)}
                style={[styles.dayCell, compacto && styles.dayCellCompact, seleccionado && styles.dayCellSelected, esPasado && styles.dayCellPast]}
              >
                <Text style={[styles.dayNumber, seleccionado && styles.dayNumberSelected, compacto && styles.dayNumberCompact]}>{Number(dia.slice(-2))}</Text>
                {cantidad > 0 && <View style={[styles.dayBadge, seleccionado && styles.dayBadgeSelected]}><Text style={[styles.dayBadgeText, seleccionado && styles.dayBadgeTextSelected]}>{cantidad}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function AgendaCoach() {
  const router = useRouter();
  const hoy = new Date();
  const hoyISO = fechaISO(hoy);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoyISO);
  const [fechaVisible, setFechaVisible] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1, 12));
  const [asesorias, setAsesorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [idReagendando, setIdReagendando] = useState('');
  const [fechaReagenda, setFechaReagenda] = useState('');
  const [mesReagenda, setMesReagenda] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1, 12));
  const [horaReagenda, setHoraReagenda] = useState('');

  useFocusEffect(useCallback(() => {
    let activo = true;
    setCargando(true);
    const cargar = async () => {
      try {
        // todas las asesorías reservadas por los clientes (Atlas)
        const datos = await api('/asesorias/');
        if (activo && Array.isArray(datos)) setAsesorias(datos);
      } catch (error) {
        if (activo) Alert.alert('No se pudieron cargar las clases presenciales', error?.message || 'Revisa la conexión con el servidor.');
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => { activo = false; };
  }, []));

  const conteosPorFecha = useMemo(() => asesorias.reduce((conteos, asesoria) => {
    conteos[asesoria.fecha] = (conteos[asesoria.fecha] || 0) + 1;
    return conteos;
  }, {}), [asesorias]);

  const asesoriasDelDia = useMemo(() => asesorias
    .filter((asesoria) => asesoria.fecha === fechaSeleccionada)
    .sort((a, b) => a.hora.localeCompare(b.hora)), [asesorias, fechaSeleccionada]);

  const citaReagendando = asesorias.find((asesoria) => asesoria.id === idReagendando);

  const cambiarMesVisible = (desfase) => {
    setFechaVisible((actual) => new Date(actual.getFullYear(), actual.getMonth() + desfase, 1, 12));
  };

  const cambiarMesReagenda = (desfase) => {
    setMesReagenda((actual) => new Date(actual.getFullYear(), actual.getMonth() + desfase, 1, 12));
  };

  const seleccionarFecha = (fecha) => {
    setFechaSeleccionada(fecha);
    const seleccion = fechaDesdeISO(fecha);
    setFechaVisible(new Date(seleccion.getFullYear(), seleccion.getMonth(), 1, 12));
  };

  // confirma en Atlas; al cliente le llega el aviso "Tu asesoría fue confirmada"
  const confirmarAsesoria = async (id) => {
    try {
      const actualizada = await api(`/asesorias/${id}/`, { method: 'PATCH', body: { estado: 'confirmada' } });
      setAsesorias((lista) => lista.map((asesoria) => (asesoria.id === id ? actualizada : asesoria)));
    } catch (error) {
      Alert.alert('No se pudo confirmar', error?.message || 'Inténtalo nuevamente.');
    }
  };

  // eliminar (cancelar) la asesoría: el horario queda libre y al cliente le llega un aviso
  const eliminarAsesoria = (asesoria, nombreCliente) => {
    Alert.alert(
      'Cancelar clase presencial',
      `¿Quieres cancelar la clase de ${nombreCliente} del ${etiquetaFecha(asesoria.fecha)} a las ${asesoria.hora}? Le llegará un aviso.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/asesorias/${asesoria.id}/`, { method: 'PATCH', body: { estado: 'cancelada' } });
              setAsesorias((lista) => lista.filter((item) => item.id !== asesoria.id));
            } catch (error) {
              Alert.alert('No se pudo eliminar', error?.message || 'Inténtalo nuevamente.');
            }
          },
        },
      ]
    );
  };

  const abrirReagenda = (asesoria) => {
    setIdReagendando(asesoria.id);
    const nuevaFecha = asesoria.fecha < hoyISO ? hoyISO : asesoria.fecha;
    setFechaReagenda(nuevaFecha);
    setMesReagenda(fechaDesdeISO(nuevaFecha));
    setHoraReagenda(asesoria.hora);
  };

  const guardarReagenda = async () => {
    if (!fechaReagenda || !horaReagenda || !citaReagendando) {
      Alert.alert('Completa la nueva fecha', 'Selecciona un día y un horario para reagendar.');
      return;
    }
    if (fechaReagenda < hoyISO) {
      Alert.alert('Fecha inválida', 'No puedes reagendar una clase presencial para un día que ya pasó.');
      return;
    }
    const horarioOcupado = asesorias.some((asesoria) => (
      asesoria.id !== idReagendando && asesoria.fecha === fechaReagenda && asesoria.hora === horaReagenda
    ));
    if (horarioOcupado) {
      Alert.alert('Horario ocupado', 'Ya hay una clase presencial tomada en ese horario. Elige otro.');
      return;
    }
    // guarda el nuevo horario en Atlas; al cliente le llega un aviso para confirmarlo o pedir otro
    try {
      const actualizada = await api(`/asesorias/${idReagendando}/`, {
        method: 'PATCH',
        body: { fecha: fechaReagenda, hora: horaReagenda },
      });
      setAsesorias((lista) => lista.map((asesoria) => (asesoria.id === idReagendando ? actualizada : asesoria)));
      seleccionarFecha(fechaReagenda);
      setIdReagendando('');
    } catch (error) {
      Alert.alert(
        error?.status === 409 ? 'Horario ocupado' : 'No se pudo reagendar',
        error?.message || 'Inténtalo nuevamente.'
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_progreso.jpg')} />
      <View style={styles.page}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={23} color={colors.blanco} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Calendario de clases presenciales</Text>
              <Text style={styles.subtitle}>Revisa y organiza las horas con tus clientes</Text>
            </View>
            <LogoMarca />
          </View>

          <CalendarioMensual
            fechaVisible={fechaVisible}
            fechaSeleccionada={fechaSeleccionada}
            conteos={conteosPorFecha}
            onCambiarMes={cambiarMesVisible}
            onSeleccionar={seleccionarFecha}
          />

          <View style={styles.helpMessage}>
            <Ionicons name="logo-whatsapp" size={19} color={colors.azulClaro} />
            <Text style={styles.helpMessageText}>¡Consúltale a tu cliente por WhatsApp si deseas cambiar una hora!</Text>
          </View>

          <View style={styles.appointmentsHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Clases presenciales del día</Text>
              <Text style={styles.selectedDate}>{etiquetaFecha(fechaSeleccionada)}</Text>
            </View>
            <View style={styles.appointmentCount}><Text style={styles.appointmentCountText}>{asesoriasDelDia.length}</Text></View>
          </View>

          {cargando ? (
            <View style={styles.emptyState}><Text style={styles.emptyText}>Cargando clases presenciales…</Text></View>
          ) : asesoriasDelDia.length ? (
            <View style={styles.appointmentList}>
              {asesoriasDelDia.map((asesoria) => {
                const nombreCliente = asesoria.clienteNombre || 'Cliente';
                const confirmada = asesoria.estado === 'confirmada';
                const textoEstado = confirmada
                  ? 'Confirmada'
                  : asesoria.estado === 'reagendada_por_entrenador'
                    ? 'Espera al cliente'
                    : asesoria.estado === 'reagendada_por_cliente'
                      ? 'Cambio del cliente'
                      : 'Pendiente';
                return (
                  <View key={asesoria.id} style={styles.appointmentCard}>
                    <View style={styles.appointmentTop}>
                      <View style={styles.clientAvatar}><Text style={styles.clientInitials}>{nombreCliente.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('')}</Text></View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={styles.clientName}>{nombreCliente}</Text>
                        <Text style={styles.appointmentId}>Clase presencial #{String(asesoria.id).slice(-6).toUpperCase()}</Text>
                      </View>
                      <View style={[styles.statusChip, confirmada ? styles.statusConfirmed : styles.statusPending]}>
                        <Text style={[styles.statusText, confirmada ? styles.statusConfirmedText : styles.statusPendingText]}>{textoEstado}</Text>
                      </View>
                    </View>

                    <View style={styles.dateTimeRow}>
                      <View style={styles.dateTimeItem}>
                        <Ionicons name="calendar-outline" size={16} color={colors.azulClaro} />
                        <Text style={styles.dateTimeText}>{etiquetaFecha(asesoria.fecha)}</Text>
                      </View>
                      <View style={styles.dateTimeItem}>
                        <Ionicons name="time-outline" size={16} color={colors.azulClaro} />
                        <Text style={styles.dateTimeText}>{asesoria.hora}</Text>
                      </View>
                    </View>

                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        disabled={confirmada}
                        onPress={() => confirmarAsesoria(asesoria.id)}
                        style={[styles.confirmButton, confirmada && styles.confirmButtonDone]}
                      >
                        <Ionicons name={confirmada ? 'checkmark-circle' : 'checkmark'} size={17} color={confirmada ? colors.verde : colors.blanco} />
                        <Text style={[styles.confirmButtonText, confirmada && styles.confirmButtonTextDone]}>{confirmada ? 'Confirmada' : 'Confirmar'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity accessibilityRole="button" onPress={() => abrirReagenda(asesoria)} style={styles.rescheduleButton}>
                        <Ionicons name="create-outline" size={17} color={colors.azulClaro} />
                        <Text style={styles.rescheduleButtonText}>Modificar hora</Text>
                      </TouchableOpacity>
                    </View>

                    {/* hablarlo por WhatsApp o eliminar la asesoría */}
                    <View style={[styles.actionsRow, { marginTop: 8 }]}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => escribirleAlCliente(asesoria.clienteId)}
                        style={[styles.rescheduleButton, { borderColor: colors.verde }]}
                      >
                        <Ionicons name="logo-whatsapp" size={17} color={colors.verde} />
                        <Text style={[styles.rescheduleButtonText, { color: colors.verde }]}>WhatsApp</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Cancelar clase presencial de ${nombreCliente}`}
                        onPress={() => eliminarAsesoria(asesoria, nombreCliente)}
                        style={[styles.rescheduleButton, { borderColor: colors.rojo, paddingHorizontal: 8, minWidth: 0 }]}
                      >
                        <Ionicons name="trash-outline" size={17} color={colors.rojo} style={{ flexShrink: 0 }} />
                        <Text style={[styles.rescheduleButtonText, { color: colors.rojo, flexShrink: 1 }]}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-clear-outline" size={30} color={colors.azulClaro} />
              <Text style={styles.emptyTitle}>Sin clases presenciales este día</Text>
              <Text style={styles.emptyText}>Elige otra fecha para revisar las horas tomadas.</Text>
            </View>
          )}
        </ScrollView>
      </View>
      <Boton_barra_coach active="agenda" />

      <Modal visible={!!idReagendando} transparent animationType="fade" onRequestClose={() => setIdReagendando('')}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Modificar hora de la clase presencial</Text>
                <Text style={styles.modalSubtitle}>{citaReagendando ? citaReagendando.clienteNombre || 'Cliente' : ''} · Elige un nuevo día y horario.</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Cerrar" onPress={() => setIdReagendando('')} style={styles.modalClose}>
                <Ionicons name="close" size={21} color={colors.gris} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rescheduleContent}>
              <CalendarioMensual
                compacto
                fechaVisible={mesReagenda}
                fechaSeleccionada={fechaReagenda}
                onCambiarMes={cambiarMesReagenda}
                onSeleccionar={setFechaReagenda}
              />
              <Text style={styles.timeHeading}>Nuevo horario</Text>
              <View style={styles.timeGrid}>
                {HORARIOS.map((hora) => {
                  const activo = horaReagenda === hora;
                  const ocupado = asesorias.some((asesoria) => (
                    asesoria.id !== idReagendando && asesoria.fecha === fechaReagenda && asesoria.hora === hora
                  ));
                  return (
                    <TouchableOpacity key={hora} disabled={ocupado} onPress={() => setHoraReagenda(hora)} style={[styles.timeChip, activo && styles.timeChipActive, ocupado && styles.timeChipDisabled]}>
                      <Text style={[styles.timeChipText, activo && styles.timeChipTextActive]}>{hora}</Text>
                      {ocupado && <Text style={styles.timeChipBusyText}>Ocupado</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setIdReagendando('')} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={guardarReagenda} style={styles.saveButton}><Text style={styles.saveText}>Guardar cambio</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = {
  page: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  content: { paddingBottom: 20 },
  header: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  backButton: { width: 36, height: 42, alignItems: 'flex-start', justifyContent: 'center' },
  title: { color: colors.blanco, fontSize: 21, fontFamily: 'SundayMasthead-Regular' },
  subtitle: { color: colors.gris, fontSize: 15, lineHeight: 20, marginTop: 4 },
  calendar: { marginHorizontal: 18, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.grafito },
  calendarCompact: { marginHorizontal: 0, padding: 10, borderRadius: 12 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.carbon },
  monthTitle: { color: colors.blanco, fontSize: 16, fontWeight: '700' },
  weekHeader: { flexDirection: 'row', marginBottom: 6 },
  weekday: { flex: 1, color: colors.gris, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  dayCell: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 11, gap: 2 },
  dayCellCompact: { height: 39, borderRadius: 9 },
  dayCellPast: { opacity: 0.25 },
  dayCellSelected: { backgroundColor: colors.verde }, // mismo verde que el calendario del cliente (agendar.jsx)
  dayNumber: { color: colors.blanco, fontSize: 14, fontWeight: '600' },
  dayNumberCompact: { fontSize: 15 },
  dayNumberSelected: { color: colors.blanco, fontWeight: '800' },
  dayBadge: { minWidth: 15, height: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderRadius: 8, backgroundColor: colors.azulOscuro },
  dayBadgeSelected: { backgroundColor: colors.blanco },
  dayBadgeText: { color: colors.blanco, fontSize: 12, fontWeight: '700' },
  dayBadgeTextSelected: { color: colors.azulOscuro },
  helpMessage: { flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 18, marginTop: 12, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 11, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.grafito },
  helpMessageText: { flex: 1, color: colors.blanco, fontSize: 15, lineHeight: 21 },
  appointmentsHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 22, marginBottom: 12 },
  sectionTitle: { color: colors.blanco, fontSize: 17, fontWeight: '700' },
  selectedDate: { color: colors.gris, fontSize: 16, textTransform: 'capitalize', marginTop: 4 },
  appointmentCount: { minWidth: 30, height: 30, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 15, backgroundColor: colors.azulOscuro },
  appointmentCountText: { color: colors.blanco, fontSize: 16, fontWeight: '700' },
  appointmentList: { paddingHorizontal: 18, gap: 11 },
  appointmentCard: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.grafito },
  appointmentTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clientAvatar: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.azulOscuro },
  clientInitials: { color: colors.blanco, fontSize: 15, fontWeight: '800' },
  clientName: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
  appointmentId: { color: colors.gris, fontSize: 14, marginTop: 3 },
  statusChip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99 },
  statusConfirmed: { backgroundColor: 'rgba(60, 206, 12, 0.13)' },
  statusPending: { backgroundColor: 'rgba(47, 111, 224, 0.2)' },
  statusText: { fontSize: 13, fontWeight: '700' },
  statusConfirmedText: { color: colors.verde },
  statusPendingText: { color: colors.azulClaro },
  dateTimeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 14, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(138, 147, 163, 0.18)' },
  dateTimeItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dateTimeText: { color: colors.blanco, fontSize: 16, textTransform: 'capitalize' },
  actionsRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  confirmButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: colors.azulClaro },
  confirmButtonDone: { backgroundColor: colors.carbon, borderWidth: 1, borderColor: 'rgba(60, 206, 12, 0.45)' },
  confirmButtonText: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
  confirmButtonTextDone: { color: colors.verde },
  rescheduleButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.azulClaro },
  rescheduleButtonText: { color: colors.azulClaro, fontSize: 15, fontWeight: '700' },
  emptyState: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  emptyTitle: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
  emptyText: { color: colors.gris, fontSize: 16, textAlign: 'center', lineHeight: 22 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 15, backgroundColor: 'rgba(0, 0, 0, 0.75)' },
  modalCard: { width: '100%', maxWidth: 520, maxHeight: '94%', overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.grafito },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  modalTitle: { color: colors.blanco, fontSize: 17, fontFamily: 'SundayMasthead-Regular' },
  modalSubtitle: { color: colors.gris, fontSize: 14, lineHeight: 19, marginTop: 4, textTransform: 'capitalize' },
  modalClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  rescheduleContent: { paddingHorizontal: 16, paddingBottom: 6 },
  timeHeading: { color: colors.blanco, fontSize: 16, fontWeight: '700', marginTop: 15, marginBottom: 9 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { minWidth: 75, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.azulOscuro, backgroundColor: colors.carbon },
  timeChipActive: { borderColor: colors.azulClaro, backgroundColor: colors.azulOscuro },
  timeChipDisabled: { opacity: 0.4 },
  timeChipText: { color: colors.gris, fontSize: 15, fontWeight: '600' },
  timeChipTextActive: { color: colors.blanco },
  timeChipBusyText: { color: colors.gris, fontSize: 12, marginTop: 1 },
  modalActions: { flexDirection: 'row', gap: 9, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  cancelButton: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: colors.azulOscuro },
  cancelText: { color: colors.gris, fontSize: 15, fontWeight: '700' },
  saveButton: { flex: 1.3, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.azulClaro },
  saveText: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
};
