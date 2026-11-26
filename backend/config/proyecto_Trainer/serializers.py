from rest_framework import serializers
from django.contrib.auth.hashers import make_password, check_password

from django.core.exceptions import FieldDoesNotExist

from django_mongodb_backend.fields import (
    EmbeddedModelField,
    EmbeddedModelArrayField,
    ArrayField
)

from decimal import Decimal

from .models import (
    UsuarioModel,
    DatosModel,
    LesionModel,
    AlergiaModel,
    PesosModel,
    MedidasModel,
    MetricasModel,
    PlanModel,
    EjercicioRutinaModel,
    RutinaModel,
    DiaDietaModel,
    DietaModel,
    EjercicioSesionModel,
    SesionModel,
    EjerciciosModel,
    PlanesModel,
    DiasRutinasPredeterminadasModel,
    RutinasPredeterminadasModel,
    MultimediaModel,
    RutinasPredeterminadasUsuarioModel,
    AbdomenModel,
    SerieEspecialModel,
    SplitModel,
    CardioModel,
    EjercicioRutinaPredeterminadaModel
)

def preparar_datos(serializer, datos):
    datos = dict(datos)

    for nombre, campo in serializer.fields.items():

        if nombre not in datos:
            continue

        if isinstance(campo, serializers.ListSerializer):
            datos[nombre] = [
                construir_instancia(campo.child, item)
                for item in datos[nombre]
            ]

        elif isinstance(campo, serializers.BaseSerializer):
            datos[nombre] = construir_instancia(
                campo,
                datos[nombre]
            )

    return datos


def construir_instancia(serializer, datos):
    datos = preparar_datos(serializer, datos)
    return serializer.Meta.model(**datos)

# ==========================================
# ESTRUCTURAS EMBEBIDAS: LESIONES Y ALERGIAS
# ==========================================

class LesionSerializer(serializers.ModelSerializer):

    class Meta:
        model = LesionModel
        fields = [
            'fecha',
            'areaCorporal',
            'detalle',
            'reposo'
        ]


class AlergiaSerializer(serializers.ModelSerializer):

    class Meta:
        model = AlergiaModel
        fields = ['tipo']


# ==========================================
# DATOS DEL USUARIO
# ==========================================

class DatosSerializer(serializers.ModelSerializer):

    lesion = LesionSerializer(many=True, required=False)
    alergia = AlergiaSerializer(many=True, required=False)

    class Meta:
        model = DatosModel
        fields = [
            'sexo',
            'altura',
            'pesoActual',
            'grasaCorporal',
            'objetivo',
            'experiencia',
            'splitActual',
            'lesion',
            'alergia'
        ]


# ==========================================
# PESOS
# ==========================================

class PesosSerializer(serializers.ModelSerializer):

    class Meta:
        model = PesosModel
        fields = [
            'fecha',
            'peso'
        ]
        read_only_fields = ['fecha']

# ==========================================
# MEDIDAS
# ==========================================

class MedidasSerializer(serializers.ModelSerializer):

    class Meta:
        model = MedidasModel
        fields = [
            'fecha',
            'pecho',
            'cintura',
            'brazo',
            'pierna',
            'peso',
            'grasaCorporal'
        ]
        read_only_fields = ['fecha']

# ==========================================
# METRICAS
# ==========================================

class MetricasSerializer(serializers.ModelSerializer):

    pesos = PesosSerializer(many=True, required=False)
    medidas = MedidasSerializer(many=True, required=False)

    class Meta:
        model = MetricasModel
        fields = [
            'pesos',
            'medidas'
        ]


# ==========================================
# PLAN CONTRATADO POR EL USUARIO
# ==========================================

class PlanSerializer(serializers.ModelSerializer):

    class Meta:
        model = PlanModel
        fields = [
            'idPlan',
            'nombre',
            'precio',
            'detalle',
            'fechaContratacion',
            'vigencia'
        ]
        read_only_fields = ['fechaContratacion']


