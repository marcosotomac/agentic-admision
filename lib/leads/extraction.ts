import { createOpenAIClient, getOpenAIAnswerModel } from "@/lib/server/openai"
import type { RecentConversationMessage } from "@/lib/rag/conversation"
import type { LeadCapture, LeadFields } from "./scoring"
import { hasMeaningfulLeadFields } from "./scoring"

type ExtractLeadCaptureParams = {
  message: string
  leadDraft?: LeadFields
  history?: RecentConversationMessage[]
}

const commercialIntentTerms = [
  "admision",
  "admisión",
  "postular",
  "inscribir",
  "inscripcion",
  "inscripción",
  "matricula",
  "matrícula",
  "pension",
  "pensión",
  "precio",
  "costo",
  "costos",
  "beca",
  "financiamiento",
  "horario",
  "modalidad",
  "inicio",
  "vacante",
  "asesor",
  "contacto",
  "llamar",
  "whatsapp",
  "quiero estudiar",
  "quiero que me contacten",
  "colegio",
  "universidad",
  "instituto",
  "campus",
]

const urgencyTerms = [
  "admision",
  "admisión",
  "postular",
  "inscribir",
  "inscripcion",
  "inscripción",
  "matricula",
  "matrícula",
  "pension",
  "pensión",
  "precio",
  "costo",
  "costos",
  "horario",
  "modalidad",
  "inicio",
  "empieza",
  "vacante",
]

const humanContactTerms = [
  "asesor",
  "contacto",
  "contacten",
  "llamar",
  "llamen",
  "whatsapp",
]

const informationalTerms = [
  "información",
  "informacion",
  "qué",
  "que",
  "cuál",
  "cual",
  "cómo",
  "como",
]

export function extractLeadCaptureHeuristically(
  params: ExtractLeadCaptureParams
): LeadCapture {
  const normalizedMessage = normalizeForMatching(params.message)
  const extractedFields = extractFields(params.message)
  const fields = mergeLeadFields(extractedFields, params.leadDraft)
  const hasFields = hasMeaningfulLeadFields(fields)
  const commercialSignals = commercialIntentTerms.filter((term) =>
    normalizedMessage.includes(term)
  )
  const urgencySignals = urgencyTerms.filter((term) =>
    normalizedMessage.includes(term)
  )
  const humanContactSignals = humanContactTerms.filter((term) =>
    normalizedMessage.includes(term)
  )
  const commercialIntent =
    commercialSignals.length > 0 || humanContactSignals.length > 0
  const informationalOnly =
    !commercialIntent &&
    !hasFields &&
    informationalTerms.some((term) => normalizedMessage.includes(term))

  return {
    fields,
    commercialIntent,
    urgencyIntent: urgencySignals.length > 0,
    requestedHumanContact: humanContactSignals.length > 0,
    informationalOnly,
    intentSignals: Array.from(
      new Set([...commercialSignals, ...urgencySignals, ...humanContactSignals])
    ),
  }
}

