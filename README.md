# VoyageZero

## Conversational WhatsApp travel assistant

WhatsApp now uses a backend-controlled travel workflow: validated Gemini intent (or a key-free English parser) → persistent per-user criteria → missing-detail question → provider search → one recommendation → explicit acceptance → lead traveller details → **demo booking**. It never calls Stripe or creates supplier orders. The existing package HTTP APIs, signed Stripe webhook, legacy agent module and guided browser presentation are retained.

New modules are in `src/services/travel/`: `intent.ts`, `dates.ts`, `location.ts`, `providers.ts`, `recommendation.ts`, `conversation.ts`, `store.ts`, `types.ts`, and `index.ts`. Integration changes are in the WhatsApp/demo controllers, WhatsApp payload validation, config, and Duffel flight normalization.

### Setup and test

1. Install dependencies with `npm install`. For a new installation, copy `.env.example` to `.env`; preserve existing credentials if already configured.
2. Use `DEMO_MODE=true` for mock INR flights/hotels/cabs. A blank `GOOGLE_API_KEY` enables the local parser. Actual WhatsApp delivery still requires Meta credentials and a signed webhook.
3. For connected searches use `DEMO_MODE=false`, the existing **Duffel test** token, Supabase, and ORS for hotel geocoding. Apply both SQL files in `supabase/migrations/` in order. Duffel Stays access is required for connected hotel inventory. No Amadeus credentials are needed because this project already uses Duffel.
4. Run `npm run dev` (or `npm run build` then `npm start`). Run `npm test` and `npm run typecheck`. No lint command is configured.

New optional settings: `TRAVEL_TIMEZONE=Asia/Kolkata`, `TRAVEL_SESSION_HOURS=24`, `TRAVEL_DATA_FILE=data/travel.json`. Existing environment names are reused; the actual `.env` is never changed by this implementation.

The key-free HTTP conversation endpoint is `POST /api/demo/chat`, with JSON `{ "userId": "demo-traveller", "messageId": "a-new-UUID-for-each-message", "message": "I want to fly to Delhi tomorrow" }`. Use the same userId for follow-ups and the same messageId when retrying a delivery. It is disabled outside demo mode. The existing browser presentation remains its separate guided package demo.

Example messages: `I want to fly to Delhi tomorrow` → `Mumbai` → `something later` → `cheaper one` → `yes book it` → `Arjun Mehta` → `arjun@example.com`. Hotels support `Need a hotel in Goa this weekend under 5000`; cabs support `Need a cab from Pune airport to Hinjewadi`. Flight/hotel demo bookings request lead name/email; cabs only need a name. The WhatsApp identifier is retained as the contact. No passport, DOB or payment details are requested.

### Persistence and boundaries

Demo mode atomically writes sessions, message replies and bookings to the ignored local data file. Connected mode uses the existing `conversations.state.travel` field plus the new `travel_demo_bookings` and `travel_message_results` tables through a transactional SQL function. Repeated event IDs return the saved reply and cannot create another booking. Outbound delivery retries may repeat a reply. Sessions expire after the configured interval; stored bookings remain.

Deploy **one application process** for this MVP: incoming turns are serialized in process. Multi-replica use needs a distributed per-user lock around reading and advancing state; the SQL commit transaction alone does not serialize whole conversations. The webhook still acknowledges before asynchronous processing, so a process crash before commit can lose an acknowledged message. A durable incoming queue/outbox is required for production delivery guarantees. Stored contact details and message results need an operational retention policy.

