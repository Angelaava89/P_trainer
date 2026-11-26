import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import AdminShell, { adminColors as c } from '../components/AdminShell';
import '../global.css';
import { apiAdmin, cerrarSesionAdmin } from '../lib/admin';
import { irSinHistorial } from '../lib/navegacion';
import FondoThomas from '../components/FondoThomas';

// Lista de cuentas del backend con filtros por rol y búsqueda local por nombre/correo.
const filtros = [
  { key: 'todos', label: 'Todos' },
  { key: 'cliente', label: 'Clientes' },
  { key: 'profesional', label: 'Profesionales' },
  { key: 'admin', label: 'Administradores' },
];

// Roles que puede asignar el administrador. "tipo" es el valor que guarda la base de datos (tipo_usuario).
const rolesEditables = [
  { key: 'cliente', label: 'Cliente', tipo: 'Alumno' },
  { key: 'profesional', label: 'Profesional', tipo: 'Profesor' },
  { key: 'admin', label: 'Administrador', tipo: 'Admin' },
];

// Planes que se pueden asignar a un cliente con la ruta existente POST /planes/asignar/ ({ alumno_id, nivel }).
const planesAsignables = [
  { nivel: 'inicial', label: 'Básico' },
  { nivel: 'avanzado', label: 'Avanzado' },
];

// Reconoce el nivel a partir del nombre del plan que entrega el servidor.
const nivelDePlan = (nombre = '') => {
  const texto = String(nombre || '').toLowerCase();
  if (texto.includes('avanz')) return 'avanzado';
  if (texto.includes('princip') || texto.includes('básic') || texto.includes('basic') || texto.includes('inicial')) return 'inicial';
  return '';
};

const rolVisible = (rol) => ({ admin: 'Administrador', profesional: 'Profesional', cliente: 'Cliente' }[rol] || 'Cliente');

function iniciales(nombre = '') {
  return nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0] || '').join('').toUpperCase() || 'U';
}