export async function extractLeadCapture(
  params: ExtractLeadCaptureParams
): Promise<LeadCapture> {
  try {
    const openai = createOpenAIClient()

    const historyText =
      params.history && params.history.length > 0
        ? params.history
            .map(
              (msg) =>
                `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`
            )
            .join("\n")
        : "Ninguno (inicio de la conversación)"

    const existingFieldsText =
      params.leadDraft && Object.keys(params.leadDraft).length > 0
        ? JSON.stringify(params.leadDraft, null, 2)
        : "Ninguno"

    const systemPrompt = `Eres un extractor de datos semántico de leads para admisiones de la Universidad San Ignacio de Loyola (USIL).
Tu tarea es analizar el último mensaje del usuario, considerando el historial de chat y los datos existentes del perfil, para extraer campos de información y clasificar intenciones.

Campos posibles a extraer (extrae solo si el usuario los especifica, corrige o confirma en su último mensaje en base al contexto):
- name: Nombre de pila del estudiante.
- lastName: Apellido(s) del estudiante.
- age: Edad del estudiante (solo número, ej. "18").
- email: Correo electrónico del estudiante.
- phone: Celular o número de teléfono del estudiante (solo dígitos).
- program: Carrera de interés (ej. "Marketing", "Ingeniería de Sistemas").
- faculty: Facultad de interés (ej. "Ingeniería", "Ciencias Empresariales", "Ciencias de la Salud", "Arquitectura").
- currentStatus: Situación académica ("School student" para alumno escolar, "School graduate" para egresado escolar, "Transfer student" para traslado de otra universidad/instituto).
- school: Nombre del colegio.
- originInstitution: Colegio, instituto o universidad de origen.
- graduationYear: Año de egreso escolar (ej. "2025").
- currentUniversity: Universidad actual (si es traslado).
- city: Ciudad de residencia.
- country: País de residencia.
- modality: Modalidad de estudio preferida (ej. "Presencial", "Semipresencial", "Virtual").
- campus: Campus preferido (ej. "La Molina", "Lima Norte", "San Isidro").
- schedule: Horario preferido (ej. "mañana", "tarde", "noche", "fin de semana").
- budget: Presupuesto o dudas sobre becas (ej. "Needs scholarship or financing guidance", "Cost concern", o un monto de soles).
- urgency: Urgencia de postulación (ej. "As soon as possible", "Immediate", "Current intake", "Upcoming intake").
- objections: Objeciones mencionadas (ej. "Cost concern", "Distance concern", "Schedule concern", "Decision uncertainty").
- interestLevel: Nivel de interés aparente ("High" para deseos de inscripción, "Medium" para evaluando opciones, "Low" para solo curioseando).

Clasificación de intenciones:
- commercialIntent: true si el usuario muestra interés en postular, inscribirse, precios, becas, costos, o iniciar el proceso de admisión.
- urgencyIntent: true si quiere comenzar de inmediato o en la próxima convocatoria.
- requestedHumanContact: true si pide hablar con un asesor humano, que lo llamen o whatsapp.
- informationalOnly: true si la consulta es netamente de carácter informativo/institucional (ej. historia de la u) sin mostrar intención comercial de admisión en este mensaje.
- intentSignals: lista de palabras clave o conceptos cortos que delatan la intención (ej. ["carrera", "costos", "inscripcion"]).

Instrucciones críticas:
1. No inventes datos. Si un dato no se menciona ni se deduce inequívocamente del último mensaje usando el contexto, no lo incluyas en "fields".
2. Si el usuario corrige un dato previo (ej. "Mejor Sistemas en lugar de Marketing"), colócalo en "fields" para actualizar el perfil.
3. El objeto "fields" debe contener únicamente los campos agregados, confirmados o corregidos en este último turno.
4. Deducción automática de país: Si el usuario indica que está en "Lima" (o cualquier otra ciudad conocida de Perú) y el país no se ha especificado, deduce automáticamente que el país de residencia es "Perú".
5. Responde ÚNICAMENTE con un objeto JSON válido. No uses bloques de código (markdown), no agregues texto antes ni después.

Historial de la conversación:
${historyText}

Datos del perfil ya conocidos antes de este turno:
${existingFieldsText}

Último mensaje del usuario a analizar:
"${params.message}"`

    const response = await openai.responses.create({
      model: getOpenAIAnswerModel(),
      instructions: "Return JSON representation only.",
      input: [
        {
          role: "system" as const,
          content: systemPrompt,
        },
        {
          role: "user" as const,
          content: params.message,
        },
      ],
      max_output_tokens: 600,
    })

    const outputText = response.output_text.trim()
    const jsonStr = outputText
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "")
      .trim()
    const result = JSON.parse(jsonStr)

    if (result && typeof result === "object") {
      const fields = (result.fields ?? {}) as LeadFields
      const mergedFields = compactFields({ ...fields, ...params.leadDraft })

      // Deducción automática programática de salvaguarda
      if (mergedFields.city === "Lima" && !mergedFields.country) {
        mergedFields.country = "Perú"
      }

      return {
        fields: mergedFields,
        commercialIntent: Boolean(result.commercialIntent),
        urgencyIntent: Boolean(result.urgencyIntent),
        requestedHumanContact: Boolean(result.requestedHumanContact),
        informationalOnly: Boolean(result.informationalOnly),
        intentSignals: Array.isArray(result.intentSignals)
          ? result.intentSignals.map(String)
          : [],
      }
    }
    throw new Error("Invalid format from LLM lead extractor")
  } catch (error) {
    console.error(
      "OpenAI lead extraction failed, falling back to heuristics:",
      error
    )
    return extractLeadCaptureHeuristically(params)
  }
}

