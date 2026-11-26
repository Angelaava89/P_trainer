import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import AdminShell, { adminColors as c } from '../components/AdminShell';
import '../global.css';
import { apiAdmin, cerrarSesionAdmin } from '../lib/admin';
import { irSinHistorial } from '../lib/navegacion';
import FondoThomas from '../components/FondoThomas';

// Inicio del panel: resume las cuentas y el estado informativo de pagos.
const numero = (valor) => new Intl.NumberFormat('es-CL').format(Number(valor || 0));

function iniciales(nombre = '') {
  return nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0] || '').join('').toUpperCase() || 'U';
}

function fechaCorta(valor) {
  if (!valor) return 'Fecha no disponible';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return 'Fecha no disponible';
  return fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

function StatCard({ icon, label, value, tone, footnote }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statTop}>
        <Text style={styles.mutedSmall}>{label}</Text>
        <View style={[styles.statIcon, { backgroundColor: tone.soft }]}>
          <Ionicons name={icon} size={22} color={tone.strong} />
        </View>
      </View>
      <Text style={styles.statValue}>{value == null ? '—' : numero(value)}</Text>
      <Text style={styles.statFoot}>{footnote || 'Registros actuales'}</Text>
    </View>
  );
}

export default function Admin() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const anchoPanel = width >= 960;
  const anchoContenido = width >= 760 ? 28 : 16;
  const statWidth = width >= 1220 ? '32%' : '48.5%';

  // La API limita el acceso a administradores; si la sesión venció se vuelve al acceso.
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await apiAdmin('/admin/resumen/');
      setResumen(datos);
      setError('');
    } catch (fallo) {
      if (fallo.status === 401 || fallo.status === 403) {
        await cerrarSesionAdmin();
        irSinHistorial(router, '/login');
      } else {
        setError(fallo.message || 'No se pudo cargar el panel.');
      }
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => { cargar(); }, [cargar]);

  // Las métricas vienen del backend; la vista previa devuelve valores vacíos.
  const tarjetas = resumen ? [
    { icon: 'people-outline', label: 'Usuarios registrados', value: resumen.usuarios_total, tone: { strong: c.primary, soft: c.primarySoft } },
    { icon: 'person-outline', label: 'Clientes', value: resumen.clientes, tone: { strong: c.blue, soft: c.blueSoft } },
    { icon: 'barbell-outline', label: 'Profesionales', value: resumen.profesionales, tone: { strong: c.sky, soft: c.skySoft } },
    {
      icon: 'cart-outline',
      label: 'Rutinas vendidas',
      value: resumen.rutinas_vendidas,
      footnote: resumen.rutinas_vendidas_disponible ? 'Compras registradas en BD' : 'Compras aún no guardadas en BD',
      tone: { strong: c.success, soft: c.successSoft },
    },
    { icon: 'layers-outline', label: 'Planes básicos', value: resumen.planes_basicos, tone: { strong: c.primary, soft: c.primarySoft } },
    { icon: 'trophy-outline', label: 'Planes avanzados', value: resumen.planes_avanzados, tone: { strong: c.danger, soft: c.dangerSoft } },
  ] : [];
  const tonoPagos = resumen?.pagos_integrados
    ? { color: c.success, fondo: c.successSoft }
    : { color: c.blue, fondo: c.blueSoft };

  return (
    <AdminShell active="resumen" title="Resumen">
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_registro.jpg')} />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={c.primary} />}
        contentContainerStyle={{ paddingHorizontal: anchoContenido, paddingTop: 22, paddingBottom: 28, width: '100%', maxWidth: 1320, alignSelf: 'center' }}
      >
        <View style={styles.headingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>Resumen general</Text>
            <Text style={styles.subtitle}>Datos actuales de tu app.</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={cargar} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={22} color={c.primary} />
            <Text style={styles.refreshText}>Actualizar</Text>
          </TouchableOpacity>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={cargar} style={{ marginTop: 9 }}><Text style={styles.link}>Reintentar</Text></TouchableOpacity>
          </View>
        )}

        {!resumen ? (
          <View style={styles.emptyBox}>
            {cargando
              ? <><ActivityIndicator color={c.primary} /><Text style={styles.emptyText}>Cargando datos del servidor…</Text></>
              : <Text style={styles.emptyText}>El panel todavía no pudo cargar datos.</Text>}
          </View>
        ) : (
          <>
            <View style={styles.stats}>
              {tarjetas.map((tarjeta) => (
                <View key={tarjeta.label} style={{ width: statWidth, marginBottom: 10 }}>
                  <StatCard {...tarjeta} />
                </View>
              ))}
            </View>

            <View style={[styles.panelRow, !anchoPanel && { flexDirection: 'column' }]}>
              <View style={[styles.panel, anchoPanel ? { flex: 1.35 } : null]}>
                <View style={styles.panelHeading}>
                  <View style={[styles.panelIcon, { backgroundColor: tonoPagos.fondo }]}>
                    <Ionicons name="card-outline" size={23} color={tonoPagos.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.panelTitle}>Pagos y suscripciones</Text>
                    <Text style={styles.panelNote}>Estado del checkout y planes publicados</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: tonoPagos.fondo }]}>
                    <Text style={[styles.statusText, { color: tonoPagos.color }]}>
                      {resumen.pagos_integrados ? 'Conectado' : 'Pendiente'}
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <Text style={styles.bodyText}>
                  {resumen.pagos_integrados
                    ? 'La pasarela está conectada. El historial de transacciones aún no está disponible en el panel.'
                    : 'La compra actual es una demostración y todavía no procesa cobros reales.'}
                </Text>
                <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/admin_pagos')} style={styles.linkRow}>
                  <Text style={styles.link}>Ver planes y estado</Text>
                  <Ionicons name="chevron-forward" size={19} color={c.primary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.panel, anchoPanel ? { flex: 1 } : null]}>
                <View style={styles.panelHeading}>
                  <View style={[styles.panelIcon, { backgroundColor: c.blueSoft }]}>
                    <Ionicons name="calendar-outline" size={23} color={c.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.panelTitle}>Actividad reciente</Text>
                    <Text style={styles.panelNote}>Cuentas creadas en los últimos 30 días</Text>
                  </View>
                </View>
                <Text style={styles.activityCount}>{numero(resumen.nuevos_30_dias)}</Text>
                <Text style={styles.activityCaption}>nuevas cuentas registradas</Text>
                <View style={styles.activityProgressTrack}>
                  <View style={[styles.activityProgressFill, { width: resumen.usuarios_total ? `${Math.min(100, (resumen.nuevos_30_dias / resumen.usuarios_total) * 100)}%` : '0%' }]} />
                </View>
                <Text style={styles.panelNote}>Sobre {numero(resumen.usuarios_total)} cuentas totales</Text>
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeading}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.panelTitle}>Usuarios recientes</Text>
                  <Text style={styles.panelNote}>Últimas cuentas creadas</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/admin_usuarios')}>
                  <Text style={styles.link}>Ver todos</Text>
                </TouchableOpacity>
              </View>
              {(resumen.usuarios_recientes || []).map((usuario) => (
                <View key={usuario.id} style={styles.userRow}>
                  <View style={styles.userAvatar}><Text style={styles.userInitials}>{iniciales(usuario.nombre)}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.userName}>{usuario.nombre || 'Sin nombre'}</Text>
                    <Text numberOfLines={1} style={styles.userEmail}>{usuario.correo}</Text>
                  </View>
                  <Text style={styles.userDate}>{fechaCorta(usuario.creado)}</Text>
                </View>
              ))}
              {(!resumen.usuarios_recientes || resumen.usuarios_recientes.length === 0) && (
                <Text style={[styles.bodyText, { paddingTop: 16 }]}>Todavía no hay cuentas registradas en el backend.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </AdminShell>
  );
}

