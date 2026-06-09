import type { SupabaseClient } from "@supabase/supabase-js"

import {
  leadFieldKeys,
  type LeadCapture,
  type LeadFields,
  type LeadScore,
} from "./scoring"

type LeadRow = {
  id: string
  score: number | null
  metadata: Record<string, unknown> | null
}

type LeadProfileRow = {
  name: string | null
  email: string | null
  phone: string | null
  program: string | null
  preferred_schedule: string | null
  metadata: Record<string, unknown> | null
}

type UpsertLeadCaptureParams = {
  supabase: SupabaseClient
  sessionId: string
  capture: LeadCapture
  scoring: LeadScore
}

export type UpsertedLead = {
  id: string
}

export async function fetchLeadProfileBySession(params: {
  supabase: SupabaseClient
  sessionId: string
}): Promise<LeadFields> {
  const { data, error } = await params.supabase
    .from("leads")
    .select("name, email, phone, program, preferred_schedule, metadata")
    .eq("session_id", params.sessionId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Lead profile lookup failed", error)
    return {}
  }

  return data ? leadFieldsFromProfileRow(data as LeadProfileRow) : {}
}

export async function upsertLeadCapture(
  params: UpsertLeadCaptureParams
): Promise<UpsertedLead> {
  const existingLead = await findExistingLead(
    params.supabase,
    params.sessionId,
    params.capture.fields
  )
  const lead = existingLead
    ? await updateLead(params.supabase, existingLead, params)
    : await insertLead(params.supabase, params)

  await insertLeadEvents({
    supabase: params.supabase,
    leadId: lead.id,
    sessionId: params.sessionId,
    capture: params.capture,
    scoring: params.scoring,
    scoreBefore: existingLead?.score ?? null,
  })

  return {
    id: lead.id,
  }
}

async function findExistingLead(
  supabase: SupabaseClient,
  sessionId: string,
  fields: LeadFields
): Promise<LeadRow | null> {
  if (fields.email) {
    return findLeadByColumn(supabase, "email", fields.email.toLowerCase())
  }

  if (fields.phone) {
    return findLeadByColumn(supabase, "phone", fields.phone)
  }

  const { data, error } = await supabase
    .from("leads")
    .select("id, score, metadata")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Lead lookup failed: ${error.message}`)
  }

  return (data as LeadRow | null) ?? null
}

async function findLeadByColumn(
  supabase: SupabaseClient,
  column: "email" | "phone",
  value: string
) {
  const { data, error } = await supabase
    .from("leads")
    .select("id, score, metadata")
    .eq(column, value)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Lead lookup failed: ${error.message}`)
  }

  return (data as LeadRow | null) ?? null
}

async function insertLead(
  supabase: SupabaseClient,
  params: UpsertLeadCaptureParams
): Promise<LeadRow> {
  const { data, error } = await supabase
    .from("leads")
    .insert(buildLeadPayload(params))
    .select("id, score, metadata")
    .single()

  if (error) {
    throw new Error(`Lead insert failed: ${error.message}`)
  }

  return data as LeadRow
}

async function updateLead(
  supabase: SupabaseClient,
  existingLead: LeadRow,
  params: UpsertLeadCaptureParams
): Promise<LeadRow> {
  const { data, error } = await supabase
    .from("leads")
    .update(
      buildLeadPayload(params, {
        existingMetadata: existingLead.metadata ?? {},
      })
    )
    .eq("id", existingLead.id)
    .select("id, score, metadata")
    .single()

  if (error) {
    throw new Error(`Lead update failed: ${error.message}`)
  }

  return data as LeadRow
}

