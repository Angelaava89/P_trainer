import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import Boton_barra from '../components/Boton_barra';
import { formatearPrecio } from '../constants/index';
import { colors } from '../constants/theme';
import '../global.css';
import { leerCatalogoRutinas, leerRutinasCompradas, guardarRutinaComprada, PRECIO_RUTINA } from '../lib/rutinas';
import { useAuth } from '../context/AuthContext';
import LogoMarca from '../components/LogoMarca';
import FondoThomas from '../components/FondoThomas';

// Convierte los nombres guardados de experiencia y rutina a las tres categorías del catálogo.
function normalizarNivel(nivel) {
  const valor = String(nivel || '')
    .toLocaleLowerCase('es-CL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (['basico', 'principiante', 'inicial'].includes(valor)) return 'basico';
  if (valor === 'intermedio') return 'intermedio';
  if (['avanzado', 'advanced'].includes(valor)) return 'avanzado';
  return '';
}

// El nivel del chip usa el nombre que reconoce el usuario en sus métricas.
function etiquetaNivel(nivel) {
  const categoria = normalizarNivel(nivel);
  if (categoria === 'basico') return 'Básico';
  if (categoria === 'intermedio') return 'Intermedio';
  if (categoria === 'avanzado') return 'Avanzado';
  return nivel || 'Nivel no indicado';
}

// Mantiene una señal de color por nivel usando los tonos que ya ocupa la aplicación.
function colorNivel(nivel) {
  const categoria = normalizarNivel(nivel);
  if (categoria === 'basico') return colors.verde;
  if (categoria === 'intermedio') return colors.azulClaro;
  if (categoria === 'avanzado') return colors.rojo;
  return colors.azulClaro;
}

// Mantiene disponible la rutina comprada para que pueda abrirse otra vez desde el catálogo.
export default function ComprarRutinas() {
  const router = useRouter();
  const parametros = useLocalSearchParams();
  const vista = Array.isArray(parametros.vista) ? parametros.vista[0] : parametros.vista;
  const vistaBiblioteca = vista === 'biblioteca';
  const vistaSoloCompradas = vista === 'mis-rutinas';
  const mostrarSeccionCompradas = vistaBiblioteca || vistaSoloCompradas;
  const { usuario } = useAuth();
  const [cargandoCompras, setCargandoCompras] = useState(true);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [rutinasCompradas, setRutinasCompradas] = useState([]);
  const [rutinasCatalogo, setRutinasCatalogo] = useState([]);
  const [perfil, setPerfil] = useState(usuario || null);

  // La lista de compras se vuelve a leer cada vez que el catálogo recupera el foco.
  useFocusEffect(useCallback(() => {
    let activa = true;

    const cargarCompras = async () => {
      setCargandoCompras(true);
      try {
        const [ids, catalogo] = await Promise.all([
          leerRutinasCompradas(usuario?.correo),
          leerCatalogoRutinas(),
        ]);
        if (activa) {
          setRutinasCompradas(ids);
          setRutinasCatalogo(catalogo);
        }
      } catch (error) {
        if (activa) {
          setRutinasCompradas([]);
          setRutinasCatalogo([]);
        }
      } finally {
        if (activa) setCargandoCompras(false);
      }
    };

    cargarCompras();
    return () => { activa = false; };
  }, [usuario?.correo]));

  // La experiencia se recupera del perfil actualizado en el servidor para recomendar el nivel correcto.
  useFocusEffect(useCallback(() => {
    let activa = true;
    if (usuario) setPerfil(usuario);
    setCargandoPerfil(true);

    api('/perfil/')
      .then((respuesta) => {
        if (!activa) return;
        setPerfil(respuesta?.usuario || respuesta || usuario || null);
      })
      .catch(() => {
        if (activa) setPerfil(usuario || null);
      })
      .finally(() => { if (activa) setCargandoPerfil(false); });

    return () => { activa = false; };
  }, [usuario]));

  const nivelExperiencia = perfil?.datos?.experiencia || usuario?.datos?.experiencia || '';
  const nivelNormalizado = normalizarNivel(nivelExperiencia);
  const rutinasPropias = useMemo(
    () => rutinasCatalogo.filter((rutina) => rutinasCompradas.includes(String(rutina.id))),
    [rutinasCatalogo, rutinasCompradas]
  );
  const rutinasDisponibles = useMemo(
    () => rutinasCatalogo.filter((rutina) => !rutinasCompradas.includes(String(rutina.id))),
    [rutinasCatalogo, rutinasCompradas]
  );
  const recomendaciones = useMemo(() => {
    if (!nivelNormalizado || vistaSoloCompradas) return [];
    return rutinasDisponibles.filter((rutina) => normalizarNivel(rutina.nivel) === nivelNormalizado);
  }, [rutinasDisponibles, nivelNormalizado, vistaSoloCompradas]);
  const recomendacionesCompradas = rutinasPropias.filter(
    (rutina) => normalizarNivel(rutina.nivel) === nivelNormalizado
  );
  const idsRecomendadas = new Set(recomendaciones.map((rutina) => String(rutina.id)));
  const rutinasAdicionales = vistaSoloCompradas
    ? []
    : rutinasDisponibles.filter((rutina) => !idsRecomendadas.has(String(rutina.id)));
  const nombre = perfil?.nombre || usuario?.nombre || 'Cliente';
  const primerNombre = nombre.trim().split(/\s+/)[0];

  // Abre una rutina comprada o registra el pago simulado de una rutina disponible.
  const continuarConRutina = async (rutina, estaComprada) => {
    if (estaComprada) {
      return router.push({ pathname: '/rutina_detalle', params: { id: rutina.id } });
    }

    try {
      const actualizadas = await guardarRutinaComprada(usuario?.correo || perfil?.correo, rutina.id, rutina);
      setRutinasCompradas(actualizadas);
      router.replace('/home');
    } catch (error) {
      Alert.alert('No se pudo completar', 'Intenta nuevamente para habilitar esta rutina.');
    }
  };

  const numeroRutina = (rutina) => rutinasCatalogo.findIndex((item) => String(item.id) === String(rutina.id)) + 1;

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={mostrarSeccionCompradas ? ['top'] : ['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_metricas.jpg')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28, width: '100%', maxWidth: 760, alignSelf: 'center' }}
      >
        {/* El logo queda centrado y el botón permite volver a las tres opciones. */}
        <View className="px-5 pt-2">
          <View className="flex-row items-center mb-5">
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} hitSlop={10} style={{ width: 40 }}>
              <Ionicons name="chevron-back" size={26} color={colors.blanco} />
            </TouchableOpacity>
            <View className="flex-1 items-center"><LogoMarca /></View>
            <View style={{ width: 40 }} />
          </View>

          <Text className="text-blanco text-2xl font-masthead">HOLA, {primerNombre.toLocaleUpperCase('es-CL')}</Text>
          <Text className="text-blanco/60 text-base mt-2">
            {vistaSoloCompradas
              ? 'Accede a las rutinas que ya compraste'
              : vistaBiblioteca
                ? 'Tus rutinas compradas y otras para descubrir'
                : 'Tu progreso y tus planes, en un solo lugar'}
          </Text>

          <View className="self-start flex-row items-center rounded-full px-4 py-2 mt-4" style={{ borderWidth: 1, borderColor: colors.azulClaro, backgroundColor: 'rgba(37,117,255,0.10)' }}>
            <Ionicons name="barbell" size={20} color={colors.azulClaro} />
            <Text className="text-azulClaro text-sm font-bold ml-2">
              Nivel: {cargandoPerfil ? 'Cargando…' : etiquetaNivel(nivelExperiencia)}
            </Text>
          </View>

          <Text className="text-blanco text-xl font-masthead mt-6">
            {vistaSoloCompradas ? 'Mis rutinas' : 'Comprar rutinas'}
          </Text>
          {!vistaSoloCompradas && (
            <Text className="text-blanco/55 text-sm mt-1">Cada rutina cuesta {formatearPrecio(PRECIO_RUTINA)}</Text>
          )}
        </View>

        <View className="px-5 mt-6">
          {vistaSoloCompradas && cargandoCompras && (
            <ActivityIndicator color={colors.azulClaro} style={{ marginTop: 24 }} />
          )}

          {vistaSoloCompradas && !cargandoCompras && rutinasPropias.length === 0 && (
            <View className="bg-grafito rounded-2xl p-5 items-center">
              <Text className="text-blanco/60 text-sm text-center">Todavía no tienes rutinas compradas.</Text>
            </View>
          )}

          {!vistaSoloCompradas && (
            <>
          <EncabezadoSeccion titulo="Recomendadas para ti" detalle="Rutinas acordes a tu nivel de experiencia" />

          {cargandoPerfil ? (
            <View className="items-center py-6">
              <ActivityIndicator color={colors.azulClaro} />
              <Text className="text-blanco/50 text-xs mt-3">Buscando recomendaciones…</Text>
            </View>
          ) : recomendaciones.length ? (
            <View style={{ gap: 12 }}>
              {recomendaciones.map((rutina) => (
                <TarjetaRutina
                  key={`recomendada-${rutina.id}`}
                  rutina={rutina}
                  numero={numeroRutina(rutina)}
                  comprada={rutinasCompradas.includes(String(rutina.id))}
                  cargando={cargandoCompras}
                  onPress={() => continuarConRutina(rutina, rutinasCompradas.includes(String(rutina.id)))}
                />
              ))}
            </View>
          ) : (
            <View className="bg-grafito rounded-2xl p-4" style={{ borderWidth: 1, borderColor: colors.azulOscuro }}>
              <Text className="text-blanco text-sm font-bold">
                {vistaBiblioteca && recomendacionesCompradas.length
                  ? 'Ya tienes las rutinas recomendadas para tu nivel.'
                  : nivelNormalizado
                    ? `Todavía no hay rutinas predeterminadas de nivel ${etiquetaNivel(nivelExperiencia)}.`
                    : 'Completa tus métricas para recibir recomendaciones personalizadas.'}
              </Text>
              <Text className="text-blanco/50 text-xs mt-1">Puedes revisar todas las rutinas disponibles más abajo.</Text>
            </View>
          )}

          {rutinasAdicionales.length > 0 && (
            <>
              <View className="my-6" style={{ height: 2, backgroundColor: colors.azulOscuro }} />
              <EncabezadoSeccion
                titulo={vistaBiblioteca ? 'Más rutinas para comprar' : 'Todas las rutinas'}
                detalle={vistaBiblioteca ? 'Explora las otras rutinas disponibles' : 'Explora el catálogo completo'}
              />
            </>
          )}

          {cargandoCompras ? (
            <ActivityIndicator color={colors.azulClaro} style={{ marginTop: 30 }} />
          ) : rutinasAdicionales.length ? (
            <View style={{ gap: 12 }}>
              {rutinasAdicionales.map((rutina) => {
                const id = String(rutina.id);
                const comprada = rutinasCompradas.includes(id);
                return (
                  <TarjetaRutina
                    key={id}
                    rutina={rutina}
                    numero={numeroRutina(rutina)}
                    comprada={comprada}
                    cargando={cargandoCompras}
                    onPress={() => continuarConRutina(rutina, comprada)}
                  />
                );
              })}
            </View>
          ) : (
            <View className="bg-grafito rounded-2xl p-5 items-center">
              <Text className="text-blanco/60 text-sm text-center">
                {vistaBiblioteca && rutinasDisponibles.length === 0
                  ? 'Ya compraste todas las rutinas disponibles.'
                  : vistaBiblioteca
                    ? 'No hay más rutinas fuera de las recomendadas. Puedes comprarlas desde la sección superior.'
                    : 'Aún no hay rutinas disponibles en el catálogo.'}
              </Text>
            </View>
          )}
            </>
          )}

          {mostrarSeccionCompradas && rutinasPropias.length > 0 && (
            <View className="mt-7 mb-4">
              <EncabezadoSeccion
                titulo={vistaBiblioteca ? 'Rutinas que ya compraste' : 'Tus entrenamientos'}
                detalle="Tus rutinas guardadas, listas para abrir cuando quieras"
              />
              <View style={{ gap: 12 }}>
                {rutinasPropias.map((rutina) => (
                  <TarjetaRutina
                    key={`comprada-${rutina.id}`}
                    rutina={rutina}
                    numero={numeroRutina(rutina)}
                    comprada
                    onPress={() => continuarConRutina(rutina, true)}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      {mostrarSeccionCompradas && <Boton_barra active={vistaSoloCompradas ? 'mis-rutinas' : 'inicio'} />}
    </SafeAreaView>
  );
}

// El acento vertical y el subtítulo separan las recomendaciones del catálogo completo.
function EncabezadoSeccion({ titulo, detalle }) {
  return (
    <View className="flex-row mb-4">
      <View className="rounded-full mr-3" style={{ width: 5, backgroundColor: colors.azulClaro }} />
      <View className="flex-1">
        <Text className="text-blanco text-lg font-bold">{titulo}</Text>
        <Text className="text-blanco/55 text-sm mt-1">{detalle}</Text>
      </View>
    </View>
  );
}

// La tarjeta identifica la rutina, y diferencia el acceso de una compra pendiente.
function TarjetaRutina({ rutina, numero, comprada, cargando = false, onPress }) {
  const nivel = etiquetaNivel(rutina.nivel);
  const acento = colorNivel(rutina.nivel);
  const cantidadEjercicios = (rutina.dias || []).reduce(
    (total, dia) => total + (Array.isArray(dia.ejercicios) ? dia.ejercicios.length : 0),
    0
  );
  const resumen = rutina.enfoqueRutina || rutina.descripcion || 'Rutina de entrenamiento';
  const nombreRutina = rutina.titulo || `Rutina ${numero}`;
  const tituloPrincipal = comprada ? nombreRutina : rutina.nombre || nombreRutina;
  const precio = formatearPrecio(PRECIO_RUTINA);

  return (
    <View className="bg-grafito rounded-2xl p-4" style={{ borderWidth: 1.2, borderColor: acento }}>
      <View className="flex-row items-center">
        <View className="items-center justify-center rounded-2xl" style={{ width: 58, height: 58, backgroundColor: `${acento}20` }}>
          <Ionicons name="barbell-outline" size={29} color={acento} />
        </View>

        <View className="flex-1 ml-3" style={{ minWidth: 0 }}>
          <Text className="text-xs font-bold" style={{ color: acento }}>{comprada ? 'TU RUTINA' : `RUTINA ${numero}`}</Text>
          <Text numberOfLines={2} className="text-blanco text-base font-bold mt-1">{tituloPrincipal}</Text>
          <Text numberOfLines={2} className="text-blanco/60 text-xs mt-1">{resumen}</Text>
          <View className="flex-row flex-wrap items-center mt-2" style={{ gap: 6 }}>
            <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${acento}30` }}>
              <Text className="text-xs font-bold" style={{ color: acento }}>{nivel.toLocaleUpperCase('es-CL')}</Text>
            </View>
            {cantidadEjercicios > 0 && (
              <View className="flex-row items-center rounded-full px-2 py-1" style={{ borderWidth: 1, borderColor: colors.azulOscuro }}>
                <Ionicons name="barbell-outline" size={13} color={colors.blanco} />
                <Text className="text-blanco/75 text-xs ml-1">{cantidadEjercicios} ejercicios</Text>
              </View>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={23} color={colors.blanco} style={{ opacity: 0.65, marginLeft: 6 }} />
      </View>

      <View className="flex-row items-center justify-between mt-4 pt-3" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' }}>
        {comprada ? (
          <View className="flex-row items-center flex-1">
            <Ionicons name="checkmark-circle" size={17} color={colors.verde} />
            <Text className="text-blanco/60 text-xs ml-2">Disponible en tus rutinas</Text>
          </View>
        ) : <Text className="text-blanco text-sm font-bold">{precio}</Text>}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={comprada ? `Abrir ${nombreRutina}` : `Comprar ${nombreRutina} por ${precio}`}
          disabled={cargando}
          className={`flex-row items-center justify-center rounded-full px-4 py-2 ${comprada ? 'bg-carbon' : 'bg-azulClaro'}`}
          onPress={onPress}
          style={{ opacity: cargando ? 0.6 : 1, borderWidth: comprada ? 1 : 0, borderColor: comprada ? colors.azulOscuro : 'transparent' }}
        >
          <Text className="text-blanco text-xs font-bold">{comprada ? 'Abrir rutina' : 'Comprar rutina'}</Text>
          <Ionicons name={comprada ? 'chevron-forward' : 'cart-outline'} size={16} color={colors.blanco} style={{ marginLeft: 6, opacity: comprada ? 0.75 : 1 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
