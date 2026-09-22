# Catalogue demo checkpoint

Saved on 2026-09-22 for continuing development later.

- `Locations_Airports_Hotels_Cabs.xlsx`: user-supplied sample catalogue.
- `Travel_Catalogue_Template.xlsx`: suggested structure with Cities, Airports, Hotels, Cabs, Rates and Guide sheets. Contains 9 cities, 9 airports, 18 hotel entries and 25 cab-service entries. Listings require verification; rates are blank.
- `travel-catalogue-demo.html`: interactive conversation preview source (HTML fragment). Uses the supplied catalogue names with illustrative INR prices, simulated payments, bookings and cancellation. Optional Codex host state persistence is used when available.

The preview is a design prototype, not integrated into the running app or WhatsApp. It does not contact suppliers, collect payments, or create real reservations. Flight options are fictional; airport names come from the sample.

## Next work

1. Validate and import catalogue records into the app using stable IDs.
2. Add WhatsApp service buttons, city lists and guided date/traveller collection.
3. Persist conversation progress and handle stale selections and spelling suggestions.
4. Test the guided flow with simulated prices and payments.
5. Connect verified suppliers and a payment gateway, with availability rechecks, verified payment events, duplicate-event protection, supplier confirmation and failure/refund handling before going live.

Keep credentials in the ignored environment file. Do not place credentials or customer records in this catalogue.
