from datetime import datetime, timedelta
from decimal import Decimal
import hashlib
import logging
import math
import re

from bson import ObjectId
from bson.errors import InvalidId
from django.conf import settings
from django.db import IntegrityError
from django.utils import timezone as dj_timezone
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from database import get_db

from .auth import TokenAuthentication, crear_token
from .catalogo_rutinas import buscar_ejercicio_global, ejercicio_a_api, rutina_a_api
from .models import (
    AbdomenModel,
    AlergiaModel,
    AsesoriaModel,
    CardioModel,
    DatosModel,
    DiasRutinasPredeterminadasModel,
    EjercicioRutinaModel,
    LesionModel,
    MedidasModel,
    MetricasModel,
    NotificacionModel,
    PesosModel,
    PlanModel,
    PlanesModel,
    RutinaModel,
    RutinasPredeterminadasUsuarioModel,
    SesionModel,
    SplitModel,
    UsuarioModel,
)
from .permissions import (
    SoloAlumno,
    SoloProfesor,
    SoloProfesorOAdmin,
    SoloProfesorOAlumno,
    UsuarioAutenticado,
)
from .serializers import (
    AlumnoProfesorSerializer,
    DatosSerializer,
    DietaEdicionSerializer,
    DietaSerializer,
    DiaDietaSerializer,
    MedidasSerializer,
    MetricasSerializer,
    PesosSerializer,
    PlanSerializer,
    RutinaSerializer,
    RutinasPredeterminadasUsuarioSerializer,
    SesionSerializer,
    UsuarioSerializer,
    convertir,
    preparar_datos,
)

logger = logging.getLogger(__name__)


def obtener_alumno(alumno_id):
    """Alumno por id, o None si el id no es válido, no existe o no es alumno."""
    alumno = buscar_por_id(UsuarioModel, alumno_id)
    if alumno is None or alumno.tipo_usuario != "Alumno":
        return None
    return alumno


def respuesta_alumno_no_encontrado():
    return Response({"error": "No se encontró el alumno."}, status=status.HTTP_404_NOT_FOUND)

def obtener_metricas(alumno):
    if not alumno.metricas:
        alumno.metricas.append(MetricasModel())
        alumno.save()

    return alumno.metricas[0]

@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def salud(request):
    """GET /api/salud/ — para comprobar que Django llega a Atlas."""
    get_db().command("ping")
    return Response({"estado": "ok", "mongo": "conectado"})

#REGISTRO USUARIO -- crea el usuario automaticamente como alumno para que alguien no correspondiente no se registre como profesor
@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def registrar_usuario(request):

    serializer = UsuarioSerializer(data=request.data)

    if serializer.is_valid():

        usuario = serializer.save()

        return Response(
            {
                "mensaje": "Usuario registrado correctamente.",
                "usuario": UsuarioSerializer(usuario).data
            },
            status=status.HTTP_201_CREATED
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )

#LOGIN DE USUARIO
@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def login_usuario(request):

    correo = request.data.get('correo')
    password = request.data.get('password')

    if not correo or not password:
        return Response(
            {"mensaje": "Debes ingresar correo y contraseña."},
            status=status.HTTP_400_BAD_REQUEST
        )

    usuario = UsuarioSerializer.verificar_login(
        correo,
        password
    )

    if usuario is None:
        return Response(
            {"mensaje": "Correo o contraseña incorrectos."},
            status=status.HTTP_401_UNAUTHORIZED
        )

    token = crear_token(usuario.pk)

    return Response(
        {
            "mensaje": "Inicio de sesión exitoso.",
            "token": token,
            "usuario": UsuarioSerializer(usuario).data
        },
        status=status.HTTP_200_OK
    )


