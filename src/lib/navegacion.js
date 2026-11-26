// Navega a una pantalla borrando todo el historial anterior.
// Se usa al cerrar sesión: así el botón "atrás" (o el gesto de Android) no puede
// volver a pantallas privadas como /home, /perfil o /admin.
//
// router.replace() solo cambia la pantalla actual; las de abajo siguen en la pila.
// dismissAll() vuelve a la primera pantalla de la pila y replace() la cambia por el destino,
// dejando una pila con una sola pantalla.
export function irSinHistorial(router, ruta = '/login') {
  if (router.canDismiss()) {
    router.dismissAll();
  }
  router.replace(ruta);
}
