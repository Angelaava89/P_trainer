import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/theme';
import { ADMIN_PREVIEW_KEY, cerrarSesionAdmin } from '../lib/admin';
import { irSinHistorial } from '../lib/navegacion';
import LogoMarca from './LogoMarca';

// Alias semánticos del panel enlazados a la paleta compartida de src/constants/theme.js.
export const adminColors = {
  background: colors.carbon,
  surface: colors.grafito,
  surfaceSoft: colors.azulOscuro,
  text: colors.blanco,
  muted: colors.gris,
  line: colors.azulOscuro,
  primary: colors.azulClaro, // mismo azul de botones y pestañas activas del resto de la app
  primarySoft: colors.azulOscuro,
  primaryBorder: colors.azulClaro,
  blue: colors.azulClaro,
  blueSoft: colors.azulOscuro,
  sky: colors.azulClaro,
  skySoft: colors.azulOscuro,
  purple: colors.azulClaro,
  purpleSoft: colors.azulOscuro,
  success: colors.verde,
  successSoft: 'rgba(60, 206, 12, 0.14)',
  danger: colors.rojo,
  dangerSoft: 'rgba(198, 40, 40, 0.16)',
};

// Una sola lista alimenta la navegación lateral de web y la barra inferior de móvil.
const tabs = [
  { key: 'resumen', label: 'Resumen', icon: 'grid-outline', route: '/admin' },
  { key: 'usuarios', label: 'Usuarios', icon: 'people-outline', route: '/admin_usuarios' },
  { key: 'pagos', label: 'Pagos y suscripciones', icon: 'card-outline', route: '/admin_pagos' },
  { key: 'rutinas', label: 'Rutinas predeterminadas', icon: 'layers-outline', route: '/admin_rutinas' },
  { key: 'apariencia', label: 'Apariencia', icon: 'color-palette-outline', route: '/admin_apariencia' },
];

function NavItem({ tab, active, onPress, compact = false }) {
  const seleccionado = tab.key === active;
  return (
    <TouchableOpacity
      key={tab.key}
      accessibilityRole="button"
      accessibilityState={{ selected: seleccionado }}
      onPress={onPress}
      style={compact ? styles.bottomItem : [styles.sideItem, seleccionado && styles.sideItemActive]}
    >
      <Ionicons name={tab.icon} size={compact ? 20 : 19} color={seleccionado ? adminColors.primary : adminColors.muted} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit={compact}
        minimumFontScale={0.8}
        style={compact
          ? [styles.bottomLabel, seleccionado && styles.activeLabel]
          : [styles.sideLabel, seleccionado && styles.activeLabel]}
      >
        {tab.label}
      </Text>
    </TouchableOpacity>
  );
}

