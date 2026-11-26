import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import FondoThomas from '../components/FondoThomas';
import LogoMarca from '../components/LogoMarca';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useMetricas } from '../context/MetricasContext';
import { guardarSexoUsuario } from '../lib/sexoUsuario';
import '../global.css';

const objetivos = ['Ganancia muscular', 'Pérdida de grasa', 'Mantenimiento', 'Resistencia'];
const niveles = ['Principiante', 'Intermedio', 'Avanzado'];
const sexo =['Femenino','Masculino'];
// La base de datos acepta "Mujer" / "Hombre"; los botones siguen mostrando Femenino / Masculino.
const SEXO_BD = { Femenino: 'Mujer', Masculino: 'Hombre' };
const coloresNivel = {
  Principiante: 'bg-verde',
  Intermedio: ' bg-azulClaro',
  Avanzado: 'bg-rojo',
};
const coloresSexo = {
  Femenino: 'bg-verde',
  Masculino: 'bg-rojo',
};
// Lesiones (LesionModel en models.py: fecha, areaCorporal, detalle, reposo)
const zonasCuerpo = ['Cuello', 'Hombro', 'Codo', 'Muñeca', 'Espalda', 'Cadera', 'Rodilla', 'Tobillo', 'Otra'];

// Fecha de hoy en formato AAAA-MM-DD (el que acepta el DateField de Django)
function fechaDeHoy() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}


