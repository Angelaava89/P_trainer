
from django.urls import path
from proyecto_Trainer import views
from . import admin_panel

urlpatterns = [

    # AUTENTICACIÓN Y CONEXIÓN
    path('salud/', views.salud, name='salud'),
    path('registro/', views.registrar_usuario, name='registro'),
    path('login/', views.login_usuario, name='login'),
    # PERFIL
    path('perfil/', views.perfil_usuario, name='perfil'), #el alumno puede consultar y actualizar su perfil
    # ALUMNOS
    path('alumnos/', views.listar_alumnos, name='listar_alumnos'),
    # DATOS
    path('datos/', views.gestionar_datos, name='gestionar_datos'), 
    path('datos/alumno/<str:alumno_id>/',views.gestionar_datos,name='gestionar_datos_alumno'),
    # MÉTRICAS
    path('metricas/peso/<str:alumno_id>/',views.gestionar_peso,name='gestionar_peso'),
    path('medidas/', views.gestionar_medidas, name='gestionar_medidas'),
    # Métricas del alumno
    # Alumno consulta sus propias métricas
    path("metricas/",views.ver_metricas_alumno,name="mis_metricas"),
    # Profesor consulta las métricas de un alumno
    path("metricas/alumno/<str:alumno_id>/",views.ver_metricas_alumno,name="metricas_alumno"),
    # EJERCICIOS
    path('ejercicios/', views.ejercicios, name='ejercicios'),
    # RUTINAS
    path('asignar-rutina/', views.asignar_rutina, name='asignar_rutina'),
    path('rutinas-asignadas/<str:alumno_id>/',views.rutinas_asignadas,name='rutinas_asignadas'),
    path('videos-ejercicio/<str:alumno_id>/',views.video_ejercicio_alumno,name='video_ejercicio_alumno'),
    path('mis-rutinas/', views.mis_rutinas, name='mis_rutinas'),
    path('mis-rutinas/vistas/',views.marcar_mis_rutinas_vistas,name='marcar_mis_rutinas_vistas'),
    path('rutinas/alumno/<str:alumno_id>/',views.listar_rutinas_usuario,name='listar_rutinas_usuario'),
    path('rutinas/alumno/<str:alumno_id>/<str:rutina_id>/',views.actualizar_rutina_alumno,name='actualizar_rutina_alumno'),
    # RUTINAS PREDETERMINADAS
    path('rutinas-predeterminadas/', views.catalogo_rutinas_predeterminadas, name='catalogo_rutinas_predeterminadas'),
    path('rutinas/compradas/', views.rutinas_compradas, name='rutinas_compradas'),
    path('rutinas-predeterminadas/alumno/<str:alumno_id>/<str:rutina_id>/',views.detalle_rutina_predeterminada,name='detalle_rutina_predeterminada'),
    # DIETAS
    path('dietas/crear/<str:alumno_id>/',views.crear_dieta,name='crear_dieta'),
    path('dietas/listar/<str:alumno_id>/',views.listar_dietas_usuario,name='listar_dietas_usuario'),
    path('dietas/mis-dietas/',views.listar_mis_dietas,name='listar_mis_dietas'),
    path('dietas/editar/<str:alumno_id>/<str:dieta_id>/',views.editar_dieta,name='editar_dieta'),
    path('dietas/dia/editar/<str:alumno_id>/<str:dieta_id>/<str:dia_id>/',views.editar_dia_dieta,name='editar_dia_dieta'),
    path('dietas/eliminar/<str:alumno_id>/<str:dieta_id>/',views.eliminar_dieta,name='eliminar_dieta'),
    # SESIONES
    path('sesiones/', views.registrar_sesion, name='registrar_sesion'),
    path('sesiones/alumno/<str:alumno_id>/',views.listar_sesiones_alumno,name='listar_sesiones_alumno'),
    # PLANES DEL ALUMNO
    path('planes/', views.planes_usuario, name='planes_usuario'),
    path('planes/asignar/', views.asignar_plan, name='asignar_plan'),
    # ADMINISTRACIÓN
    path('admin/resumen/',admin_panel.resumen_admin,name='resumen_admin'),
    path('admin/planes/',admin_panel.listar_planes_admin,name='listar_planes_admin'), #get y post de planes
    path('admin/planes/<str:plan_id>/', admin_panel.plan_admin_detalle, name='plan_admin_detalle'), #patch y delete de planes
    path('admin/usuarios/',admin_panel.listar_usuarios_admin,name='listar_usuarios_admin'),
    path('admin/usuarios/<str:usuario_id>/',admin_panel.actualizar_usuario_admin,name='actualizar_usuario_admin'), #patch y delete de usuarios
    # ADMINISTRACIÓN RUTINAS PREDEDTERMINADAS
    path("admin/rutinas-predeterminadas/",admin_panel.rutinas_predeterminadas_admin,name="rutinas_predeterminadas_admin"),
    path("admin/rutinas-predeterminadas/<str:rutina_id>/",admin_panel.detalle_rutina_predeterminada_admin,name="detalle_rutina_predeterminada_admin"),
    path("admin/ejercicios/",admin_panel.ejercicios_admin,name="ejercicios_admin"),
    #ADMINISTRACIÓN MULTIMEDIA DE FONDO DE PANTALLA
    path("multimedia/",admin_panel.gestionar_multimedia, name="gestionar_multimedia"),
    path("multimedia/<str:multimedia_id>/",admin_panel.actualizar_multimedia, name="actualizar_multimedia"),
    path("multimedia/<str:multimedia_id>/eliminar/",admin_panel.eliminar_multimedia, name="eliminar_multimedia"),
    #VISUALIZAR MULTIMEDIA ACTIVA ACTUALMENTE POR TODOS
    path("fondo-activo/",views.obtener_fondo_activo, name="obtener_fondo_activo"),
    #FONDOS Y VIDEO EN USO POR PANTALLA (solo lectura, para toda la app)
    path("apariencia/",views.obtener_apariencia, name="obtener_apariencia"),
    # ASESORÍAS
    path('asesorias/', views.asesorias, name='asesorias'),
    path('asesorias/ocupadas/',views.horarios_ocupados,name='horarios_ocupados'),
    path('asesorias/<str:asesoria_id>/',views.asesoria_detalle,name='asesoria_detalle'),
    # NOTIFICACIONES
    path('notificaciones/', views.notificaciones, name='notificaciones'),
    path('notificaciones/leer-todas/',views.leer_todas,name='leer_todas'),
    path('notificaciones/<str:notificacion_id>/',views.notificacion_detalle,name='notificacion_detalle'),
    path('avisos/whatsapp/', views.aviso_whatsapp, name='aviso_whatsapp'),
    path('avisos/rutina/', views.aviso_rutina, name='aviso_rutina'),
    path('avisos/mensaje-profesor/', views.aviso_mensaje_profesor, name='aviso_mensaje_profesor'),
]