// cabeceraGrande (activada por defecto en Resumen, Usuarios y Pagos): cabecera sin título,
// solo la T de Thomas, "Thomas" / "Administrador", la puerta de salida y el logo, en tamaño grande.
export default function AdminShell({ active, title, children, cabeceraGrande = true }) {
  const router = useRouter();
  const { cerrarSesion } = useAuth();
  const { width } = useWindowDimensions();
  const [vistaPrevia, setVistaPrevia] = useState(false);
  // En web amplia se usa sidebar; en móvil y pantallas nativas se usa navegación inferior.
  const escritorio = Platform.OS === 'web' && width >= 760;
  // En teléfonos angostos se oculta el nombre y el rol (queda el avatar) para que el logo quepa en la esquina.
  const mostrarNombre = escritorio || width >= 400 || cabeceraGrande;
  // En la cabecera grande el avatar y la salida se ven siempre (también en web con barra lateral).
  const perfilEnCabecera = !escritorio || cabeceraGrande;

  useEffect(() => {
    AsyncStorage.getItem(ADMIN_PREVIEW_KEY).then((valor) => setVistaPrevia(valor === '1'));
  }, []);

  const irA = (route) => router.replace(route);
  const salir = async () => {
    const eraVistaPrevia = await cerrarSesionAdmin();
    cerrarSesion();
    // /admin_login no existe como pantalla; el acceso de administradores es el mismo /login.
    irSinHistorial(router, eraVistaPrevia ? '/' : '/login');
  };

  // La cabecera respeta la zona segura superior; la barra móvil gestiona por separado el espacio del sistema.
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.layout, escritorio && styles.layoutDesktop]}>
        {escritorio && (
          <View style={styles.sidebar}>
            <View style={styles.brand}>
              <View style={styles.brandMark}><Ionicons name="barbell" size={18} color={adminColors.text} /></View>
              <View>
                <Text style={styles.brandName}>P TRAINER</Text>
                <Text style={styles.brandCaption}>Administración</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>ESPACIO DE TRABAJO</Text>
            <View style={styles.sideNav}>
              {tabs.map((tab) => (
                <NavItem key={tab.key} tab={tab} active={active} onPress={() => irA(tab.route)} />
              ))}
            </View>

            <View style={styles.sidebarSpacer} />
            <View style={styles.sidebarProfile}>
              <View style={styles.avatar}><Text style={styles.avatarText}>T</Text></View>
              <View style={styles.profileCopy}>
                <Text style={styles.profileName}>Thomas</Text>
                <Text style={styles.profileRole}>{vistaPrevia ? 'Vista previa' : 'Administrador'}</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={salir} style={styles.logoutButton}>
                <Ionicons name="log-out-outline" size={18} color={adminColors.muted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.workspace}>
          <View style={[styles.topbar, cabeceraGrande && styles.topbarGrande]}>
            {!cabeceraGrande && <Text numberOfLines={1} style={styles.topbarTitle}>{title}</Text>}
            <View style={styles.topbarProfile}>
              {perfilEnCabecera && (
                <View style={[styles.avatar, cabeceraGrande && styles.avatarGrande]}>
                  <Text style={[styles.avatarText, cabeceraGrande && styles.avatarTextGrande]}>T</Text>
                </View>
              )}
              {mostrarNombre && (
                <View style={styles.topbarProfileCopy}>
                  <Text numberOfLines={1} style={[styles.profileName, cabeceraGrande && styles.profileNameGrande]}>Thomas</Text>
                  <Text numberOfLines={1} style={[styles.profileRole, cabeceraGrande && styles.profileRoleGrande]}>{vistaPrevia ? 'Vista previa' : 'Administrador'}</Text>
                </View>
              )}
              {perfilEnCabecera && (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={salir} style={[styles.logoutButton, cabeceraGrande && styles.logoutButtonGrande]}>
                  <Ionicons name="log-out-outline" size={cabeceraGrande ? 26 : 18} color={adminColors.muted} />
                </TouchableOpacity>
              )}
            </View>
            {/* Logo en la esquina superior derecha: el mismo componente responsivo del resto de la app. */}
            {/* sin ícono de salida aquí: esta barra ya tiene su propio botón de cerrar sesión */}
            <LogoMarca conSalida={false} grande={cabeceraGrande} />
          </View>

          {vistaPrevia && (
            <View style={styles.previewBanner}>
              <Ionicons name="information-circle-outline" size={17} color={adminColors.primary} />
              <Text style={styles.previewText}>Vista previa: el panel mostrará datos reales al iniciar con una cuenta administradora.</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/login')}>
                <Text style={styles.previewLink}>Acceso</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.content}>{children}</View>

          {!escritorio && (
            <SafeAreaView edges={['bottom']} style={styles.bottomNavSafe}>
              <View style={styles.bottomNav}>
                {tabs.map((tab) => (
                  <NavItem key={tab.key} compact tab={tab} active={active} onPress={() => irA(tab.route)} />
                ))}
              </View>
            </SafeAreaView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// Los estilos de cada formato están separados: sidebar de escritorio y barra inferior compacta.
const styles = {
  root: { flex: 1, backgroundColor: adminColors.background },
  layout: { flex: 1, flexDirection: 'column' },
  layoutDesktop: { flexDirection: 'row' },
  sidebar: {
    width: 236,
    backgroundColor: adminColors.surface,
    borderRightWidth: 1,
    borderRightColor: adminColors.line,
    paddingTop: 24,
    paddingHorizontal: 15,
    paddingBottom: 16,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, marginBottom: 34 },
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: adminColors.primary, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: adminColors.text, fontSize: 16, fontFamily: 'SundayMasthead-Regular', letterSpacing: 0.5 },
  brandCaption: { color: adminColors.muted, fontSize: 14, marginTop: 1 },
  sectionLabel: { color: adminColors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 10, marginBottom: 9 },
  sideNav: { gap: 4 },
  sideItem: { minHeight: 42, borderRadius: 9, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  sideItemActive: { backgroundColor: adminColors.primarySoft },
  sideLabel: { color: adminColors.muted, fontSize: 15, flexShrink: 1 },
  activeLabel: { color: adminColors.primary, fontWeight: '700' },
  sidebarSpacer: { flex: 1 },
  sidebarProfile: { borderTopWidth: 1, borderTopColor: adminColors.line, paddingTop: 14, marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: adminColors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: adminColors.blue, fontSize: 16, fontWeight: '800' },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { color: adminColors.text, fontSize: 15, fontWeight: '700' },
  profileRole: { color: adminColors.muted, fontSize: 13, marginTop: 1 },
  logoutButton: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  workspace: { flex: 1, minWidth: 0, backgroundColor: adminColors.background },
  topbar: { minHeight: 62, paddingHorizontal: 22, backgroundColor: adminColors.surface, borderBottomWidth: 1, borderBottomColor: adminColors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topbarTitle: { color: adminColors.text, fontSize: 18, fontFamily: 'SundayMasthead-Regular', flex: 1 },
  // flexShrink (y no flex: 1): el nombre usa solo el espacio que necesita, así el título y el logo no quedan fuera.
  topbarProfile: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1, minWidth: 0 },
  topbarProfileCopy: { flexShrink: 1, minWidth: 0 },
  // versión grande de la cabecera (la usan todas las pantallas de admin)
  topbarGrande: { minHeight: 84, paddingVertical: 12 },
  avatarGrande: { width: 48, height: 48, borderRadius: 24 },
  avatarTextGrande: { fontSize: 22 },
  profileNameGrande: { fontSize: 19 },
  profileRoleGrande: { fontSize: 15, marginTop: 2 },
  logoutButtonGrande: { width: 44, height: 44 },
  content: { flex: 1, minHeight: 0 },
  previewBanner: { minHeight: 42, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: adminColors.primarySoft, borderBottomWidth: 1, borderBottomColor: adminColors.line, flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewText: { flex: 1, color: adminColors.muted, fontSize: 13, lineHeight: 18 },
  previewLink: { color: adminColors.primary, fontSize: 13, fontWeight: '700' },
  bottomNavSafe: { backgroundColor: adminColors.surface },
  bottomNav: { minHeight: 60, backgroundColor: adminColors.surface, borderTopWidth: 1, borderTopColor: adminColors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingTop: 5, paddingBottom: 7 },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 2 },
  bottomLabel: { color: adminColors.muted, fontSize: 12, maxWidth: '100%' },
};