Mock providers are clearly labelled and do not represent inventory or real cab dispatch. Connected hotel prices are search estimates per night across requested rooms; no room/rate is reserved. Budget refinements currently assume INR; other-currency results are excluded when a budget is set, with no implicit currency conversion. Flight city resolution has a small explicit city/code dictionary and asks for clarification otherwise; expanding international airport coverage needs a location API. The local fallback covers common English requests, ISO dates and named relative days; richer language requires Gemini. Dates use the configured timezone; flight times use supplier airport-local times. “Next Monday” means the next occurrence; “next weekend” means the weekend after this one. Time-only cab changes and arbitrary date formats need further clarification support. Demo bookings record the lead contact for the requested party, not individual passenger manifests. Search timeouts stop waiting but do not cancel the existing Duffel SDK request. Live provider, Gemini, Meta delivery and Supabase migration execution require configured services and are not exercised by the offline tests.

## Existing package API and guided demo

End-to-end TypeScript sandbox travel concierge for WhatsApp and HTTP. Gemini performs structured tool calling; Duffel test mode supplies flights/stays and creates test orders; OpenRouteService calculates cab routes; Stripe Checkout test webhooks trigger ticketing; Supabase stores state and PDFKit vouchers.

## Client demo — no API keys required

The default is `DEMO_MODE=true`. Run `npm install`, then `npm run dev`, and open `http://localhost:3000`. The responsive WhatsApp-style presentation provides a guided Dubai booking, simulated Stripe test checkout, confirmation/PNR, voucher download, status, and cancellation. It makes no paid or external API calls.

When credentials are ready, copy `.env.example` to `.env`, set `DEMO_MODE=false`, fill every integration key, and follow the setup below. Demo routes are disabled when demo mode is off.

## Run locally

1. Use Node 20+, run `npm install`, and copy `.env.example` to `.env`.
2. Create a free Supabase project and run `supabase/migrations/001_init.sql` in its SQL editor. If you change `SUPABASE_VOUCHERS_BUCKET`, make the same change in the migration.
3. Add Google AI Studio, Duffel **test**, ORS, Stripe **test**, and Meta developer credentials.
4. Run `npm run dev`, expose port 3000 with a free tunnel, and set `PUBLIC_BASE_URL`/Stripe redirect URLs to it.
5. Configure Meta callback as `https://HOST/api/webhooks/whatsapp` with the verify token. Subscribe to `messages`.
6. Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and use its `whsec_...`, or register that HTTPS endpoint in Stripe test mode.

Build validation: `npm run typecheck && npm run build`.

## Conversation

Send a natural request such as “Find a return trip from DEL to DXB, 10–15 October, one adult, a 4-star stay, and a cab from DXB to Downtown Dubai.” The agent searches real test/free APIs, gathers the selected package and passenger identity fields, then returns a Stripe test Checkout URL. A signed `checkout.session.completed` event is the only path that creates a Duffel order. It generates and uploads the voucher and sends it as a WhatsApp document.

- `/status BOOKING_UUID`
- `Cancel booking BOOKING_UUID`

## HTTP API

- `POST /api/flights/search`
- `POST /api/stays/search`
- `GET /api/stays/:searchResultId/rates`
- `POST /api/cab/quote`
- `POST /api/bookings`
- `POST /api/bookings/:id/checkout`
- `GET /api/bookings/:id`
- `GET|POST /api/webhooks/whatsapp`
- `POST /api/webhooks/stripe`

All amounts are integer minor units internally. Never expose the Supabase service-role key. The voucher bucket is intentionally public because Meta must fetch document URLs; production deployments should instead use signed URLs with adequate expiry.

Cab quotes are route-based estimates and do not reserve a vehicle or contribute to the Stripe total. Hotel checkout uses a freshly created Duffel quote and hotel booking is completed after payment; Duffel Stays must be enabled for the account before those routes can return inventory.

## Reliability and boundaries

Webhook event IDs are claimed transactionally before work, Stripe and Meta signatures are verified against raw request bodies, payment metadata is cross-checked against the database, and repeat paid events return the existing confirmation. Errors after payment set `FAILED`, retain diagnostic state, and tell the traveller not to pay twice. Because this project is strictly sandbox/free-tier, its PNRs, charges, refunds, and vouchers are test artifacts and cannot be used for actual travel.
