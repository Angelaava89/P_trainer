import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FondoThomas from '../components/FondoThomas';
import LogoMarca from '../components/LogoMarca';
import MedidorImc from '../components/MedidorImc';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import '../global.css';
import { RANGOS_IMC as RANGOS, rangoImc } from '../lib/imc';
import { calcularTMB } from '../lib/metabolismo';

const valorParametro = (valor) => (Array.isArray(valor) ? valor[0] : valor);
const decimal = (n) => n.toFixed(1).replace('.', ',');


export default function ResultadoImc() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const alturaCm = Number(valorParametro(params.altura));
  const pesoKg = Number(valorParametro(params.peso));
  const sinConexion = valorParametro(params.sinConexion) === '1';

  const alturaM = alturaCm / 100;
  const imc = alturaM > 0 ? pesoKg / (alturaM * alturaM) : 0;
  const rango = rangoImc(imc);

  // peso saludable para su estatura (IMC 18,5 a 24,9)
  const pesoMin = 18.5 * alturaM * alturaM;
  const pesoMax = 24.9 * alturaM * alturaM;


  const desdeProgreso = valorParametro(params.desdeProgreso) === '1';
  const origenRegistro = valorParametro(params.origenRegistro) === '1';
  const continuar = () => {
    // El resultado del IMC vuelve al progreso cuando se abrió desde allí.
    if (desdeProgreso && router.canGoBack()) return router.back();

    // La persona recién registrada elige cómo continuar después de completar sus métricas.
    if (origenRegistro) return router.replace('/elige_inicio');

    // Los demás accesos al cálculo del IMC conservan su destino habitual.
    return router.replace('/home');
  };


const sexo = valorParametro(params.sexo);
const { usuario } = useAuth();
const edad = Number(usuario?.edad);

const tmb = calcularTMB({
  peso: pesoKg,
  altura: alturaCm,
  edad,
  sexo,
});

// Observación con los datos recién ingresados (solo se muestra al terminar el registro)
const observacion = `Con ${alturaCm} cm y ${decimal(pesoKg)} kg, tu IMC es ${decimal(imc)} (${rango.nombre.toLowerCase()}) `
  + `y tu peso saludable va de ${Math.round(pesoMin)} a ${Math.round(pesoMax)} kg.`
  + (tmb !== null ? ` En reposo, tu cuerpo usa unas ${tmb} kcal al día.` : '');

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_bienvenido.jpg')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <View className="px-6 pt-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-blanco text-2xl font-masthead">Tu IMC</Text>
            <LogoMarca />
          </View>
          <Text className="text-blanco/50 text-sm mt-1 mb-6">Índice de masa corporal según tu altura y peso</Text>

          {/* cuadro con el IMC */}
          <View className="bg-grafito rounded-2xl p-5 items-center" style={{ borderWidth: 1.5, borderColor: rango.color }}>
            <Text className="text-blanco/50 text-xs">Tu índice de masa corporal es</Text>
            <Text className="text-blanco font-bold mt-1" style={{ fontSize: 48 }}>{decimal(imc)}</Text>
            <View className="flex-row items-center rounded-full px-3 py-1 mt-1" style={{ backgroundColor: `${rango.color}33` }}>
              <Ionicons name={rango.icon} size={16} color={rango.color} />
              <Text className="text-sm font-bold ml-1" style={{ color: rango.color }}>{rango.nombre}</Text>
            </View>
            <Text className="text-blanco/70 text-xs text-center mt-3">{rango.resumen}</Text>

            <View className="flex-row w-full mt-4 pt-4" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
              <View className="flex-1 items-center">
                <Text className="text-blanco text-base font-bold">{alturaCm} cm</Text>
                <Text className="text-blanco/40 text-[14px] mt-0.5">Altura</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-blanco text-base font-bold">{decimal(pesoKg)} kg</Text>
                <Text className="text-blanco/40 text-[14px] mt-0.5">Peso actual</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-blanco text-base font-bold">{Math.round(pesoMin)}–{Math.round(pesoMax)} kg</Text>
                <Text className="text-blanco/40 text-[14px] mt-0.5">Peso saludable</Text>
              </View>
            </View>
          </View>

          {/* gráfico de rangos */}
          <Text className="text-blanco text-sm font-bold mt-6 mb-3">¿Dónde estás?</Text>
          <View className="bg-grafito rounded-2xl p-4">
            {/* medidor semicircular con la aguja en su IMC */}
            <MedidorImc imc={imc} rango={rango} />

            {/* leyenda */}
            <View className="mt-4" style={{ gap: 6 }}>
              {RANGOS.map((r) => (
                <View key={r.nombre} className="flex-row items-center">
                  <View className="rounded-full" style={{ width: 10, height: 10, backgroundColor: r.color }} />
                  <Text className={`text-xs ml-2 flex-1 ${r === rango ? 'text-blanco font-bold' : 'text-blanco/60'}`}>{r.nombre}</Text>
                  <Text className={`text-xs ${r === rango ? 'text-blanco font-bold' : 'text-blanco/40'}`}>
                    {r.desde === 0 ? `menos de 18,5` : r.hasta === Infinity ? '40 o más' : `${String(r.desde).replace('.', ',')} – ${decimal(r.hasta - 0.1)}`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
              
        <View className="bg-grafito rounded-2xl p-5 mt-4"
            style={{ borderWidth: 1, borderColor: colors.azulClaro }}>

            <Text className="text-blanco/50 text-xs">
              Tu tasa metabólica basal
            </Text>

            <Text className="text-blanco font-bold mt-2"
              style={{ fontSize: 36 }}>
              {tmb !== null ? tmb : '--'}
            </Text>

            <Text className="text-blanco/60 text-sm">
              kcal/día en reposo
            </Text>

            <Text className="text-blanco/50 text-xs mt-3">
              Es la energía que tu organismo estima necesitar
              para mantener sus funciones vitales en reposo.
            </Text>
          </View>

          {/* Observaciones: debajo de la tasa metabólica basal, solo para quien recién se registró */}
          {origenRegistro && (
            <View className="bg-grafito rounded-2xl p-5 mt-4">
              <View className="flex-row items-center mb-2">
                <Ionicons name="clipboard-outline" size={18} color={colors.azulClaro} />
                <Text className="text-blanco text-sm font-bold ml-2">Observaciones</Text>
              </View>
              <Text className="text-blanco/70 text-sm" style={{ lineHeight: 20 }}>{observacion}</Text>
              <Text className="text-blanco/40 text-xs mt-3">
                Son estimaciones iniciales con los datos que acabas de ingresar. Tu personal trainer las revisará para ajustar tu plan.
              </Text>
            </View>
          )}

      

          {sinConexion && (
            <Text className="text-blanco/40 text-[14px] mt-2">Tus datos quedaron guardados en este dispositivo y se enviarán cuando tengas conexión.</Text>
          )}

          <TouchableOpacity className="bg-azulClaro rounded-full py-4 items-center mt-8" onPress={continuar}>
            <Text className="text-blanco text-base font-bold">
              {desdeProgreso ? 'Volver a mi progreso' : origenRegistro ? 'Elegir una opción' : 'Continuar'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