function extractFields(message: string): LeadFields {
  const age = extractAge(message)
  const nameParts = extractNameParts(message)
  const school = extractSchool(message)
  const currentUniversity = extractCurrentUniversity(message)
  const graduationYear = extractGraduationYear(message)
  const originInstitution = extractOriginInstitution(message, {
    school,
    currentUniversity,
  })

  return compactFields({
    name: nameParts.name,
    lastName: nameParts.lastName ?? extractLastName(message),
    age,
    originInstitution,
    school,
    graduationYear,
    currentUniversity,
    currentStatus: extractCurrentStatus(message, {
      age,
      originInstitution,
      school,
      currentUniversity,
      graduationYear,
    }),
    city: extractCity(message),
    country: extractCountry(message),
    email: extractEmail(message),
    phone: extractPhone(message),
    faculty: extractFaculty(message),
    program: extractProgram(message),
    modality: extractModality(message),
    campus: extractCampus(message),
    schedule: extractSchedule(message),
    budget: extractBudget(message),
    urgency: extractUrgency(message),
    objections: extractObjections(message),
    interestLevel: extractInterestLevel(message),
  })
}

function mergeLeadFields(
  extractedFields: LeadFields,
  leadDraft?: LeadFields
): LeadFields {
  return compactFields({
    ...extractedFields,
    ...leadDraft,
  })
}

function extractEmail(message: string) {
  return message
    .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
    ?.toLowerCase()
}

function extractPhone(message: string) {
  const candidates = message.match(/\+?\d[\d\s().-]{5,}\d/g) ?? []
  const phone = candidates.find(
    (candidate) => candidate.replace(/\D/g, "").length >= 7
  )

  if (!phone) {
    return undefined
  }

  const normalizedDigits = phone.replace(/(?!^)\D/g, "").trim()

  return normalizedDigits || undefined
}

function extractNameParts(message: string): {
  name?: string
  lastName?: string
} {
  const explicitName = message.match(
    /(?:me llamo|mi nombre es)\s+([^,.?;!\n\d]{2,80})/iu
  )?.[1]
  const shortIntroName = message.match(
    /\bsoy\s+(?!de\b|del\b|la\b|el\b|estudiante\b|egresad[oa]\b|traslad[oa]\b|colegio\b|universidad\b|instituto\b)([^,.?;!\n\d]{2,60})/iu
  )?.[1]
  const candidate = cleanHumanText(explicitName ?? shortIntroName)

  if (!candidate || looksLikeNonName(candidate)) {
    return {}
  }

  const parts = candidate.split(/\s+/).filter(Boolean)
  const [firstName, ...lastNameParts] = parts

  return compactFields({
    name: titleCaseHumanValue(firstName),
    lastName: titleCaseHumanValue(lastNameParts.join(" ")),
  })
}

function extractLastName(message: string) {
  const explicitLastName = message.match(
    /(?:mi\s+apellido\s+es|apellido\s*:?)\s+([^,.?;!\n\d]{2,80})/iu
  )?.[1]

  return titleCaseHumanValue(cleanHumanText(explicitLastName))
}

function extractAge(message: string) {
  const ageText = message.match(
    /\b(?:tengo|edad\s*:?)\s*(1[4-9]|[2-6][0-9])\s*(?:años|anos)?\b/iu
  )?.[1]

  return ageText
}

function extractSchool(message: string) {
  const patterns = [
    /\b(?:soy|vengo|estudio|estoy)\s+(?:del|de\s+el)\s+colegio\s+([^,.?;!\n]{2,80})/iu,
    /\b(?:estudio|estoy|voy)\s+en\s+(?:el\s+)?colegio\s+([^,.?;!\n]{2,80})/iu,
    /\bcolegio\s+([^,.?;!\n]{2,80})/iu,
  ]
  const match = patterns
    .map((pattern) => message.match(pattern)?.[1])
    .find(Boolean)

  return titleCaseHumanValue(cleanHumanText(match))
}

function extractCurrentUniversity(message: string) {
  const patterns = [
    /\b(?:estudio|curso|estoy|vengo|soy)\s+(?:en|de|desde)\s+(?:la\s+)?universidad\s+([^,.?;!\n]{2,90})/iu,
    /\b(?:traslado|trasladarme|trasladarme\s+desde)\s+(?:de|desde)\s+(?:la\s+)?universidad\s+([^,.?;!\n]{2,90})/iu,
    /\buniversidad\s+([^,.?;!\n]{2,90})/iu,
  ]
  const match = patterns
    .map((pattern) => message.match(pattern)?.[1])
    .find(Boolean)
  const university = titleCaseHumanValue(cleanHumanText(match))

  return university ? formatUniversityName(university) : undefined
}