function fechaCorta(valor) {
  if (!valor) return 'Fecha no disponible';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return 'Fecha no disponible';
  return fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminUsuarios() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [usuarios, setUsuarios] = useState([]);
  const [total, setTotal] = useState(0);
  const [limite, setLimite] = useState(100);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  // Edición y borrado de usuarios (PATCH / DELETE /admin/usuarios/<id>/).
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [formulario, setFormulario] = useState({ nombre: '', rut: '', correo: '', edad: '', rol: 'cliente', nivelPlan: '' });
  const [usuarioBorrando, setUsuarioBorrando] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await apiAdmin('/admin/usuarios/');
      setUsuarios(datos.usuarios || []);
      setTotal(datos.total || 0);
      setLimite(datos.limite || 100);
      setError('');
    } catch (fallo) {
      if (fallo.status === 401 || fallo.status === 403) {
        await cerrarSesionAdmin();
        irSinHistorial(router, '/login');
      } else {
        setError(fallo.message || 'No se pudieron cargar los usuarios.');
      }
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => { cargar(); }, [cargar]);

  // Mensaje claro cuando el servidor todavía no tiene la ruta para editar o borrar.
  const mensajeFallo = (fallo, accion) => {
    if (fallo?.status === 404 || fallo?.status === 405) {
      return `El servidor todavía no permite ${accion} usuarios. Falta la ruta /admin/usuarios/<id>/ en el backend.`;
    }
    return fallo?.message || `No se pudo ${accion} el usuario.`;
  };

  const abrirEdicion = (usuario) => {
    setErrorAccion('');
    setUsuarioEditando(usuario);
    setFormulario({
      nombre: usuario.nombre || '',
      rut: usuario.rut || '',
      correo: usuario.correo || '',
      edad: usuario.edad ? String(usuario.edad) : '',
      rol: usuario.rol && usuario.rol !== 'desconocido' ? usuario.rol : 'cliente',
      nivelPlan: nivelDePlan(usuario.plan),
    });
  };

  const cambiarCampo = (campo, valor) => setFormulario((previo) => ({ ...previo, [campo]: valor }));

  const guardarEdicion = async () => {
    if (procesando || !usuarioEditando) return;
    const nombre = formulario.nombre.trim();
    const correo = formulario.correo.trim().toLowerCase();
    const edadValor = Number(formulario.edad);
    if (!nombre) return setErrorAccion('Ingresa el nombre.');
    if (!/^\S+@\S+\.\S+$/.test(correo)) return setErrorAccion('Ingresa un correo válido.');
    if (formulario.edad && (!Number.isInteger(edadValor) || edadValor < 12 || edadValor > 100)) {
      return setErrorAccion('La edad debe estar entre 12 y 100 años.');
    }
    const rol = rolesEditables.find((r) => r.key === formulario.rol) || rolesEditables[0];
    // Se envían con los mismos nombres de campo del modelo UsuarioModel.
    const cambios = {
      nombre,
      correo,
      ...(formulario.rut.trim() ? { rut: formulario.rut.trim() } : {}),
      ...(formulario.edad ? { edad: edadValor } : {}),
      tipo_usuario: rol.tipo,
    };
    // El plan se asigna aparte (ruta que ya existe), solo a clientes y solo si cambió.
    const cambiaPlan = rol.key === 'cliente' && formulario.nivelPlan && formulario.nivelPlan !== nivelDePlan(usuarioEditando.plan);
    setProcesando(true);
    const errores = [];
    let datosOk = false;
    let planNuevo = null;
    try {
      await apiAdmin(`/admin/usuarios/${usuarioEditando.id}/`, { method: 'PATCH', body: cambios });
      datosOk = true;
    } catch (fallo) {
      errores.push(mensajeFallo(fallo, 'editar'));
    }
    if (cambiaPlan) {
      try {
        const respuesta = await apiAdmin('/planes/asignar/', {
          method: 'POST',
          body: { alumno_id: usuarioEditando.id, nivel: formulario.nivelPlan },
        });
        planNuevo = respuesta?.plan?.nombre || planesAsignables.find((p) => p.nivel === formulario.nivelPlan)?.label;
      } catch (fallo) {
        errores.push(fallo?.message ? `Plan: ${fallo.message}` : 'No se pudo asignar el plan.');
      }
    }
    if (datosOk || planNuevo) {
      setUsuarios((lista) => lista.map((u) => (u.id === usuarioEditando.id
        ? {
          ...u,
          ...(datosOk ? { nombre, correo, rut: cambios.rut ?? u.rut, edad: cambios.edad ?? u.edad, rol: rol.key } : {}),
          ...(planNuevo ? { plan: planNuevo } : {}),
        }
        : u)));
    }
    setProcesando(false);
    if (errores.length === 0) {
      setUsuarioEditando(null);
      setAviso('Usuario actualizado.');
    } else {
      setErrorAccion(errores.join('\n'));
      if (planNuevo) setAviso('Plan asignado.');
    }
  };

  const confirmarBorrado = async () => {
    if (procesando || !usuarioBorrando) return;
    setProcesando(true);
    try {
      await apiAdmin(`/admin/usuarios/${usuarioBorrando.id}/`, { method: 'DELETE' });
      setUsuarios((lista) => lista.filter((u) => u.id !== usuarioBorrando.id));
      setTotal((t) => Math.max(0, t - 1));
      setUsuarioBorrando(null);
      setAviso('Usuario eliminado.');
    } catch (fallo) {
      setErrorAccion(mensajeFallo(fallo, 'borrar'));
    } finally {
      setProcesando(false);
    }
  };

  // Los filtros se aplican sobre la página de resultados cargada, sin otra llamada al servidor.
  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es-CL');
    return usuarios.filter((usuario) => {
      const coincideRol = filtro === 'todos' || (usuario.rol || 'cliente') === filtro;
      const campos = `${usuario.nombre || ''} ${usuario.correo || ''}`.toLocaleLowerCase('es-CL');
      return coincideRol && (!texto || campos.includes(texto));
    });
  }, [usuarios, filtro, busqueda]);

  // Aumenta los márgenes en tablet/escritorio y conserva espacio útil en móvil.
  const anchoContenido = width >= 760 ? 28 : 16;

  return (
    <AdminShell active="usuarios" title="Usuarios">
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_login.jpg')} />
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: anchoContenido, paddingTop: 18 }}>
          <View style={styles.headingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heading}>Usuarios</Text>
              <Text style={styles.subtitle}>{total.toLocaleString('es-CL')} cuentas registradas</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Actualizar usuarios" onPress={cargar} style={styles.refreshButton}>
              <Ionicons name="refresh-outline" size={25} color={c.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={24} color={c.muted} />
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar por nombre o correo"
              placeholderTextColor={c.muted}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Buscar usuarios"
              style={styles.searchInput}
            />
            {!!busqueda && (
              <TouchableOpacity accessibilityLabel="Limpiar búsqueda" onPress={() => setBusqueda('')}>
                <Ionicons name="close-circle" size={21} color={c.muted} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {filtros.map((opcion) => {
              const activo = filtro === opcion.key;
              return (
                <TouchableOpacity
                  key={opcion.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activo }}
                  onPress={() => setFiltro(opcion.key)}
                  style={[styles.filterButton, activo && styles.filterActive]}
                >
                  <Text style={[styles.filterText, activo && styles.filterTextActive]}>{opcion.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {!!error && <View style={[styles.errorBox, { marginHorizontal: anchoContenido }]}><Text style={styles.errorText}>{error}</Text></View>}
        {!!aviso && (
          <TouchableOpacity onPress={() => setAviso('')} style={[styles.successBox, { marginHorizontal: anchoContenido }]}>
            <Ionicons name="checkmark-circle-outline" size={16} color={c.success} />
            <Text style={styles.successText}>{aviso}</Text>
          </TouchableOpacity>
        )}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={c.primary} />}
          contentContainerStyle={{ paddingHorizontal: anchoContenido, paddingTop: 2, paddingBottom: 24, width: '100%', maxWidth: 1320, alignSelf: 'center' }}
        >
          {cargando && usuarios.length === 0 ? (
            <View style={styles.loading}><ActivityIndicator color={c.primary} /></View>
          ) : visibles.length > 0 ? (
            <View style={styles.list}>
              {visibles.map((usuario) => (
                <View key={usuario.id} style={styles.userRow}>
                  <View style={styles.userAvatar}><Text style={styles.userInitials}>{iniciales(usuario.nombre)}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.userName}>{usuario.nombre || 'Sin nombre'}</Text>
                    <Text numberOfLines={1} style={styles.userEmail}>{usuario.correo || 'Sin correo'}</Text>
                    <Text style={styles.userDate}>{fechaCorta(usuario.creado)}</Text>
                  </View>
                  <View style={styles.userMeta}>
                    <Text style={styles.roleText}>{rolVisible(usuario.rol)}</Text>
                    <Text numberOfLines={1} style={styles.planText}>{usuario.plan || 'Sin plan'}</Text>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Editar a ${usuario.nombre || 'usuario'}`}
                      onPress={() => abrirEdicion(usuario)}
                      style={styles.actionButton}
                    >
                      <Ionicons name="create-outline" size={21} color={c.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Borrar a ${usuario.nombre || 'usuario'}`}
                      onPress={() => { setErrorAccion(''); setUsuarioBorrando(usuario); }}
                      style={[styles.actionButton, { borderColor: c.dangerSoft }]}
                    >
                      <Ionicons name="trash-outline" size={21} color={c.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="search-outline" size={23} color={c.blue} />
              <Text style={styles.emptyTitle}>No encontramos usuarios</Text>
              <Text style={styles.emptyText}>Prueba otro nombre, correo o filtro.</Text>
            </View>
          )}
          {total > limite && <Text style={styles.limitNote}>Mostrando las {limite} cuentas más recientes de {total}.</Text>}
        </ScrollView>
      </View>

      {/* Ventana para editar los datos del usuario */}
      <Modal visible={!!usuarioEditando} transparent animationType="fade" onRequestClose={() => setUsuarioEditando(null)}>
        <View style={styles.modalFondo}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modalCaja}>
              <Text style={styles.modalTitulo}>Editar usuario</Text>
              <Text style={styles.modalSubtitulo}>Modifica los datos y presiona Guardar.</Text>

              {[
                { campo: 'nombre', label: 'Nombre', placeholder: 'Nombre completo' },
                { campo: 'rut', label: 'RUT', placeholder: '12.345.678-9' },
                { campo: 'correo', label: 'Correo', placeholder: 'correo@ejemplo.cl', teclado: 'email-address' },
                { campo: 'edad', label: 'Edad', placeholder: 'Años', teclado: 'number-pad' },
              ].map((item) => (
                <View key={item.campo} style={{ marginTop: 12 }}>
                  <Text style={styles.inputLabel}>{item.label}</Text>
                  <TextInput
                    value={formulario[item.campo]}
                    onChangeText={(v) => cambiarCampo(item.campo, v)}
                    placeholder={item.placeholder}
                    placeholderTextColor={c.muted}
                    keyboardType={item.teclado || 'default'}
                    autoCapitalize={item.campo === 'nombre' ? 'words' : 'none'}
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>
              ))}

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Rol</Text>
              <View style={styles.rolesRow}>
                {rolesEditables.map((r) => {
                  const activo = formulario.rol === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      onPress={() => cambiarCampo('rol', r.key)}
                      style={[styles.filterButton, activo && styles.filterActive]}
                    >
                      <Text style={[styles.filterText, { fontSize: 15 }, activo && styles.filterTextActive]}>{r.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {formulario.rol === 'cliente' && (
                <>
                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>Plan</Text>
                  <View style={styles.rolesRow}>
                    {planesAsignables.map((p) => {
                      const activo = formulario.nivelPlan === p.nivel;
                      return (
                        <TouchableOpacity
                          key={p.nivel}
                          onPress={() => cambiarCampo('nivelPlan', p.nivel)}
                          style={[styles.filterButton, activo && styles.filterActive]}
                        >
                          <Text style={[styles.filterText, { fontSize: 15 }, activo && styles.filterTextActive]}>{p.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={[styles.userDate, { marginTop: 6 }]}>
                    Plan actual: {usuarioEditando?.plan || 'Sin plan'}
                  </Text>
                </>
              )}

              {!!errorAccion && <Text style={[styles.errorText, { marginTop: 12 }]}>{errorAccion}</Text>}

              <View style={styles.modalBotones}>
                <TouchableOpacity onPress={() => setUsuarioEditando(null)} style={styles.botonSecundario}>
                  <Text style={styles.botonSecundarioTexto}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={guardarEdicion} disabled={procesando} style={[styles.botonPrimario, procesando && { opacity: 0.6 }]}>
                  {procesando ? <ActivityIndicator color={c.text} /> : <Text style={styles.botonPrimarioTexto}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Confirmación antes de borrar */}
      <Modal visible={!!usuarioBorrando} transparent animationType="fade" onRequestClose={() => setUsuarioBorrando(null)}>
        <View style={styles.modalFondo}>
          <View style={[styles.modalCaja, { alignSelf: 'center' }]}>
            <Ionicons name="warning-outline" size={28} color={c.danger} />
            <Text style={[styles.modalTitulo, { marginTop: 8 }]}>¿Borrar usuario?</Text>
            <Text style={styles.modalSubtitulo}>
              Se eliminará la cuenta de {usuarioBorrando?.nombre || 'este usuario'} ({usuarioBorrando?.correo || 'sin correo'}). Esta acción no se puede deshacer.
            </Text>
            {!!errorAccion && <Text style={[styles.errorText, { marginTop: 12 }]}>{errorAccion}</Text>}
            <View style={styles.modalBotones}>
              <TouchableOpacity onPress={() => setUsuarioBorrando(null)} style={styles.botonSecundario}>
                <Text style={styles.botonSecundarioTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmarBorrado} disabled={procesando} style={[styles.botonPrimario, { backgroundColor: c.danger }, procesando && { opacity: 0.6 }]}>
                {procesando ? <ActivityIndicator color={c.text} /> : <Text style={styles.botonPrimarioTexto}>Borrar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

const styles = {
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  heading: { color: c.text, fontSize: 25, fontFamily: 'SundayMasthead-Regular' },
  subtitle: { color: c.muted, fontSize: 14, marginTop: 4 },
  refreshButton: { width: 50, height: 50, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  searchBox: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 9 },
  searchInput: { flex: 1, color: c.text, fontSize: 17, paddingVertical: 0, outlineStyle: 'none' },
  filters: { flexDirection: 'row', gap: 9, paddingVertical: 12 },
  filterButton: { minHeight: 46, justifyContent: 'center', borderRadius: 99, borderWidth: 1, borderColor: c.line, paddingHorizontal: 18, backgroundColor: c.surface },
  filterActive: { backgroundColor: c.primarySoft, borderColor: c.primaryBorder },
  filterText: { color: c.muted, fontSize: 17, fontWeight: '600' },
  filterTextActive: { color: c.primary },
  list: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 14 },
  userRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 13 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.blueSoft, alignItems: 'center', justifyContent: 'center' },
  userInitials: { color: c.blue, fontSize: 14, fontWeight: '800' },
  userName: { color: c.text, fontSize: 14, fontWeight: '700' },
  userEmail: { color: c.muted, fontSize: 14, marginTop: 2 },
  userDate: { color: c.muted, fontSize: 14, marginTop: 3 },
  userMeta: { alignItems: 'flex-end', maxWidth: 125, marginLeft: 3 },
  roleText: { color: c.primary, fontSize: 14, fontWeight: '700' },
  planText: { color: c.muted, fontSize: 14, marginTop: 4 },
  loading: { minHeight: 150, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { minHeight: 170, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 20 },
  emptyTitle: { color: c.text, fontSize: 15, fontWeight: '700', marginTop: 3 },
  emptyText: { color: c.muted, fontSize: 14, textAlign: 'center' },
  limitNote: { color: c.muted, fontSize: 14, textAlign: 'center', marginTop: 13 },
  errorBox: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.dangerSoft, borderRadius: 9, padding: 11, marginBottom: 10 },
  errorText: { color: c.danger, fontSize: 14 },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.successSoft, borderRadius: 9, padding: 11, marginBottom: 10 },
  successText: { color: c.success, fontSize: 14, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 6, marginLeft: 4 },
  actionButton: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modalCaja: { width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 18 },
  modalTitulo: { color: c.text, fontSize: 19, fontWeight: '800' },
  modalSubtitulo: { color: c.muted, fontSize: 14, marginTop: 4 },
  inputLabel: { color: c.muted, fontSize: 14, marginBottom: 6 },
  input: { height: 50, color: c.text, fontSize: 17, backgroundColor: c.background, borderWidth: 1, borderColor: c.line, borderRadius: 9, paddingHorizontal: 12 },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalBotones: { flexDirection: 'row', gap: 10, marginTop: 18 },
  botonSecundario: { flex: 1, height: 50, borderRadius: 10, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  botonSecundarioTexto: { color: c.text, fontWeight: '700' },
  botonPrimario: { flex: 1, height: 50, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  botonPrimarioTexto: { color: c.text, fontWeight: '800' },
};
