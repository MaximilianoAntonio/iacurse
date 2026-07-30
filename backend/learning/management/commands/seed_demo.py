"""
Management command: seed_demo

Crea datos demo para el piloto de Electromedicina II:
- Usuarios: Prof. Hermes Mora (teacher) + 4 estudiantes @uv.cl
- Unidad temática de prueba: "El Arte del Rickroll" — demo completa del
  potencial de la plataforma: texto base extenso para la adaptación por IA,
  diagnóstico de 6 preguntas, 6 lecciones con markdown rico (video embebido,
  código, citas, listas), 10 actividades que cubren los 5 tipos con metadatos
  variados (dificultad, Bloom, límites de intentos/tiempo, evaluación
  formativa/sumativa/reflexiva), 4 objetivos de aprendizaje y una rúbrica
  vinculada a la autoevaluación.
- Insignias canónicas y sesiones de estudio demo (para el panel docente).

Uso:
    python manage.py seed_demo
    python manage.py seed_demo --reset   # borra y recrear
"""
import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from curriculum.models import Activity, LearningObjective, Lesson, Rubric, Unit
from learning.models import Badge, StudySession

User = get_user_model()

UNITS_DATA = [
    {
        "slug": "rickroll",
        "title": "El Arte del Rickroll",
        "icon": "Music",
        "color": "rose",
        "summary": "Historia, técnica, psicología y ética del meme más longevo de internet.",
        "content": (
            "## ¿Qué es un rickroll?\n\n"
            "Un rickroll es una broma de internet que consiste en engañar a alguien para "
            "que abra un enlace esperando encontrar otra cosa —un tráiler, una filtración, "
            "una noticia— y termine viendo el video musical de *Never Gonna Give You Up* "
            "de Rick Astley (1987). La clave es la **expectativa**: la víctima hace clic "
            "convencida de algo y, en cambio, suena el icónico redoble de batería inicial.\n\n"
            "Es un meme inofensivo por diseño: la 'trampa' termina en una canción, no en "
            "un susto ni en software malicioso. Esa inocuidad es parte de su longevidad.\n\n"
            "## Orígenes: del duckroll al rickroll\n\n"
            "En 2006, en el imageboard 4chan, nació el *duckroll*: un cebo que redirigía "
            "a la imagen de un pato montado sobre ruedas. La mecánica del engaño ya "
            "existía; solo faltaba el *payload* perfecto.\n\n"
            "En mayo de 2008, Rockstar Games publicó el primer tráiler de *Grand Theft "
            "Auto IV* y sus servidores colapsaron por la demanda. Un usuario anónimo "
            "compartió un supuesto 'mirror' del tráiler que, en realidad, llevaba al "
            "video de Rick Astley. Miles cayeron en horas y el rickroll había nacido.\n\n"
            "## La canción detrás del meme\n\n"
            "*Never Gonna Give You Up* fue el debut de Rick Astley en 1987, producido "
            "por el trío británico Stock Aitken Waterman. Llegó al número 1 en más de 20 "
            "países, incluidos Reino Unido y Estados Unidos. El contraste entre la voz "
            "de barítono de Astley y su aspecto de adolescente pelirrojo ya era famoso "
            "antes del meme.\n\n"
            "Puedes ver la pieza original aquí (bajo tu propio riesgo):\n\n"
            "[Never Gonna Give You Up — video oficial](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n\n"
            "## Anatomía técnica del engaño\n\n"
            "Todo rickroll tiene tres componentes:\n\n"
            "1. **El cebo**: algo que la víctima realmente quiera ver.\n"
            "2. **La ocultación**: un acortador de URL o un texto de enlace engañoso que "
            "esconda el destino real.\n"
            "3. **El payload**: el video de Astley sonando a todo volumen.\n\n"
            "Los veteranos reconocen el enlace al instante por el ID del video:\n\n"
            "```\n"
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ\n"
            "                            └─ ID del video\n"
            "```\n\n"
            "## Psicología del cebo\n\n"
            "El rickroll explota la *brecha de información*: la curiosidad que sentimos "
            "cuando sabemos que falta algo por conocer. Un buen cebo promete cerrar esa "
            "brecha ('tráiler filtrado', 'video eliminado'), y la frustración momentánea "
            "se transforma en risa porque el castigo es solo una canción.\n\n"
            "> El meme perfecto no castiga: te hace cómplice de la broma para la "
            "> siguiente víctima.\n\n"
            "## El rickroll en la cultura popular\n\n"
            "El meme saltó de los foros al mainstream muy rápido: en 2008 el propio Rick "
            "Astley hizo un rickroll en vivo durante el desfile de Macy's en Nueva York, "
            "y YouTube gastó una broma de April Fools redirigiendo todos sus videos "
            "destacados a la canción. El video oficial supera los 1.500 millones de "
            "reproducciones, y Astley asegura que el meme le dio una segunda vida a su "
            "carrera.\n\n"
            "## Variantes y legado\n\n"
            "El rickroll inspiró toda una familia de memes de cebo: enlaces que prometen "
            "algo y entregan otra cosa, siempre en clave de humor. Su espíritu vive en "
            "cada 'link bait' inofensivo, y su nombre se convirtió en verbo: *rickrollear*.\n\n"
            "## Cómo rickrollear con ética y estilo\n\n"
            "Un buen rickroll es inofensivo: el cebo debe ser creíble pero jamás malicioso "
            "(nada de phishing real, enlaces a malware ni sustos con volumen alto). El "
            "rickroll perfecto se cierra con risas, no con enojo. Y la regla de oro: si "
            "te rickrollean, reconócelo con elegancia… y empieza a preparar tu venganza."
        ),
        "diagnostic": [
            "¿Alguna vez has sido víctima de un rickroll? Cuénta cómo fue.",
            "¿Qué sabes de Rick Astley o de la canción \"Never Gonna Give You Up\"?",
            "¿Qué crees que hace que un meme sobreviva tantos años en internet?",
            "¿Sabes identificar cuándo un enlace puede ser una trampa? ¿Qué señales miras?",
            "¿Te animarías a rickrollear a alguien? Describe tu estrategia.",
            "¿Dónde crees que está el límite entre una broma en línea y una mala práctica?",
        ],
        "objectives": [
            {"code": "O1", "description": "Explicar el origen y la evolución del rickroll como fenómeno de internet.", "bloom": "understand"},
            {"code": "O2", "description": "Identificar las señales técnicas de un enlace-cebo antes de hacer clic.", "bloom": "analyze"},
            {"code": "O3", "description": "Analizar los factores que hacen perdurar un meme en la cultura digital.", "bloom": "analyze"},
            {"code": "O4", "description": "Evaluar límites éticos en bromas en línea y proponer hábitos de verificación.", "bloom": "evaluate"},
        ],
        "rubric": {
            "name": "Rúbrica de reflexión anti-cebo",
            "description": "Evalúa la reflexión del estudiante sobre su inmunidad a los cebos en línea.",
            "criteria": [
                {
                    "name": "Detección de señales de cebo",
                    "weight": 2,
                    "levels": [
                        {"score": 0, "label": "Insuficiente", "description": "No identifica señales del enlace sospechoso"},
                        {"score": 1, "label": "Suficiente", "description": "Identifica señales básicas como acortador o promesa exagerada"},
                        {"score": 2, "label": "Destacado", "description": "Identifica múltiples señales y explica por qué sospechar del enlace"},
                    ],
                },
                {
                    "name": "Hábitos de verificación",
                    "weight": 2,
                    "levels": [
                        {"score": 0, "label": "Insuficiente", "description": "No propone hábitos concretos"},
                        {"score": 1, "label": "Suficiente", "description": "Propone verificar enlaces antes de hacer clic"},
                        {"score": 2, "label": "Destacado", "description": "Describe técnicas concretas como previsualizar el destino del enlace"},
                    ],
                },
                {
                    "name": "Autoevaluación honesta",
                    "weight": 1,
                    "levels": [
                        {"score": 0, "label": "Insuficiente", "description": "No reflexiona sobre su conducta"},
                        {"score": 1, "label": "Suficiente", "description": "Reconoce sus vulnerabilidades ante cebos y rickrolls"},
                        {"score": 2, "label": "Destacado", "description": "Evalúa su conducta en línea con ejemplos propios"},
                    ],
                },
            ],
        },
        "lessons": [
            {
                "title": "Historia del meme: de 4chan al mundo",
                "description": "Del duckroll al tráiler falso de GTA IV: cómo nació el meme.",
                "duration": 15,
                "content": (
                    "# Historia del meme: de 4chan al mundo\n\n"
                    "Antes del rickroll existió el **duckroll** (2006): en 4chan, los "
                    "usuarios publicaban enlaces prometedores que llevaban a la foto de "
                    "un pato montado sobre ruedas. La mecánica del cebo ya estaba lista; "
                    "solo faltaba el payload perfecto.\n\n"
                    "## El tráiler de GTA IV\n\n"
                    "En mayo de 2008, Rockstar Games anunció el primer tráiler de *Grand "
                    "Theft Auto IV* y los servidores colapsaron por la demanda. Un "
                    "usuario de 4chan publicó un 'mirror' del tráiler que, en realidad, "
                    "llevaba al video de *Never Gonna Give You Up*. Miles cayeron en "
                    "horas.\n\n"
                    "### Por qué funcionó tan bien\n\n"
                    "- La expectación por el juego era máxima.\n"
                    "- Los mirrors eran necesarios: el sitio oficial no daba abasto.\n"
                    "- Nadie conocía aún el enlace legendario.\n\n"
                    "## Del foro a la televisión\n\n"
                    "En noviembre de 2008, durante el desfile de Macy's en Nueva York, "
                    "Rick Astley apareció cantando su propio éxito: el primer rickroll "
                    "en vivo de la historia, transmitido por televisión nacional. El meme "
                    "había cruzado la frontera de internet."
                ),
                "activities": [
                    {
                        "type": "multiple_choice",
                        "title": "El cebo original",
                        "prompt": "Elige la respuesta correcta según la historia del meme.",
                        "data": {
                            "question": "¿Qué esperaba ver la gente cuando cayó en el primer rickroll masivo de 2008?",
                            "options": [
                                "El tráiler de Half-Life 3",
                                "El tráiler de Grand Theft Auto IV",
                                "La final del Mundial de Sudáfrica",
                                "Un tutorial de cómo hacer duckrolls",
                            ],
                            "correctIndex": 1,
                            "explanation": "El cebo fue un falso 'mirror' del primer tráiler de GTA IV, muy esperado en 2008.",
                            "hints": ["Fue un videojuego de Rockstar Games", "Salió en 2008 y colapsó servidores"],
                        },
                        "points": 10,
                        "difficulty": "easy",
                        "bloomLevel": "remember",
                        "maxAttempts": 3,
                        "objectiveCodes": ["O1"],
                    },
                    {
                        "type": "guided_problem",
                        "title": "Anatomía de un rickroll",
                        "prompt": "Ordena mentalmente los pasos y responde cada uno.",
                        "data": {
                            "scenario": "Quieres ejecutar el rickroll perfecto y analizas sus componentes paso a paso.",
                            "steps": [
                                {
                                    "prompt": "Paso 1 — ¿Qué necesitas ofrecer a la víctima para que haga clic voluntariamente?",
                                    "answer": "un cebo creíble",
                                    "hint": "Algo que la víctima realmente quiera ver: un tráiler, una filtración, una noticia.",
                                },
                                {
                                    "prompt": "Paso 2 — ¿Qué herramienta usas para ocultar el destino real del enlace?",
                                    "answer": "acortador de URL",
                                    "hint": "bit.ly, tinyurl o simplemente texto de enlace engañoso.",
                                },
                                {
                                    "prompt": "Paso 3 — ¿En qué momento se consume el rickroll?",
                                    "answer": "cuando suena la canción",
                                    "hint": "El redoble de batería delata todo.",
                                },
                            ],
                            "finalAnswer": "Cebo creíble + enlace oculto + la canción sonando = rickroll consumado.",
                            "explanation": "Todo rickroll combina expectativa, ocultamiento del destino y el payload musical.",
                        },
                        "points": 15,
                        "difficulty": "medium",
                        "bloomLevel": "apply",
                        "objectiveCodes": ["O1", "O2"],
                    },
                ],
            },
            {
                "title": "Never Gonna Give You Up: la canción detrás del meme",
                "description": "Rick Astley, 1987 y el hit ochentero que se volvió inmortal.",
                "duration": 20,
                "content": (
                    "# Never Gonna Give You Up: la canción detrás del meme\n\n"
                    "Rick Astley tenía 19 años cuando grabó su debut en 1987. Producido "
                    "por **Stock Aitken Waterman**, el sencillo fue número 1 en más de 20 "
                    "países, incluidos Reino Unido y Estados Unidos.\n\n"
                    "## El video oficial\n\n"
                    "Antes de continuar, escucha la pieza completa. Analiza su intro: "
                    "¿reconoces el redoble de batería que delata el rickroll?\n\n"
                    "[Never Gonna Give You Up — Rick Astley (video oficial)](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n\n"
                    "## La voz que nadie esperaba\n\n"
                    "El contraste entre la voz de barítono de Astley y su imagen de "
                    "adolescente pelirrojo generaba sorpresa incluso antes del meme: la "
                    "gente no creía que esa voz saliera de él.\n\n"
                    "## De hit ochentero a meme eterno\n\n"
                    "El video oficial supera los 1.500 millones de reproducciones en "
                    "YouTube, cifra que crece cada año gracias a los nuevos rickrolleados. "
                    "Astley, lejos de molestarse, abrazó el meme: lo ha tocado en "
                    "conciertos mezclado con otras canciones y agradece que una nueva "
                    "generación descubriera su música."
                ),
                "activities": [
                    {
                        "type": "multiple_choice",
                        "title": "El debut de 1987",
                        "prompt": "Elige la respuesta correcta sobre el origen de la canción.",
                        "data": {
                            "question": "¿En qué año lanzó Rick Astley 'Never Gonna Give You Up'?",
                            "options": ["1985", "1987", "1991", "2008"],
                            "correctIndex": 1,
                            "explanation": "El sencillo debutó en 1987 y fue número 1 en más de 20 países.",
                            "hints": ["Es un año ochentero", "Astley tenía 19 años"],
                        },
                        "points": 10,
                        "difficulty": "easy",
                        "bloomLevel": "remember",
                        "objectiveCodes": ["O1"],
                    },
                    {
                        "type": "case_analysis",
                        "title": "Caso: el rickroll de Macy's",
                        "prompt": "Analiza el salto del meme a la televisión en vivo.",
                        "data": {
                            "case": (
                                "Noviembre de 2008. El desfile de Macy's por el Día de Acción de Gracias "
                                "recorre Nueva York con millones de espectadores en vivo. En medio del "
                                "evento, una presentación 'sorpresa' interrumpe la transmisión: Rick Astley "
                                "en persona cantando Never Gonna Give You Up. Internet enloquece: el meme "
                                "acababa de autorickrollear a la televisión."
                            ),
                            "questions": [
                                {
                                    "prompt": "¿Quién apareció en el desfile para ejecutar el rickroll en vivo?",
                                    "answer": "Rick Astley",
                                    "explanation": "El propio cantante participó de la broma.",
                                },
                                {
                                    "prompt": "¿Qué canción interpretó durante la transmisión?",
                                    "answer": "Never Gonna Give You Up",
                                    "explanation": "Su éxito de 1987, el payload clásico del meme.",
                                },
                                {
                                    "prompt": "¿Por qué este evento marcó un hito para el meme?",
                                    "answer": "el meme saltó de internet a la televisión en vivo",
                                    "explanation": "Pasó de los foros a un evento masivo de TV nacional.",
                                },
                            ],
                        },
                        "points": 15,
                        "difficulty": "medium",
                        "bloomLevel": "analyze",
                        "objectiveCodes": ["O1", "O3"],
                    },
                ],
            },
            {
                "title": "Anatomía técnica: URLs, acortadores y el ID legendario",
                "description": "Aprende a leer un enlace antes de hacer clic.",
                "duration": 15,
                "content": (
                    "# Anatomía técnica: URLs, acortadores y el ID legendario\n\n"
                    "Todo enlace cuenta una historia. Aprender a leerlo es la vacuna "
                    "contra el rickroll… y la herramienta del rickrolleador.\n\n"
                    "## La URL del payload\n\n"
                    "El video oficial tiene un ID que los veteranos memorizaron:\n\n"
                    "```\n"
                    "https://www.youtube.com/watch?v=dQw4w9WgXcQ\n"
                    "                            └─ ID del video\n"
                    "```\n\n"
                    "## Las señales de alarma\n\n"
                    "1. **Acortadores sin contexto** (bit.ly, tinyurl): ocultan el destino.\n"
                    "2. **Promesas exageradas**: 'FILTRADO', 'ELIMINADO', 'MIRA ANTES DE QUE LO BORREN'.\n"
                    "3. **Texto de enlace genérico** que no coincide con la URL real al "
                    "pasar el mouse por encima.\n\n"
                    "## La contraofensiva\n\n"
                    "Previsualizar el destino (hover en desktop, pulsación larga en "
                    "móvil) revela la URL real antes de hacer clic. Si ves "
                    "`dQw4w9WgXcQ`… ya sabes qué hacer: enviárselo a otro."
                ),
                "activities": [
                    {
                        "type": "multiple_choice",
                        "title": "El ID legendario",
                        "prompt": "Elige la respuesta correcta. Puedes usar hasta 2 pistas.",
                        "data": {
                            "question": "¿Qué es 'dQw4w9WgXcQ'?",
                            "options": [
                                "El ID del video de Never Gonna Give You Up en YouTube",
                                "La contraseña WiFi de 4chan",
                                "El nombre en clave del primer duckroll",
                                "Un error de tipeo que se volvió meme",
                            ],
                            "correctIndex": 0,
                            "explanation": "Es el identificador del video oficial; reconocerlo es la vacuna anti-rickroll.",
                            "hints": ["Aparece en la URL del video", "youtube.com/watch?v=…"],
                        },
                        "points": 10,
                        "difficulty": "easy",
                        "bloomLevel": "remember",
                        "objectiveCodes": ["O2"],
                    },
                    {
                        "type": "progressive_exercise",
                        "title": "Detecta el rickroll antes de caer",
                        "prompt": "Supera los tres niveles de defensa anti-rickroll.",
                        "data": {
                            "levels": [
                                {
                                    "prompt": "Nivel 1 — Un amigo te manda 'TRÁILER FILTRADO de GTA VI' con un enlace acortado. ¿Cuál es tu primera reacción?",
                                    "answer": "sospechar del enlace",
                                    "explanation": "Cebo demasiado bueno + URL oculta = sospecha razonable.",
                                },
                                {
                                    "prompt": "Nivel 2 — Al previsualizar, el enlace muestra youtube.com/watch?v=dQw4w9WgXcQ. ¿Qué concluyes?",
                                    "answer": "es el enlace del rickroll",
                                    "explanation": "dQw4w9WgXcQ es el ID del video de Never Gonna Give You Up.",
                                },
                                {
                                    "prompt": "Nivel 3 — Fallaste y ya suena el redoble de batería. ¿Cuál es la reacción elegante?",
                                    "answer": "reírse y admitir el rickroll",
                                    "explanation": "La etiqueta del meme: se reconoce con humor y se prepara la venganza.",
                                },
                            ],
                        },
                        "points": 15,
                        "difficulty": "hard",
                        "bloomLevel": "analyze",
                        "maxAttempts": 2,
                        "masteryThreshold": 80,
                        "objectiveCodes": ["O2"],
                    },
                ],
            },
            {
                "title": "Psicología del cebo: por qué funciona y por qué perdura",
                "description": "La brecha de información y las razones de un meme eterno.",
                "duration": 20,
                "content": (
                    "# Psicología del cebo: por qué funciona y por qué perdura\n\n"
                    "El rickroll no es solo un chiste: es una lección de psicología "
                    "aplicada a internet.\n\n"
                    "## La brecha de información\n\n"
                    "La curiosidad nace de percibir una *brecha* entre lo que sabemos y "
                    "lo que queremos saber. Un buen cebo abre esa brecha ('tráiler "
                    "filtrado', 'video eliminado') y promete cerrarla con un solo clic.\n\n"
                    "> La curiosidad es el combustible; la frustración breve, el chiste; "
                    "> la canción, el perdón instantáneo.\n\n"
                    "## Por qué perdura el meme\n\n"
                    "1. **Simplicidad**: una sola acción basta (hacer clic).\n"
                    "2. **Inocuidad**: nadie sale herido; el castigo es bailar.\n"
                    "3. **Participación**: la víctima se convierte en el siguiente "
                    "rickrolleador.\n"
                    "4. **Reconocimiento compartido**: un ID de video une a generaciones "
                    "de internautas.\n\n"
                    "## El meme como cultura\n\n"
                    "Cuando un meme sobrevive más de 15 años, deja de ser un chiste y "
                    "pasa a ser *referente cultural*: una manera compartida de hablar "
                    "sobre la confianza y la sorpresa en internet."
                ),
                "activities": [
                    {
                        "type": "case_analysis",
                        "title": "¿Por qué el rickroll no muere?",
                        "prompt": "Analiza los factores de longevidad del meme.",
                        "data": {
                            "case": (
                                "La mayoría de los memes muere en meses. El rickroll lleva más de 15 años "
                                "vivo: sigue apareciendo en presentaciones corporativas, partidos de "
                                "deporte, protestas y hasta en el código fuente de sitios web. Su "
                                "estructura es idéntica a 2008: cebo, enlace oculto, canción."
                            ),
                            "questions": [
                                {
                                    "prompt": "¿Qué hace que la víctima acepte la broma sin enojarse?",
                                    "answer": "la broma es inofensiva y termina en una canción",
                                    "explanation": "La inocuidad convierte la frustración en risa.",
                                },
                                {
                                    "prompt": "¿Qué rol juega la víctima en la supervivencia del meme?",
                                    "answer": "se convierte en el siguiente rickrolleador",
                                    "explanation": "La participación perpetúa el ciclo.",
                                },
                                {
                                    "prompt": "¿Por qué la simplicidad del mecanismo ayuda a su longevidad?",
                                    "answer": "cualquiera puede replicarlo con un solo enlace",
                                    "explanation": "Barrera de entrada mínima = reproducción masiva.",
                                },
                            ],
                        },
                        "points": 15,
                        "difficulty": "hard",
                        "bloomLevel": "evaluate",
                        "weight": 2,
                        "objectiveCodes": ["O3"],
                    },
                    {
                        "type": "guided_problem",
                        "title": "Diseña un cebo ético",
                        "prompt": "Construye paso a paso un cebo efectivo y honorable.",
                        "data": {
                            "scenario": "Quieres rickrollear a tu grupo de amigos sin romper las reglas del meme honorable.",
                            "steps": [
                                {
                                    "prompt": "Paso 1 — ¿Qué tema usarías como cebo para que sea creíble para tus amigos?",
                                    "answer": "algo que realmente les interese",
                                    "hint": "Un tráiler, una filtración, una noticia de su interés.",
                                },
                                {
                                    "prompt": "Paso 2 — ¿Qué NO debe contener tu enlace para que la broma siga siendo ética?",
                                    "answer": "malware o phishing",
                                    "hint": "La broma termina en la canción, nunca en daño real.",
                                },
                                {
                                    "prompt": "Paso 3 — ¿Cuándo termina oficialmente la broma?",
                                    "answer": "cuando suena la canción",
                                    "hint": "No hay segunda trampa: el rickroll se cierra con risas.",
                                },
                            ],
                            "finalAnswer": "Cebo relevante + enlace inofensivo + cierre en la canción = rickroll ético.",
                            "explanation": "La efectividad del cebo nunca justifica el daño: esa es la regla de oro.",
                        },
                        "points": 15,
                        "difficulty": "medium",
                        "bloomLevel": "create",
                        "objectiveCodes": ["O3", "O4"],
                    },
                ],
            },
            {
                "title": "El rickroll en la cultura: TV, April Fools y estadios",
                "description": "Del desfile de Macy's al April Fools institucional de YouTube.",
                "duration": 15,
                "content": (
                    "# El rickroll en la cultura: TV, April Fools y estadios\n\n"
                    "El rickroll dejó de ser un chiste de foro para convertirse en "
                    "fenómeno cultural global.\n\n"
                    "## El April Fools de YouTube (2008)\n\n"
                    "El 1 de abril de 2008, YouTube redirigió **todos los videos "
                    "destacados de su portada** a *Never Gonna Give You Up*. Millones de "
                    "usuarios fueron rickrolleados por la propia plataforma: el mayor "
                    "rickroll institucional de la historia.\n\n"
                    "## El rickroll en vivo\n\n"
                    "El desfile de Macy's de 2008 abrió la puerta a los rickrolls "
                    "presenciales: equipos de deporte universitario lo han usado contra "
                    "sus rivales, orquestas lo interpretan como bis sorpresa y Astley "
                    "mismo lo toca en sus conciertos.\n\n"
                    "## El meme institucional\n\n"
                    "El rickroll aparece hoy en presentaciones corporativas, materiales "
                    "docentes y campañas publicitarias. Cuando una broma de foro termina "
                    "en manuales de marketing, algo cultural profundo ocurrió."
                ),
                "activities": [
                    {
                        "type": "multiple_choice",
                        "title": "El April Fools de YouTube",
                        "prompt": "Pregunta sumativa: lee bien antes de responder.",
                        "data": {
                            "question": "¿Qué hizo YouTube el 1 de abril de 2008?",
                            "options": [
                                "Redirigió todos los videos destacados de su portada a Never Gonna Give You Up",
                                "Baneó el video de Rick Astley por spam",
                                "Cambió su logo por el pato del duckroll",
                                "Publicó el primer tráiler de GTA IV",
                            ],
                            "correctIndex": 0,
                            "explanation": "La plataforma rickrolleó a todos sus usuarios: el mayor rickroll institucional.",
                            "hints": ["Fue una broma de April Fools", "Afectó a la portada completa"],
                        },
                        "points": 20,
                        "difficulty": "medium",
                        "bloomLevel": "remember",
                        "assessmentType": "summative",
                        "maxAttempts": 2,
                        "timeLimitMin": 5,
                        "objectiveCodes": ["O1"],
                    },
                    {
                        "type": "multiple_choice",
                        "title": "Rick Astley abraza el meme",
                        "prompt": "Elige la respuesta correcta sobre la reacción del cantante.",
                        "data": {
                            "question": "¿Cómo reaccionó Rick Astley al convertirse en meme?",
                            "options": [
                                "Demandó a YouTube por las reproducciones",
                                "Se retiró de la música por la vergüenza",
                                "Lo abrazó: lo canta en conciertos y agradece la segunda vida de su carrera",
                                "Grabó una versión punk de la canción como venganza",
                            ],
                            "correctIndex": 2,
                            "explanation": "Astley agradece que el meme acercara su música a nuevas generaciones.",
                            "hints": ["Sigue cantando la canción", "Dice que le dio una segunda vida a su carrera"],
                        },
                        "points": 10,
                        "difficulty": "medium",
                        "bloomLevel": "understand",
                        "objectiveCodes": ["O3"],
                    },
                ],
            },
            {
                "title": "Ética del meme y defensa personal",
                "description": "Las reglas del rickrolleador honorable y tu vacuna digital.",
                "duration": 10,
                "content": (
                    "# Ética del meme y defensa personal\n\n"
                    "El rickroll sobrevive porque es un chiste **inofensivo**: nadie sale "
                    "herido y el 'castigo' es escuchar una buena canción. Mantenerlo así "
                    "es responsabilidad de quien bromea.\n\n"
                    "## Reglas del rickrolleador honorable\n\n"
                    "- El cebo nunca apunta a malware, phishing ni sustos con volumen.\n"
                    "- La broma termina cuando suena la canción: no hay segunda trampa.\n"
                    "- Se acepta la derrota con elegancia cuando te toca a ti.\n\n"
                    "## Defensa personal\n\n"
                    "Previsualiza los enlaces antes de abrirlos (pasa el mouse por "
                    "encima, o mantén pulsado en móvil), desconfía de los acortadores sin "
                    "contexto y memoriza el ID `dQw4w9WgXcQ`: es la vacuna definitiva "
                    "contra el rickroll.\n\n"
                    "## La reflexión final\n\n"
                    "El rickroll es, en el fondo, una lección de higiene digital: la "
                    "misma desconfianza sana que te salva de un meme te protege del "
                    "phishing real. Quien aprende a leer un enlace, aprende a navegar."
                ),
                "activities": [
                    {
                        "type": "self_assessment",
                        "title": "Tu inmunidad al rickroll",
                        "prompt": "Reflexiona sobre tu nivel de inmunidad y cómo mejorarlo.",
                        "data": {
                            "prompt": (
                                "¿Qué tan vulnerable eres a los cebos en internet? Menciona al menos una "
                                "señal que te haría sospechar de un enlace y un hábito concreto que "
                                "adoptarás para verificar antes de hacer clic. Sé honesto: todos hemos "
                                "caído alguna vez."
                            ),
                            "rubric": [
                                "Identifica señales de un cebo (acortadores, promesas exageradas)",
                                "Propone hábitos de verificación de enlaces",
                                "Evalúa con honestidad su propia conducta en línea",
                            ],
                            "autoGradeKeywords": ["enlace", "verificar", "cebo", "sospechar", "rickroll"],
                        },
                        "points": 15,
                        "difficulty": "medium",
                        "bloomLevel": "evaluate",
                        "assessmentType": "self_reflection",
                        "maxAttempts": 0,
                        "useRubric": True,
                        "objectiveCodes": ["O4"],
                    },
                ],
            },
        ],
    },
]


