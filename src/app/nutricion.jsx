import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import Boton_barra from '../components/Boton_barra';
import FondoThomas from '../components/FondoThomas';
import LogoMarca from '../components/LogoMarca';
import { colors } from '../constants/theme';
import '../global.css';

// Arriba se elige el tipo de día; abajo se listan las comidas que el coach asignó para ese tipo.
// key = tipo_dia que guarda la base de datos en cada día de la dieta.
const TIPOS_DIA = [
  { key: 'Entrenamiento', label: 'Días de entrenamiento', icono: 'barbell-outline' },
  { key: 'Descanso', label: 'Días de descanso', icono: 'bed-outline' },
];
// Nombres de siempre en pantalla; "campo" es donde se guarda cada uno en el día de la dieta (DiaDietaModel).
// Debe coincidir con CAMPO_COMIDA de asignar_nutricion_coach.jsx.
const COMIDAS = [
  { nombre: 'Desayuno', campo: 'comida1', icono: 'cafe-outline' },
  { nombre: 'Media mañana', campo: 'comida2', icono: 'nutrition-outline' },
  { nombre: 'Almuerzo', campo: 'comida3', icono: 'restaurant-outline' },
  { nombre: 'Media tarde', campo: 'pre_entreno', icono: 'ice-cream-outline' },
  { nombre: 'Cena', campo: 'intra_entreno', icono: 'moon-outline' },
  { nombre: 'Medianoche', campo: 'medianoche', icono: 'cloudy-night-outline' },
  { nombre: 'Snack', campo: 'snack', icono: 'fast-food-outline' },
  { nombre: 'Suplementos', campo: 'suplementos', icono: 'medkit-outline' },
];
// El coach deja "-" en lo que no llenó.
const VACIO = '-';

// Cada comida llega como texto, un alimento por línea: "Avena · 100 g".
const leerAlimentos = (texto) => String(texto || '')
  .split('\n')
  .map((linea) => linea.trim())
  .filter((linea) => linea && linea !== VACIO)
  .map((linea) => {
    const partes = linea.match(/^(.*?)\s*·\s*(\d+)\s*g$/);
    return partes ? { nombre: partes[1].trim(), gramos: partes[2] } : { nombre: linea, gramos: '' };
  });
const conValor = (texto) => (String(texto || '').trim() && String(texto).trim() !== VACIO ? String(texto).trim() : '');