// Los tamaños de las tarjetas se calculan arriba según el ancho disponible.
const styles = {
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  heading: { color: c.text, fontSize: 27, fontFamily: 'SundayMasthead-Regular' },
  subtitle: { color: c.muted, fontSize: 15, marginTop: 4 },
  refreshButton: { minHeight: 46, borderWidth: 1, borderColor: c.line, borderRadius: 8, backgroundColor: c.surface, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshText: { color: c.text, fontSize: 14, fontWeight: '600' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 4 },
  statCard: { width: '100%', minHeight: 136, padding: 18, borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: c.surface },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mutedSmall: { flex: 1, color: c.muted, fontSize: 14 },
  statIcon: { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: c.text, fontSize: 26, fontWeight: '700', marginTop: 11 },
  statFoot: { color: c.muted, fontSize: 14, marginTop: 4 },
  panelRow: { flexDirection: 'row', gap: 13, marginBottom: 13 },
  panel: { minWidth: 0, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 19, marginBottom: 13 },
  panelHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  panelTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  panelNote: { color: c.muted, fontSize: 14, marginTop: 3, lineHeight: 19 },
  statusBadge: { borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 },
  statusText: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1, backgroundColor: c.line, marginVertical: 14 },
  bodyText: { color: c.muted, fontSize: 14, lineHeight: 21 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginTop: 12 },
  link: { color: c.primary, fontSize: 14, fontWeight: '700' },
  activityCount: { color: c.text, fontSize: 32, fontWeight: '700', marginTop: 17 },
  activityCaption: { color: c.muted, fontSize: 14, marginTop: 2 },
  activityProgressTrack: { height: 8, borderRadius: 99, backgroundColor: c.blueSoft, marginTop: 14, marginBottom: 8, overflow: 'hidden' },
  activityProgressFill: { height: '100%', borderRadius: 99, backgroundColor: c.blue },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line },
  userAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.blueSoft },
  userInitials: { color: c.blue, fontSize: 14, fontWeight: '800' },
  userName: { color: c.text, fontSize: 14, fontWeight: '700' },
  userEmail: { color: c.muted, fontSize: 14, marginTop: 2 },
  userDate: { color: c.muted, fontSize: 14, marginLeft: 4 },
  errorBox: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.dangerSoft, borderRadius: 10, padding: 13, marginBottom: 12 },
  errorText: { color: c.danger, fontSize: 14, lineHeight: 20 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', minHeight: 170, gap: 10, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.line },
  emptyText: { color: c.muted, fontSize: 14 },
};
