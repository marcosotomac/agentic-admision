import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/server/supabase"
import { createOpenAIClient, getOpenAIAnswerModel } from "@/lib/server/openai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const career = searchParams.get("career")

  if (!career) {
    return NextResponse.json(
      { error: "El parámetro 'career' es obligatorio." },
      { status: 400 }
    )
  }

  try {
    const supabase = createServerSupabaseClient()

    // Buscamos los chunks que coincidan con la carrera y hablen de malla o ciclo
    const { data: chunks, error: dbError } = await supabase
      .from("knowledge_chunks")
      .select("content, metadata")
      .or(`content.ilike.%${career}%,metadata->>sourceTitle.ilike.%${career}%`)
      .or("content.ilike.%malla%,content.ilike.%ciclo%")
      .limit(6)

    if (dbError) {
      console.error("Database query failed:", dbError)
      return NextResponse.json(
        { error: "Error consultando la base de datos de conocimiento." },
        { status: 500 }
      )
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: `No se encontró información de la malla para la carrera: ${career}.` },
        { status: 404 }
      )
    }

    // Unimos los contenidos de los chunks para darle contexto al LLM
    const contextText = chunks.map((c) => c.content).join("\n\n---\n\n")

    const openai = createOpenAIClient()
    const systemPrompt = `Eres un extractor de datos académicos experto. Tu tarea es analizar el texto proveído (que contiene información de la malla curricular de USIL) y extraer la estructura de ciclos, cursos y créditos de la carrera "${career}".

Retorna un objeto JSON con el siguiente esquema exacto:
{
  "career": "${career}",
  "credits": number (créditos totales de la carrera, infiérelo si no está explícito, p.ej. 200 para ingeniería, 310 para medicina),
  "duration": string (duración aproximada, p.ej. "10 semestres"),
  "cycles": [
    {
      "number": number (número de ciclo, del 1 al 10 o el máximo que figure),
      "courses": [
        {
          "name": string (nombre oficial del curso),
          "credits": number (créditos del curso, si no se mencionan asume 3 o 4 créditos por defecto),
          "area": "especialidad" | "ciencias" | "gestion"
        }
      ]
    }
  ],
  "mentions": string[] (lista de menciones académicas que figuren para esta carrera, si aplica),
  "certifications": string[] (lista de certificaciones, convenios o doble grado Americano SIU que figuren)
}

Reglas estrictas de clasificación de "area":
- "especialidad": Cursos específicos del núcleo de la carrera, talleres técnicos, laboratorios avanzados, proyectos de tesis/investigación.
- "ciencias": Cursos de matemática, física, estadística, biología, química, algoritmos complejos y teoría computacional.
- "gestion": Cursos de inglés, lenguaje/comunicación, economía, administración, marketing, ética y ciudadanía, habilidades blandas.

Retorna ÚNICAMENTE el JSON puro. Sin explicaciones, sin envoltorio de markdown (\`\`\`json), sin texto adicional.`

    const response = await openai.chat.completions.create({
      model: getOpenAIAnswerModel(),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Texto extraído de la base de conocimiento sobre la carrera:\n\n${contextText}`,
        },
      ],
      temperature: 0.1,
    })

    const resultText = response.choices[0].message.content?.trim()

    if (!resultText) {
      throw new Error("El LLM retornó una respuesta vacía.")
    }

    const parsedData = JSON.parse(resultText)

    return NextResponse.json(parsedData)
  } catch (error) {
    console.error("Error generating structured curriculum:", error)
    return NextResponse.json(
      {
        error: "Error interno procesando la estructura de la malla curricular.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