# ==========================================
# EJERCICIOS DENTRO DE UNA RUTINA ASIGNADAS POR CONTRATACIÓN DE PLAN
# ==========================================

class EjercicioRutinaSerializer(serializers.ModelSerializer):

    class Meta:
        model = EjercicioRutinaModel
        fields = [
            'idEjercicio',
            'nombreEjercicio',
            'series',
            'repeticiones',
            'rer',
            'equipo',
            'peso',
            'tiempo',
            'video'
        ]


# ==========================================
# RUTINAS ASIGNADAS POR CONTRATACIÓN DE PLAN
# ==========================================

class RutinaSerializer(serializers.ModelSerializer):

    ejercicios = EjercicioRutinaSerializer(
        many=True,
        required=False
    )

    idRutina = serializers.CharField(read_only=True)

    class Meta:
        model = RutinaModel
        fields = [
            'idRutina',
            'intensidad',
            'enfoqueRutina',
            'ejercicios'
        ]


##################################################################################
### SERIALIZERS RELACIONADOS CON LAS RUTINAS PREDETERMINADAS ###
# --- Helper: convierte dicts validados en instancias de modelos embebidos
def convertir(modelo, datos):
    resultado = {}
    for nombre, valor in datos.items():
        try:
            campo = modelo._meta.get_field(nombre)
        except FieldDoesNotExist:
            # Claves que el modelo no tiene (por ejemplo, agregadas a mano en Atlas) se
            # ignoran: pasarlas al constructor del modelo lanzaba TypeError.
            continue

        if isinstance(campo, EmbeddedModelField) and valor is not None:
            emb = campo.embedded_model
            valor = emb(**convertir(emb, valor))
        elif isinstance(campo, EmbeddedModelArrayField) and valor is not None:
            emb = campo.embedded_model
            valor = [emb(**convertir(emb, v)) for v in valor]
        resultado[nombre] = valor
    return resultado


# --- Nivel serie / ejercicio ------------------------------------------
class SerieEspecialSerializer(serializers.ModelSerializer):
    class Meta:
        model = SerieEspecialModel
        fields = ['serie', 'tecnica', 'al_fallo', 'rer']


class EjercicioRutinaPredeterminadaSerializer(serializers.ModelSerializer):
    series_especiales = SerieEspecialSerializer(many=True, required=False)

    class Meta:
        model = EjercicioRutinaPredeterminadaModel
        fields = [
            'idEjercicio', 'orden', 'nombre_ejercicio', 'equipo', 'series',
            'reps_min', 'reps_max', 'rer', 'al_fallo', 'unilateral', 'tempo',
            'superset_grupo', 'descanso_seg', 'detalle', 'series_especiales',
        ]

    def validate(self, data):
        rmin, rmax = data.get('reps_min'), data.get('reps_max')
        if rmin is not None and rmax is not None and rmin > rmax:
            raise serializers.ValidationError("reps_min no puede ser mayor que reps_max.")
        if rmin is None and rmax is None and not data.get('al_fallo', False):
            raise serializers.ValidationError("Indica el rango de repeticiones o marca al_fallo.")
        return data


# --- Nivel día ---------------------------------------------------------
class DiasRutinasPredeterminadasSerializer(serializers.ModelSerializer):
    grupo_muscular = serializers.ListField(
        child=serializers.CharField(max_length=30), required=False
    )
    ejercicios = EjercicioRutinaPredeterminadaSerializer(many=True, required=False)

    class Meta:
        model = DiasRutinasPredeterminadasModel
        fields = [
            'id_dia', 'orden', 'nombre', 'grupo_muscular', 'tipo_intensidad',
            'intensidad', 'incluye_abdomen', 'ejercicios',
        ]


