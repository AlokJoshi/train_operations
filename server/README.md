# Server-Side Profit Validation (Reference Implementation)

This folder shows how to move profit validation server-side.

## What this solves

- The browser is no longer the source of truth for totals.
- The server recomputes revenue, expenses, and profit from a session event stream.
- A user can still alter local UI values, but server totals remain authoritative.

## Start the validator server

```bash
node server/server.js
```

Server URL defaults to `http://127.0.0.1:3000`.

Health check:

```bash
curl http://127.0.0.1:3000/health
```

## API flow

1. Start game session

```bash
curl -X POST http://127.0.0.1:3000/api/session/start \
  -H "Content-Type: application/json" \
  -d "{\"maxTrains\":9}"
```

2. Send gameplay financial events in order (`seq` must be strictly increasing)

```bash
curl -X POST http://127.0.0.1:3000/api/session/<SESSION_ID>/events \
  -H "Content-Type: application/json" \
  -d "{\"seq\":1,\"event\":{\"type\":\"buyEngine\",\"trainNumber\":1},\"clientTick\":0}"
```

```bash
curl -X POST http://127.0.0.1:3000/api/session/<SESSION_ID>/events \
  -H "Content-Type: application/json" \
  -d "{\"seq\":2,\"event\":{\"type\":\"ticketRevenue\",\"trainNumber\":1,\"amount\":250000},\"clientTick\":1030}"
```

3. Ask for authoritative summary

```bash
curl http://127.0.0.1:3000/api/session/<SESSION_ID>/summary
```

## Integration points in this game

Use these places to emit server events:

- Engine purchase: call when new train is created.
- Coach purchase: [Game.js](../Game.js) in `addCoach`.
- Station add/remove: [Financials.js](../Financials.js) methods `addStation` / `deleteStation`.
- Track cost: [Financials.js](../Financials.js) method `incrementTrackCost`.
- Collision/flyover: [Game.js](../Game.js) methods `incrementCollisionCost` and flyover cost path.
- Ticket/freight revenue: [Financials.js](../Financials.js) methods `incrementRevenueFromTickets` and `incrementRevenueFromRawMaterial`.
- Per-time-unit maintenance: where periodic maintenance is charged in [script.js](../script.js).

## Important production notes

This sample is intentionally minimal and in-memory. For production:

- Persist sessions/events in a database.
- Authenticate user and bind session ownership.
- Add anti-replay protection and per-event signatures/tokens.
- Rate limit event ingest.
- Optionally move full train/passenger simulation to server for stronger validation.

## Why this pattern works

Client displays profit, but **server computes and validates profit**. If client state is manipulated in DevTools, authoritative totals from `/summary` still reflect only accepted event history.
