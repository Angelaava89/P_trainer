from django.db import models
from bson import ObjectId
from django.conf import settings

from django_mongodb_backend.models import EmbeddedModel

from django_mongodb_backend.fields import (
    EmbeddedModelField,
    EmbeddedModelArrayField,
    ArrayField
)

from django.core.validators import MaxValueValidator

from django.core.exceptions import FieldDoesNotExist
from django.core.exceptions import ValidationError

from django.utils import timezone

#LISTAS DE OPCIONES PARA COLECCIÓN USUARIO
OBJETIVOS = [
    ("Ganancia muscular", "Ganancia muscular"),
    ("Pérdida de grasa", "Pérdida de grasa"),
    ("Mantenimiento", "Mantenimiento"),
    ("Resistencia", "Resistencia")
]

EXPERIENCIA = [
    ("Principiante", "Principiante"),
    ("Intermedio", "Intermedio"),
    ("Avanzado", "Avanzado")
]

SEXO = [
    ("Hombre", "Hombre"),
    ("Mujer", "Mujer"),
    ("Otro", "Otro")
]

NIVEL = [
    ("Basico", "Basico"),
    ("Intermedio", "Intermedio"),
    ("Avanzado", "Avanzado")
]

VIGENCIA = [
    ("Activo", "Activo"),
    ("Vencido", "Vencido")
]

ENFOQUE_RUTINA = [
    ("Piernas", "Piernas"),
    ("Tren Superior", "Tren Superior"),
    ("Abdomen", "Abdomen"),
    ("Cardio", "Cardio")
]

ENFOQUE_RECETA = [
    ("Desayuno", "Desayuno"),
    ("Almuerzo", "Almuerzo"),
    ("Snack", "Snack"),
    ("Cena", "Cena")
]

DIA = [
    ("Entrenamiento", "Entrenamiento"),
    ("Descanso", "Descanso")
]

def generar_object_id():
    return str(ObjectId())

#MODELOS ANTIGUOS: ya no se usan, pero la migracion 0001_initial los nombra.
#Se dejan solo para que makemigrations/migrate puedan cargar esa migracion.
class AlimentoRecetaModel(EmbeddedModel):
    idAlimento = models.CharField(max_length=24)
    nombreAlimento = models.CharField(max_length=100)
    tipo = models.CharField(max_length=50)
    gramos = models.IntegerField()
    calorias = models.IntegerField()

class RecetaModel(EmbeddedModel):
    idReceta = models.CharField(
        max_length=24,
        default=generar_object_id,
        editable=False,
    )

    enfoqueReceta = models.CharField(
        max_length=50,
        choices=ENFOQUE_RECETA
    )

    alimentos = EmbeddedModelArrayField(
        AlimentoRecetaModel,
        blank=True,
        default=list
    )

#ESTRUCTURA LESION
class LesionModel(EmbeddedModel):
    fecha = models.DateField()
    areaCorporal = models.CharField(max_length=50)
    detalle = models.CharField(max_length=200, blank=True)  # opcional en la app
    reposo = models.CharField(max_length=20)

#ESTRUCTURA ALERGIA
class AlergiaModel(EmbeddedModel):
    tipo = models.CharField(max_length=100)

#DATOS (LESION + ALERGIA)
class DatosModel(EmbeddedModel):
    sexo = models.CharField(
        max_length=50,
        choices=SEXO
    )
    altura = models.FloatField()
    pesoActual = models.FloatField()
    # Opcional: en "Tus métricas" el % de grasa se puede dejar vacío.
    grasaCorporal = models.FloatField(null=True, blank=True)
    objetivo = models.CharField(
        max_length=30,
        choices=OBJETIVOS
    )
    experiencia = models.CharField(
        max_length=30,
        choices=EXPERIENCIA
    )
    splitActual = models.CharField(
        max_length=300 #se deja un campo grande de caracteres para que alumno describa split actual
    )

    lesion = EmbeddedModelArrayField(
        LesionModel,
        blank=True,
        default=list  # empieza como [] en vez de None
    )

    alergia = EmbeddedModelArrayField(
        AlergiaModel,
        blank=True,
        default=list  # empieza como [] en vez de None
    )

