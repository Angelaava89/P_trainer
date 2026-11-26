from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("proyecto_Trainer", "0004_diadietamodel_medianoche_diadietamodel_suplementos"),
    ]

    # MongoDB no exige declarar previamente las claves de sus documentos.
    # Esta operacion actualiza el estado de Django para el identificador del
    # ejercicio global, sin completar ni modificar documentos que ya existen.
    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddField(
                    model_name="diasrutinaspredeterminadasmodel",
                    name="idEjercicio",
                    field=models.CharField(blank=True, default="", max_length=24),
                ),
            ],
        ),
    ]