# --- Bloques de rutina -------------------------------------------------
class SplitSerializer(serializers.ModelSerializer):
    secuencia = serializers.ListField(child=serializers.CharField(max_length=20), required=False)

    class Meta:
        model = SplitModel
        fields = ['dias_entrenamiento', 'secuencia', 'repetir', 'descripcion']


class CardioSerializer(serializers.ModelSerializer):
    class Meta:
        model = CardioModel
        fields = ['sesiones_semana', 'tipo', 'duracion_min', 'en_ayunas', 'indicaciones']


class AbdomenSerializer(serializers.ModelSerializer):
    aplica_despues_de_dias = serializers.ListField(child=serializers.CharField(max_length=20), required=False)
    excluye_dias = serializers.ListField(child=serializers.CharField(max_length=20), required=False)
    ejercicios = EjercicioRutinaPredeterminadaSerializer(many=True, required=False)

    class Meta:
        model = AbdomenModel
        fields = ['aplica_despues_de_dias', 'excluye_dias', 'ejercicios']


# --- Mixin para escritura anidada -------------------------------------
class EscrituraAnidadaMixin:
    def create(self, validated_data):
        modelo = self.Meta.model
        return modelo.objects.create(**convertir(modelo, validated_data))

    def update(self, instance, validated_data):
        for campo, valor in convertir(self.Meta.model, validated_data).items():
            setattr(instance, campo, valor)
        instance.save()
        return instance