#CONSULTA Y ACTUALIZACIÓN DE SU PROPIO PERFIL PARA TODO USUARIO AUTENTICADO (ALUMNO, PROFESOR, ADMIN) -- el alumno no puede modificar su id o el perfil de alguien más que ya que se recupera la información de perfil según el token
@api_view(['GET', 'PATCH'])
@authentication_classes([TokenAuthentication])
@permission_classes([UsuarioAutenticado])
def perfil_usuario(request):

    usuario = request.user

    if request.method == 'GET':

        serializer = UsuarioSerializer(usuario)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )

    elif request.method == 'PATCH':

        serializer = UsuarioSerializer(
            usuario,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():

            usuario_actualizado = serializer.save()

            return Response(
                {
                    "mensaje": "Perfil actualizado correctamente.",
                    "usuario": UsuarioSerializer(
                        usuario_actualizado
                    ).data
                },
                status=status.HTTP_200_OK
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

#ALUMNO ACTUALIZA SOLO LA INFORMACIÓN DE SECCIÓN "DATOS" EN USUARIO / PROFESOR CONSULTA Y ACTUALIZA LA INFORMACIÓN DE SECCIÓN "DATOS" DE UN ALUMNO ESPECÍFICO (busca por id)
@api_view(["GET", "PATCH"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesorOAlumno])
def gestionar_datos(request, alumno_id=None):

    # Identificar al alumno
    if request.user.tipo_usuario == "Alumno":
        alumno = request.user
    else:
        if not alumno_id:
            return Response(
                {"error": "Debes indicar el ID del alumno."},
                status=status.HTTP_400_BAD_REQUEST
            )

        alumno = obtener_alumno(alumno_id)
        if alumno is None:
            return respuesta_alumno_no_encontrado()

    # ==================================
    # GET: CONSULTAR DATOS
    # ==================================

    if request.method == "GET":

        if not alumno.datos:
            return Response(
                {"mensaje": "El alumno todavía no registra sus datos."},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(
            DatosSerializer(alumno.datos).data,
            status=status.HTTP_200_OK
        )

    # ==================================
    # PATCH: ACTUALIZAR DATOS
    # ==================================

    primera_vez = alumno.datos is None

    # La primera vez se exigen todos los campos obligatorios de DatosModel;
    # después se puede mandar solo lo que cambia. Antes se guardaba un
    # DatosModel con nulos en campos obligatorios.
    serializer = DatosSerializer(
        data=request.data,
        partial=not primera_vez
    )

    if not serializer.is_valid():
        if primera_vez:
            errores = dict(serializer.errors)
            errores.setdefault("mensaje", "Completa primero tus métricas (Tus métricas) antes de registrar este dato.")
            return Response(errores, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    # Obtener datos anteriores
    if alumno.datos:

        datos_actuales = {
            "sexo": alumno.datos.sexo,
            "altura": alumno.datos.altura,
            "pesoActual": alumno.datos.pesoActual,
            "grasaCorporal": alumno.datos.grasaCorporal,
            "objetivo": alumno.datos.objetivo,
            "experiencia": alumno.datos.experiencia,
            "splitActual": alumno.datos.splitActual,
            "lesion": list(alumno.datos.lesion or []),
            "alergia": list(alumno.datos.alergia or [])
        }

    else:
        datos_actuales = {
            "lesion": [],
            "alergia": []
        }

    # Para los avisos: peso y cantidad de lesiones antes del cambio
    peso_antes = datos_actuales.get("pesoActual")
    lesiones_antes = len(datos_actuales["lesion"])

    # Incorporar los nuevos datos
    datos_actuales.update(serializer.validated_data)

    # Convertir diccionarios a modelos embebidos
    datos_actuales["lesion"] = [
        LesionModel(**lesion) if isinstance(lesion, dict) else lesion
        for lesion in datos_actuales["lesion"]
    ]

    datos_actuales["alergia"] = [
        AlergiaModel(**alergia) if isinstance(alergia, dict) else alergia
        for alergia in datos_actuales["alergia"]
    ]

    # Construir el modelo actualizado
    alumno.datos = DatosModel(**datos_actuales)
    alumno.save()

    # Avisos de lesión nueva y de avance hacia el objetivo (antes nunca se llamaba).
    # Si fallan no se revierte lo guardado.
    try:
        avisos_por_cambio_de_datos(alumno, peso_antes, lesiones_antes, primera_vez)
    except Exception:
        logger.exception("No se pudieron crear los avisos de datos del alumno %s", alumno.pk)

    return Response(
        DatosSerializer(alumno.datos).data,
        status=status.HTTP_200_OK
    )

# LISTA DE ALUMNOS PARA EL PROFESIONAL (con lesiones y alergias)
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def listar_alumnos(request):

    alumnos = UsuarioModel.objects.filter(
        tipo_usuario="Alumno"
    ).order_by('nombre')

    serializer = AlumnoProfesorSerializer(alumnos, many=True)

    return Response(
        serializer.data,
        status=status.HTTP_200_OK
    )

# CONSULTAR Y REGISTRAR PESOS DE ALUMNO (lo ingresa y consulta el profesor) EN SECCIÓN MÉTRICAS DEL PERFIL
@api_view(["GET", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def gestionar_peso(request, alumno_id):

    alumno = obtener_alumno(alumno_id)

    if alumno is None:
        return respuesta_alumno_no_encontrado()

    metricas = obtener_metricas(alumno)

    if request.method == "GET":
        return Response(
            PesosSerializer(metricas.pesos, many=True).data
        )

    serializer = PesosSerializer(data=request.data)

    if serializer.is_valid():

        peso = PesosModel(**serializer.validated_data)

        metricas.pesos.append(peso)
        alumno.save()

        return Response(
            PesosSerializer(peso).data,
            status=status.HTTP_201_CREATED
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )

#REGISTRO Y CONSULTA DE MEDIDAS DE ALUMNO (lo hace el alumno)
@api_view(["GET", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAlumno])
def gestionar_medidas(request):

    alumno = request.user
    metricas = obtener_metricas(alumno)

    if request.method == "GET":
        return Response(
            MedidasSerializer(metricas.medidas, many=True).data
        )

    serializer = MedidasSerializer(data=request.data)

    if serializer.is_valid():

        medidas = MedidasModel(**serializer.validated_data)

        metricas.medidas.append(medidas)
        alumno.save()

        return Response(
            MedidasSerializer(medidas).data,
            status=status.HTTP_201_CREATED
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )

#VISUALIZAR METRICAS DE ALUMNO (tanto el alumno como el profesor)
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesorOAlumno])
def ver_metricas_alumno(request, alumno_id=None):

    # Determinar a qué alumno se consultarán las métricas
    if request.user.tipo_usuario == "Alumno":

        # El alumno solamente puede consultar sus propias métricas
        if alumno_id is not None:
            return Response(
                {"error": "Solo puedes consultar tus propias métricas."},
                status=status.HTTP_403_FORBIDDEN
            )

        alumno = request.user

    elif request.user.tipo_usuario == "Profesor":

        # El profesor debe indicar el ID del alumno
        if not alumno_id:
            return Response(
                {"error": "Debes indicar el ID del alumno."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            alumno = UsuarioModel.objects.get(
                pk=ObjectId(alumno_id)
            )

        except InvalidId:
            return Response(
                {"error": "El ID del alumno no es válido."},
                status=status.HTTP_400_BAD_REQUEST
            )

        except UsuarioModel.DoesNotExist:
            return Response(
                {"error": "No se encontró al alumno."},
                status=status.HTTP_404_NOT_FOUND
            )

        if alumno.tipo_usuario != "Alumno":
            return Response(
                {"error": "El usuario indicado no es un alumno."},
                status=status.HTTP_400_BAD_REQUEST
            )

    else:
        return Response(
            {"error": "No tienes permiso para consultar estas métricas."},
            status=status.HTTP_403_FORBIDDEN
        )

    # Obtener métricas del alumno
    metricas = alumno.metricas or []

    serializer = MetricasSerializer(
        metricas,
        many=True
    )

    return Response(
        {
            "alumno_id": str(alumno.pk),
            "total_registros_metricas": len(metricas),
            "metricas": serializer.data
        },
        status=status.HTTP_200_OK
    )

# Datos que corresponden a los planes ofrecidos por la aplicación cuando la colección de catálogo no está cargada.
PLANES_DE_COMPRA = {
    "inicial": {
        "nombre_catalogo": "Plan Principiante",
        "nombre": "PLAN BÁSICO",
        "precio": Decimal("19990.00"),
        "detalle": "Creación de rutina personalizada, gráfico de medidas y métricas, perfil personalizado",
    },
    "avanzado": {
        "nombre_catalogo": "Plan Avanzado",
        "nombre": "PLAN AVANZADO",
        "precio": Decimal("39990.00"),
        "detalle": "Nutrición de élite, programa personalizado, biofeedback y analítica, asesorías personalizadas",
    },
}

def bloquear_si_no_hay_pagos():
    """Las compras (planes y rutinas) todavía son simuladas: no hay pasarela de pago.

    Se permiten solo si settings.COMPRAS_SIMULADAS es True (por defecto, igual a DEBUG).
    Cuando se integre un pago real, aquí se debe verificar el pago antes de activar nada.
    """
    if getattr(settings, "COMPRAS_SIMULADAS", False):
        return None
    return Response(
        {"mensaje": "Los pagos todavía no están habilitados en este servidor."},
        status=status.HTTP_403_FORBIDDEN,
    )


def agregar_plan_al_historial(planes, nuevo_plan):
    """Marca como Vencido cualquier contrato activo y agrega el nuevo al final."""
    historial = list(planes or [])
    for anterior in historial:
        if getattr(anterior, "vigencia", None) == "Activo":
            anterior.vigencia = "Vencido"
    historial.append(nuevo_plan)
    return historial


# CONSULTAR LOS PLANES DEL ALUMNO Y GUARDAR UN CONTRATO EN SU ARREGLO plan[]
@api_view(['GET', 'POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([UsuarioAutenticado])
def planes_usuario(request):

    usuario = request.user

    if request.method == 'GET':
        planes = usuario.plan or []
        serializer = PlanSerializer(planes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # Solo un alumno puede contratar para su propia cuenta con su sesión autenticada.
    if usuario.tipo_usuario != "Alumno":
        return Response(
            {"mensaje": "Solo un alumno puede contratar un plan para su cuenta."},
            status=status.HTTP_403_FORBIDDEN
        )

    respuesta_bloqueo = bloquear_si_no_hay_pagos()
    if respuesta_bloqueo:
        return respuesta_bloqueo

    plan_id = str(request.data.get("planId", "")).strip().lower()
    datos_plan = PLANES_DE_COMPRA.get(plan_id)
    if datos_plan is None:
        return Response(
            {"mensaje": "El plan seleccionado no es válido."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # El catálogo es opcional: si no está disponible, el plan de compra conserva
    # los datos oficiales definidos por la aplicación.
    try:
        catalogo = PlanesModel.objects.filter(nombre=datos_plan["nombre_catalogo"]).first()
    except Exception:
        logger.exception("No se pudo consultar el catálogo de planes; se usarán los datos predeterminados.")
        catalogo = None
    id_plan_guardado = plan_id
    nombre_plan = datos_plan["nombre"]
    precio_plan = datos_plan["precio"]
    detalle_plan = datos_plan["detalle"]
    if catalogo is not None:
        id_plan_guardado = str(catalogo.pk)
        nombre_plan = catalogo.nombre
        precio_plan = catalogo.precio
        detalle_plan = catalogo.detalle

    # Si la app reintenta una solicitud que ya se guardó, se devuelve ese contrato
    # activo para evitar agregarlo dos veces al historial del usuario.
    planes_actuales = list(usuario.plan or [])
    contrato_activo_mismo_plan = next(
        (
            contrato for contrato in planes_actuales
            if getattr(contrato, "vigencia", None) == "Activo"
            and (
                str(getattr(contrato, "idPlan", "")) == id_plan_guardado
                or str(getattr(contrato, "idPlan", "")) == plan_id
                or str(getattr(contrato, "nombre", "")).strip().casefold()
                == nombre_plan.strip().casefold()
            )
        ),
        None,
    )
    if contrato_activo_mismo_plan is not None:
        return Response(
            {
                "mensaje": "El plan ya está activo en esta cuenta.",
                "plan": PlanSerializer(contrato_activo_mismo_plan).data,
            },
            status=status.HTTP_200_OK,
        )

    # Mismo criterio que asignar_plan: el contrato anterior queda en el historial
    # como "Vencido" y se agrega el nuevo como "Activo".
    usuario.plan = agregar_plan_al_historial(
        usuario.plan,
        PlanModel(
            idPlan=id_plan_guardado,
            nombre=nombre_plan,
            precio=precio_plan,
            detalle=detalle_plan,
            fechaContratacion=dj_timezone.localdate(),
            vigencia="Activo",
        ),
    )

    # Se captura y registra cualquier fallo real al escribir el arreglo embebido;
    # la app recibe una respuesta JSON útil en vez de un error HTML genérico.
    try:
        usuario.save()
        usuario.refresh_from_db()
    except Exception:
        logger.exception("No se pudo guardar el plan en usuarios.plan para el usuario %s.", usuario.pk)
        return Response(
            {"mensaje": "No se pudo guardar el plan en la base de datos. Revisa la consola de Django."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    plan_persistido = next(
        (
            contrato for contrato in (usuario.plan or [])
            if getattr(contrato, "vigencia", None) == "Activo"
            and str(getattr(contrato, "idPlan", "")) == id_plan_guardado
        ),
        None,
    )
    if plan_persistido is None:
        logger.error("La escritura del plan no quedó visible en usuarios.plan para el usuario %s.", usuario.pk)
        return Response(
            {"mensaje": "La base de datos no confirmó el guardado del plan. Intenta nuevamente."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Solo se avisa al personal trainer cuando el contrato básico o avanzado quedó guardado.
    try:
        notificar(
            PROFESORES,
            "Clientes",
            "plan_contratado",
            "Nuevo plan contratado",
            f"{usuario.nombre} contrató el {datos_plan['nombre'].title()}.",
            alumno_id=usuario.pk,
        )
    except Exception:
        # La notificación es secundaria: un fallo al crearla no revierte el plan ya persistido.
        logger.exception("No se pudo notificar la contratación del plan para el alumno %s", usuario.pk)

    return Response(
        {
            "mensaje": "Plan contratado correctamente.",
            "plan": PlanSerializer(plan_persistido).data,
        },
        status=status.HTTP_201_CREATED
    )

# EJERCICIOS GLOBALES DEL CATÁLOGO.
@api_view(['GET', 'POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def ejercicios(request):
    db = get_db()
    coleccion = db.ejercicios

    if request.method == 'GET':
        lista = [ejercicio_a_api(doc) for doc in coleccion.find({}).sort('nombre', 1)]
        return Response(lista, status=status.HTTP_200_OK)

    nombre = str(request.data.get('nombreEjercicio') or request.data.get('nombre') or '').strip()
    equipo = str(request.data.get('equipo') or '').strip()
    video = str(request.data.get('video') or request.data.get('videoTutorial') or '').strip()
    if not nombre or not equipo:
        return Response({'mensaje': 'Completa el nombre y el equipo del ejercicio.'}, status=status.HTTP_400_BAD_REQUEST)

    documento = {
        'idEjercicio': str(ObjectId()),
        'nombre': nombre,
        'equipo': equipo,
        'videoTutorial': video,
    }
    resultado = coleccion.insert_one(documento)
    guardado = coleccion.find_one({'_id': resultado.inserted_id})
    return Response(
        {'mensaje': 'Ejercicio creado correctamente.', 'ejercicio': ejercicio_a_api(guardado)},
        status=status.HTTP_201_CREATED,
    )

#CREAR/ASIGNAR RUTINA A ALUMNO -- solo por profesor
@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def asignar_rutina(request):

    alumno_id = request.data.get('alumno_id')

    if not alumno_id:
        return Response(
            {"mensaje": "Debes indicar el ID del alumno."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Buscar al alumno
    try:
        alumno = UsuarioModel.objects.get(
            pk=ObjectId(alumno_id)
        )

    except (InvalidId, UsuarioModel.DoesNotExist):
        return Response(
            {"mensaje": "No se encontró el alumno."},
            status=status.HTTP_404_NOT_FOUND
        )

    if alumno.tipo_usuario != "Alumno":
        return Response(
            {"mensaje": "El usuario seleccionado no es un alumno."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Obtener los datos de la rutina
    enfoque = request.data.get('enfoqueRutina')
    intensidad = request.data.get('intensidad')
    ejercicios_recibidos = request.data.get('ejercicios', [])

    if not ejercicios_recibidos:
        return Response(
            {"mensaje": "La rutina debe contener al menos un ejercicio."},
            status=status.HTTP_400_BAD_REQUEST
        )

    ejercicios_rutina = []

    # Buscar los ejercicios del catálogo
    for item in ejercicios_recibidos:

        id_ejercicio = item.get('idEjercicio')

        if not id_ejercicio:
            return Response(
                {"mensaje": "Falta el ID de uno de los ejercicios."},
                status=status.HTTP_400_BAD_REQUEST
            )

        ejercicio = buscar_ejercicio_global(get_db(), id_ejercicio)
        if not ejercicio:
            return Response(
                {"mensaje": f"No se encontró el ejercicio {id_ejercicio}."},
                status=status.HTTP_404_NOT_FOUND
            )

        ejercicio_api = ejercicio_a_api(ejercicio)
        ejercicios_rutina.append({
            "idEjercicio": ejercicio_api["id"],
            "nombreEjercicio": ejercicio_api["nombreEjercicio"],
            "series": item.get('series', 1),
            "repeticiones": item.get('repeticiones', 1),
            "rer": item.get('rer', 1),
            "equipo": ejercicio_api["equipo"],
            "peso": item.get('peso', 0),
            "tiempo": item.get('tiempo', ''),
            "video": ejercicio_api["video"],
        })

    # Construir los datos de la rutina
    datos_rutina = {
        "enfoqueRutina": enfoque,
        "intensidad": intensidad,
        "ejercicios": ejercicios_rutina
    }

    serializer = RutinaSerializer(data=datos_rutina)

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    # Convertir los datos validados en un modelo embebido
    datos = preparar_datos(
        serializer,
        serializer.validated_data
    )

    nueva_rutina = RutinaModel(**datos)

    # Agregar la rutina sin eliminar las anteriores
    rutinas_actuales = alumno.rutina or []
    rutinas_actuales.append(nueva_rutina)

    alumno.rutina = rutinas_actuales
    alumno.save()

    return Response(
        {
            "mensaje": "Rutina asignada correctamente.",
            "rutina": RutinaSerializer(nueva_rutina).data
        },
        status=status.HTTP_201_CREATED
    )

def _armar_ejercicios_rutina(ejercicios_recibidos):
    """Devuelve (lista, None), o (None, Response) si algo viene mal.
    Reconstruye cada ejercicio desde el catálogo, igual que asignar_rutina."""
    if not isinstance(ejercicios_recibidos, list) or not ejercicios_recibidos:
        return None, Response(
            {"mensaje": "La rutina debe contener al menos un ejercicio."},
            status=status.HTTP_400_BAD_REQUEST
        )

    ejercicios = []
    for item in ejercicios_recibidos:
        if not isinstance(item, dict):
            return None, Response(
                {"mensaje": "Cada ejercicio debe ser un objeto con idEjercicio."},
                status=status.HTTP_400_BAD_REQUEST
            )

        id_ejercicio = item.get("idEjercicio")
        if not id_ejercicio:
            return None, Response(
                {"mensaje": "Falta el ID de uno de los ejercicios."},
                status=status.HTTP_400_BAD_REQUEST
            )

        ejercicio = buscar_ejercicio_global(get_db(), id_ejercicio)
        if not ejercicio:
            return None, Response(
                {"mensaje": f"No se encontró el ejercicio {id_ejercicio}."},
                status=status.HTTP_404_NOT_FOUND
            )

        ejercicio_api = ejercicio_a_api(ejercicio)
        ejercicios.append({
            "idEjercicio": ejercicio_api["id"],
            "nombreEjercicio": ejercicio_api["nombreEjercicio"],
            "series": item.get("series", 1),
            "repeticiones": item.get("repeticiones", 1),
            "rer": item.get("rer", 1),
            "equipo": ejercicio_api["equipo"],
            "peso": item.get("peso", 0),
            "tiempo": item.get("tiempo", ""),
            "video": ejercicio_api["video"],
        })

    return ejercicios, None


#ACTUALIZACIÓN DE RUTINA (NO PREDETERMINADA) DEL ALUMNO -- solo profesor
@api_view(["PATCH"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def actualizar_rutina_alumno(request, alumno_id, rutina_id):

    # buscar_por_id responde None también si el id no es válido (así no hay 500)
    alumno = buscar_por_id(UsuarioModel, alumno_id)

    if alumno is None or alumno.tipo_usuario != "Alumno":
        return Response(
            {"error": "Alumno no encontrado."},
            status=status.HTTP_404_NOT_FOUND
        )

    rutina = next(
        (r for r in alumno.rutina if str(r.idRutina) == str(rutina_id)),
        None
    )

    if rutina is None:
        return Response(
            {"error": "Rutina no encontrada para este alumno."},
            status=status.HTTP_404_NOT_FOUND
        )

    # Solo se aceptan estos tres campos
    datos_entrada = {
        campo: request.data[campo]
        for campo in ("enfoqueRutina", "intensidad")
        if campo in request.data
    }

    if "ejercicios" in request.data:
        ejercicios, error = _armar_ejercicios_rutina(request.data["ejercicios"])
        if error:
            return error
        datos_entrada["ejercicios"] = ejercicios

    if not datos_entrada:
        return Response(
            {"error": "Envía al menos enfoqueRutina, intensidad o ejercicios."},
            status=status.HTTP_400_BAD_REQUEST
        )

    serializer = RutinaSerializer(data=datos_entrada, partial=True)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Convierte los diccionarios validados en modelos embebidos (lo que faltaba antes)
    datos = preparar_datos(serializer, serializer.validated_data)

    for campo, valor in datos.items():
        setattr(rutina, campo, valor)

    alumno.save()

    return Response(RutinaSerializer(rutina).data, status=status.HTTP_200_OK)

def _entero_rutina(valor, predeterminado=1):
    """Obtiene el primer valor numérico que puede guardar el modelo de ejercicios."""
    encontrado = re.search(r"\d+", str(valor or ""))
    return int(encontrado.group()) if encontrado else predeterminado


def _campo_embebido(objeto, campo, predeterminado=None):
    """Lee campos tanto de subdocumentos Django como de documentos BSON en forma de diccionario."""
    if isinstance(objeto, dict):
        return objeto.get(campo, predeterminado)
    return getattr(objeto, campo, predeterminado)


def rutina_biblioteca_a_modelo(datos_rutina, alumno_id):
    """Adapta rutinas predeterminadas o creadas al subdocumento rutina que ya existe en usuarios."""
    if not isinstance(datos_rutina, dict):
        raise ValueError("Cada rutina debe tener un formato válido.")

    titulo = str(
        datos_rutina.get("titulo")
        or datos_rutina.get("nombre")
        or datos_rutina.get("enfoqueRutina")
        or ""
    ).strip()
    if not titulo:
        raise ValueError("Cada rutina debe tener un nombre.")

    # El ID permanece igual para la misma rutina del mismo alumno y no depende de la instalación del teléfono.
    id_origen = str(datos_rutina.get("id") or datos_rutina.get("idRutina") or titulo).strip()
    id_rutina = hashlib.sha256(f"{alumno_id}:{id_origen}".encode("utf-8")).hexdigest()[:24]

    ejercicios_recibidos = datos_rutina.get("ejercicios") or []
    if not ejercicios_recibidos and isinstance(datos_rutina.get("dias"), list):
        # La estructura del catálogo puede agrupar ejercicios por día; la colección actual solo tiene una lista de ejercicios.
        ejercicios_recibidos = [
            {
                **ejercicio,
                "nombre": f"{dia.get('nombre') or 'Día'} · {ejercicio.get('nombre') or ejercicio.get('nombreEjercicio') or 'Ejercicio'}",
            }
            for dia in datos_rutina["dias"]
            if isinstance(dia, dict)
            for ejercicio in (dia.get("ejercicios") or [])
            if isinstance(ejercicio, dict)
        ]

    if not isinstance(ejercicios_recibidos, list) or not ejercicios_recibidos:
        raise ValueError(f"La rutina {titulo} debe tener al menos un ejercicio.")

    ejercicios = []
    for indice, ejercicio in enumerate(ejercicios_recibidos, start=1):
        if not isinstance(ejercicio, dict):
            raise ValueError(f"El ejercicio {indice} de {titulo} no es válido.")

        nombre = str(ejercicio.get("nombre") or ejercicio.get("nombreEjercicio") or "").strip()
        if not nombre:
            raise ValueError(f"Al ejercicio {indice} de {titulo} le falta el nombre.")

        id_ejercicio_origen = str(
            ejercicio.get("ejercicioId") or ejercicio.get("idEjercicio") or ejercicio.get("id") or indice
        )
        id_ejercicio = hashlib.sha256(f"{id_rutina}:{id_ejercicio_origen}".encode("utf-8")).hexdigest()[:24]

        try:
            peso = float(ejercicio.get("peso") or 0)
            if not math.isfinite(peso):
                peso = 0
        except (TypeError, ValueError):
            peso = 0

        ejercicios.append(EjercicioRutinaModel(
            idEjercicio=id_ejercicio,
            nombreEjercicio=nombre[:100],
            series=min(max(_entero_rutina(ejercicio.get("series"), 1), 1), 32767),
            repeticiones=min(max(_entero_rutina(ejercicio.get("repeticiones"), 1), 1), 32767),
            # RER puede ser 0 (al fallo); antes se forzaba a 1.
            rer=min(max(_entero_rutina(ejercicio.get("rer"), 0), 0), 32767),
            equipo=str(ejercicio.get("equipo") or ejercicio.get("grupo") or "Sin equipo")[:100],
            peso=peso,
            tiempo=str(ejercicio.get("descanso") or ejercicio.get("tiempo") or "")[:30],
            video=str(ejercicio.get("video") or "")[:255],
        ))

    return RutinaModel(
        idRutina=id_rutina,
        enfoqueRutina=titulo[:50],
        ejercicios=ejercicios,
    )


def _firma_rutina(rutina):
    """Compara los ejercicios para evitar notificaciones repetidas al guardar la misma selección."""
    return (
        str(_campo_embebido(rutina, "enfoqueRutina", "")),
        tuple(
            (
                str(_campo_embebido(ejercicio, "idEjercicio", "")),
                str(_campo_embebido(ejercicio, "nombreEjercicio", "")),
                str(_campo_embebido(ejercicio, "series", "")),
                str(_campo_embebido(ejercicio, "repeticiones", "")),
                str(_campo_embebido(ejercicio, "rer", "")),
                str(_campo_embebido(ejercicio, "equipo", "")),
                str(_campo_embebido(ejercicio, "peso", "")),
                str(_campo_embebido(ejercicio, "tiempo", "")),
                str(_campo_embebido(ejercicio, "video", "")),
            )
            for ejercicio in (_campo_embebido(rutina, "ejercicios", []) or [])
        ),
    )


@api_view(["POST", "PUT"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def rutinas_asignadas(request, alumno_id):
    """Guarda o actualiza las rutinas seleccionadas dentro del array rutina del alumno."""
    alumno = buscar_por_id(UsuarioModel, alumno_id)
    if alumno is None or alumno.tipo_usuario != "Alumno":
        return Response({"mensaje": "No se encontró el alumno."}, status=status.HTTP_404_NOT_FOUND)

    recibidas = request.data.get("rutinas")
    if not isinstance(recibidas, list) or not recibidas:
        return Response({"mensaje": "Selecciona al menos una rutina."}, status=status.HTTP_400_BAD_REQUEST)

    rutinas_actuales = list(alumno.rutina or [])
    indices_por_id = {
        str(_campo_embebido(rutina, "idRutina", "")): indice
        for indice, rutina in enumerate(rutinas_actuales)
    }
    notificaciones_pendientes = []

    try:
        for datos_rutina in recibidas:
            rutina_nueva = rutina_biblioteca_a_modelo(datos_rutina, str(alumno.pk))
            id_rutina = str(rutina_nueva.idRutina)
            indice_existente = indices_por_id.get(id_rutina)

            # Si la rutina ya existía, conserva el link de video que se haya puesto desde la sección Videos.
            if indice_existente is not None:
                videos_previos = {
                    str(_campo_embebido(ejercicio, "idEjercicio", "")): str(_campo_embebido(ejercicio, "video", "") or "")
                    for ejercicio in (_campo_embebido(rutinas_actuales[indice_existente], "ejercicios", []) or [])
                }
                for ejercicio in rutina_nueva.ejercicios:
                    if not ejercicio.video and videos_previos.get(str(ejercicio.idEjercicio)):
                        ejercicio.video = videos_previos[str(ejercicio.idEjercicio)]

            if indice_existente is None:
                rutinas_actuales.append(rutina_nueva)
                indices_por_id[id_rutina] = len(rutinas_actuales) - 1
                notificaciones_pendientes.append(("rutina_nueva", rutina_nueva.enfoqueRutina))
            elif _firma_rutina(rutinas_actuales[indice_existente]) != _firma_rutina(rutina_nueva):
                rutinas_actuales[indice_existente] = rutina_nueva
                notificaciones_pendientes.append(("rutina_actualizada", rutina_nueva.enfoqueRutina))
    except (TypeError, ValueError) as error:
        return Response({"mensaje": str(error)}, status=status.HTTP_400_BAD_REQUEST)

    notificaciones_creadas = []
    try:
        # Cada rutina nueva o modificada genera un aviso en la colección de notificaciones ya existente.
        for tipo, titulo_rutina in notificaciones_pendientes:
            prefijo = "Nueva rutina" if tipo == "rutina_nueva" else "Rutina actualizada"
            aviso = notificar(
                alumno.pk,
                "Entrenamiento",
                tipo,
                f"{prefijo}: {titulo_rutina}",
                f"Tu personal trainer te asignó la rutina {titulo_rutina}. Ya puedes verla en Mi rutina.",
                alumno_id=alumno.pk,
            )
            notificaciones_creadas.append(aviso)

        # El subdocumento y sus ejercicios se escriben en el array ya declarado por UsuarioModel.
        alumno.rutina = rutinas_actuales
        alumno.save()
    except Exception:
        # Evita dejar avisos nuevos si MongoDB no pudo guardar el array del alumno.
        for aviso in notificaciones_creadas:
            try:
                aviso.delete()
            except Exception:
                pass
        raise

    return Response(
        {
            "mensaje": "Rutinas guardadas en el perfil del alumno.",
            "cantidad": len(notificaciones_pendientes),
            "rutinas": [str(_campo_embebido(rutina, "enfoqueRutina", "Rutina")) for rutina in rutinas_actuales],
        },
        status=status.HTTP_200_OK,
    )

#VIDEO DE UN EJERCICIO (link de Cloudinary) EN LAS RUTINAS DEL ALUMNO
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def video_ejercicio_alumno(request, alumno_id):
    """Pone el link del video en todos los ejercicios del alumno que se llamen igual."""
    alumno = buscar_por_id(UsuarioModel, alumno_id)
    if alumno is None or alumno.tipo_usuario != "Alumno":
        return Response({"mensaje": "No se encontró el alumno."}, status=status.HTTP_404_NOT_FOUND)

    nombre_ejercicio = str(request.data.get("ejercicio") or "").strip()
    url_video = str(request.data.get("video") or "").strip()
    if not nombre_ejercicio:
        return Response({"mensaje": "Indica a qué ejercicio corresponde el video."}, status=status.HTTP_400_BAD_REQUEST)
    if not url_video.lower().startswith("https://") or len(url_video) > 255:
        return Response({"mensaje": "Ingresa un link válido que empiece con https://"}, status=status.HTTP_400_BAD_REQUEST)

    def _normalizar(texto):
        import unicodedata
        texto = unicodedata.normalize("NFD", str(texto or "").lower())
        return " ".join("".join(c for c in texto if unicodedata.category(c) != "Mn").split())

    buscado = _normalizar(nombre_ejercicio)
    actualizados = 0
    rutinas = list(alumno.rutina or [])
    for rutina in rutinas:
        for ejercicio in (_campo_embebido(rutina, "ejercicios", []) or []):
            if _normalizar(_campo_embebido(ejercicio, "nombreEjercicio", "")) == buscado:
                if isinstance(ejercicio, dict):
                    ejercicio["video"] = url_video
                else:
                    ejercicio.video = url_video
                actualizados += 1

    if actualizados:
        alumno.rutina = rutinas
        alumno.save()

    return Response(
        {
            "mensaje": "Video guardado en las rutinas del alumno." if actualizados else "El alumno no tiene ese ejercicio en sus rutinas.",
            "actualizados": actualizados,
        },
        status=status.HTTP_200_OK,
    )

def _ids_rutinas_predeterminadas(alumno):
    """Lee las rutinas compradas desde el arreglo existente del alumno."""
    ids = []
    for rutina in (alumno.rutina_predeterminada or []):
        leer = rutina.get if isinstance(rutina, dict) else lambda campo, defecto="": getattr(rutina, campo, defecto)
        identificador = str(leer("idRutina", "") or "").strip()
        if identificador and identificador not in ids:
            ids.append(identificador)
    return ids


def _registrar_rutina_predeterminada(alumno, rutina_id, nivel_local="", enfoque_local=""):
    """Guarda una copia de la rutina comprada en rutina_predeterminada."""

    rutina_id = str(rutina_id).strip()
    db = get_db()

    ids_actuales = _ids_rutinas_predeterminadas(alumno)

    if rutina_id in ids_actuales:
        return ids_actuales, None

    try:
        identificador = ObjectId(rutina_id)
    except (InvalidId, TypeError):
        identificador = None

    if identificador is not None:
        rutina = db.rutinas_predeterminadas.find_one(
            {"_id": identificador}
        )

        if not rutina:
            return None, "No se encontró la rutina predeterminada."

        rutina_api = rutina_a_api(rutina, db)

        rutina_usuario = RutinasPredeterminadasUsuarioModel(
            idRutina=rutina_id,
            nivel=rutina_api["nivel"],
            nombre=rutina_api.get("nombre", ""),
            descripcion=rutina_api.get("descripcion", ""),
            split=SplitModel(
                **convertir(
                    SplitModel,
                    rutina_api["split"]
                )
            ),
            cardio=(
                CardioModel(
                    **convertir(
                        CardioModel,
                        rutina_api["cardio"]
                    )
                )
                if rutina_api.get("cardio")
                else None
            ),
            abdomen=(
                AbdomenModel(
                    **convertir(
                        AbdomenModel,
                        rutina_api["abdomen"]
                    )
                )
                if rutina_api.get("abdomen")
                else None
            ),
            notas_generales=rutina_api.get(
                "notas_generales",
                []
            ),
            dias=[
                DiasRutinasPredeterminadasModel(
                    **convertir(
                        DiasRutinasPredeterminadasModel,
                        dia
                    )
                )
                for dia in rutina_api.get("dias", [])
            ],
            activa=True,
        )

    else:

        # Rutinas locales antiguas de la app
        if rutina_id not in {
            "RUT-101",
            "RUT-102",
            "RUT-103",
            "RUT-104",
            "RUT-105",
            "RUT-106",
        }:
            return None, "El identificador de rutina no es válido."

        nivel_texto = str(
            nivel_local or ""
        ).strip().casefold()

        nivel = (
            "Basico"
            if nivel_texto in {
                "inicial",
                "principiante",
                "basico",
                "básico",
            }
            else "Intermedio"
            if nivel_texto == "intermedio"
            else "Avanzado"
            if nivel_texto in {
                "avanzado",
                "advanced",
            }
            else ""
        )

        enfoque = str(
            enfoque_local or ""
        ).strip()

        rutina_usuario = RutinasPredeterminadasUsuarioModel(
            idRutina=rutina_id,
            nivel=nivel,
            nombre="",
            descripcion="",
            split=SplitModel(
                dias_entrenamiento=0,
                secuencia=[],
                repetir=True,
                descripcion=enfoque,
            ),
            cardio=None,
            abdomen=None,
            notas_generales=[],
            dias=[],
            activa=True,
        )

    alumno.rutina_predeterminada.append(
        rutina_usuario
    )

    alumno.save()

    return _ids_rutinas_predeterminadas(alumno), None


@api_view(["GET", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAlumno])
def rutinas_compradas(request):
    """Lee o registra compras sin crear otro campo en el documento del usuario."""
    alumno = request.user
    compras = _ids_rutinas_predeterminadas(alumno)

    if request.method == "GET":
        return Response({"rutinasCompradas": compras}, status=status.HTTP_200_OK)

    respuesta_bloqueo = bloquear_si_no_hay_pagos()
    if respuesta_bloqueo:
        return respuesta_bloqueo

    rutina_id = str(request.data.get("rutina_id") or "").strip()
    if not rutina_id or len(rutina_id) > 24:
        return Response({"error": "Debes indicar el identificador de una rutina válida."}, status=status.HTTP_400_BAD_REQUEST)

    ids, error = _registrar_rutina_predeterminada(alumno, rutina_id, request.data.get("nivel"), request.data.get("split"))
    if error:
        codigo = status.HTTP_404_NOT_FOUND if error.startswith("No se encontró") else status.HTTP_400_BAD_REQUEST
        return Response({"error": error}, status=codigo)
    return Response({"mensaje": "Rutina registrada en la cuenta.", "rutinasCompradas": ids}, status=status.HTTP_200_OK)


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAlumno])
def catalogo_rutinas_predeterminadas(request):
    """Entrega el catálogo guardado con los campos históricos que usa Mongo."""
    db = get_db()
    rutinas = [rutina_a_api(doc, db) for doc in db.rutinas_predeterminadas.find({}).sort("_id", 1)]
    return Response(rutinas, status=status.HTTP_200_OK)


# VISUALIZACIÓN DE RUTINA COMPRADA POR EL PROFESIONAL ASIGNADO.
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def detalle_rutina_predeterminada(request, alumno_id, rutina_id):

    alumno = obtener_alumno(alumno_id)
    if alumno is None:
        return respuesta_alumno_no_encontrado()

    rutina_id = str(rutina_id).strip()

    # Se muestra la copia que quedó guardada en el alumno al comprarla, no la
    # plantilla del catálogo (que el admin pudo editar o borrar después).
    rutina_usuario = next(
        (
            r for r in (alumno.rutina_predeterminada or [])
            if str(getattr(r, "idRutina", "")).strip() == rutina_id
        ),
        None
    )

    if rutina_usuario is None:
        return Response(
            {"error": "Rutina predeterminada no encontrada."},
            status=status.HTTP_404_NOT_FOUND
        )

    # Compras antiguas guardaron solo una referencia sin días: en ese caso se
    # completa con la plantilla del catálogo si todavía existe.
    if not rutina_usuario.dias:
        try:
            plantilla = get_db().rutinas_predeterminadas.find_one({"_id": ObjectId(rutina_id)})
        except (InvalidId, TypeError):
            plantilla = None
        if plantilla:
            return Response(rutina_a_api(plantilla, get_db()), status=status.HTTP_200_OK)

    datos = RutinasPredeterminadasUsuarioSerializer(rutina_usuario).data
    datos["id"] = rutina_id
    return Response(datos, status=status.HTTP_200_OK)

@api_view(["POST"]) #ASGINA DIETA A ALUMNO -- solo profesor
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def crear_dieta(request, alumno_id):

    alumno = obtener_alumno(alumno_id)
    if alumno is None:
        return respuesta_alumno_no_encontrado()

    # Validar los datos de la dieta
    serializer = DietaSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Crear la dieta con sus días y agregarla al alumno
    dieta = serializer.save()
    alumno.dietas.append(dieta)
    alumno.save()

    # La app del alumno ya espera este aviso (tipo "nutricion_nueva").
    try:
        notificar(
            alumno.pk, "Nutrición", "nutricion_nueva",
            "Tienes un nuevo plan de nutrición",
            "Tu personal trainer te asignó un plan de nutrición. Revísalo en Mi Nutrición.",
            alumno_id=alumno.pk,
        )
    except Exception:
        logger.exception("No se pudo notificar la dieta nueva del alumno %s", alumno.pk)

    return Response(
        {
            "mensaje": "Dieta registrada correctamente",
            "dieta": DietaSerializer(dieta).data
        },
        status=status.HTTP_201_CREATED
    )

@api_view(["GET"]) #LISTA DIETAS DE ALUMNO PARA PROFESOR
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def listar_dietas_usuario(request, alumno_id):

    alumno = obtener_alumno(alumno_id)
    if alumno is None:
        return respuesta_alumno_no_encontrado()

    dietas = alumno.dietas or []

    return Response(
        {
            "alumno_id": str(alumno.pk),
            "nombre": alumno.nombre,
            "total_dietas": len(dietas),
            "dietas": DietaSerializer(dietas, many=True).data
        },
        status=status.HTTP_200_OK
    )

@api_view(["GET"]) #LISTA DIETAS DE ALUMNO PARA EL ALUMNO
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAlumno])
def listar_mis_dietas(request):

    usuario = request.user
    dietas = usuario.dietas or []

    return Response(
        {
            "alumno_id": str(usuario.pk),
            "nombre": usuario.nombre,
            "total_dietas": len(dietas),
            "dietas": DietaSerializer(dietas, many=True).data
        },
        status=status.HTTP_200_OK
    )


@api_view(["PUT", "PATCH"]) #EDITA DIETA DE ALUMNO -- solo profesor
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def editar_dieta(request, alumno_id, dieta_id):

    alumno = obtener_alumno(alumno_id)
    if alumno is None:
        return respuesta_alumno_no_encontrado()

    dieta = next(
        (d for d in alumno.dietas if str(d.idDieta) == str(dieta_id)),
        None
    )

    if dieta is None:
        return Response({"error": "No se encontró la dieta"}, status=404)

    # Valida tipos y largos; partial=True permite mandar solo los campos a cambiar
    serializer = DietaEdicionSerializer(data=request.data, partial=True)

    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    datos = serializer.validated_data

    if not datos:
        return Response(
            {"error": "Envía al menos un campo: tmb, macros, notas o suplementos"},
            status=400
        )

    for campo, valor in datos.items():
        setattr(dieta, campo, valor)

    alumno.save()

    return Response(
        {
            "mensaje": "Dieta actualizada correctamente",
            "dieta": DietaSerializer(dieta).data
        },
        status=200
    )

@api_view(["PUT", "PATCH"]) #EDITA UN DÍA ESPECÍFICO DE LA DIETA DEL ALUMNO -- solo profesor
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def editar_dia_dieta(request, alumno_id, dieta_id, dia_id):

    alumno = obtener_alumno(alumno_id)
    if alumno is None:
        return respuesta_alumno_no_encontrado()

    # Buscar la dieta
    dieta = next(
        (
            d for d in alumno.dietas
            if str(d.idDieta) == str(dieta_id)
        ),
        None
    )

    if dieta is None:
        return Response(
            {"error": "No se encontró la dieta"},
            status=404
        )

    # Buscar el día dentro de la dieta
    dia = next(
        (
            d for d in dieta.dias
            if str(d.idDia) == str(dia_id)
        ),
        None
    )

    if dia is None:
        return Response(
            {"error": "No se encontró el día indicado"},
            status=404
        )

    # Validar los datos del día
    serializer = DiaDietaSerializer(
        dia,
        data=request.data,
        partial=True
    )

    if serializer.is_valid():

        # Actualizar los campos modificados
        for campo, valor in serializer.validated_data.items():
            setattr(dia, campo, valor)

        alumno.save()

        return Response(
            {
                "mensaje": "Día actualizado correctamente",
                "dia": DiaDietaSerializer(dia).data
            },
            status=200
        )

    return Response(
        serializer.errors,
        status=400
    )


@api_view(["DELETE"]) #ELIMINA DIETA DE ALUMNO -- solo profesor
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def eliminar_dieta(request, alumno_id, dieta_id):

    alumno = obtener_alumno(alumno_id)
    if alumno is None:
        return respuesta_alumno_no_encontrado()

    # Buscar la dieta
    dieta = next(
        (
            d for d in alumno.dietas
            if str(d.idDieta) == str(dieta_id)
        ),
        None
    )

    if dieta is None:
        return Response(
            {"error": "No se encontró la dieta"},
            status=404
        )

    # Eliminar la dieta
    alumno.dietas = [
        d for d in alumno.dietas
        if str(d.idDieta) != str(dieta_id)
    ]

    alumno.save()

    return Response(
        {"mensaje": "Dieta eliminada correctamente"},
        status=200
    )


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([UsuarioAutenticado])
def registrar_sesion(request):

    # Solo los alumnos pueden registrar sus sesiones
    if request.user.tipo_usuario != "Alumno":
        return Response(
            {"error": "Solo los alumnos pueden registrar sesiones."},
            status=status.HTTP_403_FORBIDDEN
        )

    datos = request.data

    # Comprobar que se haya indicado la rutina realizada
    id_rutina = datos.get('idRutina')

    if not id_rutina:
        return Response(
            {"error": "Debes indicar la rutina realizada."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Solo las rutinas asignadas por el profesor (rutina) registran sesiones, para que él
    # revise los resultados y evalúe el entrenamiento. Las rutinas predeterminadas
    # compradas (rutina_predeterminada) no registran sesión.
    rutina_existe = any(
        str(rutina.idRutina) == str(id_rutina)
        for rutina in (request.user.rutina or [])
    )

    if not rutina_existe and str(id_rutina) in _ids_rutinas_predeterminadas(request.user):
        return Response(
            {"error": "Las rutinas predeterminadas no registran sesiones; solo las que asigna tu profesional."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not rutina_existe:
        return Response(
            {"error": "La rutina no pertenece a este alumno."},
            status=status.HTTP_404_NOT_FOUND
        )

    # Validar los datos de la sesión
    serializer = SesionSerializer(data=datos)

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    # Construir la instancia de sesión y sus ejercicios embebidos
    datos_sesion = preparar_datos(
        serializer,
        serializer.validated_data
    )

    nueva_sesion = SesionModel(**datos_sesion)

    # Guardar la sesión dentro del documento del alumno
    if request.user.sesion is None:
        request.user.sesion = []

    request.user.sesion.append(nueva_sesion)
    request.user.save()

    return Response(
        {
            "mensaje": "Sesión registrada correctamente.",
            "sesion": SesionSerializer(nueva_sesion).data
        },
        status=status.HTTP_201_CREATED
    )

#LISTAR LAS SESIONES DE ALUMNO PARA EL PROFESOR
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def listar_sesiones_alumno(request, alumno_id):

    try:
        alumno = UsuarioModel.objects.get(
            pk=ObjectId(alumno_id)
        )

    except (InvalidId, UsuarioModel.DoesNotExist):
        return Response(
            {"error": "No se encontró el alumno."},
            status=status.HTTP_404_NOT_FOUND
        )

    if alumno.tipo_usuario != "Alumno":
        return Response(
            {"error": "El usuario indicado no es un alumno."},
            status=status.HTTP_400_BAD_REQUEST
        )

    sesiones = alumno.sesion or []

    serializer = SesionSerializer(sesiones, many=True)

    return Response(
        serializer.data,
        status=status.HTTP_200_OK
    )


PROFESORES = "profesores"
FORMATO_FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
FORMATO_HORA = re.compile(r"^\d{2}:\d{2}$")
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
         'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
KG_POR_HITO = 2  # cada 2 kg de avance hacia su objetivo se avisa


# ---------- helpers ----------

def es_profesor(usuario):
    return getattr(usuario, "tipo_usuario", "") == "Profesor"


def primer_nombre(usuario_o_nombre):
    nombre = usuario_o_nombre if isinstance(usuario_o_nombre, str) else getattr(usuario_o_nombre, "nombre", "")
    return (nombre or "Cliente").strip().split(" ")[0]


def fecha_legible(fecha_iso):
    """'2026-11-05' -> '5 de noviembre'"""
    try:
        _, mes, dia = (int(p) for p in fecha_iso.split("-"))
        return f"{dia} de {MESES[mes - 1]}"
    except (ValueError, IndexError):
        return fecha_iso


def notificar(para, categoria, tipo, titulo, mensaje, asesoria_id="", alumno_id=""):
    return NotificacionModel.objects.create(
        para=str(para),
        categoria=categoria,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        asesoria_id=str(asesoria_id or ""),
        alumno_id=str(alumno_id or ""),
    )


def asesoria_a_dict(a):
    # mismos nombres que ya usaba la app en la agenda local
    return {
        "id": str(a.pk),
        "clienteId": a.alumno_id,
        "clienteNombre": a.alumno_nombre,
        "fecha": a.fecha,
        "hora": a.hora,
        "estado": a.estado,
        "creada": a.creada.isoformat() if a.creada else None,
    }


def notificacion_a_dict(n):
    return {
        "id": str(n.pk),
        "categoria": n.categoria,
        "tipo": n.tipo,
        "titulo": n.titulo,
        "mensaje": n.mensaje,
        "asesoriaId": n.asesoria_id,
        "alumnoId": n.alumno_id,
        "leida": n.leida,
        "resuelta": n.resuelta,
        "respuesta": n.respuesta,
        "creada": n.creada.isoformat() if n.creada else None,
    }


def buscar_por_id(modelo, valor):
    try:
        return modelo.objects.get(pk=ObjectId(str(valor)))
    except (InvalidId, TypeError, modelo.DoesNotExist):
        return None


def bloqueo_horario(fecha, hora):
    """Valor del campo AsesoriaModel.bloqueo para un horario activo."""
    return f"{fecha} {hora}"


def horario_ocupado(fecha, hora, excluir_id=None):
    qs = AsesoriaModel.objects.filter(fecha=fecha, hora=hora).exclude(estado="cancelada")
    if excluir_id:
        qs = qs.exclude(pk=excluir_id)
    return qs.exists()


def validar_fecha_hora(datos):
    fecha = str(datos.get("fecha", "")).strip()
    hora = str(datos.get("hora", "")).strip()
    if not FORMATO_FECHA.match(fecha) or not FORMATO_HORA.match(hora):
        return None, None, Response(
            {"mensaje": "Indica la fecha (AAAA-MM-DD) y la hora (HH:MM)."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    # El servidor también rechaza fechas pasadas para cubrir clientes que no usan la interfaz móvil.
    try:
        fecha_validada = datetime.strptime(fecha, "%Y-%m-%d").date()
    except ValueError:
        return None, None, Response(
            {"mensaje": "La fecha indicada no es válida."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if fecha_validada < dj_timezone.localdate():
        return None, None, Response(
            {"mensaje": "No puedes reservar ni reagendar una clase presencial para una fecha que ya pasó."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return fecha, hora, None


# ---------- avisos que salen de "Tus métricas" y "Registrar peso" ----------

def peso_inicial_desde_metricas(usuario):
    """Primer peso registrado del alumno: metricas[0].pesos o, si no hay, metricas[0].medidas.

    MetricasModel no tiene un campo "peso"; antes se leía ese campo y siempre daba None.
    """
    metricas = usuario.metricas or []
    if not metricas:
        return None

    primera_metrica = metricas[0]
    candidatos = list(_campo_embebido(primera_metrica, "pesos", []) or []) + \
        list(_campo_embebido(primera_metrica, "medidas", []) or [])

    for registro in candidatos:
        try:
            peso = float(_campo_embebido(registro, "peso", None))
        except (TypeError, ValueError):
            continue
        if peso > 0:
            return peso
    return None


def avisos_por_cambio_de_datos(usuario, peso_antes, lesiones_antes, primera_vez):
    """Se llama desde PATCH /api/datos/ después de guardar.
    - Lesión nueva          -> aviso al profesional.
    - Avance de su objetivo -> aviso al alumno y al profesional (cada 2 kg).
    """
    datos = usuario.datos
    if datos is None:
        return
    nombre = primer_nombre(usuario)

    # lesiones nuevas
    lesiones = list(datos.lesion or [])
    for lesion in lesiones[lesiones_antes:]:
        en_reposo = " (en reposo)" if lesion.reposo == "Sí" else ""
        detalle = f": {lesion.detalle}" if lesion.detalle else ""
        notificar(
            PROFESORES, "Clientes", "lesion_registrada",
            f"{nombre} registró una lesión",
            f"Zona: {lesion.areaCorporal}{detalle}{en_reposo}. Revisa su rutina.",
            alumno_id=usuario.pk,
        )

    # avance del objetivo según el peso
    if primera_vez or peso_antes is None or datos.pesoActual is None:
        return
    # La primera medición conserva el peso inicial; el peso anterior sirve de respaldo
    # para cuentas antiguas que todavía no tienen registros en la lista de medidas.
    inicial = peso_inicial_desde_metricas(usuario)
    if inicial is None:
        inicial = peso_antes
    if datos.objetivo == "Pérdida de grasa":
        avance_antes, avance_ahora, verbo = inicial - peso_antes, inicial - datos.pesoActual, "bajado"
    elif datos.objetivo == "Ganancia muscular":
        avance_antes, avance_ahora, verbo = peso_antes - inicial, datos.pesoActual - inicial, "subido"
    else:
        return

    if avance_ahora >= KG_POR_HITO and math.floor(avance_ahora / KG_POR_HITO) > math.floor(avance_antes / KG_POR_HITO):
        kg = f"{avance_ahora:.1f}".rstrip("0").rstrip(".")
        notificar(
            usuario.pk, "Entrenamiento", "objetivo_alcanzado",
            "¡Nuevo objetivo alcanzado!",
            f"Has {verbo} {kg} kg desde que empezaste. ¡Sigue así!",
            alumno_id=usuario.pk,
        )
        notificar(
            PROFESORES, "Clientes", "objetivo_alcanzado",
            f"{nombre} alcanzó un objetivo",
            f"Ha {verbo} {kg} kg desde que empezó ({datos.objetivo.lower()}).",
            alumno_id=usuario.pk,
        )


# ---------- asesorías ----------

@api_view(["GET", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([UsuarioAutenticado])
def asesorias(request):
    usuario = request.user

    if request.method == "GET":
        qs = AsesoriaModel.objects.exclude(estado="cancelada")
        if not es_profesor(usuario):
            qs = qs.filter(alumno_id=str(usuario.pk))
        return Response([asesoria_a_dict(a) for a in qs.order_by("fecha", "hora")])

    # POST: el alumno reserva una hora
    if es_profesor(usuario):
        return Response({"mensaje": "Las reservas las hacen los clientes."}, status=status.HTTP_403_FORBIDDEN)

    fecha, hora, error = validar_fecha_hora(request.data)
    if error:
        return error
    if horario_ocupado(fecha, hora):
        return Response({"mensaje": "Ese horario ya fue reservado. Elige otro."}, status=status.HTTP_409_CONFLICT)

    try:
        asesoria = AsesoriaModel.objects.create(
            alumno_id=str(usuario.pk),
            alumno_nombre=usuario.nombre,
            fecha=fecha,
            hora=hora,
            estado="pendiente",
            bloqueo=bloqueo_horario(fecha, hora),
        )
    except IntegrityError:
        # Otra persona reservó ese horario justo antes (el índice único de "bloqueo" lo impide).
        return Response({"mensaje": "Ese horario ya fue reservado. Elige otro."}, status=status.HTTP_409_CONFLICT)
    notificar(
        PROFESORES, "Clases presenciales", "asesoria_nueva",
        "Tienes una clase presencial reservada",
        f"{primer_nombre(usuario)} reservó una clase presencial el {fecha_legible(fecha)} a las {hora}.",
        asesoria_id=asesoria.pk, alumno_id=usuario.pk,
    )
    return Response(asesoria_a_dict(asesoria), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([UsuarioAutenticado])
def horarios_ocupados(request):
    """Horas tomadas por cualquier cliente (sin nombres), para no reservar dos veces la misma."""
    qs = AsesoriaModel.objects.exclude(estado="cancelada")
    return Response([{"id": str(a.pk), "fecha": a.fecha, "hora": a.hora} for a in qs])


@api_view(["PATCH"])
@authentication_classes([TokenAuthentication])
@permission_classes([UsuarioAutenticado])
def asesoria_detalle(request, asesoria_id):
    usuario = request.user
    asesoria = buscar_por_id(AsesoriaModel, asesoria_id)
    if asesoria is None:
        return Response({"mensaje": "No se encontró la clase presencial."}, status=status.HTTP_404_NOT_FOUND)

    profesor = es_profesor(usuario)
    if not profesor and asesoria.alumno_id != str(usuario.pk):
        return Response({"mensaje": "Esta clase presencial no es tuya."}, status=status.HTTP_403_FORBIDDEN)

    nombre_alumno = primer_nombre(asesoria.alumno_nombre)

    # cambio de horario
    if "fecha" in request.data or "hora" in request.data:
        if asesoria.estado == "cancelada":
            return Response({"mensaje": "No se puede reagendar una clase cancelada."}, status=status.HTTP_409_CONFLICT)
        fecha, hora, error = validar_fecha_hora(request.data)
        if error:
            return error
        if horario_ocupado(fecha, hora, excluir_id=asesoria.pk):
            return Response({"mensaje": "Ese horario ya está tomado. Elige otro."}, status=status.HTTP_409_CONFLICT)

        fecha_antes, hora_antes = asesoria.fecha, asesoria.hora
        asesoria.fecha, asesoria.hora = fecha, hora
        asesoria.estado = "reagendada_por_entrenador" if profesor else "reagendada_por_cliente"
        asesoria.bloqueo = bloqueo_horario(fecha, hora)
        try:
            asesoria.save()
        except IntegrityError:
            return Response({"mensaje": "Ese horario ya está tomado. Elige otro."}, status=status.HTTP_409_CONFLICT)

        if profesor:
            notificar(
                asesoria.alumno_id, "Clases presenciales", "asesoria_reagendada",
                "Tu clase presencial fue reagendada",
                f"El personal trainer cambió tu clase presencial del {fecha_legible(fecha_antes)} a las {hora_antes} "
                f"al {fecha_legible(fecha)} a las {hora}. Confirma el nuevo horario o solicita otro.",
                asesoria_id=asesoria.pk, alumno_id=asesoria.alumno_id,
            )
        else:
            notificar(
                PROFESORES, "Clases presenciales", "asesoria_cambio_cliente",
                f"{nombre_alumno} pidió otro horario",
                f"Cambió su clase presencial al {fecha_legible(fecha)} a las {hora}. Revísala en tu calendario.",
                asesoria_id=asesoria.pk, alumno_id=asesoria.alumno_id,
            )
        return Response(asesoria_a_dict(asesoria))

    # confirmación: cada parte solo confirma lo que propuso la otra.
    #   - el profesional confirma una reserva nueva o un cambio pedido por el cliente
    #   - el cliente confirma un horario que reagendó el profesional
    if request.data.get("estado") == "confirmada":
        puede_confirmar = (
            asesoria.estado in ("pendiente", "reagendada_por_cliente")
            if profesor
            else asesoria.estado == "reagendada_por_entrenador"
        )
        if not puede_confirmar:
            return Response(
                {"mensaje": "Esta clase presencial no está esperando tu confirmación."},
                status=status.HTTP_409_CONFLICT,
            )
        asesoria.estado = "confirmada"
        asesoria.save()
        if profesor:
            notificar(
                asesoria.alumno_id, "Clases presenciales", "asesoria_confirmada",
                "Tu clase presencial fue confirmada",
                f"Te esperamos el {fecha_legible(asesoria.fecha)} a las {asesoria.hora}.",
                asesoria_id=asesoria.pk, alumno_id=asesoria.alumno_id,
            )
        else:
            notificar(
                PROFESORES, "Clases presenciales", "asesoria_confirmada_cliente",
                f"{nombre_alumno} confirmó su clase presencial",
                f"Aceptó el horario del {fecha_legible(asesoria.fecha)} a las {asesoria.hora}.",
                asesoria_id=asesoria.pk, alumno_id=asesoria.alumno_id,
            )
        return Response(asesoria_a_dict(asesoria))

    # eliminar (cancelar) la asesoría: deja libre el horario y avisa a la otra parte
    if request.data.get("estado") == "cancelada":
        if asesoria.estado == "cancelada":
            return Response({"mensaje": "La clase presencial ya estaba cancelada."}, status=status.HTTP_409_CONFLICT)
        asesoria.estado = "cancelada"
        asesoria.bloqueo = None  # libera el horario para otra reserva
        asesoria.save()
        if profesor:
            notificar(
                asesoria.alumno_id, "Clases presenciales", "asesoria_cancelada",
                "Tu clase presencial ha sido cancelada",
                f"El personal trainer canceló tu clase presencial del {fecha_legible(asesoria.fecha)} a las {asesoria.hora}. "
                "Puedes reservar otro horario cuando quieras.",
                asesoria_id=asesoria.pk, alumno_id=asesoria.alumno_id,
            )
        else:
            notificar(
                PROFESORES, "Clases presenciales", "asesoria_cancelada_cliente",
                f"{nombre_alumno} canceló su clase presencial",
                f"Quedó libre el horario del {fecha_legible(asesoria.fecha)} a las {asesoria.hora}.",
                asesoria_id=asesoria.pk, alumno_id=asesoria.alumno_id,
            )
        return Response(asesoria_a_dict(asesoria))

    return Response({"mensaje": "Nada que actualizar."}, status=status.HTTP_400_BAD_REQUEST)


# ---------- notificaciones ----------

def _notificaciones_de(usuario):
    para = PROFESORES if es_profesor(usuario) else str(usuario.pk)
    return NotificacionModel.objects.filter(para=para)


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([UsuarioAutenticado])
def notificaciones(request):
    qs = _notificaciones_de(request.user).order_by("-creada")[:60]
    return Response([notificacion_a_dict(n) for n in qs])


@api_view(["PATCH", "DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([UsuarioAutenticado])
def notificacion_detalle(request, notificacion_id):
    notificacion = buscar_por_id(NotificacionModel, notificacion_id)
    if notificacion is None or not _notificaciones_de(request.user).filter(pk=notificacion.pk).exists():
        return Response({"mensaje": "No se encontró la notificación."}, status=status.HTTP_404_NOT_FOUND)

    # Solo elimina el aviso individual que pertenece a la bandeja visible para la cuenta.
    if request.method == "DELETE":
        notificacion.delete()
        return Response({"mensaje": "Notificación eliminada."})

    if "leida" in request.data:
        notificacion.leida = bool(request.data["leida"])
    if "resuelta" in request.data:
        notificacion.resuelta = bool(request.data["resuelta"])
    if "respuesta" in request.data:
        notificacion.respuesta = str(request.data["respuesta"])[:30]
    notificacion.save()
    return Response(notificacion_a_dict(notificacion))


@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([UsuarioAutenticado])
def leer_todas(request):
    for n in _notificaciones_de(request.user).filter(leida=False):
        n.leida = True
        n.save()
    return Response({"mensaje": "Listo."})


# ---------- avisos manuales ----------

@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([UsuarioAutenticado])
def aviso_whatsapp(request):
    """El cliente tocó "Mensajes WhatsApp": se avisa al profesional (máximo uno cada 10 minutos)."""
    usuario = request.user
    if es_profesor(usuario):
        return Response({"mensaje": "Sin aviso."})
    hace_poco = dj_timezone.now() - timedelta(minutes=10)
    repetido = NotificacionModel.objects.filter(
        para=PROFESORES, tipo="whatsapp", alumno_id=str(usuario.pk), creada__gte=hace_poco
    ).exists()
    if not repetido:
        notificar(
            PROFESORES, "Clientes", "whatsapp",
            f"{primer_nombre(usuario)} te escribió por WhatsApp",
            "Abrió WhatsApp desde la app para hablar contigo. Revisa tus mensajes.",
            alumno_id=usuario.pk,
        )
    return Response({"mensaje": "Aviso enviado."})


@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def aviso_mensaje_profesor(request):
    """El profesional abrió WhatsApp para escribirle a un alumno (máximo un aviso cada 10 minutos)."""
    alumno = obtener_alumno(request.data.get("alumno_id"))
    if alumno is None:
        return respuesta_alumno_no_encontrado()
    hace_poco = dj_timezone.now() - timedelta(minutes=10)
    repetido = NotificacionModel.objects.filter(
        para=str(alumno.pk), tipo="mensaje_profesor", creada__gte=hace_poco
    ).exists()
    if not repetido:
        notificar(
            alumno.pk, "Mensajes", "mensaje_profesor",
            "Tu entrenador te escribió",
            "Tu personal trainer te envió un mensaje por WhatsApp. Revisa tus chats.",
            alumno_id=alumno.pk,
        )
    return Response({"mensaje": "Aviso enviado."})


@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesor])
def aviso_rutina(request):
    """El profesional asignó o cambió rutinas a un alumno."""
    alumno = buscar_por_id(UsuarioModel, request.data.get("alumno_id"))
    if alumno is None or alumno.tipo_usuario != "Alumno":
        return Response({"mensaje": "No se encontró el alumno."}, status=status.HTTP_404_NOT_FOUND)
    titulos = [str(t) for t in (request.data.get("rutinas") or []) if t][:5]
    detalle = f": {', '.join(titulos)}" if titulos else ""
    notificar(
        alumno.pk, "Entrenamiento", "rutina_actualizada",
        "Rutina actualizada",
        f"Tu entrenador actualizó tus rutinas{detalle}.",
        alumno_id=alumno.pk,
    )
    return Response({"mensaje": "Aviso enviado."})


#ASIGNAR PLAN A ALUMNO POR PARTE DEL PROFESOR
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesorOAdmin])
def asignar_plan(request):

    alumno_id = request.data.get("alumno_id")
    nivel = str(request.data.get("nivel") or "").strip().lower()

    niveles_validos = {
        "inicial": "Plan Principiante",
        "avanzado": "Plan Avanzado"
    }

    if nivel not in niveles_validos:
        return Response(
            {"mensaje": "Nivel de plan inválido."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Buscar alumno
    alumno = buscar_por_id(UsuarioModel, alumno_id)

    if alumno is None or alumno.tipo_usuario != "Alumno":
        return Response(
            {"mensaje": "No se encontró el alumno."},
            status=status.HTTP_404_NOT_FOUND
        )

    # Buscar plan en la colección planes
    plan = PlanesModel.objects.filter(
        nombre=niveles_validos[nivel]
    ).first()

    if plan is None:
        return Response(
            {"mensaje": "No se encontró el plan solicitado."},
            status=status.HTTP_404_NOT_FOUND
        )

    # Convertir precio a Decimal
    precio = Decimal(str(plan.precio))

    alumno.plan = agregar_plan_al_historial(
        alumno.plan,
        PlanModel(
            idPlan=str(plan.pk),
            nombre=plan.nombre,
            precio=precio,
            detalle=plan.detalle,
            fechaContratacion=dj_timezone.localdate(),
            vigencia="Activo"
        ),
    )
    alumno.save()

    return Response(
        {
            "mensaje": "Plan asignado correctamente.",
            "alumno_id": str(alumno.pk),
            "plan": {
                "idPlan": str(plan.pk),
                "nombre": plan.nombre,
                "precio": precio,
                "detalle": plan.detalle,
                "vigencia": "Activo"
            }
        },
        status=status.HTTP_200_OK
    )

#LISTAR RUTINAS -- PROFESOR VE TODAS / ALUMNO SOLO VE LAS SUYAS
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloProfesorOAlumno])
def listar_rutinas_usuario(request, alumno_id):

    alumno = buscar_por_id(UsuarioModel, alumno_id)

    # Verificar que el alumno exista
    if alumno is None or alumno.tipo_usuario != "Alumno":
        return Response(
            {"mensaje": "No se encontró el alumno."},
            status=status.HTTP_404_NOT_FOUND
        )

    # Verificar que el alumno consulte solamente sus propias rutinas
    if request.user.tipo_usuario == "Alumno":
        if str(request.user.pk) != str(alumno.pk):
            return Response(
                {"mensaje": "No tienes permiso para consultar estas rutinas."},
                status=status.HTTP_403_FORBIDDEN
            )

    rutinas = alumno.rutina or []

    return Response(
        {
            "alumno_id": str(alumno.pk),
            "nombre": alumno.nombre,
            "total_rutinas": len(rutinas),
            "rutinas": RutinaSerializer(rutinas, many=True).data
        },
        status=status.HTTP_200_OK
    )

def tiene_plan_avanzado(usuario):
    """True si el usuario tiene un plan activo que sea el Plan Avanzado."""
    for plan in (usuario.plan or []):
        vigencia = str(_campo_embebido(plan, "vigencia", "") or "").strip().lower()
        nombre = f"{_campo_embebido(plan, 'idPlan', '')} {_campo_embebido(plan, 'nombre', '')}".lower()
        if vigencia == "activo" and "avanzado" in nombre:
            return True
    return False

def rutina_a_dict_cliente(rutina, avisos_por_titulo,puede_ver_videos=False):
    """Convierte el subdocumento guardado en Mongo al formato que muestra la pantalla del cliente."""
    titulo = str(_campo_embebido(rutina, "enfoqueRutina", "Rutina") or "Rutina")
    aviso = (
        avisos_por_titulo.get(f"Nueva rutina: {titulo}")
        or avisos_por_titulo.get(f"Rutina actualizada: {titulo}")
    )
    ejercicios = _campo_embebido(rutina, "ejercicios", []) or []
    return {
        "id": str(_campo_embebido(rutina, "idRutina", "")),
        "titulo": titulo,
        "nivel": str(_campo_embebido(rutina, "nivel", "") or ""),
        "frecuencia": str(_campo_embebido(rutina, "frecuencia", "") or ""),
        "asignada": aviso.creada.isoformat() if aviso and aviso.creada else None,
        "vista": bool(aviso.leida) if aviso else True,
        "ejercicios": [
            {
                "id": str(_campo_embebido(ejercicio, "idEjercicio", "")),
                "nombre": str(_campo_embebido(ejercicio, "nombreEjercicio", "Ejercicio")),
                "grupo": str(_campo_embebido(ejercicio, "equipo", "") or ""),
                "series": str(_campo_embebido(ejercicio, "series", "")),
                "repeticiones": str(_campo_embebido(ejercicio, "repeticiones", "")),
                "rer": str(_campo_embebido(ejercicio, "rer", "")),
                "descanso": str(_campo_embebido(ejercicio, "tiempo", "") or ""),
                "peso": _campo_embebido(ejercicio, "peso", 0),
                                # Los videos explicativos son exclusivos del Plan Avanzado.
                "video": str(_campo_embebido(ejercicio, "video", "") or "") if puede_ver_videos else "",
                # Avisa si el ejercicio tiene video, aunque el cliente no pueda verlo (para mostrar el candado).
                "tieneVideo": bool(str(_campo_embebido(ejercicio, "video", "") or "").strip()),
            }
            for ejercicio in ejercicios
        ],
    }


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([UsuarioAutenticado])
def mis_rutinas(request):
    """Entrega a cada alumno solo las rutinas guardadas dentro de su propio perfil."""
    usuario = request.user
    rutinas = usuario.rutina or []
    titulos = [
        f"{prefijo}: {str(_campo_embebido(rutina, 'enfoqueRutina', 'Rutina') or 'Rutina')}"
        for rutina in rutinas
        for prefijo in ("Nueva rutina", "Rutina actualizada")
    ]
    avisos_por_titulo = {}
    for aviso in NotificacionModel.objects.filter(
        para=str(usuario.pk),
        tipo__in=["rutina_nueva", "rutina_actualizada"],
        titulo__in=titulos,
    ).order_by("-creada"):
        avisos_por_titulo.setdefault(aviso.titulo, aviso)

    puede_ver_videos = tiene_plan_avanzado(usuario)
    return Response([rutina_a_dict_cliente(rutina, avisos_por_titulo, puede_ver_videos) for rutina in rutinas])


@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([UsuarioAutenticado])
def marcar_mis_rutinas_vistas(request):
    """Marca como leídas las notificaciones de rutina del alumno autenticado."""
    avisos = _notificaciones_de(request.user).filter(
        tipo__in=["rutina_nueva", "rutina_actualizada"],
        leida=False,
    )
    for aviso in avisos:
        aviso.leida = True
        aviso.save()
    return Response({"mensaje": "Rutinas marcadas como vistas."})

# MULTIMEDIA
#PERMITE QUE TODOS PUEDAN VISUALIZAR LA FOTO O VIDEO QUE ESTA ACTIVO ACTUALMENTE
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def obtener_fondo_activo(request):

    db = get_db()
    coleccion = db["multimedia"]

    multimedia = coleccion.find_one({"activo": True})

    if not multimedia:
        return Response(
            {"mensaje": "No hay un fondo activo."},
            status=404
        )

    multimedia["id"] = str(multimedia.pop("_id"))

    return Response(multimedia, status=200)

#PERMITE QUE TODA LA APP (clientes, trainer y pantalla de inicio sin sesión) LEA LOS FONDOS Y EL VIDEO EN USO
#Solo lee la colección "multimedia" de Sol. "nombre" es la clave del espacio (fondo_login, video_inicio, ...)
#y el registro más reciente de cada clave es el que está en uso. Devuelve solo los links, no los ids.
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def obtener_apariencia(request):

    db = get_db()
    coleccion = db["multimedia"]

    apariencia = {"video": None, "fondos": {}}

    # Por cada espacio (nombre) se usa el registro marcado como activo; si ninguno
    # lo está, el más reciente. Antes se ignoraba "activo", así que activar un
    # fondo desde el panel no cambiaba nada.
    elegidos = {}
    campos = {"nombre": 1, "url": 1, "tipo_multimedia": 1, "activo": 1}
    for elemento in coleccion.find({}, campos).sort("_id", 1):
        nombre = str(elemento.get("nombre") or "")
        if not elemento.get("url"):
            continue
        actual = elegidos.get(nombre)
        if actual is None or not actual.get("activo") or elemento.get("activo"):
            elegidos[nombre] = elemento

    for nombre, elemento in elegidos.items():
        if nombre == "video_inicio" and elemento.get("tipo_multimedia") == "video":
            apariencia["video"] = elemento["url"]
        elif nombre.startswith("fondo_") and elemento.get("tipo_multimedia") == "foto":
            apariencia["fondos"][nombre] = elemento["url"]

    return Response(apariencia, status=200)
