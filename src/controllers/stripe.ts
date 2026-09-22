import type { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "../services/payment.js";
import { config } from "../config.js";
import { claimEvent, getBooking, updateBooking } from "../db.js";
import { finalizeBooking } from "../services/finalize.js";
export async function stripeWebhook(req: Request, res: Response) {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.header("stripe-signature") ?? "",
      config.STRIPE_WEBHOOK_SECRET,
    );
  } catch (e) {
    res
      .status(400)
      .send(`Invalid signature: ${e instanceof Error ? e.message : "error"}`);
    return;
  }
  res.sendStatus(200);
  if (
    event.type !== "checkout.session.completed" ||
    !(await claimEvent("stripe", event.id))
  )
    return;
  const s = event.data.object;
  if (s.payment_status !== "paid") return;
  const id = s.metadata?.booking_id;
  if (!id) return;
  const b = await getBooking(id);
  if (b.stripe_session_id !== s.id || b.user_phone !== s.metadata?.user_phone)
    throw new Error("Stripe metadata does not match booking");
  await finalizeBooking(id);
}