#PESOS
class PesosModel(EmbeddedModel):
    fecha = models.DateField(auto_now_add=True)
    peso = models.FloatField()

#MEDIDAS
class MedidasModel(EmbeddedModel):
    fecha = models.DateField(auto_now_add=True)
    pecho = models.FloatField()
    cintura = models.FloatField()
    brazo = models.FloatField()
    pierna = models.FloatField()
    # Opcionales: peso del día y % de grasa corporal que el alumno registra junto a sus medidas.
    peso = models.FloatField(null=True, blank=True)
    grasaCorporal = models.FloatField(null=True, blank=True)

#METRICAS
class MetricasModel(EmbeddedModel):
    pesos = EmbeddedModelArrayField(
        PesosModel,
        blank=True,
        default=list
    )
    medidas = EmbeddedModelArrayField(
        MedidasModel,
        blank=True,
        default=list
    )

#PLAN
class PlanModel(EmbeddedModel):
    idPlan = models.CharField(max_length=24)
    nombre = models.CharField(max_length=100)
    precio = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )
    detalle = models.CharField(max_length=200)
    fechaContratacion = models.DateField(auto_now_add=True)
    vigencia = models.CharField(
        max_length=20,
        choices=VIGENCIA)

#ESTRUCTURA EJERCICIOS DENTRO DE RUTINA
class EjercicioRutinaModel(EmbeddedModel):
    idEjercicio = models.CharField(max_length=24)
    nombreEjercicio = models.CharField(max_length=100)
    series = models.PositiveSmallIntegerField(default=1)
    repeticiones = models.PositiveSmallIntegerField(default=1)
    rer = models.PositiveSmallIntegerField()
    equipo = models.CharField(max_length=100)
    peso = models.FloatField()
    tiempo = models.CharField(max_length=30)
    video = models.CharField(max_length=255)#

#RUTINA
class RutinaModel(EmbeddedModel):
    idRutina = models.CharField(
        max_length=24,
        default=generar_object_id,
        editable=False,
    )

    intensidad = models.CharField(
            max_length=150, #varios caracteres para que describa la intensidad del dia de entrenamiento
            blank=True,
            default=""
        )

    # Texto libre: las rutinas de la biblioteca del coach usan títulos propios
    # ("Día 1 · Pecho y tríceps"), no solo las opciones de ENFOQUE_RUTINA.
    enfoqueRutina = models.CharField(max_length=50)

    ejercicios = EmbeddedModelArrayField(
        EjercicioRutinaModel,
        blank=True,
        default=list  # empieza como [] en vez de None
    )


#########################################################################################
### MODELOS RUTINAS PREDETERMINADAS (NO PREGUNTEN , SOLO DISFRUTEN) ###
class TecnicaSerie(models.TextChoices):
    DROP_SET = "drop_set", "Drop set"
    REST_PAUSE = "rest_pause", "Rest pause"
    NEGATIVOS = "negativos", "Negativos"


class TipoIntensidad(models.TextChoices):
    NINGUNA = "", "Sin especificar"
    A = "A", "Máxima intensidad"
    B = "B", "Media-alta (pump)"

# --- Nivel serie -------------------------------------------------------
class SerieEspecialModel(EmbeddedModel):
    serie = models.PositiveSmallIntegerField()  # número de serie que cambia
    tecnica = models.CharField(max_length=20, choices=TecnicaSerie.choices, blank=True, default="")
    al_fallo = models.BooleanField(default=False)
    rer = models.PositiveSmallIntegerField(
    null=True,
    blank=True,
    validators=[MaxValueValidator(5)])  # solo si difiere del ejercicio


