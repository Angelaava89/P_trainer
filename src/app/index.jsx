import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { prepararUrlVideo } from '../components/VideoEjercicio';
import { colors } from '../constants/theme';
import '../global.css';
import { useAuth } from '../context/AuthContext';
import { useApariencia } from '../lib/apariencia';
import { destinoDeSesion } from '../lib/destinoSesion';

const VIDEO_ORIGINAL = require('../../assets/videos/gym.mp4');

// Pantalla inicial: un solo botón "Comenzar" que lleva a iniciar sesión,
// desde donde también se puede ir al registro.
export default function Index() {
  const router = useRouter();
  const { usuario, token, restaurando } = useAuth();
  const { width } = useWindowDimensions();

  // Si quedó una sesión abierta (se guarda en el dispositivo), "Comenzar" lleva directo
  // a la pantalla que corresponde al rol; si no, al inicio de sesión.
  const comenzar = async () => {
    if (usuario && token) {
      try {
        router.push(await destinoDeSesion({ token, usuario }));
        return;
      } catch {
        // Si algo falla se pide iniciar sesión de nuevo.
      }
    }
    router.push('/login');
  };
  const anchoLogo = Math.min(width * 0.62, 270);
  const tamanoTitulo = Math.min(Math.max(width * 0.075, 25), 33);
  // Video de inicio: el que puso el admin en Apariencia (link de Cloudinary) o el original de la app.
  const apariencia = useApariencia();
  const fuenteVideo = apariencia.video ? { uri: prepararUrlVideo(apariencia.video) } : VIDEO_ORIGINAL;
  const player = useVideoPlayer(fuenteVideo, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  return (
    <View className="flex-1 bg-carbon">
      <StatusBar style="light" />
      <VideoView player={player} style={{ width: '100%', height: '100%', position: 'absolute' }} contentFit="cover" nativeControls={false} />
      <LinearGradient
        colors={['rgba(8, 10, 13, 0.56)', colors.carbon]}
        // Cubre toda la pantalla (incluida la zona de la barra de navegación de Android),
        // igual que el video. hp(100) medía solo el área "útil" y dejaba una franja abajo sin oscurecer.
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
      >
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={{ flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 20 }}
        >
          <Image
            source={require('../../assets/images/logo_tbtf.png')}
            resizeMode="contain"
            accessibilityLabel="Logo TBTF"
            style={{ width: anchoLogo, height: anchoLogo * 0.43, marginBottom: 24 }}
          />
          <Text style={{ color: colors.blanco, fontSize: tamanoTitulo, lineHeight: tamanoTitulo * 1.22, letterSpacing: 0.5, textAlign: 'center', fontFamily: 'SundayMasthead-Regular' }}>
            CLASSIC <Text style={{ color: colors.azulClaro, fontFamily: 'SundayMasthead-Regular' }}>PHYSIQUE</Text>
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: width < 350 ? 10 : 13, letterSpacing: width < 350 ? 1 : 2, marginTop: 16, marginBottom: 30, textAlign: 'center' }}>
            DISCIPLINE · AESTHETICS · RESULTS
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Comenzar"
            style={{ minHeight: Math.max(hp(6.5), 54), width: Math.min(width * 0.84, 390) }}
            className="bg-azulClaro rounded-xl items-center justify-center"
            disabled={restaurando}
            onPress={comenzar}
          >
            <Text className="text-blanco text-base font-masthead tracking-wide">COMENZAR</Text>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}
