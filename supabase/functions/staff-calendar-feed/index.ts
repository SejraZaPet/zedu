import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

const pad = (n: number) => n.toString().padStart(2, '0')

function toICSDate(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'
  )
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function fold(line: string): string {
  if (line.length <= 75) return line
  const out: string[] = []
  let i = 0
  while (i < line.length) {
    out.push((i === 0 ? '' : ' ') + line.slice(i, i + 73))
    i += 73
  }
  return out.join('\r\n')
}

interface EventRow {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string | null
}

function buildIcs(events: EventRow[]): string {
  const dtstamp = toICSDate(new Date())
  const vevents = events.map((e) => {
    const start = new Date(e.start_time)
    const end = e.end_time ? new Date(e.end_time) : new Date(start.getTime() + 60 * 60 * 1000)
    const lines = [
      'BEGIN:VEVENT',
      fold(`UID:${e.id}@Bezli.cz`),
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toICSDate(start)}`,
      `DTEND:${toICSDate(end)}`,
      fold(`SUMMARY:${escapeText(e.title)}`),
    ]
    if (e.description) lines.push(fold(`DESCRIPTION:${escapeText(e.description)}`))
    lines.push('END:VEVENT')
    return lines.join('\r\n')
  })
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bezli//Staff Calendar//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Bezli pracovní kalendář',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)

  // POST (authenticated): create or return the caller's feed token
  if (req.method === 'POST') {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimData, error: claimError } = await client.auth.getClaims(token)
    if (claimError || !claimData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = claimData.claims.sub as string

    const { data: staff } = await admin
      .from('staff_members')
      .select('id, calendar_feed_token')
      .eq('profile_id', userId)
      .maybeSingle()

    if (!staff) {
      return new Response(JSON.stringify({ error: 'Nejste členem interního týmu.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let feedToken = staff.calendar_feed_token as string | null
    if (!feedToken) {
      feedToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')
      const { error } = await admin
        .from('staff_members')
        .update({ calendar_feed_token: feedToken })
        .eq('id', staff.id)
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const feedUrl = `${SUPABASE_URL}/functions/v1/staff-calendar-feed?token=${feedToken}`
    return new Response(JSON.stringify({ token: feedToken, url: feedUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // GET (public, token-based): iCalendar feed for calendar apps
  const feedToken = url.searchParams.get('token')
  if (!feedToken || feedToken.length < 16) {
    return new Response('Invalid token', { status: 401, headers: corsHeaders })
  }

  const { data: staff } = await admin
    .from('staff_members')
    .select('id, active')
    .eq('calendar_feed_token', feedToken)
    .maybeSingle()

  if (!staff || staff.active === false) {
    return new Response('Invalid token', { status: 401, headers: corsHeaders })
  }

  const { data: events, error } = await admin
    .from('staff_calendar_events')
    .select('id, title, description, start_time, end_time')
    .order('start_time', { ascending: true })

  if (error) {
    return new Response('Server error', { status: 500, headers: corsHeaders })
  }

  return new Response(buildIcs((events ?? []) as EventRow[]), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="Bezli-pracovni-kalendar.ics"',
      'Cache-Control': 'public, max-age=300',
    },
  })
})