# --- RUTINAS PREDETERMINADAS (plantilla) ------------------------------
class RutinasPredeterminadasSerializer(EscrituraAnidadaMixin, serializers.ModelSerializer):
    split = SplitSerializer()
    cardio = CardioSerializer(required=False, allow_null=True)
    abdomen = AbdomenSerializer(required=False, allow_null=True)
    notas_generales = serializers.ListField(child=serializers.CharField(max_length=250), required=False)
    dias = DiasRutinasPredeterminadasSerializer(many=True, required=False)

    class Meta:
        model = RutinasPredeterminadasModel
        fields = [
            'id', 'nivel', 'nombre', 'descripcion', 'split', 'cardio', 'abdomen',
            'notas_generales', 'dias', 'activa', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate(self, data):

        split = data.get("split")
        dias = data.get("dias", [])

        if split:

            cantidad = split.get("dias_entrenamiento")

            if cantidad and cantidad != len(dias):

                raise serializers.ValidationError(
                    {
                        "dias":
                        f"Se esperaban {cantidad} días según dias_entrenamiento."
                    }
                )

        return data


# --- RUTINA ASIGNADA AL ALUMNO ----------------------------------------
class RutinasPredeterminadasUsuarioSerializer(EscrituraAnidadaMixin,serializers.ModelSerializer):
    split = SplitSerializer()
    cardio = CardioSerializer(required=False, allow_null=True)
    abdomen = AbdomenSerializer(required=False, allow_null=True)
    notas_generales = serializers.ListField(child=serializers.CharField(max_length=250), required=False)
    dias = DiasRutinasPredeterminadasSerializer(many=True, required=False)

    class Meta:
        model = RutinasPredeterminadasUsuarioModel
        fields = [
            'idRutina', 'nivel', 'nombre', 'descripcion', 'split', 'cardio', 'abdomen',
            'notas_generales', 'dias', 'activa', 'fechaAsignacion',
        ]
        read_only_fields = ['fechaAsignacion']

    def validate(self, data):

        split = data.get("split")
        dias = data.get("dias", [])

        if split:

            cantidad = split.get("dias_entrenamiento")

            if cantidad and cantidad != len(dias):

                raise serializers.ValidationError(
                    {
                        "dias":
                        f"Se esperaban {cantidad} días según dias_entrenamiento."
                    }
                )

        return data

#################################################################################
### FIN SECCIÓN SERIALIZERS RUTINAS PREDETERMINADAS ###

# ==========================================
# DIAS DE COMIDA DENTRO DE DIETA
# ==========================================

class DiaDietaSerializer(serializers.ModelSerializer):

    class Meta:
        model = DiaDietaModel
        fields = "__all__"
        read_only_fields = ["idDia"]


# ==========================================
# DIETAS
# ==========================================

class DietaSerializer(serializers.ModelSerializer):

    dias = DiaDietaSerializer(many=True)

    class Meta:
        model = DietaModel
        fields = "__all__"
        read_only_fields = ["idDieta"]

    def create(self, validated_data):

        dias_data = validated_data.pop("dias", [])

        dias = [
            DiaDietaModel(**dia)
            for dia in dias_data
        ]

        dieta = DietaModel(
            **validated_data,
            dias=dias
        )

        return dieta

class DietaEdicionSerializer(serializers.Serializer):
    """Campos de una dieta que el profesor puede editar.
    Los días se editan aparte, en editar_dia_dieta."""
    tmb = serializers.CharField(max_length=150)
    macros = serializers.CharField(max_length=250)
    notas = serializers.CharField(max_length=350, allow_blank=True)
    suplementos = serializers.CharField(max_length=350, allow_blank=True)


# ==========================================
# EJERCICIOS DENTRO DE UNA SESIÓN
# ==========================================

class EjercicioSesionSerializer(serializers.ModelSerializer):

    class Meta:
        model = EjercicioSesionModel
        fields = [
            'idEjercicio',
            'nombreEjercicio',
            'series',
            'repeticiones',
            'rer',
            'equipo',
            'peso',
            'tiempo',
            'detalles',
            'calificacion'
        ]


# ==========================================
# SESIONES
# ==========================================

class SesionSerializer(serializers.ModelSerializer):

    ejercicios = EjercicioSesionSerializer(
        many=True,
        required=False
    )

    idSesion = serializers.CharField(read_only=True)

    class Meta:
        model = SesionModel

        fields = [
            'idSesion',
            'idRutina',
            'fecha',
            'ejercicios'
        ]


# ==========================================
# USUARIO
# ==========================================

class UsuarioSerializer(serializers.ModelSerializer):

    id = serializers.CharField(read_only=True)

    password = serializers.CharField(
            min_length=8,
            max_length=128,
            write_only=True
        )

    # Opcional en el registro; se llena después con PATCH /api/datos/
    datos = DatosSerializer(required=False, allow_null=True)

    # Solo lectura: el alumno NO puede escribir estos arreglos desde /registro/ ni /perfil/.
    # Cada uno tiene su propia ruta con sus permisos (planes, rutinas, dietas, sesiones, medidas).
    metricas = MetricasSerializer(many=True, read_only=True)
    plan = PlanSerializer(many=True, read_only=True)
    rutina = RutinaSerializer(many=True, read_only=True)
    rutina_predeterminada = RutinasPredeterminadasUsuarioSerializer(many=True, read_only=True)
    dietas = DietaSerializer(many=True, read_only=True)
    sesion = SesionSerializer(many=True, read_only=True)

    class Meta:
        model = UsuarioModel
        fields = [
            'id',
            'nombre',
            'rut',
            'edad',
            'correo',
            'password',
            'tipo_usuario',
            'datos',
            'metricas',
            'plan',
            'rutina',
            'rutina_predeterminada',
            'dietas',
            'sesion'
        ]

        read_only_fields = ['id', 'tipo_usuario']

    def create(self, validated_data):
        validated_data['password'] = make_password(
            validated_data['password']
        )

        # El registro público siempre crea alumnos.
        validated_data['tipo_usuario'] = 'Alumno'

        datos = preparar_datos(self, validated_data)

        return UsuarioModel.objects.create(**datos)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)

        if password:
            instance.password = make_password(password)

        datos = preparar_datos(self, validated_data)

        for campo, valor in datos.items():
            setattr(instance, campo, valor)

        instance.save()
        return instance

    @staticmethod
    def verificar_login(correo, password):
        try:
            usuario = UsuarioModel.objects.get(correo=correo)
        except UsuarioModel.DoesNotExist:
            return None

        if check_password(password, usuario.password):
            return usuario

        return None


