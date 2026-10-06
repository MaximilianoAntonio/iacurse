"use client";

/**
 * Consentimiento informado electrónico — obligatorio para estudiantes tras
 * el cambio de contraseña (antes del diagnóstico general del curso).
 *
 * Implementa el formulario "Consentimiento Informado Electrónico para el uso
 * científico de datos académicos" (Universidad de Valparaíso, versión
 * 2026-08-V2) según sus instrucciones:
 *
 * - Seis pantallas centradas, cada una con el texto COMPLETO de su sección.
 * - En TODAS las pantallas hay que esperar 10 segundos antes de poder
 *   interactuar; en las cinco primeras además el estudiante marca
 *   "He leído y comprendido esta información" — parte por parte queda
 *   demostrado que leyó todo antes de continuar.
 * - La última pantalla resume las secciones leídas y muestra la decisión:
 *   Opción 1 (autorizo) despliega las 6 casillas checklist completamente
 *   desmarcadas que deben marcarse individualmente; Opción 2 (no autorizo).
 *   "Registrar mi decisión" está inactivo por defecto.
 *
 * La decisión se registra con la versión del documento, la fecha/hora y el
 * código del estudiante; el profesor no tiene forma técnica de conocerla.
 */

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  Loader2,
  XCircle,
} from "lucide-react";
import { postJSON } from "@/hooks/use-fetch";
import { LogoMark } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/** Segundos de espera obligatoria en CADA pantalla (incluida la decisión). */
const READING_SECONDS = 10;

/** Casillas checklist de la Opción 1 (autorizo), texto del formulario v4. */
const AUTHORIZE_CHECKS = [
  "Declaro que he leído y comprendido la información presentada.",
  "He tenido oportunidad de resolver mis dudas antes de tomar esta decisión.",
  "Comprendo que consentir el uso de mis datos es completamente voluntario y que puedo retirar el consentimiento en cualquier momento.",
  "Entiendo los riesgos y beneficios explicados en la sección anterior.",
  "Entiendo que no se expondrá ningún dato personal.",
  "Entiendo que consentir el uso de mis datos no ofrece riesgos para mi bienestar físico ni emocional.",
];

type Decision = "authorized" | "rejected";

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground/90">
      {items.map((item, idx) => (
        <li key={idx}>{item}</li>
      ))}
    </ul>
  );
}

function Block({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
      {children}
    </section>
  );
}

function MoreInfo({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <span className="font-semibold text-foreground">Más información: </span>
      {children}
    </div>
  );
}

interface ConsentSection {
  title: string;
  body: React.ReactNode;
}

