
from datetime import datetime, timedelta, timezone
import logging
import unicodedata

from bson import ObjectId
from bson.errors import InvalidId
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes
)
from rest_framework.response import Response
from rest_framework import status

from .catalogo_rutinas import ejercicio_a_api, rutina_a_api, rutina_desde_api
from .serializers import AdminUsuarioSerializer, PlanesSerializer, MultimediaSerializer

from database import get_db

from .auth import TokenAuthentication
from .permissions import SoloAdmin

from django.utils import timezone as dj_timezone

import re
from bson import Decimal128

logger = logging.getLogger(__name__)

# --------------------------------------------------
# FUNCIONES AUXILIARES
# --------------------------------------------------

def normalizar_texto(valor):
    """Uniforma mayúsculas y tildes para comparar datos guardados con etiquetas visibles."""

    texto = unicodedata.normalize("NFD", str(valor or "").casefold())
    return "".join(caracter for caracter in texto if unicodedata.category(caracter) != "Mn").strip()


def obtener_tipo_usuario(usuario):
    """Lee el rol aunque el documento use el nombre camelCase o snake_case."""

    return usuario.get("tipo_usuario") or usuario.get("tipoUsuario") or ""


def obtener_plan_actual(planes):
    """Devuelve básico o avanzado únicamente cuando el contrato está vigente."""

    if not isinstance(planes, list):
        return None

    for plan in reversed(planes):
        if not isinstance(plan, dict) or normalizar_texto(plan.get("vigencia")) != "activo":
            continue

        descripcion = normalizar_texto(
            f"{plan.get('idPlan') or plan.get('id_plan') or ''} {plan.get('nombre') or ''}"
        )
        if "avanz" in descripcion:
            return "avanzado"
        if any(palabra in descripcion for palabra in ("basico", "principiante", "inicial")):
            return "basico"

    return None


def tiene_plan_contratado(planes):
    """
    Comprueba si el usuario tiene un plan contratado.
    Ignora los objetos vacíos utilizados como estructura inicial.
    """

    if not isinstance(planes, list):
        return False

    for plan in planes:
        if not isinstance(plan, dict):
            continue

        if plan.get("idPlan") or plan.get("nombre"):
            return True

    return False


def obtener_rol(tipo_usuario):
    """
    Convierte los roles almacenados en Atlas
    a los nombres que utiliza el frontend.
    """

    roles = {
        "Admin": "admin",
        "Administrador": "admin",
        "Profesor": "profesional",
        "Alumno": "cliente"
    }

    clave = normalizar_texto(tipo_usuario)
    if clave in {"admin", "administrador"}:
        return "admin"
    if clave in {"profesor", "profesional"}:
        return "profesional"
    if clave in {"alumno", "cliente"}:
        return "cliente"
    return roles.get(tipo_usuario, "desconocido")


def obtener_fecha_creacion(usuario):
    """
    Obtiene la fecha aproximada de creación desde
    el ObjectId de MongoDB.
    """

    identificador = usuario.get("_id")

    if isinstance(identificador, ObjectId):
        return identificador.generation_time.isoformat()

    return None


def nombre_plan_activo(planes):
    """Nombre del contrato con vigencia Activo más reciente (o None)."""
    if not isinstance(planes, list):
        return None
    for plan in reversed(planes):
        if isinstance(plan, dict) and normalizar_texto(plan.get("vigencia")) == "activo":
            return plan.get("nombre") or plan.get("idPlan")
    return None


def preparar_usuario(usuario):
    """
    Prepara los datos públicos de un usuario.
    Nunca incluye la contraseña.
    """

    return {
        "id": str(usuario.get("_id")),
        "nombre": usuario.get("nombre"),
        "rut": usuario.get("rut"),
        "edad": usuario.get("edad"),
        "correo": usuario.get("correo"),
        "creado": obtener_fecha_creacion(usuario),
        "rol": obtener_rol(obtener_tipo_usuario(usuario)),
        # Antes se tomaba el primer plan del historial aunque estuviera vencido.
        "plan": nombre_plan_activo(usuario.get("plan", []))
    }

