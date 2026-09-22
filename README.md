# VoyageZero — WhatsApp travel assistant

A TypeScript / Express travel agency demo. The WhatsApp webhook and the browser preview use the **same persistent conversation engine**. Search flights, hotels and cabs; refine a recommendation; collect the lead traveller’s details; save a demo booking; check status; retrieve a summary; and cancel with confirmation.

## Run the demo

Requires Node.js 20 or later.

```powershell
npm ci
Copy-Item .env.example .env # Only for a new installation; preserve an existing .env
npm run dev
```

Open http://localhost:3000. Keep `DEMO_MODE=true`. No Gemini, Stripe, Duffel or Supabase credentials are required for the local preview. Demo mode uses local English intent parsing even if an old Gemini key is present. Availability and prices are simulated; no money is charged and no supplier reservations are made.

```text
Flight from Mumbai to Delhi tomorrow
cheaper one
book it
Arjun Mehta
arjun@example.com
/bookings
/status DEMO-FLT-<reference>
/voucher DEMO-FLT-<reference>
/cancel DEMO-FLT-<reference>
yes
```

Also try `Hotel in Goa tomorrow for 2 nights under 5000` or `Cab from Pune airport to Hinjewadi`. Hotel budgets/prices are per night across the requested rooms; the saved summary calculates the full stay total. Flight prices cover the requested passenger count. Bookings store the lead traveller only.

Commands: `/help`, `/reset`, `/bookings`, `/status ID`, `/voucher ID`, `/cancel ID`. Cancellation asks for `yes` or `no`. `/reset` clears the current search but keeps bookings. Plain `cancel` cancels the search, not a saved booking. The voucher command returns a text summary, not an airline ticket or PDF.

## Connect a WhatsApp test number

The local preview does not send messages to WhatsApp. To receive and reply to actual WhatsApp messages, configure a Meta developer test sender and allowed test recipient:

1. Supply `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, and a private `WHATSAPP_VERIFY_TOKEN` in `.env`. Use the Graph API version supported by your Meta app.
2. Expose the local server through an HTTPS tunnel.
3. Configure `https://YOUR-HOST/api/webhooks/whatsapp` as the webhook callback, with the same verification token, and subscribe to messages.
4. Send a message from your allowed recipient number. Keep `DEMO_MODE=true` to use mock travel services and local persistence while testing real WhatsApp transport.

The webhook verifies Meta signatures; placeholder Meta credentials cannot receive/send actual WhatsApp messages. Never commit `.env` or share access tokens. Meta delivery has not been verified without a configured test account.

## Storage and privacy

`data/travel.json` stores sessions, bookings, and deduplicated replies and is excluded from Git. Restarting the server keeps bookings. The browser stores its random demo traveller ID and recent messages locally. Clearing browser storage starts a different traveller; use sample names and emails in this demo. Each WhatsApp sender has separate state. Booking commands only return the current sender’s records.

Run one application process: a serialized queue and atomic file replacement prevent concurrent local writes within that process. Multiple workers need a shared lock/queue. WhatsApp acknowledges receipt before processing; a process crash can lose an acknowledged message. A durable inbox/outbox and delivery retry handling are needed before production use. This is a functional demo, not a production reservation system.

## Connected sandbox integrations

Existing Duffel, Supabase, ORS, Stripe and PDF modules are retained for future integration. Their package HTTP APIs and Stripe webhook are disabled in demo mode. They are separate from the conversational demo booking flow and require authentication and further verification before exposure to customers.

`DEMO_MODE=false` enables connected sandbox search. Supply a Duffel test token, Supabase and ORS settings; apply `supabase/migrations/001_init.sql`, `002_travel.sql`, then `003_booking_commands.sql`. Gemini is optional for richer language. Conversational bookings remain demo records even in connected mode. Cabs remain mocked. Connected integrations have not been verified against live accounts.

The key-free parser supports common English travel requests, ISO dates, relative days, passenger/room counts, and a small city dictionary. It is not a general multilingual AI assistant. Prices with budget filters currently assume INR.

## Development

```powershell
npm test
npm run typecheck
npm run build
npm start
```

`GET /health` reports server and demo mode. `POST /api/demo/chat` accepts `{userId:"demo-traveller", messageId:"a UUID", message:"your request"}`. Reuse the message ID when retrying a request. The browser preview handles loading, failures, duplicate-safe retries, and renders messages as text.

Cleanup: removed the unused tool-calling agent/tool wrappers, the obsolete task list, fake payment modal, and in-memory presentation booking endpoints. Active supplier adapters, migrations and tests remain.