// La vista de nutrición presenta la última dieta que el entrenador guardó para el alumno (/dietas/mis-dietas/).
export default function Nutricion() {
  const router = useRouter();
  const [dieta, setDieta] = useState(null);
  const [tipoDia, setTipoDia] = useState('Entrenamiento');
  const [selectorTipoDiaAbierto, setSelectorTipoDiaAbierto] = useState(false);
  const [glosarioVisible, setGlosarioVisible] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState('');

  // Se usa la dieta más reciente que el coach guardó.
  useFocusEffect(useCallback(() => {
    let activa = true;
    setCargando(true);
    api('/dietas/mis-dietas/')
      .then((respuesta) => {
        if (!activa) return;
        const dietas = Array.isArray(respuesta?.dietas) ? respuesta.dietas : [];
        setDieta(dietas[dietas.length - 1] || null);
        setAviso('');
      })
      .catch((error) => {
        if (!activa) return;
        setDieta(null);
        setAviso(error?.message || 'No se pudo cargar tu plan de nutrición.');
      })
      .finally(() => { if (activa) setCargando(false); });
    return () => { activa = false; };
  }, []));

  // Día de la dieta que corresponde al tipo elegido (Entrenamiento o Descanso).
  const diaElegido = useMemo(
    () => (Array.isArray(dieta?.dias) ? dieta.dias : []).find((dia) => dia?.tipo_dia === tipoDia) || null,
    [dieta, tipoDia]
  );

  // Comidas del tipo de día elegido con sus alimentos.
  const comidasDelDia = useMemo(() => COMIDAS.map((comida) => ({
    ...comida,
    // Si una dieta antigua no trae suplementos en el día, se muestran los de la dieta completa.
    alimentos: leerAlimentos(diaElegido?.[comida.campo]).length || comida.campo !== 'suplementos'
      ? leerAlimentos(diaElegido?.[comida.campo])
      : leerAlimentos(dieta?.suplementos),
  })), [dieta, diaElegido]);

  // Agua del día elegido; si el coach aún no la asigna, se muestra la del plan base: 2 a 3 litros.
  const objetivoAgua = conValor(diaElegido?.agua) || '2–3 L';
  const indicaciones = [
    { titulo: 'TMB', texto: conValor(dieta?.tmb) },
    { titulo: 'Macros', texto: conValor(dieta?.macros) },
    { titulo: 'Notas', texto: conValor(dieta?.notas) },
  ].filter((item) => item.texto);

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_perfil.jpg')} />
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <TouchableOpacity accessibilityLabel="Volver" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={colors.blanco} />
        </TouchableOpacity>
        <Text numberOfLines={1} className="text-blanco text-xl font-masthead ml-4 flex-1">Mi Nutrición</Text>
        <LogoMarca />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Abrir glosario de entrenamiento y cardio"
          onPress={() => setGlosarioVisible(true)}
          className="flex-row items-center bg-grafito rounded-2xl px-4 py-3 mb-4"
          style={{ borderWidth: 1, borderColor: colors.azulOscuro }}
        >
          <Ionicons name="book-outline" size={21} color={colors.azulClaro} />
          <Text className="text-blanco text-sm font-bold flex-1 ml-3">Glosario</Text>
          <Ionicons name="chevron-forward" size={19} color={colors.gris} />
        </TouchableOpacity>

        {/* Un selector compacto permite cambiar entre el menú de entrenamiento y el de descanso. */}
        <View className="mb-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Tipo de día seleccionado: ${TIPOS_DIA.find((opcion) => opcion.key === tipoDia)?.label || 'Días de entrenamiento'}`}
            accessibilityState={{ expanded: selectorTipoDiaAbierto }}
            onPress={() => setSelectorTipoDiaAbierto((abierto) => !abierto)}
            className="flex-row items-center bg-grafito rounded-2xl px-4 py-4"
            style={{ borderWidth: 1, borderColor: colors.azulOscuro }}
          >
            <Ionicons name={TIPOS_DIA.find((opcion) => opcion.key === tipoDia)?.icono || 'barbell-outline'} size={22} color={colors.azulClaro} />
            <Text className="text-blanco text-sm font-bold flex-1 ml-3">
              {TIPOS_DIA.find((opcion) => opcion.key === tipoDia)?.label || 'Días de entrenamiento'}
            </Text>
            <Ionicons name={selectorTipoDiaAbierto ? 'chevron-up' : 'chevron-down'} size={20} color={colors.blanco} />
          </TouchableOpacity>

          {selectorTipoDiaAbierto && (
            <View className="bg-grafito rounded-2xl mt-2 overflow-hidden" style={{ borderWidth: 1, borderColor: colors.azulOscuro }}>
              {TIPOS_DIA.map((opcion, indice) => {
                const activa = tipoDia === opcion.key;
                return (
                  <TouchableOpacity
                    key={opcion.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activa }}
                    onPress={() => {
                      setTipoDia(opcion.key);
                      setSelectorTipoDiaAbierto(false);
                    }}
                    className="flex-row items-center px-4 py-4"
                    style={indice > 0 ? { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' } : undefined}
                  >
                    <Ionicons name={opcion.icono} size={21} color={activa ? colors.azulClaro : colors.gris} />
                    <Text className={`text-sm flex-1 ml-3 ${activa ? 'text-blanco font-bold' : 'text-blanco/70'}`}>{opcion.label}</Text>
                    {activa && <Ionicons name="checkmark" size={20} color={colors.azulClaro} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* La recomendación de agua queda como una referencia breve para ambos tipos de día. */}
        <View
          className="flex-row items-center rounded-xl px-3 py-2 mb-3"
          style={{ backgroundColor: 'rgba(18,22,29,0.76)', borderWidth: 1, borderColor: 'rgba(47,111,224,0.22)' }}
        >
          <Ionicons name="water-outline" size={17} color={colors.azulClaro} />
          <Text className="text-blanco/55 text-xs flex-1 ml-2">Agua diaria</Text>
          <Text className="text-blanco/75 text-xs font-semibold">{objetivoAgua}</Text>
        </View>

        {cargando ? (
          <View className="bg-grafito rounded-2xl p-5"><Text className="text-blanco/60 text-sm">Cargando tu plan…</Text></View>
        ) : !!aviso ? (
          <View className="bg-grafito rounded-2xl p-6 items-center mt-1">
            <Ionicons name="nutrition-outline" size={34} color={colors.azulClaro} />
            <Text className="text-blanco text-sm font-bold mt-3">No se pudo mostrar el plan</Text>
            <Text className="text-blanco/50 text-xs text-center mt-2">{aviso}</Text>
          </View>
        ) : (
          <>
            {indicaciones.length > 0 && (
              <View className="bg-grafito rounded-2xl p-4 mb-4">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="clipboard-outline" size={17} color={colors.azulClaro} />
                  <Text className="text-blanco text-base font-bold ml-2">Indicaciones del coach</Text>
                </View>
                {indicaciones.map((item) => (
                  <Text key={item.titulo} className="text-blanco/75 text-sm leading-6"><Text className="font-bold text-blanco">{item.titulo}: </Text>{item.texto}</Text>
                ))}
              </View>
            )}
            {comidasDelDia.map((comida) => (
          <View key={comida.nombre} className="mb-4">
            {/* Título de la comida (Desayuno, Media mañana, Almuerzo, Media tarde, Cena, Medianoche, Snack, Suplementos) */}
            <View className="flex-row items-center mb-2">
              <Ionicons name={comida.icono} size={17} color={colors.azulClaro} />
              <Text className="text-blanco text-base font-bold ml-2">{comida.nombre}</Text>
            </View>
            {comida.alimentos.length === 0 ? (
              <View className="bg-grafito rounded-2xl px-4 py-3">
                <Text className="text-blanco/45 text-xs">Sin comidas asignadas por ahora.</Text>
              </View>
            ) : (
            <View className="bg-grafito rounded-2xl p-4 mb-2">
              <View className="flex-row items-center">
                <View className="items-center justify-center rounded-xl bg-carbon" style={{ width: 42, height: 42 }}>
                  <Ionicons name="restaurant-outline" size={21} color={colors.azulClaro} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-blanco text-base font-bold">{comida.nombre}</Text>
                  <Text className="text-blanco/45 text-xs mt-1">{comida.alimentos.length} {comida.alimentos.length === 1 ? 'alimento' : 'alimentos'}</Text>
                </View>
              </View>
              <View className="mt-3 pt-2" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' }}>
                {comida.alimentos.map((alimento, posicion) => (
                  <View key={`${alimento.nombre}-${posicion}`} className="flex-row items-center justify-between py-2">
                    <View className="flex-row items-center flex-1 mr-3">
                      <View className="rounded-full bg-azulClaro mr-2" style={{ width: 5, height: 5 }} />
                      <Text className="text-blanco/80 text-sm flex-1">{alimento.nombre}</Text>
                    </View>
                    {!!alimento.gramos && <Text className="text-azulClaro text-xs font-bold">{alimento.gramos} g</Text>}
                  </View>
                ))}
              </View>
            </View>
            )}
          </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={glosarioVisible} transparent animationType="fade" onRequestClose={() => setGlosarioVisible(false)}>
        <View className="flex-1 justify-center px-5" style={{ backgroundColor: 'rgba(0,0,0,0.78)' }}>
          <View className="bg-grafito rounded-3xl overflow-hidden" style={{ maxHeight: '86%', borderWidth: 1, borderColor: colors.azulOscuro }}>
            <View className="flex-row items-center px-5 pt-5 pb-3">
              <Text className="text-blanco text-xl font-bold flex-1">Glosario</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar glosario" onPress={() => setGlosarioVisible(false)} className="p-2">
                <Ionicons name="close" size={24} color={colors.gris} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 22 }}>
              <View className="mb-5">
                <Text className="text-azulClaro text-base font-bold mb-2">Split</Text>
                <Text className="text-blanco/75 text-sm leading-6">4 total training days</Text>
                <Text className="text-blanco/75 text-sm leading-6">Ideal training sequence: 1, Rest, 2, 3, Rest, 4, Rest, Repeat.</Text>
              </View>

              <View className="mb-5">
                <Text className="text-azulClaro text-base font-bold mb-2">Cardio</Text>
                <Text className="text-blanco/75 text-sm leading-6">Caminata inclinada o subida de 1 hora min de lunes a viernes (6 days).</Text>
                <Text className="text-blanco/75 text-sm leading-6 mt-2">Fin de semana: 1 día salir a caminar en ayuno min 30 min.</Text>
                <Text className="text-blanco/75 text-sm leading-6 mt-2">Durante el cardio siempre con L-carnitina y BCAAS.</Text>
                <Text className="text-blanco/75 text-sm leading-6 mt-2">En los días de descanso de fierros hacer 5 piques en subida a máxima velocidad.</Text>
                <Text className="text-blanco/50 text-xs leading-5 mt-2">No hacerlo con la guata vacía o sin haber comido una meal hace más de 3 horas, menos en ayuno.</Text>
              </View>

              <View>
                <Text className="text-azulClaro text-base font-bold mb-2">Glossary</Text>
                <Text className="text-blanco/75 text-sm leading-6"><Text className="font-bold text-blanco">A:</Text> Max intensity sets</Text>
                <Text className="text-blanco/75 text-sm leading-6 mt-2"><Text className="font-bold text-blanco">B:</Text> Mid-high intensity sets (pump focused)</Text>
                <Text className="text-blanco/75 text-sm leading-6 mt-2"><Text className="font-bold text-blanco">Rer:</Text> Rep in Reserve</Text>
                <Text className="text-blanco/75 text-sm leading-6 mt-2"><Text className="font-bold text-blanco">Drop set:</Text> 2 weight downs with no rest till failure.</Text>
                <Text className="text-blanco/75 text-sm leading-6 mt-2"><Text className="font-bold text-blanco">Rest Pause:</Text> 2 extra sets with 20–30 sec rest in between and an all-out set working with the same weight or slightly less till failure.</Text>
                <Text className="text-blanco/75 text-sm leading-6 mt-2"><Text className="font-bold text-blanco">Negatives:</Text> 1–3 reps of just holding the weight for the most amount of time after completing the rep or doing a new one just to complete the negative reps.</Text>
                <Text className="text-blanco/75 text-sm leading-6 mt-2"><Text className="font-bold text-blanco">Frequency:</Text> Repetition rhythm tempo from the positive force to the negative.</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Boton_barra active="inicio" />
    </SafeAreaView>
  );
}