def _make_activity(lesson, order, atype, title, prompt, data, points=10):
    return Activity.objects.create(
        lesson=lesson, type=atype, title=title, prompt=prompt,
        data=data, points=points, order=order,
    )


# Metadatos opcionales de actividad (clave en UNITS_DATA → campo del modelo)
_ACTIVITY_META_FIELDS = [
    ("difficulty", "difficulty"),
    ("assessment_type", "assessmentType"),
    ("bloom_level", "bloomLevel"),
    ("max_attempts", "maxAttempts"),
    ("mastery_threshold", "masteryThreshold"),
    ("weight", "weight"),
    ("time_limit_min", "timeLimitMin"),
]


class Command(BaseCommand):
    help = "Crea datos demo del piloto Electromedicina II (usuarios, unidades, actividades)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Borra datos existentes antes de sembrar.")

    def handle(self, *args, **options):
        reset = options["reset"]
        if reset:
            self.stdout.write("Borrando datos existentes...")
            StudySession.objects.all().delete()
            Activity.objects.all().delete()
            Lesson.objects.all().delete()
            Unit.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()

        # --- Usuarios demo ---
        # Forzamos siempre una password usable (es un seed demo).
        teacher, _ = User.objects.get_or_create(
            email="hermes.mora@uv.cl",
            defaults={
                "username": "hermes.mora",
                "name": "Prof. Hermes Mora",
                "role": User.ROLE_TEACHER,
                "is_staff": True,
            },
        )
        teacher.set_password("demo1234")
        teacher.save()

        students_data = [
            ("camila.rojas@uv.cl", "Camila Rojas"),
            ("matias.soto@uv.cl", "Matías Soto"),
            ("francisca.diaz@uv.cl", "Francisca Díaz"),
            ("ignacio.munoz@uv.cl", "Ignacio Muñoz"),
        ]
        students = []
        for email, name in students_data:
            s, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": email.split("@")[0],
                    "name": name,
                    "role": User.ROLE_STUDENT,
                },
            )
            s.set_password("demo1234")
            s.save()
            students.append(s)

        self.stdout.write(self.style.SUCCESS(f"Usuarios: 1 docente + {len(students)} estudiantes."))

        # --- Unidades, lecciones, actividades ---
        if Unit.objects.exists() and not reset:
            self.stdout.write("Las unidades ya existen. Usa --reset para recrear.")
        else:
            for idx, ud in enumerate(UNITS_DATA):
                unit = Unit.objects.create(
                    slug=ud["slug"], title=ud["title"], icon=ud["icon"],
                    color=ud["color"], summary=ud["summary"],
                    description=ud["summary"], order=idx,
                    content=ud["content"],
                    diagnostic_questions=ud["diagnostic"],
                )

                # Objetivos de aprendizaje de la unidad
                obj_by_code = {}
                for od in ud.get("objectives", []):
                    obj_by_code[od["code"]] = LearningObjective.objects.create(
                        unit=unit, code=od["code"],
                        description=od["description"],
                        bloom_level=od.get("bloom", "apply"),
                    )

                # Rúbrica de la unidad (para autoevaluaciones)
                rubric = None
                if ud.get("rubric"):
                    rubric = Rubric.objects.create(
                        author=teacher,
                        name=ud["rubric"]["name"],
                        description=ud["rubric"]["description"],
                        criteria=ud["rubric"]["criteria"],
                    )

                for li, ld in enumerate(ud["lessons"]):
                    lesson = Lesson.objects.create(
                        unit=unit,
                        slug=f"{ud['slug']}-l{li+1}",
                        title=ld["title"],
                        description=ld.get("description", ld["title"]),
                        content=ld["content"],
                        duration_min=ld["duration"],
                        order=li,
                    )
                    for ai, ad in enumerate(ld.get("activities", [])):
                        activity = _make_activity(
                            lesson, ai, ad["type"], ad["title"], ad["prompt"],
                            ad["data"], points=ad.get("points", 10),
                        )
                        # Metadatos pedagógicos opcionales
                        for field, key in _ACTIVITY_META_FIELDS:
                            if key in ad:
                                setattr(activity, field, ad[key])
                        if ad.get("useRubric") and rubric:
                            activity.rubric = rubric
                        activity.save()
                        # Vinculación con objetivos de aprendizaje
                        for code in ad.get("objectiveCodes", []):
                            if code in obj_by_code:
                                activity.objectives.get_or_create(
                                    objective_id=obj_by_code[code].id
                                )
            self.stdout.write(self.style.SUCCESS(
                f"Creadas {len(UNITS_DATA)} unidades con lecciones y actividades."
            ))

        # --- Insignias (si no están cargadas vía fixtures) ---
        if not Badge.objects.exists():
            badges_data = [
                ("primer-paso", "Primer Paso", "Footprints", "bronze"),
                ("explorador", "Explorador", "Compass", "bronze"),
                ("racha-7", "Constancia", "Flame", "silver"),
                ("maestro-ecg", "Maestro del ECG", "Award", "gold"),
                ("centinela", "Centinela", "ShieldCheck", "silver"),
            ]
            for slug, name, icon, tier in badges_data:
                Badge.objects.create(slug=slug, name=name, icon=icon, tier=tier)
            self.stdout.write(self.style.SUCCESS("Creadas 5 insignias canónicas."))

        # --- Sesiones de estudio demo (para que el Panel Docente muestre datos) ---
        if not StudySession.objects.exists() and students:
            now = timezone.now()
            for s in students:
                units = list(Unit.objects.all())
                for day_offset in range(7):
                    if random.random() < 0.7:  # 70% de días activos
                        unit = random.choice(units) if units else None
                        StudySession.objects.create(
                            user=s, unit=unit, duration=random.randint(600, 3600),
                            started_at=now - timedelta(days=day_offset, hours=random.randint(0, 8)),
                            is_active=False, ended_at=now - timedelta(days=day_offset),
                        )
            self.stdout.write(self.style.SUCCESS("Creadas sesiones de estudio demo."))

        self.stdout.write(self.style.SUCCESS("\n✅ Seed demo completo."))
        self.stdout.write("  Login docente:   hermes.mora@uv.cl / demo1234")
        self.stdout.write("  Login estudiante: camila.rojas@uv.cl / demo1234")
