import { Router } from "express";
import { z } from "zod";
import { createBooking, getBooking, updateBooking } from "../db.js";
import {
  searchFlights,
  searchStays,
  getStayRates,
  revalidateFlight,
  quoteStay,
} from "../services/duffel.js";
import { calculateCabFare, geocode } from "../services/cab.js";
import { createPaymentLink } from "../services/payment.js";
export const api = Router();
api.post("/flights/search", async (req, res) =>
  res.json(
    await searchFlights(
      z
        .object({
          origin: z.string(),
          destination: z.string(),
          departureDate: z.string(),
          returnDate: z.string().optional(),
          adults: z.number(),
        })
        .parse(req.body),
    ),
  ),
);
api.post("/stays/search", async (req, res) => {
  const input = z
    .object({
      city: z.string(),
      checkInDate: z.string(),
      checkOutDate: z.string(),
      adults: z.number().int().min(1),
      rooms: z.number().int().min(1),
      stars: z.number().int().min(1).max(5).optional(),
    })
    .parse(req.body);
  const point = await geocode(input.city);
  res.json(
    await searchStays({ ...input, latitude: point.lat, longitude: point.lng }),
  );
});
api.get("/stays/:searchResultId/rates", async (req, res) =>
  res.json(await getStayRates(req.params.searchResultId)),
);
api.post("/cab/quote", async (req, res) =>
  res.json(
    await calculateCabFare(
      z.object({ pickup: z.string(), dropoff: z.string() }).parse(req.body),
    ),
  ),
);
const draft = z.object({
  user_phone: z.string().min(7),
  selected_offer_id: z.string(),
  flight_snapshot: z.record(z.unknown()),
  hotel_snapshot: z.record(z.unknown()).nullable().optional(),
  cab_snapshot: z.record(z.unknown()).nullable().optional(),
  passengers: z
    .array(
      z.object({
        givenName: z.string(),
        familyName: z.string(),
        bornOn: z.string(),
        gender: z.enum(["m", "f"]),
        title: z.enum(["mr", "ms", "mrs", "miss"]),
        email: z.string().email(),
        phoneNumber: z.string(),
        passport: z
          .object({
            uniqueIdentifier: z.string(),
            expiresOn: z.string(),
            issuingCountryCode: z.string().length(2),
          })
          .optional(),
      }),
    )
    .min(1),
  amount_minor: z.number().int().positive(),
  currency: z.string().length(3),
});
api.post("/bookings", async (req, res) =>
  res
    .status(201)
    .json(await createBooking({ ...draft.parse(req.body), status: "DRAFT" })),
);
api.get("/bookings/:id", async (req, res) =>
  res.json(await getBooking(req.params.id)),
);
api.post("/bookings/:id/checkout", async (req, res) => {
  let b = await getBooking(req.params.id);
  if (b.status !== "DRAFT")
    throw new Error("Only draft bookings can enter checkout");
  if (!b.selected_offer_id) throw new Error("Booking has no selected flight");
  const flight = await revalidateFlight(b.selected_offer_id);
  const hotelInput = b.hotel_snapshot as { rateId?: string } | null;
  const hotel = hotelInput?.rateId ? await quoteStay(hotelInput.rateId) : null;
  if (hotel && hotel.currency !== flight.currency)
    throw new Error("Flight and hotel use different currencies");
  const amountMinor =
    Math.round(Number(flight.amount) * 100) +
    (hotel ? Math.round(Number(hotel.amount) * 100) : 0);
  b = await updateBooking(b.id, {
    flight_snapshot: flight,
    hotel_snapshot: hotel,
    cab_snapshot: b.cab_snapshot
      ? {
          ...b.cab_snapshot,
          bookingStatus: "ESTIMATE_ONLY",
          includedInTotal: false,
        }
      : null,
    amount_minor: amountMinor,
    currency: flight.currency.toUpperCase(),
  });
  const p = await createPaymentLink(b);
  b = await updateBooking(b.id, {
    status: "PAYMENT_PENDING",
    stripe_session_id: p.id,
  });
  res.json({ ...p, booking: b });
});