# ==========================================
# EDICIÓN DE USUARIOS DESDE EL PANEL ADMIN
# ==========================================

TIPOS_USUARIO = ["Alumno", "Profesor", "Admin"]


class AdminUsuarioSerializer(serializers.Serializer):
    """Campos que el administrador puede cambiar de una cuenta.

    No es un ModelSerializer a propósito: la unicidad de correo y RUT se revisa
    en la vista excluyendo al propio usuario (un UniqueValidator sin instancia
    rechazaba el correo actual del usuario como "ya existe")."""
    nombre = serializers.CharField(max_length=100, required=False)
    rut = serializers.CharField(max_length=12, required=False)
    edad = serializers.IntegerField(min_value=1, max_value=120, required=False)
    correo = serializers.EmailField(required=False)
    tipo_usuario = serializers.ChoiceField(choices=TIPOS_USUARIO, required=False)

    def validate_correo(self, valor):
        return valor.strip().lower()

    def validate_rut(self, valor):
        return valor.strip()


# ==========================================
# ALUMNOS VISTOS POR EL PROFESIONAL
# ==========================================

class AlumnoProfesorSerializer(serializers.ModelSerializer):
    """Lo que el profesional necesita ver de cada alumno: datos de contacto,
    métricas, lesiones y alergias. No incluye la contraseña."""

    id = serializers.CharField(read_only=True)
    datos = DatosSerializer(read_only=True)
    # El entrenador usa el contrato guardado para separar a los alumnos por plan.
    plan = PlanSerializer(many=True, read_only=True)
    # El gráfico del entrenador usa las medidas ya guardadas del alumno; esto solo amplía la respuesta de lectura.
    metricas = MetricasSerializer(many=True, read_only=True)
    # Plan contratado vigente (ej. "Plan Avanzado"), para que el coach vea el plan real del alumno.
    planActivo = serializers.SerializerMethodField()
    class Meta:
        model = UsuarioModel
        fields = [
            'id',
            'nombre',
            'rut',
            'edad',
            'correo',
            'datos',
            'plan',
            'metricas',
            'planActivo'
        ]
    def get_planActivo(self, alumno):
        """Devuelve el nombre del plan con vigencia Activo, o None si no tiene."""
        for plan in (alumno.plan or []):
            leer = plan.get if isinstance(plan, dict) else lambda campo, defecto='': getattr(plan, campo, defecto)
            if str(leer('vigencia', '') or '').strip().lower() == 'activo':
                return str(leer('nombre', '') or leer('idPlan', '') or '')
        return None



# ==========================================
# COLECCIONES INDEPENDIENTES
# ==========================================

class EjerciciosSerializer(serializers.ModelSerializer):

    id = serializers.CharField(read_only=True)
    videoTutorial = serializers.CharField(required=False, allow_blank=True, max_length=255)

    class Meta:
        model = EjerciciosModel
        fields = [
            'id',
            'idEjercicio',
            'nombre',
            'equipo',
            'videoTutorial'
        ]

        read_only_fields = ['id']

class PlanesSerializer(serializers.ModelSerializer):

    id = serializers.CharField(read_only=True)
    nombre = serializers.CharField(max_length=100)
    precio = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01")
    )
    detalle = serializers.CharField(
        max_length=200,
        allow_blank=True
    )

    class Meta:
        model = PlanesModel
        fields = [
            'id',
            'nombre',
            'precio',
            'detalle'
        ]

        read_only_fields = ['id']

#SERIALIZADOR PARA CONTENIDO MULTIMEDIA
class MultimediaSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    nombre = serializers.CharField(max_length=150)
    tipo_multimedia = serializers.ChoiceField(
        choices=["foto", "video"]
    )
    url = serializers.URLField()
    activo = serializers.BooleanField(default=False)
