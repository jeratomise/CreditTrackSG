import express, { Router } from "express";
import Stripe from "stripe"; // used for webhook event types
import { stripe, supabase } from "../lib/clients";
import { requireAuth } from "../lib/auth";
import { validate, checkoutSchema } from "../lib/validation";

const router = Router();

// ── Stripe webhook ──────────────────────────────────────────────────────────
// Uses the RAW body (express.raw) for signature verification. The app-level JSON
// parser is configured to skip this path (see api/server.ts), so router mount order
// can't accidentally consume the raw body.
router.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return res.status(500).json({ error: "Stripe not configured" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (userId && supabase) {
        await supabase.from("profiles").update({
          role: "pro",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        }).eq("id", userId);
        console.log(`User ${userId} upgraded to Pro via Stripe`);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      if (supabase) {
        await supabase.from("profiles").update({
          role: "user",
          stripe_subscription_id: null,
        }).eq("stripe_customer_id", customerId);
        console.log(`Customer ${customerId} subscription cancelled — downgraded to Free`);
      }
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      if (["past_due", "unpaid", "canceled"].includes(subscription.status)) {
        if (supabase) {
          await supabase.from("profiles").update({ role: "user" }).eq("stripe_customer_id", customerId);
        }
      }
    }
  } catch (err: any) {
    console.error("Webhook handler error:", err.message);
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  res.json({ received: true });
});

// Create a Stripe Checkout session for Pro plan. Auth required: the user is taken
// from the verified JWT, NOT the body, so a caller can only checkout for themselves.
router.post("/api/create-checkout-session", requireAuth, async (req: any, res) => {
  const parsed = validate(checkoutSchema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const billingCycle = parsed.data.billingCycle;
  const userId = req.authUser.id;
  const userEmail = req.authUser.email;

  if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

  const priceId = billingCycle === "annual"
    ? process.env.STRIPE_PRO_PRICE_ID_ANNUAL
    : process.env.STRIPE_PRO_PRICE_ID_MONTHLY;

  if (!priceId) return res.status(500).json({ error: "Billing is not configured" });

  const appUrl = process.env.APP_URL || "https://credittrack.elitex.cc";

  try {
    let customerId: string | undefined;
    if (supabase) {
      const { data: profile } = await supabase.from("profiles").select("stripe_customer_id").eq("id", userId).single();
      if (profile?.stripe_customer_id) customerId = profile.stripe_customer_id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}?upgraded=true`,
      cancel_url: `${appUrl}?upgrade=cancelled`,
      subscription_data: { metadata: { userId } },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout session error:", err.message);
    res.status(500).json({ error: "Failed to start checkout" });
  }
});

// Create a Stripe Customer Portal session. Auth required: the Stripe customer is
// resolved from the verified user's own profile, never from the request.
router.post("/api/create-portal-session", requireAuth, async (req: any, res) => {
  const userId = req.authUser.id;

  if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
  if (!supabase) return res.status(500).json({ error: "Database not initialized" });

  const appUrl = process.env.APP_URL || "https://credittrack.elitex.cc";

  try {
    const { data: profile } = await supabase.from("profiles").select("stripe_customer_id").eq("id", userId).single();
    if (!profile?.stripe_customer_id) return res.status(400).json({ error: "No Stripe customer found for this user" });

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: appUrl,
    });

    res.json({ url: portalSession.url });
  } catch (err: any) {
    console.error("Portal session error:", err.message);
    res.status(500).json({ error: "Failed to open billing portal" });
  }
});

export default router;