# --- Nivel ejercicio (se reutiliza en días y en abdomen) ---------------
class EjercicioRutinaPredeterminadaModel(EmbeddedModel):
    idEjercicio = models.CharField(max_length=24, blank=True, default="")
    orden = models.PositiveSmallIntegerField()
    nombre_ejercicio = models.CharField(max_length=100)
    equipo = models.CharField(max_length=50, blank=True, default="")
    series = models.PositiveSmallIntegerField()
    reps_min = models.PositiveSmallIntegerField(null=True, blank=True)  # null si es "al fallo"
    reps_max = models.PositiveSmallIntegerField(null=True, blank=True)
    rer = models.PositiveSmallIntegerField(default=0)
    al_fallo = models.BooleanField(default=False)
    unilateral = models.BooleanField(default=False)
    tempo = models.CharField(max_length=10, blank=True, default="")          # ej. "1-2"
    superset_grupo = models.CharField(max_length=10, blank=True, default="")  # ej. "A"
    descanso_seg = models.PositiveSmallIntegerField(null=True, blank=True)
    detalle = models.CharField(max_length=250, blank=True, default="")
    series_especiales = EmbeddedModelArrayField(SerieEspecialModel, blank=True, default=list)

    def clean(self):
        if self.reps_min and self.reps_max and self.reps_min > self.reps_max:
            raise ValidationError("reps_min no puede ser mayor que reps_max.")


# --- Nivel día ---------------------------------------------------------
class DiasRutinasPredeterminadasModel(EmbeddedModel):
    id_dia = models.CharField(max_length=20)             # "dia1", "dia2"...
    orden = models.PositiveSmallIntegerField()           # antes: dia
    nombre = models.CharField(max_length=50)             # "Día 1 – Piernas"
    grupo_muscular = ArrayField(models.CharField(max_length=30), blank=True, default=list)
    tipo_intensidad = models.CharField(max_length=1, choices=TipoIntensidad.choices, blank=True, default="")
    intensidad = models.CharField(max_length=150, blank=True, default="")  # texto libre, como ahora
    incluye_abdomen = models.BooleanField(default=True)
    ejercicios = EmbeddedModelArrayField(EjercicioRutinaPredeterminadaModel, blank=True, default=list)


# --- Bloques a nivel rutina -------------------------------------------
class SplitModel(EmbeddedModel):
    dias_entrenamiento = models.PositiveSmallIntegerField()
    secuencia = ArrayField(models.CharField(max_length=20), blank=True, default=list)
    repetir = models.BooleanField(default=True)
    descripcion = models.CharField(max_length=250, blank=True, default="")  # comentario del profesor


class CardioModel(EmbeddedModel):
    sesiones_semana = models.PositiveSmallIntegerField(default=0)
    tipo = models.CharField(max_length=30, blank=True, default="")
    duracion_min = models.PositiveSmallIntegerField(null=True, blank=True)
    en_ayunas = models.BooleanField(default=False)
    indicaciones = models.CharField(max_length=250, blank=True, default="")


class AbdomenModel(EmbeddedModel):
    aplica_despues_de_dias = ArrayField(models.CharField(max_length=20), blank=True, default=list)
    excluye_dias = ArrayField(models.CharField(max_length=20), blank=True, default=list)
    ejercicios = EmbeddedModelArrayField(EjercicioRutinaPredeterminadaModel, blank=True, default=list)


# --- Documento raíz ----------------------------------------------------
class RutinasPredeterminadasModel(models.Model):
    nivel = models.CharField(max_length=30, choices=NIVEL)
    nombre = models.CharField(max_length=100, blank=True, default="")
    descripcion = models.CharField(max_length=250, blank=True, default="")
    split = EmbeddedModelField(SplitModel)
    cardio = EmbeddedModelField(CardioModel, null=True, blank=True)
    abdomen = EmbeddedModelField(AbdomenModel, null=True, blank=True)
    notas_generales = ArrayField(models.CharField(max_length=250), blank=True, default=list)
    dias = EmbeddedModelArrayField(DiasRutinasPredeterminadasModel, blank=True, default=list)
    activa = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rutinas_predeterminadas"
		

