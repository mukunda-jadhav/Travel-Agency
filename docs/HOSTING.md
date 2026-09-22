# Render demo deployment with Supabase

This setup runs the existing WhatsApp bot with simulated travel offers and a persistent database. The interactive catalogue prototype is still separate.

## Database

1. Create a project at https://supabase.com/dashboard.
2. In its SQL Editor, run `supabase/migrations/001_init.sql`, then `002_travel.sql`, then `003_booking_commands.sql`.
3. Copy the project URL and backend service-role key into Render's secret environment variables. Never put the key in GitHub, the browser or a chat message.
4. Set `TRAVEL_STORE=supabase` and keep `DEMO_MODE=true`. Storage selection is independent of real supplier access.

Existing local JSON bookings are not automatically migrated. This starts a separate cloud demo database. The migrations enable row-level security; the bot accesses tables with the server-side service-role key.

## Render

Create a Blueprint at https://dashboard.render.com/ and connect this repository; `render.yaml` defines the free web service. Supply the requested secret variables. Set PUBLIC_BASE_URL to the assigned HTTPS service URL (update it and redeploy once the URL is known).

Set Meta's callback URL to `https://YOUR-SERVICE.onrender.com/api/webhooks/whatsapp`, using the same verify token as the service. Subscribe to messages and use a valid WhatsApp access token and phone-number ID.

## External uptime monitor

After deployment, configure an external HTTP monitor to GET `https://YOUR-SERVICE.onrender.com/health` every 10 minutes and expect HTTP 200. No credentials or request body are needed. Do not monitor the WhatsApp webhook URL. The endpoint checks process health, not database readiness.

This can reduce idle spin-down; it does not guarantee uptime or avoid quotas, maintenance or restarts. Render Free provides 750 running hours per workspace each month, shared across free services. Do not rely on it for paid customer bookings. Free Render Postgres expires after 30 days, so this setup uses external Supabase instead; review that project's own free-plan limits before launch.

## Verify before using

Send a WhatsApp test message, create a simulated booking, restart the Render service, and check `/bookings` from the same WhatsApp account. Confirm the booking remains and database errors are absent. Then test cancellation and duplicate delivery. Never set DEMO_MODE=false merely to enable the database.