/** Texto COMPLETO de cada pantalla, según el formulario versión 2026-08-V2. */
const SECTIONS: ConsentSection[] = [
  {
    title: "¿Por qué estoy viendo este consentimiento?",
    body: (
      <>
        <p className="text-sm leading-relaxed text-foreground/90">
          Todos los estudiantes utilizarán esta plataforma educativa como parte
          de las actividades pedagógicas de la asignatura. Usted puede decidir
          libremente si autoriza o no que determinados datos académicos
          generados durante el uso de esta plataforma sean utilizados con fines
          de investigación científica.{" "}
          <strong>Su decisión es completamente voluntaria.</strong>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Block title="Si decide autorizar:">
            <BulletList
              items={[
                "Sus datos se tratarán de manera completamente anónima.",
                "No habrá ningún tipo de información que pudiera identificarle.",
                "En vez de su nombre y Rut, habrá un código alfanumérico aleatorio.",
              ]}
            />
          </Block>
          <Block title="Si decide no autorizar:">
            <BulletList
              items={[
                "Seguirá utilizando la plataforma.",
                "Realizará las mismas actividades.",
                "Recibirá la misma retroalimentación.",
                "Se evaluará con los mismos criterios, sin modificar sus calificaciones.",
                "No tendrá actividades adicionales.",
                "No perderá ningún beneficio académico.",
              ]}
            />
          </Block>
        </div>
        <p className="text-sm leading-relaxed text-foreground/90">
          <strong>
            El profesor no tiene forma técnica de conocer la decisión que usted
            tome respecto a esta autorización.
          </strong>
        </p>
        <MoreInfo>
          Este proyecto se desarrolló como un piloto de innovación docente para
          evaluar el funcionamiento de una plataforma educativa con inteligencia
          artificial generativa. La investigación utilizará únicamente los datos
          de quienes autoricen expresamente dicho uso.
        </MoreInfo>
      </>
    ),
  },
  {
    title: "¿Qué datos se utilizarían y para qué?",
    body: (
      <>
        <Block title="Si usted autoriza el uso científico de los datos de esta plataforma, la investigación podría utilizar información como:">
          <BulletList
            items={[
              "Resultados obtenidos en las actividades de la plataforma; progreso de aprendizaje; respuestas entregadas durante las actividades académicas en la plataforma; utilización de recursos de apoyo; registros generales de interacción con la plataforma; respuestas a cuestionarios relacionados con la experiencia de uso.",
              "Su código registrado en la plataforma; fecha y bloque horario general de acceso; actividad realizada; respuesta entregada; tipo de apoyo utilizado; resultado de la actividad; número de intentos; progreso por unidad; reporte voluntario de error; tipo de dispositivo de acceso (pc, móvil); datos técnicos necesarios para seguridad y funcionamiento.",
            ]}
          />
        </Block>
        <Block title="Estos datos se utilizarán únicamente para:">
          <BulletList
            items={[
              "Evaluar el funcionamiento de la plataforma; analizar su utilidad como apoyo al aprendizaje; identificar oportunidades de mejora; desarrollar publicaciones científicas y académicas; mejorar y garantizar la seguridad de la plataforma.",
            ]}
          />
        </Block>
        <Block title="La plataforma no almacenará y no se utilizará su:">
          <BulletList
            items={["Nombre.", "RUT.", "Correo institucional.", "Número de matrícula."]}
          />
        </Block>
        <p className="text-sm leading-relaxed text-foreground/90">
          Toda la información recolectada se tratará de forma completamente
          anónima. Los resultados se publicarán únicamente de manera agrupada,
          sin identificar a ningún estudiante.
        </p>
        <MoreInfo>
          Para la investigación NO se utilizarán datos biométricos, su ubicación
          geográfica, su historial de navegación, grabaciones de pantalla,
          información de otras aplicaciones ni otros datos personales que no
          sean necesarios para los objetivos del estudio.
        </MoreInfo>
      </>
    ),
  },
  {
    title: "¿Cómo se protegerá mi identidad?",
    body: (
      <>
        <p className="text-sm leading-relaxed text-foreground/90">
          Para proteger su privacidad se utilizará un sistema de anonimización
          basado en <strong>dos códigos</strong>.
        </p>
        <p className="text-sm leading-relaxed text-foreground/90">
          En esta plataforma usted está registrado con un primer código,
          conocido únicamente por el profesor. Si usted acepta consentir el uso
          científico de los datos, se generará un{" "}
          <strong>segundo código aleatorio</strong> conocido únicamente por el
          coinvestigador. La base de datos no tendrá ningún dato personal suyo
          que pudiera identificarle.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Block title="El profesor de la asignatura:">
            <BulletList
              items={[
                "Conocerá únicamente su identidad y el primer código.",
                "No conocerá el segundo código y tampoco conocerá si usted autorizó o no autorizó el uso científico de los datos.",
              ]}
            />
          </Block>
          <Block title="El coinvestigador:">
            <BulletList
              items={[
                "Conocerá únicamente el primer código y el segundo código.",
                "No conocerá su nombre; su RUT; su correo institucional ni su número de matrícula.",
              ]}
            />
          </Block>
        </div>
        <MoreInfo>
          La relación entre los dos códigos se gestionará mediante herramientas
          de la cuenta Institucional Microsoft 365 y están protegidos con
          permisos separados exclusivos.
        </MoreInfo>
      </>
    ),
  },
  {
    title: "¿Existen riesgos o beneficios?",
    body: (
      <>
        <Block title="Beneficios:">
          <p className="text-sm leading-relaxed text-foreground/90">
            Su autorización permitirá generar evidencia científica que contribuya
            al mejoramiento de la plataforma como herramienta educativa para
            fortalecer las actividades educativas personalizadas y obtener
            retroalimentación según las dificultades en el aprendizaje.
          </p>
          <BulletList
            items={[
              "Usted no recibirá: dinero; bonificaciones; décimas; puntos adicionales; beneficios académicos especiales por autorizar el uso científico de los datos.",
            ]}
          />
        </Block>
        <Block title="Riesgos:">
          <p className="text-sm leading-relaxed text-foreground/90">
            Consentir el uso de sus datos de la plataforma no presenta riesgo
            físico ni psicológico.
          </p>
          <BulletList
            items={["Hay un riesgo muy bajo de reidentificación de los datos."]}
          />
        </Block>
        <Block title="Para disminuir estos riesgos:">
          <BulletList
            items={[
              "Cada fila de la base de datos científica tiene un código aleatorio generado automáticamente.",
            ]}
          />
        </Block>
        <MoreInfo>
          La Inteligencia Artificial constituye únicamente un apoyo al
          aprendizaje y no reemplaza al profesor. Las decisiones académicas, las
          evaluaciones y las calificaciones continuarán siendo responsabilidad
          exclusiva del docente.
        </MoreInfo>
      </>
    ),
  },
  {
    title: "¿Cuáles son mis derechos?",
    body: (
      <>
        <p className="text-sm leading-relaxed text-foreground/90">
          Autorizar el uso científico de sus datos es{" "}
          <strong>completamente voluntario</strong>.
        </p>
        <BulletList
          items={[
            "El/la estudiante puede: autorizar o no autorizar; realizar consultas; solicitar aclaraciones; presentar observaciones al Comité de Ética de la Facultad de Ingeniería (cec.facing@uv.cl).",
            "El/la estudiante puede retirar su autorización hasta antes de finalizar el semestre académico (diciembre 11 de 2026).",
            "Si posteriormente decide retirar su autorización: continuará utilizando normalmente la plataforma; continuará desarrollando las actividades de la asignatura; continuará siendo evaluado exactamente igual que el resto de sus compañeros/as.",
          ]}
        />
        <p className="text-sm leading-relaxed text-foreground/90">
          <strong>Su decisión no será conocida por el profesor.</strong>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Block title="Investigador responsable">
            <p className="text-sm leading-relaxed text-foreground/90">
              Dr. Hermes Javier Mora
              <br />
              hermes.mora@uv.cl · (32) 2603705
            </p>
          </Block>
          <Block title="Coinvestigador">
            <p className="text-sm leading-relaxed text-foreground/90">
              Dr. David Ortiz Puerta
              <br />
              david.ortiz@uv.cl · (32) 2603657
            </p>
          </Block>
        </div>
        <MoreInfo>
          Si posteriormente desea retirar su autorización podrá hacerlo mediante
          el procedimiento descrito en este consentimiento. El retiro no
          afectará ninguna actividad académica ya realizada ni las calificaciones
          obtenidas.
        </MoreInfo>
      </>
    ),
  },
];