def buscar_por_id(modelo, identificador):

    try:
        object_id = ObjectId(identificador)

        return modelo.objects.get(pk=object_id)

    except (InvalidId, modelo.DoesNotExist, TypeError):
        return None

# --------------------------------------------------
# VISTA 1: RESUMEN DEL PANEL ADMINISTRADOR
# GET /api/admin/resumen/
# --------------------------------------------------

@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAdmin])
def resumen_admin(request):

    db = get_db()

    usuarios = list(
        db.usuarios.find(
            {},
            {
                "tipoUsuario": 1,
                "tipo_usuario": 1,
                "plan": 1,
                "rutina_predeterminada": 1,
            }
        )
    )

    fecha_limite = datetime.now(timezone.utc) - timedelta(days=30)

    # Contadores por tipo de usuario
    usuarios_total = len(usuarios)

    clientes = sum(1 for u in usuarios if obtener_rol(obtener_tipo_usuario(u)) == "cliente")

    profesionales = sum(1 for u in usuarios if obtener_rol(obtener_tipo_usuario(u)) == "profesional")

    administradores = sum(1 for u in usuarios if obtener_rol(obtener_tipo_usuario(u)) == "admin")

    # Clientes que tienen un plan contratado
    clientes_con_plan = sum(
        1 for u in usuarios
        if (
            u.get("tipo_usuario") == "Alumno"
            and tiene_plan_contratado(u.get("plan", []))
        )
    )

    # Los planes se cuentan por su contrato activo guardado en el arreglo plan del alumno.
    planes_basicos = sum(
        1 for u in usuarios
        if obtener_rol(obtener_tipo_usuario(u)) == "cliente"
        and obtener_plan_actual(u.get("plan", [])) == "basico"
    )
    planes_avanzados = sum(
        1 for u in usuarios
        if obtener_rol(obtener_tipo_usuario(u)) == "cliente"
        and obtener_plan_actual(u.get("plan", [])) == "avanzado"
    )

    # Usuarios registrados durante los últimos 30 días.
    # Se utiliza la fecha incorporada en el ObjectId.
    usuarios_nuevos = []

    for usuario in usuarios:
        identificador = usuario.get("_id")

        if isinstance(identificador, ObjectId):
            if identificador.generation_time >= fecha_limite:
                usuarios_nuevos.append(usuario)

    nuevos_30_dias = len(usuarios_nuevos)

    # Usuarios recientes: los últimos 5 registrados.
    usuarios_recientes_docs = list(
        db.usuarios.find(
            {},
            {
                "nombre": 1,
                "rut": 1,
                "edad": 1,
                "correo": 1,
                "tipoUsuario": 1,
                "tipo_usuario": 1,
                "plan": 1
            }
        ).sort("_id", -1).limit(5)
    )

    usuarios_recientes = [
        preparar_usuario(u)
        for u in usuarios_recientes_docs
    ]

    # Las compras de rutinas predeterminadas se guardan en el arreglo existente del usuario.
    rutinas_vendidas = sum(
        len({str(item.get("idRutina", "")).strip() for item in (u.get("rutina_predeterminada") or []) if isinstance(item, dict) and item.get("idRutina")})
        for u in usuarios
        if isinstance(u.get("rutina_predeterminada") or [], list)
    )

    return Response(
        {
            "usuarios_total": usuarios_total,
            "clientes": clientes,
            "profesionales": profesionales,
            "administradores": administradores,
            "clientes_con_plan": clientes_con_plan,
            "rutinas_vendidas": rutinas_vendidas,
            "rutinas_vendidas_disponible": True,
            "planes_basicos": planes_basicos,
            "planes_avanzados": planes_avanzados,
            "nuevos_30_dias": nuevos_30_dias,
            "pagos_integrados": None,
            "usuarios_recientes": usuarios_recientes
        },
        status=status.HTTP_200_OK
    )


# --------------------------------------------------
# VISTA 2: LISTADO DE USUARIOS
# GET /api/admin/usuarios/
# --------------------------------------------------