#MODELO RUTINA PREDETERMINADA PARA USUARIO
class RutinasPredeterminadasUsuarioModel(EmbeddedModel):
    idRutina = models.CharField(max_length=24)          # _id de la plantilla de origen
    nivel = models.CharField(max_length=30, choices=NIVEL)
    nombre = models.CharField(max_length=100, blank=True, default="")
    descripcion = models.CharField(max_length=250, blank=True, default="")
    split = EmbeddedModelField(SplitModel)
    cardio = EmbeddedModelField(CardioModel, null=True, blank=True)
    abdomen = EmbeddedModelField(AbdomenModel, null=True, blank=True)
    notas_generales = ArrayField(models.CharField(max_length=250), blank=True, default=list)
    dias = EmbeddedModelArrayField(DiasRutinasPredeterminadasModel, blank=True, default=list)
    activa = models.BooleanField(default=True)           # permite archivar sin borrar
    fechaAsignacion = models.DateTimeField(default=timezone.now)
#####################################################################################
### FIN SECCIÓN MODELOS RUTINAS PREDETERMINADAS ###

#ESTRUCTURA DE DIAS DENTRO DE DIETA
class DiaDietaModel(EmbeddedModel):
    idDia = models.CharField(
        max_length=24,
        default=generar_object_id,
        editable=False
    )
    tipo_dia = models.CharField(
        max_length=100,
        choices=DIA
    )
    comida1 = models.CharField(max_length=500)
    comida2 = models.CharField(max_length=500)
    comida3 = models.CharField(max_length=500)
    pre_entreno = models.CharField(max_length=500)
    intra_entreno = models.CharField(max_length=500)
    snack = models.CharField(max_length=500)
    agua = models.CharField(max_length=500)
    # Agregados para la app: comida de medianoche y suplementos de cada tipo de día (opcionales).
    medianoche = models.CharField(max_length=500, blank=True, default="")
    suplementos = models.CharField(max_length=500, blank=True, default="")

#DIETA
class DietaModel(EmbeddedModel):
    idDieta = models.CharField(
        max_length=24,
        default=generar_object_id,
        editable=False
    )
    tmb = models.CharField(max_length=150)
    macros = models.CharField(max_length=250)
    notas = models.CharField(max_length=350)
    suplementos = models.CharField(max_length=350)
    dias = EmbeddedModelArrayField(
        DiaDietaModel,
        blank=True,
        default=list
    )

#ESTRUCTURA DE EJERCICIOS DENTRO DE SESION 
class EjercicioSesionModel(EmbeddedModel):
    idEjercicio = models.CharField(max_length=24)
    nombreEjercicio = models.CharField(max_length=100)
    series = models.PositiveSmallIntegerField(default=1)
    repeticiones = models.CharField(max_length=10)
    rer = models.PositiveSmallIntegerField()
    equipo = models.CharField(max_length=100)
    peso = models.FloatField()
    tiempo = models.CharField(max_length=30)
    detalles = models.CharField(max_length=200)
    calificacion = models.SmallIntegerField(default=1)

#SESION
class SesionModel(EmbeddedModel):
    idSesion = models.CharField(
        max_length=24,
        default=generar_object_id,
        editable=False,
    )

    idRutina = models.CharField(max_length=24)
    fecha = models.DateField()

    ejercicios = EmbeddedModelArrayField(
        EjercicioSesionModel,
        blank=True,
        default=list  # empieza como [] en vez de None
    )