function extractOriginInstitution(
  message: string,
  facts: { school?: string; currentUniversity?: string }
) {
  if (facts.school) {
    return facts.school
  }

  if (facts.currentUniversity) {
    return facts.currentUniversity
  }

  const match = message.match(/\b(?:instituto)\s+([^,.?;!\n]{2,80})/iu)?.[1]

  return titleCaseHumanValue(cleanHumanText(match))
}

function extractGraduationYear(message: string) {
  return message.match(
    /\b(?:promoci[oó]n|egres[ée]|egreso|termin[ée]|acabo|acabe|acab[ée]).{0,18}\b(20[1-3][0-9])\b/iu
  )?.[1]
}

function extractProgram(message: string) {
  const explicitMatch = message.match(
    /(?:carrera|programa|quiero estudiar|me interesa|interesado en|interesada en|postular a|estudiar)\s+(?:de\s+|la\s+|el\s+)?([^,.?;!\n]{3,90})/iu
  )?.[1]
  const directCareerMatch = message.match(
    /\b(?:quiero|busco|quisiera|me gustar[ií]a)\s+(?:estudiar\s+)?((?:ingenier[ií]a|administraci[oó]n|medicina|psicolog[ií]a|derecho|arquitectura|comunicaci[oó]n|marketing|negocios|econom[ií]a|educaci[oó]n|gastronom[ií]a|dise[ñn]o|contabilidad|finanzas|sistemas|software)[^,.?;!\n]{0,80})/iu
  )?.[1]

  return titleCaseHumanValue(cleanHumanText(explicitMatch ?? directCareerMatch))
}

function extractFaculty(message: string) {
  const explicitFaculty = message.match(
    /\bfacultad\s+(?:de\s+)?([^,.?;!\n]{3,90})/iu
  )?.[1]
  const normalizedMessage = normalizeForMatching(message)

  if (explicitFaculty) {
    return titleCaseHumanValue(cleanHumanText(explicitFaculty))
  }

  if (/\bingenieria\b|\bsistemas\b|\bsoftware\b/.test(normalizedMessage)) {
    return "Ingeniería"
  }

  if (
    /\bnegocios\b|\badministracion\b|\bmarketing\b|\beconomia\b|\bfinanzas\b/.test(
      normalizedMessage
    )
  ) {
    return "Ciencias Empresariales"
  }

  if (/\bmedicina\b|\bsalud\b|\bpsicologia\b/.test(normalizedMessage)) {
    return "Ciencias de la Salud"
  }

  if (/\barquitectura\b/.test(normalizedMessage)) {
    return "Arquitectura"
  }

  return undefined
}

function extractCity(message: string) {
  const match = message.match(
    /\b(?:vivo|resido|estoy)\s+en\s+([^,.?;!\n]{2,60})|\bsoy\s+de\s+(?!l\s+colegio\b|la\s+universidad\b|un\s+instituto\b|el\s+instituto\b)([^,.?;!\n]{2,60})/iu
  )
  const city = titleCaseHumanValue(cleanHumanText(match?.[1] ?? match?.[2]))

  return city && isKnownCountry(city) ? undefined : city
}

function extractCountry(message: string) {
  const explicitCountry = message.match(
    /\b(?:pa[ií]s|pais|country)\s*:?\s*([^,.?;!\n]{2,60})|\b(?:soy|vengo|vivo)\s+de\s+([^,.?;!\n]{2,60})/iu
  )
  const candidate = titleCaseHumanValue(
    cleanHumanText(explicitCountry?.[1] ?? explicitCountry?.[2])
  )

  if (candidate && isKnownCountry(candidate)) {
    return normalizeCountryName(candidate)
  }

  const normalizedMessage = normalizeForMatching(message)
  const knownCountry = knownCountries.find((country) =>
    normalizedMessage.includes(country.normalized)
  )

  return knownCountry?.label
}

