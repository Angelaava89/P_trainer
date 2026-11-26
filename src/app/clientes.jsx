import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import Boton_barra_coach from '../components/Boton_barra_coach';
import FondoThomas from '../components/FondoThomas';
import LogoMarca from '../components/LogoMarca';
import { plans } from '../constants/index';
import { colors } from '../constants/theme';
import '../global.css';
import { CLIENTES_INICIALES } from '../lib/clientesCoach';
import { escribirleAlCliente } from '../lib/whatsapp';
import { CLAVE_ASIGNACIONES, CLAVE_RUTINAS } from '../lib/rutinas';


// ---------- opciones de los filtros ----------



const ESTADOS = [
  { value: 'activo', label: 'Activo', color: colors.verde },
  { value: 'lesionado', label: 'Lesionado', color: colors.rojo },
  { value: 'inactivo', label: 'Inactivo', color: colors.gris },
];

const OBJETIVOS = [
  { value: 'musculo', label: 'Ganar musculatura', icon: 'barbell-outline' },
  { value: 'peso', label: 'Bajar de peso', icon: 'trending-down-outline' },
  { value: 'mantenimiento', label: 'Mantenimiento', icon: 'pulse-outline' },
  { value: 'resistencia', label: 'Resistencia', icon: 'bicycle-outline' },
];

// los planes salen de constants/index.js, así si cambian allá cambian acá también.
// 'PLAN BEGINNER' -> 'Beginner'
const PLANES = plans.map((p) => {
  const nombre = p.title.replace('PLAN ', '').toLowerCase();
  return { value: p.id, label: nombre.charAt(0).toUpperCase() + nombre.slice(1), color: p.color };
});

const TODOS = 'todos';

// ---------- helpers ----------

// saca tildes y mayúsculas para que "matias" encuentre a "Matías"
const normalizar = (texto) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// "Thomas Rivera" -> "TR"
const iniciales = (nombre) =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');

// si el valor no está en la lista se usa la primera opción, para que la tarjeta no se caiga
const buscarOpcion = (lista, value) => lista.find((o) => o.value === value) ?? lista[0];

// ---------- alumnos reales desde Django (GET /api/alumnos/) ----------

const OBJETIVO_DESDE_BACKEND = {
  'Ganancia muscular': 'musculo',
  'Pérdida de grasa': 'peso',
  Mantenimiento: 'mantenimiento',
  Resistencia: 'resistencia',
};

const normalizarPlan = (texto = '') => String(texto)
  .toLocaleLowerCase('es-CL')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

// Solo un contrato básico o avanzado vigente convierte una cuenta en cliente del entrenador.
function obtenerPlanActivo(planes = []) {
  const lista = Array.isArray(planes) ? planes : [];
  const contratoActivo = [...lista].reverse().find((contrato) => normalizarPlan(contrato?.vigencia) === 'activo');
  if (!contratoActivo) return null;

  const descripcion = normalizarPlan(`${contratoActivo.idPlan || ''} ${contratoActivo.nombre || ''}`);
  if (descripcion.includes('avanz')) return 'avanzado';
  if (descripcion.includes('basico') || descripcion.includes('principiante') || descripcion.includes('inicial')) return 'inicial';
  return null;
}

// "2026-11-01" -> "01/11/2026"
const fechaCorta = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

// Convierte un alumno de Mongo a la forma que usan las tarjetas de esta pantalla
function alumnoACliente(alumno) {
  const datos = alumno.datos || {};
  const lesiones = datos.lesion || [];
  const alergias = (datos.alergia || []).map((a) => a.tipo).filter(Boolean);
  // % de grasa corporal: el último que el cliente ingresó en sus medidas (opcional)
  // Las medidas ahora vienen dentro de metricas (alumno.metricas[0].medidas); se mantiene alumno.medidas por compatibilidad.
  const medidasAlumno = alumno.metricas?.[0]?.medidas || alumno.medidas || [];
  const ultimaConGrasa = [...medidasAlumno].reverse().find((m) => m?.grasaCorporal != null);
  return {
    id: alumno.id,
    nombre: alumno.nombre,
    correo: alumno.correo,
    rut: alumno.rut,
    edad: alumno.edad,
    altura: datos.altura ? Number((datos.altura / 100).toFixed(2)) : null, // cm -> m
    peso: datos.pesoActual ?? null,
    grasaCorporal: datos.grasaCorporal ?? ultimaConGrasa?.grasaCorporal ?? null,
    experiencia: datos.experiencia,
    objetivo: OBJETIVO_DESDE_BACKEND[datos.objetivo] ?? 'musculo',
    plan: obtenerPlanActivo(alumno.plan),
    // se marca "lesionado" si tiene alguna lesión en reposo
    estado: lesiones.some((l) => l.reposo === 'Sí') ? 'lesionado' : 'activo',
    lesiones,
    alergias,
    sinDatos: !alumno.datos,
  };
}

