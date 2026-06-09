import fs from "fs"
import path from "path"

// Load env vars
const envFile = fs.readFileSync(
  path.resolve(process.cwd(), ".env.local"),
  "utf8"
)
envFile.split("\n").forEach((line) => {
  const [key, ...valParts] = line.split("=")
  if (key && valParts.length > 0) {
    process.env[key.trim()] = valParts.join("=").trim()
  }
})
process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

import { processChatRequest } from "../app/api/chat/route"
import type { LeadFields } from "@/lib/leads/scoring"

async function runConversation(title: string, messages: string[]) {
  console.log(`\n==================================================`)
  console.log(`SIMULACIÓN: ${title.toUpperCase()}`)
  console.log(`==================================================`)

  const sessionId = `sim-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  let currentFields: LeadFields = {}

  for (const messageText of messages) {
    console.log(`\n[USUARIO]: ${messageText}`)

    const response = await processChatRequest({
      message: messageText,
      sessionId,
    })

    console.log(`[BOT]: ${response.answer}`)
    if (
      response.profileFields &&
      Object.keys(response.profileFields).length > 0
    ) {
      currentFields = { ...currentFields, ...response.profileFields }
      console.log(
        `[FICHA ACTUALIZADA]:`,
        JSON.stringify(currentFields, null, 2)
      )
    } else {
      console.log(`[FICHA SIN CAMBIOS]`)
    }
  }
}

async function runAll() {
  try {
    // Escenario 1: Estudiante de colegio interesado en Ingeniería de Software
    await runConversation("Estudiante de 5to de Secundaria", [
      "hola, me gustaria conocer las carreras disponibles",
      "me interesa la carrera de ingenieria de software",
      "estoy en 5to de secundaria en lima",
      "mi correo es juan.perez@gmail.com y celular 955443322",
    ])

    // Escenario 2: Traslado Externo de Universidad
    await runConversation("Traslado Externo de Universidad", [
      "hola, quiero hacer un traslado de universidad",
      "estoy en la UTEC estudiando ing civil pero me quiero cambiar a mecatronica en la USIL",
      "tengo 20 años y vivo en san isidro",
      "mi correo es meca.pro@gmail.com",
    ])

    // Escenario 3: Interés en costos y becas directo
    await runConversation("Consulta directa de Pensiones", [
      "hola, cuanto cuesta la carrera de medicina humana?",
      "estoy terminando el colegio este año",
      "mi correo es marcos.med@outlook.com",
    ])
  } catch (error) {
    console.error("Error running simulations:", error)
  }
}

runAll()