function extractModality(message: string) {
  const normalizedMessage = normalizeForMatching(message)

  if (
    /\b(semipresencial|semi presencial|hibrida|híbrida)\b/.test(
      normalizedMessage
    )
  ) {
    return "Semipresencial"
  }

  if (/\b(virtual|online|remota|a distancia)\b/.test(normalizedMessage)) {
    return "Virtual"
  }

  if (/\b(presencial)\b/.test(normalizedMessage)) {
    return "Presencial"
  }

  const admissionModalities: Array<[RegExp, string]> = [
    [/\bprimeros puestos\b/, "Primeros puestos"],
    [/\bquinto superior\b/, "Quinto Superior"],
    [/\btercio superior\b/, "Tercio Superior"],
    [/\bdeportista destacado\b/, "Deportista Destacado"],
    [/\bbachillerato internacional\b/, "Bachillerato Internacional"],
    [/\btraslado externo\b|\btraslado\b/, "Traslado Externo"],
    [/\bregular\b/, "Regular"],
  ]
  const match = admissionModalities.find(([pattern]) =>
    pattern.test(normalizedMessage)
  )

  return match?.[1]
}

function extractCampus(message: string) {
  const explicitCampus = message.match(
    /\b(?:campus|sede)\s+([^,.?;!\n]{2,60})/iu
  )?.[1]
  const knownCampus = message.match(
    /\b(la molina|lima norte|magdalena|pachacamac|pachacámac|san isidro)\b/iu
  )?.[1]

  return titleCaseHumanValue(cleanHumanText(explicitCampus ?? knownCampus))
}

function extractCurrentStatus(
  message: string,
  facts: {
    age?: string
    originInstitution?: string
    school?: string
    currentUniversity?: string
    graduationYear?: string
  }
) {
  const normalizedMessage = normalizeForMatching(message)
  const age = facts.age ? Number(facts.age) : null
  const graduationYear = facts.graduationYear
    ? Number(facts.graduationYear)
    : null

  if (
    facts.currentUniversity ||
    /\b(traslado|trasladarme|vengo de otra universidad|otra universidad|instituto)\b/.test(
      normalizedMessage
    )
  ) {
    return "Transfer student"
  }

  if (
    /\b(egresado|egresada|termine el colegio|terminé el colegio|acabe el colegio|acabé el colegio)\b/.test(
      normalizedMessage
    )
  ) {
    return "School graduate"
  }

  if (
    facts.school ||
    /\b(colegio|secundaria|5to|quinto|4to|cuarto)\b/.test(normalizedMessage)
  ) {
    return "School student"
  }

  if (graduationYear && graduationYear >= new Date().getFullYear()) {
    return "School student"
  }

  if (graduationYear && graduationYear < new Date().getFullYear()) {
    return "School graduate"
  }

  if (age && age <= 17) {
    return "School student"
  }

  if (facts.originInstitution && /colegio/i.test(facts.originInstitution)) {
    return "School student"
  }

  return undefined
}

function extractSchedule(message: string) {
  const normalizedMessage = normalizeForMatching(message)
  const scheduleSignals = [
    "mañana",
    "manana",
    "tarde",
    "noche",
    "fin de semana",
  ]
  const schedule = scheduleSignals.find((signal) =>
    normalizedMessage.includes(signal)
  )

  return schedule ? cleanHumanText(schedule) : undefined
}

function extractBudget(message: string) {
  const normalizedMessage = normalizeForMatching(message)
  const explicitBudget = message.match(
    /\b(?:presupuesto|puedo\s+pagar|pagar[ií]a|mensualidad|pensi[oó]n)\s*(?:es|de|hasta|m[aá]ximo|:)?\s*(s\/?\s*)?(\d{3,5})(?:\s*(?:soles|s\/))?/iu
  )

  if (explicitBudget?.[2]) {
    return `${explicitBudget[2]} soles`
  }

  if (
    /\b(beca|becas|financiamiento|credito|creditos)\b/.test(normalizedMessage)
  ) {
    return "Needs scholarship or financing guidance"
  }

  if (/\b(no puedo pagar|muy caro|caro|costoso)\b/.test(normalizedMessage)) {
    return "Cost concern"
  }

  return undefined
}

function extractUrgency(message: string) {
  const normalizedMessage = normalizeForMatching(message)
  const urgencySignals: Array<[RegExp, string]> = [
    [/\b(lo antes posible|cuanto antes|urgente)\b/, "As soon as possible"],
    [/\b(ya|ahora|de una vez)\b/, "Immediate"],
    [/\b(este ciclo|este semestre|este a[nñ]o)\b/, "Current intake"],
    [/\b(pronto|proxima admision|proxima convocatoria)\b/, "Upcoming intake"],
  ]

  return urgencySignals.find(([pattern]) =>
    pattern.test(normalizedMessage)
  )?.[1]
}