@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAdmin])
def listar_usuarios_admin(request):

    db = get_db()

    # Parámetros de paginación
    try:
        limite = int(request.query_params.get("limite", 100))
        pagina = int(request.query_params.get("pagina", 1))

        if limite < 1 or pagina < 1:
            raise ValueError

    except (ValueError, TypeError):
        return Response(
            {"error": "Los parámetros de paginación deben ser positivos."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Evitar solicitudes excesivamente grandes
    limite = min(limite, 100)

    salto = (pagina - 1) * limite

    # Consultar el total de usuarios
    total = db.usuarios.count_documents({})

    # Obtener usuarios sin traer la contraseña
    documentos = list(
        db.usuarios.find(
            {},
            {
                "password": 0
            }
        )
        .sort("_id", -1)
        .skip(salto)
        .limit(limite)
    )

    usuarios = [
        preparar_usuario(usuario)
        for usuario in documentos
    ]

    return Response(
        {
            "total": total,
            "limite": limite,
            "pagina": pagina,
            "usuarios": usuarios
        },
        status=status.HTTP_200_OK
    )


def _plan_a_documento(datos):
    doc = dict(datos)
    if "precio" in doc:
        doc["precio"] = Decimal128(str(doc["precio"]))
    return doc

@api_view(['GET', 'POST']) #LISTADO Y CREACIÓN DE PLANES
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAdmin])
def listar_planes_admin(request):

    db = get_db()

    if request.method == 'GET':
        try:
            # Obtener todos los planes de MongoDB
            planes = list(db["planes"].find())

            # Convertir ObjectId a string
            for plan in planes:
                plan['id'] = str(plan.pop('_id'))

            serializer = PlanesSerializer(planes, many=True)

            return Response({
                "total": len(planes),
                "planes": serializer.data
            }, status=status.HTTP_200_OK)

        except Exception:
            logger.exception("No se pudieron obtener los planes")
            return Response({
                "error": "Error al obtener los planes"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # POST: crear un plan
    serializer = PlanesSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    datos = serializer.validated_data

    if db["planes"].find_one({"nombre": {"$regex": f"^{re.escape(datos['nombre'])}$", "$options": "i"}}):
        return Response({"nombre": ["Ya existe un plan con ese nombre."]}, status=status.HTTP_409_CONFLICT)

    nuevo = db["planes"].insert_one(_plan_a_documento(datos))

    return Response({
        "id": str(nuevo.inserted_id),
        "nombre": datos["nombre"],
        "precio": float(datos["precio"]),
        "detalle": datos["detalle"]
    }, status=status.HTTP_201_CREATED)

def _es_plan_base(nombre):
    # La app decide beneficios (por ejemplo los videos) por el texto del nombre,
    # así que los planes base no se renombran ni se borran.
    n = nombre.lower()
    return "básico" in n or "basico" in n or "avanzado" in n

@api_view(['PATCH', 'DELETE']) #ACTUALIZACIÓN Y ELIMINACIÓN DE PLANES
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAdmin])
def plan_admin_detalle(request, plan_id):

    db = get_db()

    try:
        object_id = ObjectId(plan_id)
    except InvalidId:
        return Response({"error": "ID de plan inválido"}, status=status.HTTP_400_BAD_REQUEST)

    plan = db["planes"].find_one({"_id": object_id})
    if not plan:
        return Response({"error": "Plan no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    es_base = _es_plan_base(plan["nombre"])

    # ---------- DELETE ----------
    if request.method == 'DELETE':
        if es_base:
            return Response({"error": "Los planes base no se pueden eliminar."},
                            status=status.HTTP_409_CONFLICT)

        en_uso = db["usuarios"].count_documents({
            "plan": {"$elemMatch": {
                "vigencia": "Activo",
                "$or": [{"idPlan": plan_id}, {"nombre": plan["nombre"]}],
            }}
        })
        if en_uso:
            return Response({"error": f"No se puede eliminar: {en_uso} alumno(s) tienen este plan activo."},
                            status=status.HTTP_409_CONFLICT)

        db["planes"].delete_one({"_id": object_id})
        return Response({"mensaje": "Plan eliminado correctamente"}, status=status.HTTP_200_OK)

    # ---------- PATCH ----------
    serializer = PlanesSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    datos = serializer.validated_data

    if not datos:
        return Response({"error": "Debe enviar al menos un campo para actualizar"},
                        status=status.HTTP_400_BAD_REQUEST)

    # Solo se valida el nombre si realmente cambió (el frontend lo envía siempre).
    if "nombre" in datos and datos["nombre"].lower() != plan["nombre"].lower():
        if es_base:
            return Response({"error": "Los planes base no se pueden renombrar."},
                            status=status.HTTP_409_CONFLICT)
        repetido = db["planes"].find_one({
            "_id": {"$ne": object_id},
            "nombre": {"$regex": f"^{re.escape(datos['nombre'])}$", "$options": "i"},
        })
        if repetido:
            return Response({"nombre": ["Ya existe un plan con ese nombre."]},
                            status=status.HTTP_409_CONFLICT)

    db["planes"].update_one({"_id": object_id}, {"$set": _plan_a_documento(datos)})

    actualizado = db["planes"].find_one({"_id": object_id})
    actualizado["id"] = str(actualizado.pop("_id"))

    return Response({
        "mensaje": "Plan actualizado correctamente",
        "plan": PlanesSerializer(actualizado).data
    }, status=status.HTTP_200_OK)

@api_view(['PATCH', 'DELETE']) #ACTUALIZAR O ELIMINAR USUARIO
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAdmin])
def actualizar_usuario_admin(request, usuario_id):

    db = get_db()

    try:
        object_id = ObjectId(usuario_id)
    except (InvalidId, TypeError):
        return Response({"error": "ID de usuario inválido"}, status=status.HTTP_400_BAD_REQUEST)

    usuario = db["usuarios"].find_one({"_id": object_id}, {"password": 0})
    if not usuario:
        return Response({"error": "Usuario no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    es_mismo_admin = object_id == request.user.pk

    # ---------- DELETE ----------
    if request.method == "DELETE":
        if es_mismo_admin:
            return Response({"error": "No puedes eliminar tu propia cuenta de administrador."},
                            status=status.HTTP_409_CONFLICT)
        id_texto = str(object_id)
        db["usuarios"].delete_one({"_id": object_id})
        # Se limpian los registros que solo tienen sentido con la cuenta.
        db["notificaciones"].delete_many({"para": id_texto})
        db["asesorias"].update_many(
            {"alumno_id": id_texto, "estado": {"$ne": "cancelada"}},
            {"$set": {"estado": "cancelada", "bloqueo": None}},
        )
        return Response({"mensaje": "Usuario eliminado correctamente"}, status=status.HTTP_200_OK)

    # ---------- PATCH ----------
    serializer = AdminUsuarioSerializer(data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    datos = dict(serializer.validated_data)
    if not datos:
        return Response({"error": "Debe enviar al menos un campo para actualizar"},
                        status=status.HTTP_400_BAD_REQUEST)

    if es_mismo_admin and datos.get("tipo_usuario", "Admin") != "Admin":
        return Response({"error": "No puedes quitarte el rol de administrador a ti mismo."},
                        status=status.HTTP_409_CONFLICT)

    # Correo y RUT únicos, sin contar al propio usuario.
    for campo, etiqueta in (("correo", "correo"), ("rut", "RUT")):
        if campo in datos and db["usuarios"].find_one({campo: datos[campo], "_id": {"$ne": object_id}}, {"_id": 1}):
            return Response({campo: [f"Ya existe otra cuenta con ese {etiqueta}."]},
                            status=status.HTTP_409_CONFLICT)

    db["usuarios"].update_one({"_id": object_id}, {"$set": datos})
    actualizado = db["usuarios"].find_one({"_id": object_id}, {"password": 0})

    return Response({
        "mensaje": "Usuario actualizado correctamente",
        "usuario": preparar_usuario(actualizado)
    }, status=status.HTTP_200_OK)


#LISTAR Y CREAR RUTINAS PREDETERMINADAS
@api_view(["GET", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAdmin])
def rutinas_predeterminadas_admin(request):
    """Administra las rutinas predeterminadas."""
    db = get_db()
    coleccion = db.rutinas_predeterminadas

    if request.method == "GET":
        rutinas = [
            rutina_a_api(doc, db)
            for doc in coleccion.find({}).sort("_id", 1)
        ]
        return Response(
            {"total": len(rutinas), "rutinas": rutinas},
            status=status.HTTP_200_OK
        )

    try:
        documento = rutina_desde_api(request.data, db)
    except ValueError as error:
        return Response(
            {"error": str(error)},
            status=status.HTTP_400_BAD_REQUEST
        )

    # AGREGAR AQUÍ LAS FECHAS
    ahora = dj_timezone.now()
    documento["created_at"] = ahora
    documento["updated_at"] = ahora

    # Guardar en MongoDB
    resultado = coleccion.insert_one(documento)

    guardada = coleccion.find_one({"_id": resultado.inserted_id})

    return Response(
        {
            "mensaje": "Rutina predeterminada creada correctamente.",
            "rutina": rutina_a_api(guardada, db)
        },
        status=status.HTTP_201_CREATED
    )


#VISUALIZA, ACTUALIZA Y ELIMINA RUTINAS PREDETERMINADAS
@api_view(["GET", "PATCH", "DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAdmin])
def detalle_rutina_predeterminada_admin(request, rutina_id):
    """Lee, edita o elimina una rutina por su _id."""

    try:
        identificador = ObjectId(rutina_id)
    except (InvalidId, TypeError):
        return Response(
            {"error": "El identificador de rutina no es válido."},
            status=status.HTTP_400_BAD_REQUEST
        )

    db = get_db()
    coleccion = db.rutinas_predeterminadas

    actual = coleccion.find_one({"_id": identificador})

    if not actual:
        return Response(
            {"error": "No se encontró la rutina predeterminada."},
            status=status.HTTP_404_NOT_FOUND
        )

    # GET: visualizar rutina
    if request.method == "GET":
        return Response(
            rutina_a_api(actual, db),
            status=status.HTTP_200_OK
        )

    # DELETE: eliminar rutina
    if request.method == "DELETE":
        coleccion.delete_one({"_id": identificador})

        return Response(
            {"mensaje": "Rutina predeterminada eliminada correctamente."},
            status=status.HTTP_200_OK
        )

    # PATCH: actualizar rutina
    datos_actuales = rutina_a_api(actual, db)
    datos_actuales.update(dict(request.data))

    try:
        documento = rutina_desde_api(datos_actuales, db)
    except ValueError as error:
        return Response(
            {"error": str(error)},
            status=status.HTTP_400_BAD_REQUEST
        )

    # AGREGAR AQUÍ LA ACTUALIZACIÓN DE FECHA
    documento["updated_at"] = dj_timezone.now()

    # Actualizar en MongoDB
    coleccion.update_one(
        {"_id": identificador},
        {
            "$set": documento,
            "$unset": {"detalles": ""}
        }
    )

    actualizada = coleccion.find_one({"_id": identificador})

    return Response(
        {
            "mensaje": "Rutina predeterminada actualizada correctamente.",
            "rutina": rutina_a_api(actualizada, db)
        },
        status=status.HTTP_200_OK
    )

@api_view(["GET", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAdmin])
def ejercicios_admin(request):
    """Administra ejercicios en la colección global y reutiliza sus nombres actuales."""
    db = get_db()
    coleccion = db.ejercicios

    if request.method == "GET":
        ejercicios = [ejercicio_a_api(doc) for doc in coleccion.find({}).sort("nombre", 1)]
        return Response({"ejercicios": ejercicios}, status=status.HTTP_200_OK)

    nombre = str(request.data.get("nombreEjercicio") or request.data.get("nombre") or "").strip()
    equipo = str(request.data.get("equipo") or "").strip()
    video = str(request.data.get("video") or request.data.get("videoTutorial") or "").strip()
    if not nombre or not equipo:
        return Response({"error": "Completa el nombre y el equipo del ejercicio."}, status=status.HTTP_400_BAD_REQUEST)

    # La colección existente identifica ejercicios con idEjercicio; se crea esa clave junto con sus campos actuales.
    documento = {
        "idEjercicio": str(ObjectId()),
        "nombre": nombre,
        "equipo": equipo,
        "videoTutorial": video,
    }
    resultado = coleccion.insert_one(documento)
    guardado = coleccion.find_one({"_id": resultado.inserted_id})
    return Response(
        {"mensaje": "Ejercicio global creado correctamente.", "ejercicio": ejercicio_a_api(guardado)},
        status=status.HTTP_201_CREATED,
    )

#CONSULTA Y REGISTRO DE MULTIMEDIA -- puede ver las fotos/videos y guardar nuevos
@api_view(["GET", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAdmin])
def gestionar_multimedia(request):

    db = get_db()
    coleccion = db["multimedia"]

    if request.method == "GET":

        multimedia = list(coleccion.find())

        for elemento in multimedia:
            elemento["id"] = str(elemento.pop("_id"))

        return Response({
            "total": len(multimedia),
            "multimedia": multimedia
        }, status=200)

    serializer = MultimediaSerializer(data=request.data)

    if serializer.is_valid():

        datos = serializer.validated_data

        documento = {
            "nombre": datos["nombre"],
            "tipo_multimedia": datos["tipo_multimedia"],
            "url": datos["url"],
            "activo": False
        }

        resultado = coleccion.insert_one(documento)

        documento.pop("_id", None)  # insert_one agrega el ObjectId, que no se puede enviar como JSON
        documento["id"] = str(resultado.inserted_id)

        return Response({
            "mensaje": "Multimedia guardado correctamente.",
            "multimedia": documento
        }, status=201)

    return Response(serializer.errors, status=400)

#ACTUALIZA Y ACTIVA LA FOTO O VIDEO QUE SE QUIERA UTILIZAR PARA EL FONDO (deja inactiva la que se utilizaba anteriormente, pero no la elimina)
@api_view(["PATCH"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAdmin])
def actualizar_multimedia(request, multimedia_id):

    db = get_db()
    coleccion = db["multimedia"]

    try:
        object_id = ObjectId(multimedia_id)
    except InvalidId:
        return Response(
            {"error": "ID inválido."},
            status=400
        )

    multimedia = coleccion.find_one({"_id": object_id})

    if not multimedia:
        return Response(
            {"error": "Multimedia no encontrado."},
            status=404
        )

    serializer = MultimediaSerializer(
        data=request.data,
        partial=True
    )

    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    datos = serializer.validated_data

    # Activar el multimedia seleccionado
    # Al activar uno se desactivan solo los del mismo espacio (mismo "nombre":
    # fondo_login, video_inicio, ...). Antes se apagaba todo, incluido el video
    # al activar un fondo.
    if datos.get("activo") is True:

        coleccion.update_many(
            {"_id": {"$ne": object_id}, "nombre": datos.get("nombre", multimedia.get("nombre"))},
            {"$set": {"activo": False}}
        )

    coleccion.update_one(
        {"_id": object_id},
        {"$set": datos}
    )

    actualizado = coleccion.find_one({"_id": object_id})
    actualizado["id"] = str(actualizado.pop("_id"))

    return Response({
        "mensaje": "Multimedia actualizado correctamente.",
        "multimedia": actualizado
    }, status=200)

#ELIMINAR FOTO O VIDEO QUE YA NO QUIERA -- no permite eliminar el fondo activo actualmente
@api_view(["DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([SoloAdmin])
def eliminar_multimedia(request, multimedia_id):

    db = get_db()
    coleccion = db["multimedia"]

    try:
        object_id = ObjectId(multimedia_id)
    except InvalidId:
        return Response(
            {"error": "ID inválido."},
            status=400
        )

    multimedia = coleccion.find_one({"_id": object_id})

    if not multimedia:
        return Response(
            {"error": "Multimedia no encontrado."},
            status=404
        )

    if multimedia.get("activo", False):
        return Response(
            {"error": "No puedes eliminar el fondo actualmente utilizado."},
            status=400
        )

    coleccion.delete_one({"_id": object_id})

    return Response({
        "mensaje": "Multimedia eliminado correctamente."
    }, status=200)
