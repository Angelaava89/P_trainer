# Evita dos reservas activas en el mismo horario.
#
# Antes, POST /api/asesorias/ revisaba si el horario estaba libre y después creaba la
# reserva: si dos alumnos reservaban casi al mismo tiempo, ambas reservas se guardaban.
# Ahora cada reserva activa guarda "bloqueo" = "AAAA-MM-DD HH:MM" y un índice único en
# Mongo rechaza la segunda. Las canceladas tienen bloqueo = None y no cuentan.
from django.db import migrations, models

NOMBRE_INDICE = "asesorias_bloqueo_unico"


def completar_bloqueos_y_crear_indice(apps, schema_editor):
    asesorias = schema_editor.connection.database["asesorias"]

    # Reservas que ya existían: la primera de cada horario queda con su bloqueo.
    # Si ya había horarios repetidos, las siguientes quedan sin bloqueo (no se borran)
    # y se avisan en la consola para revisarlas a mano.
    vistos, repetidas = set(), []
    for doc in asesorias.find({"estado": {"$ne": "cancelada"}}).sort("_id", 1):
        clave = f"{doc.get('fecha')} {doc.get('hora')}"
        if clave in vistos:
            repetidas.append(str(doc["_id"]))
            asesorias.update_one({"_id": doc["_id"]}, {"$set": {"bloqueo": None}})
        else:
            vistos.add(clave)
            asesorias.update_one({"_id": doc["_id"]}, {"$set": {"bloqueo": clave}})
    asesorias.update_many({"estado": "cancelada"}, {"$set": {"bloqueo": None}})

    asesorias.create_index(
        [("bloqueo", 1)],
        name=NOMBRE_INDICE,
        unique=True,
        # Solo cuentan las reservas activas (las canceladas tienen bloqueo = None).
        partialFilterExpression={"bloqueo": {"$type": "string"}},
    )

    if repetidas:
        print(
            f"\n  Aviso: {len(repetidas)} clase(s) presencial(es) ya compartían horario con otra "
            f"y quedaron sin bloqueo. Revísalas en la colección asesorias: {', '.join(repetidas)}"
        )


def quitar_indice(apps, schema_editor):
    asesorias = schema_editor.connection.database["asesorias"]
    if NOMBRE_INDICE in asesorias.index_information():
        asesorias.drop_index(NOMBRE_INDICE)


class Migration(migrations.Migration):

    dependencies = [
        ("proyecto_Trainer", "0007_sincronizar_modelos"),
    ]

    operations = [
        # El campo se agrega solo al estado de Django; los valores los pone la función de abajo.
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddField(
                    model_name="asesoriamodel",
                    name="bloqueo",
                    field=models.CharField(blank=True, default=None, max_length=16, null=True),
                ),
            ],
        ),
        migrations.RunPython(completar_bloqueos_y_crear_indice, quitar_indice),
    ]
