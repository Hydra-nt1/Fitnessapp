// FitTracker KI-Coach — Supabase Edge Function "coach"
// Deploy: Supabase Dashboard → Edge Functions → "Deploy a new function" → Via Editor → Name: coach → diesen Code einfügen.
// Secret setzen: Edge Functions → Secrets → GROQ_API_KEY (kostenlos auf console.groq.com).
// Optional: COACH_MODEL (Standard: openai/gpt-oss-120b).
// Der API-Key liegt nur hier auf dem Server und nie im Browser.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
const MODEL = Deno.env.get('COACH_MODEL') ?? 'openai/gpt-oss-120b'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const tools = [
  {
    type: 'function',
    function: {
      name: 'propose_routine',
      description:
        'Schlägt dem Nutzer einen konkreten Trainingsplan (eine Einheit) vor, den er mit einem Klick in der App anlegen kann. Nur verwenden, wenn der Nutzer einen Plan/eine Einheit möchte.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Kurzer Name, z. B. "Push A"' },
          muscle_group: {
            type: 'string',
            enum: ['Brust', 'Rücken', 'Schultern', 'Arme', 'Beine', 'Core', 'Ganzkörper', 'Push', 'Pull', 'Oberkörper', 'Unterkörper', 'Cardio'],
          },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Deutscher Übungsname, möglichst aus der Bibliothek des Nutzers' },
                sets: { type: 'integer' },
                reps_min: { type: 'integer' },
                reps_max: { type: 'integer' },
                weight: { type: 'number', description: 'Startgewicht in kg, 0 wenn unbekannt/Körpergewicht' },
                note: { type: 'string' },
              },
              required: ['name', 'sets', 'reps_min', 'reps_max'],
            },
          },
        },
        required: ['name', 'exercises'],
      },
    },
  },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!GROQ_API_KEY) return json({ error: 'GROQ_API_KEY ist in den Edge-Function-Secrets nicht gesetzt.' }, 500)

  // Nur angemeldete Nutzer
  const auth = req.headers.get('Authorization') ?? ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: user } = await supabase.auth.getUser(auth.replace(/^Bearer /, ''))
  if (!user?.user) return json({ error: 'Nicht angemeldet' }, 401)

  let body: { messages?: { role: string; content: string }[]; context?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400)
  }
  const history = (body.messages ?? []).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-16)
  const context = String(body.context ?? '').slice(0, 12000)

  const system = `Du bist ein erfahrener, freundlicher Personal Trainer in der App "FitTracker". Antworte immer auf Deutsch, präzise und praxisnah.
- Nutze die Trainingsdaten unten aktiv: beziehe dich auf konkrete Übungen, Gewichte, Volumen, Erholung und Lücken.
- Halte Antworten kompakt (meist < 200 Wörter), nutze Aufzählungen und **fett** für Kernaussagen.
- Wenn der Nutzer einen Plan/eine Trainingseinheit möchte, rufe das Tool propose_routine auf (pro Einheit ein Aufruf) und erkläre kurz die Idee.
- Gib keine medizinischen Diagnosen; bei Schmerzen/Verletzungen rate zu ärztlicher Abklärung.

=== Daten des Nutzers ===
${context}`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: system }, ...history], tools, tool_choice: 'auto', temperature: 0.5, max_tokens: 1800 }),
  })
  if (!res.ok) return json({ error: `KI-Dienst nicht erreichbar (${res.status})`, detail: (await res.text()).slice(0, 300) }, 502)
  const data = await res.json()
  const msg = data.choices?.[0]?.message ?? {}
  const proposals = (msg.tool_calls ?? [])
    .filter((t: any) => t.function?.name === 'propose_routine')
    .map((t: any) => {
      try {
        return JSON.parse(t.function.arguments)
      } catch {
        return null
      }
    })
    .filter(Boolean)
  let reply: string = msg.content ?? ''
  if (!reply && proposals.length) reply = proposals.length === 1 ? `Hier ist mein Vorschlag: **${proposals[0].name}**.` : `Hier sind ${proposals.length} Einheiten als Vorschlag.`
  return json({ reply, proposals })
})
