const http = require('http')
const { randomUUID } = require('crypto')
const { replayEvents, DEFAULT_RULES } = require('./profitValidator')

const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '127.0.0.1'

const sessions = new Map()

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })
  res.end(body)
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function createSession(maxTrains = 9) {
  const sessionId = randomUUID()
  const session = {
    id: sessionId,
    createdAt: Date.now(),
    maxTrains,
    events: [],
    lastSeq: 0
  }
  sessions.set(sessionId, session)
  return session
}

function validateEventEnvelope(session, envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Event envelope must be an object')
  }

  const seq = Number(envelope.seq)
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error('seq must be a positive integer')
  }
  if (seq !== session.lastSeq + 1) {
    throw new Error(`Invalid sequence number. Expected ${session.lastSeq + 1}, received ${seq}`)
  }

  if (!envelope.event || typeof envelope.event !== 'object') {
    throw new Error('event is required')
  }

  return {
    seq,
    event: envelope.event,
    clientTick: Number.isFinite(Number(envelope.clientTick)) ? Number(envelope.clientTick) : null,
    clientTime: Number.isFinite(Number(envelope.clientTime)) ? Number(envelope.clientTime) : null
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {})
    return
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, sessions: sessions.size })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/session/start') {
    try {
      const body = await parseJsonBody(req)
      const maxTrains = Number.isInteger(body.maxTrains) ? body.maxTrains : 9
      const session = createSession(maxTrains)
      sendJson(res, 201, {
        sessionId: session.id,
        rules: DEFAULT_RULES,
        maxTrains: session.maxTrains
      })
    } catch (error) {
      sendJson(res, 400, { error: error.message })
    }
    return
  }

  const eventRouteMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/events$/)
  if (req.method === 'POST' && eventRouteMatch) {
    const sessionId = eventRouteMatch[1]
    const session = sessions.get(sessionId)
    if (!session) {
      sendJson(res, 404, { error: 'Session not found' })
      return
    }

    try {
      const body = await parseJsonBody(req)
      const envelope = validateEventEnvelope(session, body)
      session.events.push(envelope)
      session.lastSeq = envelope.seq
      sendJson(res, 202, {
        accepted: true,
        lastSeq: session.lastSeq,
        eventCount: session.events.length
      })
    } catch (error) {
      sendJson(res, 400, { error: error.message })
    }
    return
  }

  const summaryRouteMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/summary$/)
  if (req.method === 'GET' && summaryRouteMatch) {
    const sessionId = summaryRouteMatch[1]
    const session = sessions.get(sessionId)
    if (!session) {
      sendJson(res, 404, { error: 'Session not found' })
      return
    }

    try {
      const events = session.events.map((entry) => entry.event)
      const summary = replayEvents(events, {
        rules: DEFAULT_RULES,
        maxTrains: session.maxTrains
      })

      sendJson(res, 200, {
        sessionId,
        eventCount: session.events.length,
        lastSeq: session.lastSeq,
        summary
      })
    } catch (error) {
      sendJson(res, 400, { error: error.message })
    }
    return
  }

  sendJson(res, 404, { error: 'Not found' })
})

server.listen(PORT, HOST, () => {
  console.log(`Profit validation server listening on http://${HOST}:${PORT}`)
})