function buildLeadPayload(
  params: UpsertLeadCaptureParams,
  options?: { existingMetadata?: Record<string, unknown> }
) {
  const existingMetadata = options?.existingMetadata ?? {}
  const profileFacts = compactLeadFields({
    ...readProfileFacts(existingMetadata),
    ...params.capture.fields,
  })
  const payload: Record<string, unknown> = {
    session_id: params.sessionId,
    score: params.scoring.score,
    category: params.scoring.category,
    metadata: {
      ...existingMetadata,
      profileFacts,
      source: "api_chat",
      lastIntentSignals: params.capture.intentSignals,
      lastMissingFields: params.scoring.missingFields,
    },
  }

  if (params.capture.commercialIntent) {
    payload.last_intent_at = new Date().toISOString()
  }

  if (params.capture.fields.name) {
    payload.name = params.capture.fields.name
  }

  if (params.capture.fields.email) {
    payload.email = params.capture.fields.email.toLowerCase()
  }

  if (params.capture.fields.phone) {
    payload.phone = params.capture.fields.phone
  }

  if (params.capture.fields.program) {
    payload.program = params.capture.fields.program
  }

  if (params.capture.fields.schedule) {
    payload.preferred_schedule = params.capture.fields.schedule
  }

  return payload
}

function leadFieldsFromProfileRow(row: LeadProfileRow): LeadFields {
  return compactLeadFields({
    ...readProfileFacts(row.metadata ?? {}),
    name: row.name ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    program: row.program ?? undefined,
    schedule: row.preferred_schedule ?? undefined,
  })
}

function readProfileFacts(metadata: Record<string, unknown>): LeadFields {
  const profileFacts = metadata.profileFacts

  if (!isRecord(profileFacts)) {
    return {}
  }

  return compactLeadFields(
    Object.fromEntries(
      leadFieldKeys.flatMap((field) => {
        const value = profileFacts[field]

        return typeof value === "string" && value.trim()
          ? [[field, value.trim()]]
          : []
      })
    ) as LeadFields
  )
}

function compactLeadFields(fields: LeadFields): LeadFields {
  return Object.fromEntries(
    Object.entries(fields).flatMap(([key, value]) => {
      const normalizedValue = value?.trim()

      return normalizedValue ? [[key, normalizedValue]] : []
    })
  ) as LeadFields
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function insertLeadEvents(params: {
  supabase: SupabaseClient
  leadId: string
  sessionId: string
  capture: LeadCapture
  scoring: LeadScore
  scoreBefore: number | null
}) {
  const events = buildLeadEvents(params)

  if (events.length === 0) {
    return
  }

  const { error } = await params.supabase.from("lead_events").insert(events)

  if (error) {
    throw new Error(`Lead event insert failed: ${error.message}`)
  }
}

function buildLeadEvents(params: {
  leadId: string
  sessionId: string
  capture: LeadCapture
  scoring: LeadScore
  scoreBefore: number | null
}) {
  const baseEvent = {
    lead_id: params.leadId,
    session_id: params.sessionId,
    score_before: params.scoreBefore,
    score_after: params.scoring.score,
  }
  const capturedFieldNames = Object.keys(params.capture.fields)
  const events: Record<string, unknown>[] = []

  if (capturedFieldNames.length > 0) {
    events.push({
      ...baseEvent,
      event_type: "lead_fields_captured",
      payload: {
        fields: capturedFieldNames,
      },
    })
  }

  if (params.capture.commercialIntent) {
    events.push({
      ...baseEvent,
      event_type: "lead_intent_detected",
      payload: {
        signals: params.capture.intentSignals,
        urgencyIntent: params.capture.urgencyIntent,
        requestedHumanContact: params.capture.requestedHumanContact,
      },
    })
  }

  if (params.scoreBefore !== params.scoring.score) {
    events.push({
      ...baseEvent,
      event_type: "lead_score_changed",
      payload: {
        category: params.scoring.category,
        missingFields: params.scoring.missingFields,
      },
    })
  }

  if (params.scoring.nextAction) {
    events.push({
      ...baseEvent,
      event_type: "lead_next_action_set",
      payload: {
        nextAction: params.scoring.nextAction,
      },
    })
  }

  return events
}