function extractObjections(message: string) {
  const normalizedMessage = normalizeForMatching(message)
  const objectionSignals: Array<[RegExp, string]> = [
    [/\b(caro|costoso|no puedo pagar|pension|pensiones)\b/, "Cost concern"],
    [/\b(lejos|distancia|traslado|movilidad)\b/, "Distance concern"],
    [/\b(trabajo|horario|tiempo|no tengo tiempo)\b/, "Schedule concern"],
    [
      /\b(no estoy seguro|no se|duda|dudas|indeciso|indecisa)\b/,
      "Decision uncertainty",
    ],
    [/\b(mis papas|mis padres|mi familia)\b/, "Family decision influence"],
  ]

  const objections = objectionSignals
    .filter(([pattern]) => pattern.test(normalizedMessage))
    .map(([, label]) => label)

  return objections.length
    ? Array.from(new Set(objections)).join(", ")
    : undefined
}

function extractInterestLevel(message: string) {
  const normalizedMessage = normalizeForMatching(message)

  if (
    /\b(quiero inscribirme|quiero postular|postular|matricularme|me quiero matricular|quiero estudiar)\b/.test(
      normalizedMessage
    )
  ) {
    return "High"
  }

  if (/\b(me interesa|estoy evaluando|me gustaria)\b/.test(normalizedMessage)) {
    return "Medium"
  }

  if (
    /\b(solo estoy mirando|solo quiero informacion|por ahora solo)\b/.test(
      normalizedMessage
    )
  ) {
    return "Low"
  }

  return undefined
}

function looksLikeNonName(value: string) {
  const normalizedValue = normalizeForMatching(value)

  return /\b(colegio|universidad|instituto|estudiante|egresado|egresada|traslado|carrera|programa)\b/.test(
    normalizedValue
  )
}

function cleanHumanText(value?: string) {
  const cleaned = value
    ?.replace(/\s+/g, " ")
    .replace(
      /\b(y\s+tengo|tengo|y\s+soy|soy\s+de|vivo\s+en|estudio\s+en|quiero\s+saber|quiero\s+inscribirme|me\s+interesa|en\s+usil|por\s+favor|gracias)\b.*$/iu,
      ""
    )
    .replace(/\b(?:del|de\s+el)\s+colegio\b.*$/iu, "")
    .trim()

  return cleaned || undefined
}

function titleCaseHumanValue(value?: string) {
  return value
    ?.split(" ")
    .map((word, index) => {
      const normalizedWord = word.toLowerCase()

      if (
        index > 0 &&
        ["de", "del", "la", "las", "los", "y", "e"].includes(normalizedWord)
      ) {
        return normalizedWord
      }

      return `${normalizedWord.charAt(0).toUpperCase()}${normalizedWord.slice(1)}`
    })
    .join(" ")
}

function formatUniversityName(value: string) {
  if (value.startsWith("De ")) {
    return `Universidad de ${value.slice(3)}`
  }

  if (value.startsWith("Del ")) {
    return `Universidad del ${value.slice(4)}`
  }

  return `Universidad ${value}`
}

function compactFields(fields: LeadFields): LeadFields {
  return Object.fromEntries(
    Object.entries(fields).flatMap(([key, value]) => {
      const normalizedValue = value?.trim()

      return normalizedValue ? [[key, normalizedValue]] : []
    })
  ) as LeadFields
}

//normalización
function normalizeForMatching(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function isKnownCountry(value: string) {
  const normalizedValue = normalizeForMatching(value)

  return knownCountries.some(
    (country) => country.normalized === normalizedValue
  )
}

function normalizeCountryName(value: string) {
  const normalizedValue = normalizeForMatching(value)

  return knownCountries.find(
    (country) => country.normalized === normalizedValue
  )?.label
}

const knownCountries = [
  "Perú",
  "Peru",
  "Chile",
  "Colombia",
  "Ecuador",
  "Bolivia",
  "Argentina",
  "Venezuela",
  "Paraguay",
  "Uruguay",
  "Brasil",
  "México",
  "Mexico",
  "España",
  "Espana",
  "Estados Unidos",
].map((label) => ({
  label:
    label === "Peru"
      ? "Perú"
      : label === "Mexico"
        ? "México"
        : label === "Espana"
          ? "España"
          : label,
  normalized: normalizeForMatching(label),
}))
