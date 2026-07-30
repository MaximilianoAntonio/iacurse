# Elimina el flujo sandbox de cursos (modelos sin uso en el producto).
# Escrita a mano: solo DeleteModel (los RemoveField previos rompían el
# remake de tablas SQLite por los indexes Meta que referencian los FKs).
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('sandbox', '0002_courseunit_content_courseunit_diagnostic_questions'),
    ]

    operations = [
        # Primero los modelos con FKs salientes
        migrations.DeleteModel(name='Question'),
        migrations.DeleteModel(name='CourseLesson'),
        migrations.DeleteModel(name='CourseUnit'),
        # Luego las raíces
        migrations.DeleteModel(name='Course'),
        migrations.DeleteModel(name='QuestionBank'),
        migrations.DeleteModel(name='DataResource'),
    ]