const TOTAL_SCREENS = SECTIONS.length + 1; // 5 informativas + decisión

interface ConsentViewProps {
  onCompleted: () => void;
}

export function ConsentView({ onCompleted }: ConsentViewProps) {
  const [screen, setScreen] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(READING_SECONDS);
  // Confirmación de lectura parte por parte (pantallas 1 a 5).
  const [readConfirmations, setReadConfirmations] = useState<boolean[]>(
    SECTIONS.map(() => false)
  );
  const [decision, setDecision] = useState<Decision | null>(null);
  const [checks, setChecks] = useState<boolean[]>(
    AUTHORIZE_CHECKS.map(() => false)
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isDecisionScreen = screen === TOTAL_SCREENS;
  const section = SECTIONS[screen - 1];
  const readConfirmed = readConfirmations[screen - 1] === true;

  // Espera obligatoria de 10 s en TODAS las pantallas (incluida la decisión).
  // El reseteo al cambiar de pantalla usa el patrón "ajustar estado durante
  // el render" (como en use-fetch.ts); el efecto solo arma el intervalo.
  const [prevScreen, setPrevScreen] = useState(screen);
  if (screen !== prevScreen) {
    setPrevScreen(screen);
    setSecondsLeft(READING_SECONDS);
  }
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [screen]);

  const allChecked = checks.every(Boolean);
  const canRegister =
    secondsLeft === 0 &&
    (decision === "rejected" || (decision === "authorized" && allChecked));

  const handleSubmit = async () => {
    if (!decision || !canRegister) return;
    setError(null);
    setLoading(true);
    try {
      await postJSON("/api/course/consent", { decision });
      onCompleted();
    } catch (err) {
      // 409: la decisión ya estaba registrada (p. ej. doble pestaña) → avanzar.
      if (err instanceof Error && err.message.includes("ya fue registrada")) {
        onCompleted();
        return;
      }
      setError(
        err instanceof Error ? err.message : "No se pudo registrar su decisión."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center overflow-y-auto bg-background p-6">
      {/* Columna centrada: el consentimiento es el único foco */}
      <div className="w-full max-w-3xl space-y-5 py-6 animate-fade-in-up">
        {/* Marca centrada */}
        <div className="flex flex-col items-center gap-2 text-center">
          <LogoMark className="h-11 w-11 shadow-sm" />
          <span className="font-display text-lg font-bold tracking-tight">
            CAAMI
          </span>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            Consentimiento informado electrónico para el uso científico de datos
            académicos · Universidad de Valparaíso · Versión 2026-08-V2
          </p>
        </div>

        {/* Progreso: pantalla N de 6 */}
        <div className="space-y-2">
          <p className="text-center text-xs font-medium text-muted-foreground">
            Pantalla {screen} de {TOTAL_SCREENS}
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_SCREENS }, (_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  idx + 1 <= screen ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        {!isDecisionScreen ? (
          /* ---------- Pantallas informativas (1 a 5) ---------- */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <h2 className="font-display text-title font-semibold">
                {section.title}
              </h2>
            </div>

            {/* Texto completo de la sección */}
            <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
              {section.body}
            </div>

            {/* Confirmación de lectura de ESTA sección: se habilita a los 10 s */}
            <label
              className={cn(
                "flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm transition-colors",
                secondsLeft > 0
                  ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground"
                  : "cursor-pointer border-primary/40 bg-primary/5 font-medium text-foreground"
              )}
            >
              <input
                type="checkbox"
                disabled={secondsLeft > 0}
                checked={readConfirmed}
                onChange={(e) =>
                  setReadConfirmations((prev) =>
                    prev.map((c, i) => (i === screen - 1 ? e.target.checked : c))
                  )
                }
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span>
                He leído y comprendido esta información
                {secondsLeft > 0 && ` (disponible en ${secondsLeft} s)`}
              </span>
            </label>

            <div className="flex items-center justify-between">
              {screen > 1 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setScreen((s) => s - 1)}
                  className="gap-1.5 text-muted-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Atrás
                </Button>
              ) : (
                <span />
              )}
              <Button
                size="lg"
                disabled={secondsLeft > 0 || !readConfirmed}
                onClick={() => setScreen((s) => s + 1)}
                className="min-w-44 font-semibold"
              >
                {secondsLeft > 0 ? `Continuar (${secondsLeft} s)` : "Continuar"}
              </Button>
            </div>
          </div>
        ) : (
          /* ---------- Pantalla 6: resumen de lectura + decisión ---------- */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <h2 className="font-display text-title font-semibold">
                Su decisión
              </h2>
            </div>

            <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
              {/* Resumen: el estudiante confirmó la lectura de cada sección */}
              <div>
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Usted confirmó haber leído y comprendido
                </p>
                <ul className="space-y-1.5">
                  {SECTIONS.map((s, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-2 text-sm text-foreground/90"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{s.title}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-sm leading-relaxed text-foreground/90">
                  La plataforma registrará electrónicamente su decisión
                  utilizando únicamente el primer código con el que usted
                  ingresó. Este registro constituye la evidencia del
                  consentimiento informado para efectos de esta investigación.
                </p>
                <p className="text-sm leading-relaxed text-foreground/90">
                  Al seleccionar una de las siguientes opciones y presionar el
                  botón &quot;Registrar mi decisión&quot;, su decisión quedará
                  registrada electrónicamente. El registro incluirá únicamente:
                </p>
                <BulletList
                  items={[
                    "Versión del consentimiento.",
                    "Fecha y hora del registro.",
                    "Código con el cual se registró en la plataforma.",
                  ]}
                />
              </div>
            </div>

            {/* La decisión se habilita tras la espera obligatoria de 10 s */}
            <fieldset disabled={secondsLeft > 0} className="space-y-3">
              {secondsLeft > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  Podrá seleccionar su decisión en {secondsLeft} s
                </p>
              )}
              <RadioGroup
                value={decision ?? ""}
                onValueChange={(v) => setDecision(v as Decision)}
                className="space-y-3"
              >
                {/* Opción 1: autorizo + checklist de confirmación individual */}
                <div
                  className={cn(
                    "space-y-3 rounded-xl border bg-card p-5 shadow-sm transition-colors",
                    decision === "authorized" ? "border-primary" : "border-border"
                  )}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <RadioGroupItem value="authorized" className="mt-1" />
                    <span className="text-sm font-medium leading-relaxed">
                      <strong>Opción 1 — Autorizo</strong> el uso científico de
                      los datos académicos generados durante mi utilización de
                      la plataforma educativa para el proyecto de investigación
                      descrito.
                    </span>
                  </label>
                  {decision === "authorized" && (
                    <div className="space-y-2.5 border-t border-border pt-3 animate-fade-in">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Lea y marque cada casilla individualmente
                      </p>
                      {AUTHORIZE_CHECKS.map((text, idx) => (
                        <label
                          key={idx}
                          className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-foreground/90"
                        >
                          <input
                            type="checkbox"
                            checked={checks[idx]}
                            onChange={(e) =>
                              setChecks((prev) =>
                                prev.map((c, i) => (i === idx ? e.target.checked : c))
                              )
                            }
                            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                          />
                          <span>{text}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Opción 2: no autorizo */}
                <div
                  className={cn(
                    "rounded-xl border bg-card p-5 shadow-sm transition-colors",
                    decision === "rejected" ? "border-primary" : "border-border"
                  )}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <RadioGroupItem value="rejected" className="mt-1" />
                    <span className="text-sm font-medium leading-relaxed">
                      <strong>Opción 2 — No autorizo</strong> el uso científico
                      de los datos académicos generados durante mi utilización
                      de la plataforma educativa.
                    </span>
                  </label>
                </div>
              </RadioGroup>
            </fieldset>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-fade-in"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScreen((s) => s - 1)}
                className="gap-1.5 text-muted-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Atrás
              </Button>
              <Button
                size="lg"
                disabled={loading || !canRegister}
                onClick={handleSubmit}
                className="min-w-56 font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registrando…
                  </>
                ) : secondsLeft > 0 ? (
                  `Registrar mi decisión (${secondsLeft} s)`
                ) : (
                  "Registrar mi decisión"
                )}
              </Button>
            </div>
            {secondsLeft === 0 && !canRegister && (
              <p className="text-right text-xs text-muted-foreground">
                {decision === "authorized"
                  ? "Marque todas las casillas de confirmación para registrar su decisión."
                  : "Seleccione una opción para registrar su decisión."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