#COLECCIÓN USUARIO (CON MODELOS ANTERIORES)
class UsuarioModel(models.Model):
    nombre = models.CharField(max_length=100)
    rut = models.CharField(
        max_length=12,
        unique=True
    )
    correo = models.EmailField(
        unique=True
    )
    password = models.CharField(
                max_length=128)
    edad = models.PositiveSmallIntegerField(default=1)
    tipo_usuario = models.CharField(max_length=20)
    # Opcional al registrarse: se completa después en la pantalla "Tus métricas"
    datos = EmbeddedModelField(DatosModel, null=True, blank=True)
    metricas = EmbeddedModelArrayField(
        MetricasModel,
        blank=True,
        default=list  # empieza como [] en vez de None
    )
    plan = EmbeddedModelArrayField(
        PlanModel,
        blank=True,
        default=list  # empieza como [] en vez de None
    )
    rutina = EmbeddedModelArrayField(
        RutinaModel,
        blank=True,
        default=list  # empieza como [] en vez de None
    )
    rutina_predeterminada = EmbeddedModelArrayField(
        RutinasPredeterminadasUsuarioModel,
        blank=True,
        default=list
    )
    dietas = EmbeddedModelArrayField(
        DietaModel,
        blank=True,
        default=list  # empieza como [] en vez de None
    )
    sesion = EmbeddedModelArrayField(
        SesionModel,
        blank=True,
        default=list  # empieza como [] en vez de None
    )
    class Meta:
        db_table = "usuarios"

    def __str__(self):
        return self.nombre

#COLECCIÓN ASESORÍAS (agenda compartida entre alumnos y profesional)
class AsesoriaModel(models.Model):
    alumno_id = models.CharField(max_length=24)
    alumno_nombre = models.CharField(max_length=100)
    fecha = models.CharField(max_length=10)   # AAAA-MM-DD
    hora = models.CharField(max_length=5)     # HH:MM
    estado = models.CharField(max_length=30, default='pendiente')
    creada = models.DateTimeField(auto_now_add=True)
    # "AAAA-MM-DD HH:MM" mientras la clase no esté cancelada; None si está cancelada.
    # Tiene un índice único en Mongo (migración 0008): la base de datos rechaza una
    # segunda reserva activa en el mismo horario aunque lleguen dos al mismo tiempo.
    bloqueo = models.CharField(max_length=16, null=True, blank=True, default=None)

    class Meta:
        db_table = "asesorias"

#COLECCIÓN NOTIFICACIONES
class NotificacionModel(models.Model):
    para = models.CharField(max_length=24)  # id del alumno, o "profesores"
    categoria = models.CharField(max_length=30)
    tipo = models.CharField(max_length=40)
    titulo = models.CharField(max_length=120)
    mensaje = models.CharField(max_length=400)
    asesoria_id = models.CharField(max_length=24, blank=True, default='')
    alumno_id = models.CharField(max_length=24, blank=True, default='')
    leida = models.BooleanField(default=False)
    resuelta = models.BooleanField(default=False)
    respuesta = models.CharField(max_length=30, blank=True, default='')
    creada = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notificaciones"

#COLECCIÓN EJERCICIOS
# Mismos nombres de campo que ya tiene la colección "ejercicios" en Atlas
# (las vistas la leen con pymongo: idEjercicio, nombre, equipo, videoTutorial).
class EjerciciosModel(models.Model):
    idEjercicio = models.CharField(max_length=24, blank=True, default="")
    nombre = models.CharField(max_length=100)
    equipo = models.CharField(max_length=100)
    videoTutorial = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        db_table = "ejercicios"

#COLECCIÓN PLANES
class PlanesModel(models.Model):
    nombre = models.CharField(max_length=100)
    precio = models.DecimalField(
        max_digits=10,
        decimal_places=2
        )
    detalle = models.CharField(max_length=200)

    class Meta:
        db_table = "planes"

#COLECCIÓN MULTIMEDIA -- se guardan las fotos y videos que podra agregar o modificar el administrador para la aplicación
class MultimediaModel(models.Model):
    nombre = models.CharField(max_length=150)
    tipo_multimedia = models.CharField(max_length=100) #foto o video
    url = models.CharField(max_length=255)
    activo = models.BooleanField(default=False) #para indicar si ya esta en uso la foto/video o no

    class Meta:
        # Las vistas (admin_panel.py y views.py) leen y escriben la colección "multimedia".
        db_table = "multimedia"
