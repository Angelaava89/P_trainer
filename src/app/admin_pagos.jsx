import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import AdminShell, { adminColors as c } from '../components/AdminShell';
import { formatearPrecio, plans } from '../constants/index';
import '../global.css';
import { apiAdmin, cerrarSesionAdmin } from '../lib/admin';
import { irSinHistorial } from '../lib/navegacion';
import FondoThomas from '../components/FondoThomas';

// Planes de la app convertidos a los campos de la colección "planes" (nombre, precio, detalle).
// Se muestran mientras el servidor no tenga la ruta /admin/planes/.
const planesDeLaApp = plans.map((plan) => ({
  id: plan.id,
  nombre: plan.title,
  precio: plan.precio,
  detalle: plan.checklist.join(', '),
  local: true,
}));

const precioNumero = (valor) => Number(String(valor ?? '').replace(/[^0-9]/g, '')) || 0;

// Pantalla informativa de pagos: hoy muestra planes y avisa que el checkout es demostrativo.
export default function AdminPagos() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [integrados, setIntegrados] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const anchoContenido = width >= 760 ? 28 : 16;
  const colorEstado = integrados ? c.success : c.blue;
  const fondoEstado = integrados ? c.successSoft : c.blueSoft;

  // CRUD de planes (GET/POST /admin/planes/ y PATCH/DELETE /admin/planes/<id>/).
  const [listaPlanes, setListaPlanes] = useState(planesDeLaApp);
  const [planesDelServidor, setPlanesDelServidor] = useState(false);
  const [planEditando, setPlanEditando] = useState(null); // { id?, nombre, precio, detalle } o null
  const [planBorrando, setPlanBorrando] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');
  const [aviso, setAviso] = useState('');

  const mensajeFallo = (fallo, accion) => {
    if (fallo?.status === 404 || fallo?.status === 405) {
      return `El servidor todavía no permite ${accion} planes. Falta la ruta /admin/planes/ en el backend.`;
    }
    return fallo?.message || `No se pudo ${accion} el plan.`;
  };

  const cargarPlanes = useCallback(async () => {
    try {
      const datos = await apiAdmin('/admin/planes/');
      const lista = Array.isArray(datos) ? datos : datos?.planes;
      if (Array.isArray(lista)) {
        setListaPlanes(lista.map((p) => ({ ...p, id: String(p.id ?? p._id ?? p.pk) })));
        setPlanesDelServidor(true);
        return;
      }
    } catch {}
    setListaPlanes(planesDeLaApp);
    setPlanesDelServidor(false);
  }, []);

  const abrirNuevoPlan = () => {
    setErrorAccion('');
    setPlanEditando({ nombre: '', precio: '', detalle: '' });
  };

  const abrirEdicionPlan = (plan) => {
    setErrorAccion('');
    setPlanEditando({ id: plan.id, nombre: plan.nombre || '', precio: String(precioNumero(plan.precio) || ''), detalle: plan.detalle || '' });
  };

  const guardarPlan = async () => {
    if (procesando || !planEditando) return;
    const nombre = planEditando.nombre.trim();
    const precio = precioNumero(planEditando.precio);
    const detalle = planEditando.detalle.trim().slice(0, 200);
    if (!nombre) return setErrorAccion('Ingresa el nombre del plan.');
    if (precio <= 0) return setErrorAccion('Ingresa un precio mayor a 0.');
    const cuerpo = { nombre, precio, detalle };
    const esNuevo = !planEditando.id;
    setProcesando(true);
    try {
      const respuesta = esNuevo
        ? await apiAdmin('/admin/planes/', { method: 'POST', body: cuerpo })
        : await apiAdmin(`/admin/planes/${planEditando.id}/`, { method: 'PATCH', body: cuerpo });
      if (esNuevo) {
        const id = String(respuesta?.id ?? respuesta?._id ?? `nuevo-${Date.now()}`);
        setListaPlanes((lista) => [...lista, { ...cuerpo, id }]);
      } else {
        setListaPlanes((lista) => lista.map((p) => (p.id === planEditando.id ? { ...p, ...cuerpo } : p)));
      }
      setPlanEditando(null);
      setAviso(esNuevo ? 'Plan agregado.' : 'Plan actualizado.');
    } catch (fallo) {
      setErrorAccion(mensajeFallo(fallo, esNuevo ? 'agregar' : 'editar'));
    } finally {
      setProcesando(false);
    }
  };

  const confirmarBorradoPlan = async () => {
    if (procesando || !planBorrando) return;
    setProcesando(true);
    try {
      await apiAdmin(`/admin/planes/${planBorrando.id}/`, { method: 'DELETE' });
      setListaPlanes((lista) => lista.filter((p) => p.id !== planBorrando.id));
      setPlanBorrando(null);
      setAviso('Plan eliminado.');
    } catch (fallo) {
      setErrorAccion(mensajeFallo(fallo, 'borrar'));
    } finally {
      setProcesando(false);
    }
  };

  // Reutiliza el estado del resumen porque el backend aún no expone un módulo de transacciones.
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await apiAdmin('/admin/resumen/');
      setIntegrados(Boolean(datos.pagos_integrados));
      setError('');
    } catch (fallo) {
      if (fallo.status === 401 || fallo.status === 403) {
        await cerrarSesionAdmin();
        irSinHistorial(router, '/login');
      } else {
        setError(fallo.message || 'No se pudo verificar el estado de pagos.');
      }
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarPlanes(); }, [cargarPlanes]);

  return (
    <AdminShell active="pagos" title="Pagos y suscripciones" cabeceraGrande>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_perfil_profesional.jpg')} />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => { cargar(); cargarPlanes(); }} tintColor={c.primary} />}
        contentContainerStyle={{ paddingHorizontal: anchoContenido, paddingTop: 20, paddingBottom: 26, width: '100%', maxWidth: 1320, alignSelf: 'center' }}
      >
        <View style={styles.headingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>Pagos y suscripciones</Text>
            <Text style={styles.subtitle}>Estado del checkout y planes disponibles en la app.</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Actualizar estado" onPress={cargar} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={23} color={c.primary} />
          </TouchableOpacity>
        </View>

        {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

        {integrados === null ? (
          <View style={styles.emptyBox}>
            {cargando
              ? <ActivityIndicator color={c.primary} />
              : <><Text style={styles.bodyText}>No se pudo verificar el estado de pagos.</Text><TouchableOpacity onPress={cargar}><Text style={styles.link}>Reintentar</Text></TouchableOpacity></>}
          </View>
        ) : (
          <>
            <View style={styles.statusCard}>
              <View style={[styles.statusIcon, { backgroundColor: fondoEstado }]}>
                <Ionicons name={integrados ? 'checkmark-circle-outline' : 'time-outline'} size={26} color={colorEstado} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{integrados ? 'Pasarela conectada' : 'Pagos por integrar'}</Text>
                <Text style={styles.cardNote}>{integrados ? 'El backend informa que hay una pasarela conectada.' : 'El checkout actual es una demostración.'}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: fondoEstado }]}>
                <Text style={[styles.statusBadgeText, { color: colorEstado }]}>{integrados ? 'Conectada' : 'Pendiente'}</Text>
              </View>
            </View>

            <View style={styles.noteCard}>
              <Ionicons name="information-circle-outline" size={22} color={c.primary} />
              <Text style={styles.bodyText}>
                {integrados
                  ? 'La pasarela está conectada. El panel mostrará transacciones cuando el backend exponga ese historial.'
                  : 'No se realizan cobros reales ni se guardan ventas todavía. Para habilitarlo falta integrar una pasarela de pago.'}
              </Text>
            </View>

            <View style={[styles.sectionHeading, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Planes disponibles</Text>
                <Text style={styles.sectionNote}>Precios configurados actualmente en la app</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Agregar plan" onPress={abrirNuevoPlan} style={styles.addButton}>
                <Ionicons name="add" size={20} color={c.text} />
                <Text style={styles.addButtonText}>Agregar plan</Text>
              </TouchableOpacity>
            </View>
            {!planesDelServidor && (
              <Text style={[styles.sectionNote, { marginBottom: 8 }]}>
                Se muestran los planes de la app: el servidor todavía no entrega la lista de planes.
              </Text>
            )}
            {!!aviso && (
              <TouchableOpacity onPress={() => setAviso('')} style={styles.successBox}>
                <Ionicons name="checkmark-circle-outline" size={16} color={c.success} />
                <Text style={styles.successText}>{aviso}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.planList}>
              {listaPlanes.map((plan) => (
                <View key={plan.id} style={styles.planRow}>
                  <View style={styles.planIcon}><Ionicons name="barbell-outline" size={20} color={c.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.planName}>{plan.nombre}</Text>
                    <Text style={styles.planPeriod}>Plan trimestral</Text>
                  </View>
                  <Text style={styles.planPrice}>{formatearPrecio(precioNumero(plan.precio))}</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ${plan.nombre}`}
                    onPress={() => abrirEdicionPlan(plan)}
                    style={styles.actionButton}
                  >
                    <Ionicons name="create-outline" size={19} color={c.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Borrar ${plan.nombre}`}
                    onPress={() => { setErrorAccion(''); setPlanBorrando(plan); }}
                    style={[styles.actionButton, { borderColor: c.dangerSoft }]}
                  >
                    <Ionicons name="trash-outline" size={19} color={c.danger} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Ver ${plan.nombre}`}
                    onPress={() => router.push({ pathname: '/metodo_pago', params: { id: plan.id } })}
                    style={styles.planArrow}
                  >
                    <Ionicons name="chevron-forward" size={19} color={c.muted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <Text style={styles.footnote}>La experiencia de compra del cliente también está marcada como demostración.</Text>
          </>
        )}
      </ScrollView>

      {/* Agregar o editar un plan */}
      <Modal visible={!!planEditando} transparent animationType="fade" onRequestClose={() => setPlanEditando(null)}>
        <View style={styles.modalFondo}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modalCaja}>
              <Text style={styles.modalTitulo}>{planEditando?.id ? 'Editar plan' : 'Agregar plan'}</Text>
              <Text style={styles.modalSubtitulo}>Todos los planes son trimestrales.</Text>

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Nombre</Text>
              <TextInput
                value={planEditando?.nombre ?? ''}
                onChangeText={(v) => setPlanEditando((p) => ({ ...p, nombre: v }))}
                placeholder="Ej: PLAN BÁSICO"
                placeholderTextColor={c.muted}
                style={styles.input}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Precio del trimestre (CLP)</Text>
              <TextInput
                value={planEditando?.precio ?? ''}
                onChangeText={(v) => setPlanEditando((p) => ({ ...p, precio: v.replace(/[^0-9]/g, '') }))}
                placeholder="19990"
                placeholderTextColor={c.muted}
                keyboardType="number-pad"
                style={styles.input}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Detalle (beneficios separados por coma)</Text>
              <TextInput
                value={planEditando?.detalle ?? ''}
                onChangeText={(v) => setPlanEditando((p) => ({ ...p, detalle: v }))}
                placeholder="Rutina personalizada, Dieta personalizada"
                placeholderTextColor={c.muted}
                multiline
                maxLength={200}
                style={[styles.input, { height: 90, paddingTop: 10, textAlignVertical: 'top' }]}
              />

              {!!errorAccion && <Text style={[styles.errorText, { marginTop: 12 }]}>{errorAccion}</Text>}

              <View style={styles.modalBotones}>
                <TouchableOpacity onPress={() => setPlanEditando(null)} style={styles.botonSecundario}>
                  <Text style={styles.botonSecundarioTexto}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={guardarPlan} disabled={procesando} style={[styles.botonPrimario, procesando && { opacity: 0.6 }]}>
                  {procesando ? <ActivityIndicator color={c.text} /> : <Text style={styles.botonPrimarioTexto}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Confirmación antes de borrar un plan */}
      <Modal visible={!!planBorrando} transparent animationType="fade" onRequestClose={() => setPlanBorrando(null)}>
        <View style={styles.modalFondo}>
          <View style={styles.modalCaja}>
            <Ionicons name="warning-outline" size={28} color={c.danger} />
            <Text style={[styles.modalTitulo, { marginTop: 8 }]}>¿Borrar plan?</Text>
            <Text style={styles.modalSubtitulo}>
              Se eliminará {planBorrando?.nombre || 'este plan'}. Los clientes que ya lo contrataron conservan su historial.
            </Text>
            {!!errorAccion && <Text style={[styles.errorText, { marginTop: 12 }]}>{errorAccion}</Text>}
            <View style={styles.modalBotones}>
              <TouchableOpacity onPress={() => setPlanBorrando(null)} style={styles.botonSecundario}>
                <Text style={styles.botonSecundarioTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmarBorradoPlan} disabled={procesando} style={[styles.botonPrimario, { backgroundColor: c.danger }, procesando && { opacity: 0.6 }]}>
                {procesando ? <ActivityIndicator color={c.text} /> : <Text style={styles.botonPrimarioTexto}>Borrar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

// Los estilos mantienen tarjetas legibles en móvil y aprovechan más ancho en pantallas grandes.
const styles = {
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 17 },
  heading: { color: c.text, fontSize: 25, fontFamily: 'SundayMasthead-Regular' },
  subtitle: { color: c.muted, fontSize: 14, marginTop: 4, lineHeight: 19 },
  refreshButton: { width: 46, height: 46, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 18 },
  statusIcon: { width: 48, height: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  cardNote: { color: c.muted, fontSize: 14, marginTop: 4, lineHeight: 19 },
  statusBadge: { borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 },
  statusBadgeText: { fontSize: 14, fontWeight: '700' },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: c.primarySoft, borderRadius: 10, padding: 15, marginTop: 11 },
  bodyText: { flex: 1, color: c.muted, fontSize: 14, lineHeight: 20 },
  sectionHeading: { marginTop: 23, marginBottom: 10 },
  sectionTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  sectionNote: { color: c.muted, fontSize: 14, marginTop: 3 },
  planList: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 15 },
  planRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 10 },
  planIcon: { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
  planName: { color: c.text, fontSize: 13, fontWeight: '700' },
  planPeriod: { color: c.muted, fontSize: 13, marginTop: 4 },
  planPrice: { color: c.primary, fontSize: 13, fontWeight: '700' },
  planArrow: { width: 24, alignItems: 'flex-end' },
  footnote: { color: c.muted, fontSize: 14, marginTop: 11, lineHeight: 19 },
  emptyBox: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 20 },
  errorBox: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.dangerSoft, borderRadius: 9, padding: 11, marginBottom: 10 },
  errorText: { color: c.danger, fontSize: 14 },
  link: { color: c.primary, fontSize: 14, fontWeight: '700' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 16, height: 44 },
  addButtonText: { color: c.text, fontSize: 14, fontWeight: '800' },
  actionButton: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.successSoft, borderRadius: 9, padding: 11, marginBottom: 10 },
  successText: { color: c.success, fontSize: 14, fontWeight: '600' },
  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modalCaja: { width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 18 },
  modalTitulo: { color: c.text, fontSize: 19, fontWeight: '800' },
  modalSubtitulo: { color: c.muted, fontSize: 14, marginTop: 4 },
  inputLabel: { color: c.muted, fontSize: 14, marginBottom: 6 },
  input: { height: 50, color: c.text, fontSize: 17, backgroundColor: c.background, borderWidth: 1, borderColor: c.line, borderRadius: 9, paddingHorizontal: 12 },
  modalBotones: { flexDirection: 'row', gap: 10, marginTop: 18 },
  botonSecundario: { flex: 1, height: 50, borderRadius: 10, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  botonSecundarioTexto: { color: c.text, fontWeight: '700' },
  botonPrimario: { flex: 1, height: 50, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  botonPrimarioTexto: { color: c.text, fontWeight: '800' },
};