// ---------- piezas chicas que se repiten ----------

function Chip({ label, activo, onPress, sobreTarjeta }) {
  const fondo = activo ? 'bg-azulClaro' : sobreTarjeta ? 'bg-carbon' : 'bg-grafito'; // condicional si se presiona se pone azul si no carbon
  return (
    <TouchableOpacity onPress={onPress} className={`px-3 py-2 rounded-full ${fondo}`}>
      <Text className={`text-xs ${activo ? 'text-blanco font-bold' : 'text-blanco/50'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

// un grupo de filtro dentro del panel desplegable: título arriba + chips (con "Todos" primero)
function GrupoFiltro({
  titulo,
  opciones,
  valor,
  onChange,
  abierto,
  onAbrir,
}) {
  const opcionSeleccionada =
    valor === TODOS
      ? 'Todos'
      : opciones.find((o) => o.value === valor)?.label || 'Todos';

  return (
    <View className="mb-4">
      {/* título */}
      <Text className="text-blanco/60 text-xs font-bold mb-2">
        {titulo}
      </Text>

      {/* campo */}
      <TouchableOpacity
        onPress={onAbrir}
        activeOpacity={0.8}
        className="flex-row items-center justify-between rounded-xl px-4"
        style={{
          minHeight: 52,
          borderWidth: 1,
          borderColor: abierto
            ? colors.azulClaro
            : 'rgba(255,255,255,0.12)',
          backgroundColor: '#171B24',
        }}
      >
        <Text
          className={`text-sm ${
            valor === TODOS
              ? 'text-blanco/60'
              : 'text-blanco font-bold'
          }`}
        >
          {opcionSeleccionada}
        </Text>

        <Ionicons
          name={abierto ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.blanco}
          style={{ opacity: 0.6 }}
        />
      </TouchableOpacity>

      {/* opciones */}
      {abierto && (
        <View
          className="rounded-xl mt-2 overflow-hidden"
          style={{
            backgroundColor: '#171B24',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.10)',
          }}
        >
          {/* Todos */}
          <TouchableOpacity
            onPress={() => onChange(TODOS)}
            activeOpacity={0.8}
            className="flex-row items-center justify-between px-4"
            style={{
              minHeight: 48,
              backgroundColor:
                valor === TODOS
                  ? `${colors.azulClaro}22`
                  : 'transparent',
            }}
          >
            <Text
              className={`text-sm ${
                valor === TODOS
                  ? 'text-blanco font-bold'
                  : 'text-blanco/70'
              }`}
            >
              Todos
            </Text>

            {valor === TODOS && (
              <Ionicons
                name="checkmark"
                size={20}
                color={colors.azulClaro}
              />
            )}
          </TouchableOpacity>

          {/* opciones */}
          {opciones.map((opcion) => {
            const seleccionado = valor === opcion.value;

            return (
              <TouchableOpacity
                key={opcion.value}
                onPress={() => onChange(opcion.value)}
                activeOpacity={0.8}
                className="flex-row items-center justify-between px-4"
                style={{
                  minHeight: 48,
                  backgroundColor: seleccionado
                    ? `${colors.azulClaro}22`
                    : 'transparent',
                }}
              >
                <Text
                  className={`text-sm ${
                    seleccionado
                      ? 'text-blanco font-bold'
                      : 'text-blanco/70'
                  }`}
                >
                  {opcion.label}
                </Text>

                {seleccionado && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.azulClaro}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function TarjetaCliente({ cliente, rutinasAsignadas = [], onRutinas, onNutricion, onVideos, onMetricas, onEditar, onPerfil }) {
  const estado = buscarOpcion(ESTADOS, cliente.estado);
  const objetivo = buscarOpcion(OBJETIVOS, cliente.objetivo);
  const plan = buscarOpcion(PLANES, cliente.plan);
  const esPlanAvanzado = cliente.plan === 'avanzado';

  const [expandido, setExpandido] = useState(false);
  const [accionesVisibles, setAccionesVisibles] = useState(false);

  return (
    <View className="bg-grafito rounded-2xl p-4">

      {/* CABECERA DEL CLIENTE */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setExpandido((valor) => !valor)}
      >
        <View className="flex-row items-start">

          {/* avatar: al tocarlo se abre el perfil completo del cliente */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Ver perfil de ${cliente.nombre}`}
            onPress={(e) => {
              e.stopPropagation();
              onPerfil?.();
            }}
            className="items-center justify-center rounded-full"
            style={{
              width: 44,
              height: 44,
              backgroundColor: `${colors.azulClaro}33`,
            }}
          >
            <Text className="text-azulClaro text-sm font-bold">
              {iniciales(cliente.nombre)}
            </Text>
          </TouchableOpacity>

          <View className="flex-1 ml-3">

            {/* nombre + flecha */}
            <View className="flex-row items-center">
              <Text
                className="text-blanco text-base font-bold flex-1"
                numberOfLines={1}
              >
                {cliente.nombre}
              </Text>

              <Ionicons
                name={expandido ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.blanco}
                style={{ opacity: 0.6 }}
              />
            </View>

            {/* estado + plan + editar + eliminar */}
            <View
              className="flex-row items-center flex-wrap mt-1"
              style={{ gap: 6 }}
            >

              {/* estado */}
              <View
                className="flex-row items-center rounded-full px-2 py-1"
                style={{
                  backgroundColor: `${estado.color}33`,
                }}
              >
                <View
                  className="rounded-full mr-1"
                  style={{
                    width: 6,
                    height: 6,
                    backgroundColor: estado.color,
                  }}
                />

                <Text
                  className="text-[14px] font-bold"
                  style={{ color: estado.color }}
                >
                  {estado.label}
                </Text>
              </View>

              {/* plan */}
              <View
                className="rounded-full px-2 py-1"
                style={{
                  borderWidth: 1,
                  borderColor: plan.color,
                }}
              >
                <Text className="text-blanco/70 text-[14px]">
                  Plan {plan.label}
                </Text>
              </View>
            </View>

            {/* objetivo */}
            <View className="flex-row items-center mt-2">
              <Ionicons
                name={objetivo.icon}
                size={14}
                color={colors.blanco}
                style={{ opacity: 0.5 }}
              />

              <Text className="text-blanco/60 text-xs ml-1">
                {objetivo.label}
              </Text>
            </View>

            {/* Rutinas asignadas visibles en la lista junto al estado y el plan. */}
            <View className="flex-row items-start mt-2" style={{ gap: 6 }}>
              <Ionicons name="barbell-outline" size={14} color={colors.azulClaro} style={{ marginTop: 2 }} />
              <View className="flex-1 flex-row flex-wrap items-center" style={{ gap: 5 }}>
                {rutinasAsignadas.length ? rutinasAsignadas.map((rutina) => (
                  <View key={rutina.id} className="rounded-full px-2 py-1" style={{ backgroundColor: colors.carbon, borderWidth: 1, borderColor: colors.azulOscuro }}>
                    <Text numberOfLines={1} className="text-[13px] text-azulClaro">{rutina.titulo}</Text>
                  </View>
                )) : (
                  <Text className="text-blanco/40 text-[13px]">Sin rutinas asignadas</Text>
                )}
              </View>
            </View>

            {/* Abre la ficha completa del cliente (perfil_cliente_coach): datos, rutina y nutrición */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Ver perfil de ${cliente.nombre}`}
              onPress={(e) => {
                e.stopPropagation();
                onPerfil?.();
              }}
              className="flex-row items-center self-start rounded-full px-3 py-2 mt-3"
              style={{ borderWidth: 1, borderColor: colors.azulClaro }}
            >
              <Ionicons name="person-circle-outline" size={17} color={colors.azulClaro} />
              <Text className="text-azulClaro text-xs font-bold ml-1">Ver perfil</Text>
            </TouchableOpacity>

          </View>
        </View>
      </TouchableOpacity>

      {/* INFORMACIÓN ADICIONAL */}
      {expandido && (
        <View
          className="mt-4 pt-4"
          style={{
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <Text className="text-blanco text-sm font-bold mb-3">
            Información del cliente
          </Text>

          <View className="flex-row flex-wrap" style={{ gap: 10 }}>

            <View className="flex-1 min-w-[45%]">
              <Text className="text-blanco/40 text-[14px]">
                Correo
              </Text>
              <Text className="text-blanco text-xs mt-1">
                {cliente.correo || 'Sin información'}
              </Text>
            </View>

            <View className="flex-1 min-w-[45%]">
              <Text className="text-blanco/40 text-[14px]">
                Edad
              </Text>
              <Text className="text-blanco text-xs mt-1">
                {cliente.edad ? `${cliente.edad} años` : 'Sin información'}
              </Text>
            </View>

            <View className="flex-1 min-w-[45%]">
              <Text className="text-blanco/40 text-[14px]">
                Altura
              </Text>
              <Text className="text-blanco text-xs mt-1">
                {cliente.altura ? `${cliente.altura} m` : 'Sin información'}
              </Text>
            </View>

            <View className="flex-1 min-w-[45%]">
              <Text className="text-blanco/40 text-[14px]">
                Peso actual
              </Text>
              <Text className="text-blanco text-xs mt-1">
                {cliente.peso ? `${cliente.peso} kg` : 'Sin información'}
              </Text>
            </View>

            <View className="flex-1 min-w-[45%]">
              <Text className="text-blanco/40 text-[14px]">
                Grasa corporal
              </Text>
              <Text className="text-blanco text-xs mt-1">
                {cliente.grasaCorporal != null ? `${cliente.grasaCorporal} %` : 'Sin información'}
              </Text>
            </View>

            <View className="flex-1 min-w-[45%]">
              <Text className="text-blanco/40 text-[14px]">
                Experiencia
              </Text>
              <Text className="text-blanco text-xs mt-1">
                {cliente.experiencia || plan.label}
              </Text>
            </View>

            <View className="flex-1 min-w-[45%]">
              <Text className="text-blanco/40 text-[14px]">
                Frecuencia
              </Text>
              <Text className="text-blanco text-xs mt-1">
                {cliente.frecuencia || 'Sin información'}
              </Text>
            </View>

          </View>

          {/* abre WhatsApp para responderle al cliente desde su conversación */}
          <TouchableOpacity
            onPress={() => escribirleAlCliente(cliente.id)}
            className="flex-row items-center justify-center rounded-xl mt-4"
            style={{ minHeight: 44, backgroundColor: '#25D366' }}
            accessibilityLabel="Abrir WhatsApp"
          >
            <Ionicons name="logo-whatsapp" size={18} color={colors.blanco} />
            <Text className="text-blanco text-xs font-bold ml-2">Abrir WhatsApp</Text>
          </TouchableOpacity>

          {cliente.sinDatos && (
            <Text className="text-blanco/40 text-[14px] mt-3">
              Este alumno todavía no completa "Tus métricas".
            </Text>
          )}

          {/* lesiones registradas por el alumno */}
          <Text className="text-blanco text-sm font-bold mt-4 mb-2">Lesiones</Text>
          {cliente.lesiones?.length ? (
            cliente.lesiones.map((l, i) => (
              <View key={`${l.areaCorporal}-${i}`} className="flex-row items-start bg-carbon rounded-xl px-3 py-2 mb-2">
                <Ionicons name="bandage-outline" size={14} color={colors.rojo} style={{ marginTop: 2 }} />
                <View className="flex-1 ml-2">
                  <Text className="text-blanco text-xs font-bold">
                    {l.areaCorporal}
                    <Text className="text-blanco/50 font-normal">  ·  Reposo: {l.reposo}</Text>
                  </Text>
                  {!!l.detalle && <Text className="text-blanco/70 text-xs mt-1">{l.detalle}</Text>}
                  <Text className="text-blanco/40 text-[13px] mt-1">Registrada el {fechaCorta(l.fecha)}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text className="text-blanco/40 text-xs">Sin lesiones registradas</Text>
          )}

          {/* alergias e intolerancias alimentarias escritas por el alumno */}
          <Text className="text-blanco text-sm font-bold mt-4 mb-2">Alergias e intolerancias</Text>
          {cliente.alergias?.length ? (
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
              {cliente.alergias.map((a, i) => (
                <View key={`${a}-${i}`} className="flex-row items-center rounded-full px-3 py-1" style={{ backgroundColor: `${colors.rojo}22` }}>
                  <Ionicons name="warning-outline" size={12} color={colors.rojo} />
                  <Text className="text-blanco text-xs ml-1">{a}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-blanco/40 text-xs">Sin alergias registradas</Text>
          )}
        </View>
      )}

      {/* Los botones se apilan en ambos planes para conservar el mismo ancho, altura y orden visual. */}
      <View className="mt-4" style={{ flexDirection: 'column', gap: 8 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={esPlanAvanzado ? 'Abrir opciones de rutinas, nutrición y videos' : 'Asignar rutinas'}
          onPress={() => esPlanAvanzado ? setAccionesVisibles(true) : onRutinas?.()}
          className="flex-row items-center bg-azulClaro rounded-xl px-3"
          style={{
            minHeight: 46,
            width: '100%',
            justifyContent: esPlanAvanzado ? 'space-between' : 'center',
          }}
        >
          {esPlanAvanzado ? (
            <View className="items-center justify-center rounded-xl" style={{ width: 34, height: 34, backgroundColor: 'rgba(255,255,255,0.14)' }}>
              <Ionicons name="barbell-outline" size={19} color={colors.blanco} />
            </View>
          ) : (
            <Ionicons name="barbell-outline" size={16} color={colors.blanco} />
          )}

          <Text
            className="text-blanco text-xs font-bold"
            style={{
              flex: esPlanAvanzado ? 1 : undefined,
              flexShrink: 1,
              marginLeft: 8,
              marginRight: esPlanAvanzado ? 8 : 0,
              textAlign: esPlanAvanzado ? 'left' : 'center',
            }}
          >
            {esPlanAvanzado ? 'Rutinas, nutrición y videos' : 'Rutinas'}
          </Text>

          {esPlanAvanzado && <Ionicons name="chevron-forward" size={20} color={colors.blanco} />}
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Ver seguimiento y métricas"
          onPress={onMetricas}
          className="flex-row items-center justify-center rounded-xl px-2"
          style={{
            minHeight: 46,
            width: '100%',
            borderWidth: 1,
            borderColor: colors.azulClaro,
          }}
        >
          <Ionicons name="stats-chart-outline" size={16} color={colors.azulClaro} />
          <Text className="text-blanco text-xs font-bold ml-2 text-center" style={{ flexShrink: 1 }}>
            Seguimiento y métricas
          </Text>
        </TouchableOpacity>
      </View>

      {/* El plan avanzado abre aquí las tres acciones disponibles para el cliente. */}
      <Modal
        visible={accionesVisibles}
        transparent
        animationType="fade"
        onRequestClose={() => setAccionesVisibles(false)}
      >
        <View className="flex-1 items-center justify-center px-5" style={{ backgroundColor: 'rgba(0,0,0,0.78)' }}>
          <View className="w-full rounded-2xl bg-grafito p-5" style={{ borderWidth: 1, borderColor: colors.azulOscuro }}>
            <Text className="text-blanco text-lg font-bold">Acciones para {cliente.nombre}</Text>
            <Text className="text-blanco/55 text-sm mt-1 mb-4">Elige qué quieres asignar.</Text>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => { setAccionesVisibles(false); onRutinas?.(); }}
              className="flex-row items-center rounded-xl px-3 py-3 mb-2"
              style={{ backgroundColor: colors.carbon, borderWidth: 1, borderColor: colors.azulOscuro }}
            >
              <Ionicons name="barbell-outline" size={20} color={colors.azulClaro} />
              <Text className="flex-1 text-blanco text-sm font-bold ml-3">Asignar rutinas</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.gris} />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => { setAccionesVisibles(false); onNutricion?.(); }}
              className="flex-row items-center rounded-xl px-3 py-3 mb-2"
              style={{ backgroundColor: colors.carbon, borderWidth: 1, borderColor: colors.azulOscuro }}
            >
              <Ionicons name="nutrition-outline" size={20} color={colors.azulClaro} />
              <Text className="flex-1 text-blanco text-sm font-bold ml-3">Asignar nutrición</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.gris} />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => { setAccionesVisibles(false); onVideos?.(); }}
              className="flex-row items-center rounded-xl px-3 py-3"
              style={{ backgroundColor: colors.carbon, borderWidth: 1, borderColor: colors.azulOscuro }}
            >
              <Ionicons name="videocam-outline" size={20} color={colors.azulClaro} />
              <Text className="flex-1 text-blanco text-sm font-bold ml-3">Asignar videos</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.gris} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setAccionesVisibles(false)} className="items-center py-3 mt-2">
              <Text className="text-blanco/65 text-sm font-bold">Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
// ---------- pantalla ----------

export default function Clientes() {
  const router = useRouter();
  // La lista se llena con las cuentas reales del servidor y permanece vacía si no hay conexión.
  const [clientes, setClientes] = useState([]);
  const [avisoDatos, setAvisoDatos] = useState('');

  // El personal trainer puede corregir el peso y la grasa corporal (el cliente también puede hacerlo).
  // El backend aún no tiene una ruta para que el entrenador guarde datos de otro usuario,
  // así que por ahora los cambios se guardan en este celular y se aplican sobre los datos de Atlas.
  const CLAVE_DATOS_EDITADOS = 'ptrainer_datos_clientes_coach';
  const [clienteEditando, setClienteEditando] = useState(null);
  const [pesoEditado, setPesoEditado] = useState('');
  const [grasaEditada, setGrasaEditada] = useState('');

  const aplicarEditados = async (lista) => {
    try {
      const editados = JSON.parse((await AsyncStorage.getItem(CLAVE_DATOS_EDITADOS)) || '{}');
      return lista.map((c) => (editados[c.id] ? { ...c, ...editados[c.id] } : c));
    } catch {
      return lista;
    }
  };

  const abrirEdicion = (cliente) => {
    setClienteEditando(cliente);
    setPesoEditado(cliente.peso != null ? String(cliente.peso) : '');
    setGrasaEditada(cliente.grasaCorporal != null ? String(cliente.grasaCorporal) : '');
  };

  const guardarEdicion = async () => {
    const peso = Number(pesoEditado.replace(',', '.'));
    if (!Number.isFinite(peso) || peso < 20 || peso > 350) {
      Alert.alert('Peso inválido', 'Ingresa un peso entre 20 y 350 kg.');
      return;
    }
    const grasaTexto = grasaEditada.trim();
    const grasaCorporal = grasaTexto ? Number(grasaTexto.replace(',', '.')) : null;
    if (grasaTexto && (!Number.isFinite(grasaCorporal) || grasaCorporal < 2 || grasaCorporal > 70)) {
      Alert.alert('Grasa corporal inválida', 'Ingresa un porcentaje entre 2 y 70, o deja el campo vacío.');
      return;
    }
    const cambios = { peso, grasaCorporal };
    setClientes((lista) => lista.map((c) => (c.id === clienteEditando.id ? { ...c, ...cambios } : c)));
    try {
      const editados = JSON.parse((await AsyncStorage.getItem(CLAVE_DATOS_EDITADOS)) || '{}');
      editados[clienteEditando.id] = cambios;
      await AsyncStorage.setItem(CLAVE_DATOS_EDITADOS, JSON.stringify(editados));
    } catch {}
    setClienteEditando(null);
  };

  useFocusEffect(useCallback(() => {
    let activo = true;
    api('/alumnos/')
      .then(async (alumnos) => {
        if (!activo) return;
        const alumnosServidor = Array.isArray(alumnos) ? alumnos : [];
        const alumnosConPlan = alumnosServidor
          .map(alumnoACliente)
          .filter((cliente) => ['inicial', 'avanzado'].includes(cliente.plan));
        const lista = await aplicarEditados(alumnosConPlan);
        if (!activo) return;
        setClientes(lista);
        setAvisoDatos(
          lista.length
            ? ''
            : alumnosServidor.length
              ? 'No hay alumnos con un Plan Básico o Avanzado vigente.'
              : 'Todavía no hay alumnos registrados.'
        );
      })
      .catch((error) => {
        if (!activo) return;
        setClientes([]);
        setAvisoDatos(
          error.status === 401 || error.status === 403
            ? 'Inicia sesión como profesional para ver a tus alumnos.'
            : 'No se pudo conectar con el servidor. Inténtalo nuevamente.'
        );
      });
    return () => { activo = false; };
  }, []));
  const [asignacionesRutinas, setAsignacionesRutinas] = useState({});
  const [bibliotecaRutinas, setBibliotecaRutinas] = useState([]);

  // Recarga al volver desde Rutinas para reflejar de inmediato lo que se guardó.
  useFocusEffect(useCallback(() => {
    let activo = true;
    const cargarAsignaciones = async () => {
      try {
        const [asignacionesGuardadas, rutinasGuardadas] = await Promise.all([
          AsyncStorage.getItem(CLAVE_ASIGNACIONES),
          AsyncStorage.getItem(CLAVE_RUTINAS),
        ]);
        if (!activo) return;
        const asignaciones = asignacionesGuardadas ? JSON.parse(asignacionesGuardadas) : {};
        const rutinas = rutinasGuardadas ? JSON.parse(rutinasGuardadas) : [];
        setAsignacionesRutinas(asignaciones && typeof asignaciones === 'object' ? asignaciones : {});
        setBibliotecaRutinas(Array.isArray(rutinas) ? rutinas : []);
      } catch (error) {
        if (activo) {
          setAsignacionesRutinas({});
          setBibliotecaRutinas([]);
        }
      }
    };
    cargarAsignaciones();
    return () => { activo = false; };
  }, []));

  // búsqueda + filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState(TODOS);
  const [filtroObjetivo, setFiltroObjetivo] = useState(TODOS);
  const [filtroPlan, setFiltroPlan] = useState(TODOS);
  const [mostrarFiltros, setMostrarFiltros] = useState(false); // ocultos hasta tocar el botón
  const [filtroAbierto, setFiltroAbierto] = useState(null);

  const filtrosActivos = [filtroEstado, filtroObjetivo, filtroPlan].filter((f) => f !== TODOS).length;
  const hayBusquedaOFiltros = busqueda.trim() !== '' || filtrosActivos > 0;

  // el nombre que se escribe se busca DENTRO de lo que dejan pasar los filtros, useMemo() es para que memorizar y que react no tenga que ejecutarlo nuevamente 
  const clientesFiltrados = useMemo(() => {
    const texto = normalizar(busqueda);
    return clientes
      .filter((c) => filtroEstado === TODOS || c.estado === filtroEstado)
      .filter((c) => filtroObjetivo === TODOS || c.objetivo === filtroObjetivo)
      .filter((c) => filtroPlan === TODOS || c.plan === filtroPlan)
      .filter((c) => texto === '' || normalizar(c.nombre).includes(texto))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [clientes, busqueda, filtroEstado, filtroObjetivo, filtroPlan]);

  const limpiarTodo = () => {
    setBusqueda('');
    setFiltroEstado(TODOS);
    setFiltroObjetivo(TODOS);
    setFiltroPlan(TODOS);
  };

  // ----- navegación a las pantallas de ese cliente -----
  // se manda el id y el nombre; allá se leen con useLocalSearchParams()
  const irA = (pathname, cliente) =>
    router.push({ pathname, params: { clienteId: cliente.id, nombre: cliente.nombre } });

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_clientes.jpg')} />
      {/* encabezado */}
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={26} color={colors.blanco} />
        </TouchableOpacity>
        <Text numberOfLines={1} className="text-blanco text-xl font-masthead ml-4 flex-1">Mis clientes</Text>
        <LogoMarca />
      </View>

      {!!avisoDatos && (
        <View className="flex-row items-center bg-grafito rounded-xl px-4 py-3 mx-5 mb-3">
          <Ionicons name="information-circle-outline" size={18} color={colors.azulClaro} />
          <Text className="text-blanco/70 text-xs ml-2 flex-1">{avisoDatos}</Text>
        </View>
      )}

      {/* barra de búsqueda con lupa + botón que despliega los filtros */}
      <View className="flex-row items-center px-5 mb-3" style={{ gap: 8 }}>
        <View className="flex-1 flex-row items-center bg-grafito rounded-xl px-4" style={{ height: 48 }}>
          <Ionicons name="search" size={18} color={colors.blanco} style={{ opacity: 0.5 }} />
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar cliente por nombre"
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoCorrect={false}
            returnKeyType="search"
            className="text-blanco text-sm ml-3 flex-1"
          />
          {busqueda !== '' && (
            <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={8} accessibilityLabel="Borrar búsqueda">
              <Ionicons name="close-circle" size={18} color={colors.blanco} style={{ opacity: 0.5 }} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={() => setMostrarFiltros((v) => !v)}
          className={`items-center justify-center rounded-xl ${mostrarFiltros ? 'bg-azulClaro' : 'bg-grafito'}`}
          style={{ width: 48, height: 48 }}
          accessibilityLabel={mostrarFiltros ? 'Ocultar filtros' : 'Mostrar filtros'}
        >
          <Ionicons name="options-outline" size={20} color={colors.blanco} />
          {/* globito con la cantidad de filtros puestos, para que se note aunque estén ocultos */}
          {filtrosActivos > 0 && (
            <View
              className="absolute items-center justify-center rounded-full bg-rojo"
              style={{ top: -4, right: -4, width: 18, height: 18 }}
            >
              <Text className="text-blanco text-[13px] font-bold">{filtrosActivos}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* panel de filtros — solo aparece al tocar el botón de arriba */}
     <Modal
      visible={mostrarFiltros}
      transparent
      animationType="slide"
      onRequestClose={() => {
        setMostrarFiltros(false);
        setFiltroAbierto(null);
      }}>
      {/* fondo oscuro */}
        <View
          className="flex-1 justify-end"
          style={{
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          {/* evita cerrar al tocar dentro del panel */}
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              setMostrarFiltros(false);
              setFiltroAbierto(null);
            }}
          />

          {/* PANEL */}
          <View
          className="bg-grafito rounded-t-3xl"
          style={{
            maxHeight: '85%',
          }}
        >
          {/* indicador superior */}
          <View className="items-center pt-3 pb-2">
            <View
              className="rounded-full"
              style={{
                width: 42,
                height: 5,
                backgroundColor: 'rgba(255,255,255,0.35)',
              }}
            />
          </View>

          {/* CONTENIDO SCROLLEABLE */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: 10,
            }}
          >
            {/* encabezado */}
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-blanco text-xl font-bold">
                Filtrar clientes
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setMostrarFiltros(false);
                  setFiltroAbierto(null);
                }}
                hitSlop={10}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={colors.blanco}
                  style={{ opacity: 0.7 }}
                />
              </TouchableOpacity>
            </View>

            {/* ESTADO */}
            <GrupoFiltro
              titulo="Estado"
              opciones={ESTADOS}
              valor={filtroEstado}
              onChange={setFiltroEstado}
              abierto={filtroAbierto === 'estado'}
              onAbrir={() =>
                setFiltroAbierto(
                  filtroAbierto === 'estado' ? null : 'estado'
                )
              }
            />

            {/* OBJETIVO */}
            <GrupoFiltro
              titulo="Objetivo"
              opciones={OBJETIVOS}
              valor={filtroObjetivo}
              onChange={setFiltroObjetivo}
              abierto={filtroAbierto === 'objetivo'}
              onAbrir={() =>
                setFiltroAbierto(
                  filtroAbierto === 'objetivo' ? null : 'objetivo'
                )
              }
            />

            {/* PLAN */}
            <GrupoFiltro
              titulo="Plan"
              opciones={PLANES}
              valor={filtroPlan}
              onChange={setFiltroPlan}
              abierto={filtroAbierto === 'plan'}
              onAbrir={() =>
                setFiltroAbierto(
                  filtroAbierto === 'plan' ? null : 'plan'
                )
              }
            />

            {/* LIMPIAR FILTROS */}
            {filtrosActivos > 0 && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  limpiarTodo();
                  setFiltroAbierto(null);
                }}
                className="items-center py-3"
              >
                <Text className="text-azulClaro text-sm font-bold">
                  Limpiar filtros
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* BOTÓN FIJO */}
          <View
            className="px-5 pt-3 pb-5"
            style={{
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setMostrarFiltros(false);
                setFiltroAbierto(null);
              }}
              className="bg-azulClaro rounded-xl items-center justify-center"
              style={{
                minHeight: 52,
              }}
            >
              <Text className="text-blanco font-bold text-base">
                Aplicar filtros
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </Modal>
      {/* editar peso y grasa corporal: solo el personal trainer */}
      <Modal visible={Boolean(clienteEditando)} transparent animationType="slide" onRequestClose={() => setClienteEditando(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setClienteEditando(null)} />
          <View className="bg-grafito rounded-t-3xl px-5 pt-5 pb-8">
            <Text className="text-blanco text-lg font-masthead">Editar datos de {clienteEditando?.nombre}</Text>
            <Text className="text-blanco/50 text-xs mt-1 mb-4">Puedes corregir el peso y la grasa corporal del cliente.</Text>

            <Text className="text-blanco/50 text-xs mb-2">Peso actual (kg)</Text>
            <TextInput
              value={pesoEditado}
              onChangeText={setPesoEditado}
              keyboardType="decimal-pad"
              placeholder="Ej: 72.5"
              placeholderTextColor="rgba(255,255,255,0.3)"
              className="bg-carbon rounded-xl px-4 text-blanco text-sm mb-4"
              style={{ height: 48 }}
            />

            <Text className="text-blanco/50 text-xs mb-2">
              Grasa corporal (%) <Text className="text-blanco/30">(opcional)</Text>
            </Text>
            <TextInput
              value={grasaEditada}
              onChangeText={setGrasaEditada}
              keyboardType="decimal-pad"
              placeholder="Ej: 22"
              placeholderTextColor="rgba(255,255,255,0.3)"
              className="bg-carbon rounded-xl px-4 text-blanco text-sm mb-5"
              style={{ height: 48 }}
            />

            <View className="flex-row" style={{ gap: 10 }}>
              <TouchableOpacity onPress={() => setClienteEditando(null)} className="flex-1 rounded-full py-3 items-center" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
                <Text className="text-blanco text-sm">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={guardarEdicion} className="flex-1 rounded-full py-3 items-center bg-azulClaro">
                <Text className="text-blanco text-sm font-bold">Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* lista */}
      <FlatList
        data={clientesFiltrados}
        keyExtractor={(c) => c.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 10, flexGrow: 1 }}
        renderItem={({ item }) => (
          <TarjetaCliente
            cliente={item}
            rutinasAsignadas={(Array.isArray(asignacionesRutinas[String(item.id)]) ? asignacionesRutinas[String(item.id)] : []).map((idRutina) => (
              bibliotecaRutinas.find((rutina) => rutina.id === idRutina) || { id: idRutina, titulo: idRutina }
            ))}
            onRutinas={() => irA('/rutinas_coach', item)}
            onNutricion={() => irA('/asignar_nutricion_coach', item)}
            onVideos={() => irA('/videos_coach', item)}
            onMetricas={() => irA('/metricas_coach', item)}
            onEditar={() => abrirEdicion(item)}
            onPerfil={() => router.push({ pathname: '/perfil_cliente_coach', params: { clienteId: String(item.id) } })}
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-6 py-10">
            <Ionicons name="search" size={36} color={colors.blanco} style={{ opacity: 0.2 }} />
            <Text className="text-blanco text-sm font-bold mt-3">
              {clientes.length === 0 ? 'Todavía no tienes clientes' : 'No se encontraron clientes'}
            </Text>
            <Text className="text-blanco/50 text-xs mt-1 text-center">
              {clientes.length === 0
                ? 'Cuando tengas clientes aparecerán aquí.'
                : 'Prueba con otro nombre o cambia los filtros.'}
            </Text>
            {hayBusquedaOFiltros && (
              <TouchableOpacity onPress={limpiarTodo} className="bg-grafito rounded-full px-4 py-2 mt-4">
                <Text className="text-azulClaro text-xs font-bold">Limpiar filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <Boton_barra_coach active="clientes" />
    </SafeAreaView>
  );
}