// chip seleccionable — se repite para objetivos y niveles, así que lo armamos una sola vez
function Chip({ label, seleccionado, onPress, colorSeleccionado = 'bg-azulClaro' }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-2 rounded-full mr-2 mb-2 ${seleccionado ? colorSeleccionado : 'bg-grafito'}`}
    >
      <Text className={`text-xs ${seleccionado ? 'text-blanco font-bold' : 'text-blanco/60'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function RegistroMetricas() {
  const router = useRouter();
  const parametros = useLocalSearchParams();
  const origenRegistro = Array.isArray(parametros.origenRegistro) ? parametros.origenRegistro[0] : parametros.origenRegistro;
  // los hooks siempre van DENTRO del componente
  const { recargar, guardarPerfil } = useMetricas();
  const { usuario } = useAuth(); // null si la cuenta se creó sin conexión
  const [altura, setAltura] = useState('');
  const [peso, setPeso] = useState('');
  // % de grasa corporal (opcional): se guarda en datos.grasaCorporal.
  const [grasa, setGrasa] = useState('');
  const [objetivo, setObjetivo] = useState(null);
  const [nivel, setNivel] = useState(null);
  const [sexoSeleccionado, setSexoSeleccionado] = useState(null);
  // opcional: distribución de entrenamiento que usa hoy (ej. Push/Pull/Legs).
  // Por ahora solo se muestra; no se envía porque "datos" no tiene este campo en la base de datos.
  const [tieneSplit, setTieneSplit] = useState(false);
  const [splitActual, setSplitActual] = useState('');

  // lesiones: lista de { fecha, areaCorporal, detalle, reposo }
  const [tieneLesion, setTieneLesion] = useState(false);
  const [lesiones, setLesiones] = useState([]);
  const [zona, setZona] = useState(null);
  const [zonaOtra, setZonaOtra] = useState('');
  const [detalleLesion, setDetalleLesion] = useState('');
  const [reposo, setReposo] = useState(null);

  // alergias: texto libre que escribe la persona (opcional)
  const [tieneAlergia, setTieneAlergia] = useState(false);
  const [alergias, setAlergias] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Arma la lesión que se está escribiendo; devuelve null si está incompleta
  const lesionEnCurso = () => {
    const area = zona === 'Otra' ? zonaOtra.trim() : zona;
    if (!area || !reposo) return null;
    return { fecha: fechaDeHoy(), areaCorporal: area, detalle: detalleLesion.trim(), reposo };
  };

  const limpiarLesionEnCurso = () => {
    setZona(null);
    setZonaOtra('');
    setDetalleLesion('');
    setReposo(null);
  };

  const agregarLesion = () => {
    const nueva = lesionEnCurso();
    if (!nueva) {
      Alert.alert('Faltan datos de la lesión', 'Elige la zona del cuerpo e indica si estás en reposo.');
      return;
    }
    setLesiones((lista) => [...lista, nueva]);
    limpiarLesionEnCurso();
  };

  const handleGuardar = async () => {
    if (guardando) return; // evita doble toque

    const alturaValor = Number(altura.replace(',', '.'));
    const pesoValor = Number(peso.replace(',', '.'));
    if (!Number.isFinite(alturaValor) || alturaValor < 80 || alturaValor > 250) {
      Alert.alert('Altura inválida', 'Ingresa una altura entre 80 y 250 cm.');
      return;
    }
    if (!Number.isFinite(pesoValor) || pesoValor < 20 || pesoValor > 350) {
      Alert.alert('Peso inválido', 'Ingresa un peso entre 20 y 350 kg.');
      return;
    }
    const grasaTexto = grasa.trim();
    const grasaValor = grasaTexto ? Number(grasaTexto.replace(',', '.')) : null;
    if (grasaTexto && (!Number.isFinite(grasaValor) || grasaValor < 2 || grasaValor > 70)) {
      Alert.alert('% de grasa inválido', 'Ingresa un porcentaje entre 2 y 70, o déjalo vacío.');
      return;
    }
    // Django exige objetivo y experiencia la primera vez que se guardan los datos
    if (!objetivo) {
      Alert.alert('Falta tu objetivo', 'Elige un objetivo.');
      return;
    }
    if (!nivel) {
      Alert.alert('Falta tu experiencia', 'Elige tu nivel de experiencia.');
      return;
    }
    if (!sexoSeleccionado) {
  Alert.alert('Falta tu sexo', 'Selecciona Femenino o Masculino.');
  return;
    }

    // Lesiones: las de la lista + la que quedó escrita sin apretar "Agregar"
    let lesionesFinales = [];
    if (tieneLesion) {
      const pendiente = lesionEnCurso();
      lesionesFinales = pendiente ? [...lesiones, pendiente] : lesiones;
      if (lesionesFinales.length === 0) {
        Alert.alert('Faltan datos de la lesión', 'Agrega al menos una lesión o marca "No" en lesiones.');
        return;
      }
    }

    // Alergias: cada una separada por coma queda como un elemento { tipo } en Mongo
    // "intolerante a la lactosa, celíaca" -> [{ tipo: "intolerante a la lactosa" }, { tipo: "celíaca" }]
    const alergiasFinales = alergias
      .split(/[,;\n]/)
      .map((a) => a.trim())
      .filter(Boolean)
      .map((tipo) => ({ tipo: tipo.slice(0, 100) }));

    try {
      setGuardando(true);

      // Guarda en Mongo Atlas, dentro de "datos" del usuario (PATCH /api/datos/)
      let enServidor = false;
      if (usuario) {
        await api('/datos/', {
          method: 'PATCH',
          body: {
            altura: alturaValor,
            pesoActual: pesoValor,
            ...(grasaValor != null ? { grasaCorporal: grasaValor } : {}),
            objetivo,
            experiencia: nivel,
            lesion: lesionesFinales,
            alergia: alergiasFinales,
            sexo: SEXO_BD[sexoSeleccionado] || 'Otro',
            // Campo opcional: Django no acepta texto vacío, así que sin split se guarda "Sin split actual".
            splitActual: (tieneSplit && splitActual.trim()) ? splitActual.trim().slice(0, 300) : 'Sin split actual',
          },
        });
        enServidor = true;
      }

      // El sexo se conserva por cuenta en el dispositivo para recalcular el TMB en el perfil sin ampliar la base de datos.
      try {
        await guardarSexoUsuario(usuario, sexoSeleccionado);
      } catch {
        // El cálculo del resultado actual sigue funcionando aunque falle el almacenamiento local.
      }

      // El peso ya quedó en datos.pesoActual con el PATCH de arriba; se recarga para que Progreso lo muestre.
      await recargar();
      await guardarPerfil({ altura: alturaValor, objetivo, nivel, lesiones: lesionesFinales, alergias: alergiasFinales });

      // muestra el resultado del IMC con su gráfico y recomendaciones
      router.replace({
        pathname: '/resultado_imc',
        params: {
          sexo: sexoSeleccionado.toLowerCase(),
          altura: String(alturaValor),
          peso: String(pesoValor),
          sinConexion: enServidor ? '' : '1',
          origenRegistro: origenRegistro || '',
        },
        
      });
    } catch (e) {
      Alert.alert('No se pudo guardar', e?.message ?? 'Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_metricas.jpg')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <View className="px-6 pt-2">
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity onPress={() => router.back()} >
              <Ionicons name="chevron-back" size={26} color={colors.blanco} />
            </TouchableOpacity>
            <LogoMarca />
          </View>
          {/*name="chevron-back"indica qué ícono quieres mostrar*/}

          <Text className="text-blanco text-2xl font-masthead">Tus métricas</Text>
          <Text className="text-blanco/50 text-sm mt-1 mb-8">
            Cuéntanos un poco de ti para armar tu plan
          </Text>
           {/* nivel de experiencia */}
          <Text className="text-blanco/50 text-xs mt-4 mb-2">Genero</Text>
          <View className="flex-row flex-wrap">
            {sexo.map((n) => (
              <Chip
                  key={n}
                  label={n}
                  seleccionado={sexoSeleccionado === n}
                  onPress={() => setSexoSeleccionado(n)}
                  colorSeleccionado={coloresSexo[n]}
                />
            ))}
          </View>
          {/* altura y peso lado a lado */}
          <View className="flex-row" style={{ gap: 12 }}>
            
            <View className="flex-1">
              <Text className="text-blanco/50 text-xs mb-2">Altura (cm)</Text>
              <TextInput
                placeholder="178"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="numeric"
                value={altura}
                onChangeText={setAltura}
                className="bg-grafito rounded-xl px-4 text-blanco text-sm"
                style={{ height: 50 }}
              />
            </View>

            <View className="flex-1">
              <Text className="text-blanco/50 text-xs mb-2">Peso actual (kg)</Text>
              <TextInput
                placeholder="77.2"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="numeric"
                value={peso}
                onChangeText={setPeso}
                className="bg-grafito rounded-xl px-4 text-blanco text-sm"
                style={{ height: 50 }}
              />
            </View>
          </View>

          {/* % de grasa corporal (opcional) */}
          <Text className="text-blanco/50 text-xs mt-4 mb-2">% de grasa corporal (opcional)</Text>
          <TextInput
            placeholder="Ej: 18"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="numeric"
            value={grasa}
            onChangeText={setGrasa}
            className="bg-grafito rounded-xl px-4 text-blanco text-sm"
            style={{ height: 50 }}
          />

          {/* objetivo */}
          <Text className="text-blanco/50 text-xs mt-6 mb-2">Objetivo</Text>
          <View className="flex-row flex-wrap">
            {objetivos.map((o) => (
              <Chip key={o} label={o} seleccionado={objetivo === o} onPress={() => setObjetivo(o)} />
            ))}
          </View>

          {/* nivel de experiencia */}
          <Text className="text-blanco/50 text-xs mt-4 mb-2">Nivel de experiencia</Text>
          <View className="flex-row flex-wrap">
            {niveles.map((n) => (
              <Chip
                  key={n}
                  label={n}
                  seleccionado={nivel === n}
                  onPress={() => setNivel(n)}
                  colorSeleccionado={coloresNivel[n]}
                />
            ))}
          </View>

          {/* split actual (opcional): si elige "No", el campo queda deshabilitado */}
          <Text className="text-blanco/50 text-xs mt-4 mb-2">
            ¿Tienes un split actual? <Text className="text-blanco/30">(opcional)</Text>
          </Text>
          <View className="flex-row flex-wrap">
            <Chip
              label="No"
              seleccionado={!tieneSplit}
              onPress={() => {
                setTieneSplit(false);
                setSplitActual('');
              }}
            />
            <Chip label="Sí" seleccionado={tieneSplit} onPress={() => setTieneSplit(true)} />
          </View>
          <TextInput
            placeholder={tieneSplit ? 'Ej: Push/Pull/Legs, Torso/Pierna, Full body' : 'Sin split actual'}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={splitActual}
            onChangeText={setSplitActual}
            editable={tieneSplit}
            maxLength={50}
            className="bg-grafito rounded-xl px-4 text-blanco text-sm"
            style={{ height: 50, opacity: tieneSplit ? 1 : 0.5 }}
          />

          {/* ---------- lesiones ---------- */}
          <Text className="text-blanco/50 text-xs mt-4 mb-2">¿Tienes alguna lesión?</Text>
          <View className="flex-row flex-wrap">
            <Chip label="No" seleccionado={!tieneLesion} onPress={() => setTieneLesion(false)} />
            <Chip label="Sí" seleccionado={tieneLesion} onPress={() => setTieneLesion(true)} colorSeleccionado="bg-rojo" />
          </View>

          {tieneLesion && (
            <View className="bg-grafito/40 rounded-2xl p-4 mt-2">
              {/* lesiones ya agregadas */}
              {lesiones.map((l, i) => (
                <View key={`${l.areaCorporal}-${i}`} className="flex-row items-center bg-grafito rounded-xl px-3 py-2 mb-2">
                  <Ionicons name="bandage-outline" size={16} color={colors.blanco} style={{ opacity: 0.6 }} />
                  <View className="flex-1 ml-2">
                    <Text className="text-blanco text-xs font-bold">
                      {l.areaCorporal} · Reposo: {l.reposo}
                    </Text>
                    {!!l.detalle && <Text className="text-blanco/50 text-xs">{l.detalle}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => setLesiones((lista) => lista.filter((_, j) => j !== i))}>
                    <Ionicons name="close-circle" size={18} color={colors.blanco} style={{ opacity: 0.5 }} />
                  </TouchableOpacity>
                </View>
              ))}

              <Text className="text-blanco/50 text-xs mb-2">Zona del cuerpo</Text>
              <View className="flex-row flex-wrap">
                {zonasCuerpo.map((z) => (
                  <Chip key={z} label={z} seleccionado={zona === z} onPress={() => setZona(z)} />
                ))}
              </View>
              {zona === 'Otra' && (
                <TextInput
                  placeholder="¿Qué zona?"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={zonaOtra}
                  onChangeText={setZonaOtra}
                  maxLength={50}
                  className="bg-grafito rounded-xl px-4 text-blanco text-sm mb-2"
                  style={{ height: 44 }}
                />
              )}

              <Text className="text-blanco/50 text-xs mt-2 mb-2">
                Detalle <Text className="text-blanco/30">(opcional)</Text>
              </Text>
              <TextInput
                placeholder="Ej: tendinitis, esguince..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={detalleLesion}
                onChangeText={setDetalleLesion}
                maxLength={200}
                className="bg-grafito rounded-xl px-4 text-blanco text-sm"
                style={{ height: 44 }}
              />

              <Text className="text-blanco/50 text-xs mt-3 mb-2">¿Estás en reposo?</Text>
              <View className="flex-row flex-wrap">
                <Chip label="Sí" seleccionado={reposo === 'Sí'} onPress={() => setReposo('Sí')} />
                <Chip label="No" seleccionado={reposo === 'No'} onPress={() => setReposo('No')} />
              </View>

              <Text className="text-blanco/30 text-[14px] mb-3">Se registra con la fecha de hoy.</Text>

              <TouchableOpacity onPress={agregarLesion} className="flex-row items-center self-start">
                <Ionicons name="add-circle-outline" size={18} color={colors.azulClaro} />
                <Text className="text-azulClaro text-xs font-bold ml-1">Agregar otra lesión</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ---------- alergias e intolerancias ---------- */}
          <Text className="text-blanco/50 text-xs mt-6 mb-2">
            ¿Tienes alergias o intolerancias alimentarias?
          </Text>

          <View className="flex-row">
            <Chip
              label="No"
              seleccionado={tieneAlergia === false}
              onPress={() => {
                setTieneAlergia(false);
                setAlergias('');
              }}
              colorSeleccionado="bg-azulClaro"
            />

            <Chip
              label="Sí"
              seleccionado={tieneAlergia === true}
              onPress={() => setTieneAlergia(true)}
              colorSeleccionado="bg-rojo"
            />
          </View>
          <TextInput
            placeholder="Ej: intolerante a la lactosa, celíaca..."
            value={alergias}
            onChangeText={setAlergias}
            editable={tieneAlergia}
            placeholderTextColor="#777"
            className={`bg-grafito text-blanco rounded-xl p-4 mt-3 ${
              tieneAlergia ? 'opacity-100' : 'opacity-40'
            }`}
          />
          
          <Text className="text-blanco/30 text-[14px] mt-1">Si tienes más de una, sepáralas con coma.</Text>

          <TouchableOpacity
            className={`bg-azulClaro rounded-full py-4 items-center mt-8 ${guardando ? 'opacity-50' : ''}`}
            onPress={handleGuardar}
            disabled={guardando}
          >
            <Text className="text-blanco text-base font-bold">
              {guardando ? 'Guardando...' : 'Guardar y continuar'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
