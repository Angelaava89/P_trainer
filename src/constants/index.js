
import { colors } from './theme';
 
export const sliderImages = [
  require('../../assets/images/poster-inicial.png'),
  require('../../assets/images/poster-avanzado.png'),
];
 
// planes y precios — según el mockup de "Planes y Servicios" / "Contratar plan"
export const plans = [
  {
    id: 'inicial',
    title: 'PLAN BÁSICO',
    precio: 19990,
    color: colors.azul,
    imagen: require('../../assets/images/poster-inicial.png'),
    checklist: ['Creación de rutina personalizada', 'Gráfico de medidas y métricas', 'Perfil personalizado'],
  },
  {
    id: 'avanzado',
    title: 'PLAN AVANZADO',
    precio: 39990,
    color: colors.rojo,
    imagen: require('../../assets/images/poster-avanzado.png'),
    checklist: ['Nutrición de élite', 'Programa personalizado', 'Biofeedback y analítica', 'Agendamiento de clases semanales', 'Video explicativo', 'Dieta personalizada'],
  },
];
 
// formatea 19990 -> "$19.990" (a mano, sin depender de Intl/toLocaleString,
// que en algunos motores de React Native no anda bien con configuraciones regionales)
export const formatearPrecio = (numero) =>
  `$${numero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
