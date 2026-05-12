// functions/src/billing/syncClubSeatCount.ts
import { logger } from "firebase-functions/v2";
import type { Firestore } from "firebase-admin/firestore";
import { getStripe } from "./stripeClient";

/**
 * Sincroniza Stripe subscription.items[0].quantity con el número actual de
 * members del workspace. Self-correcting: en lugar de calcular delta, lee el
 * contador real y lo manda a Stripe. Idempotente; safe to call multiple times.
 *
 * Solo actúa sobre workspaces type='club' con tier='b2b' y subscription activa.
 * Free clubs / personal workspaces / suspended subscriptions = no-op.
 *
 * La actualización dispara `customer.subscription.updated` desde Stripe, y el
 * handler correspondiente persiste el nuevo seatCount en el workspace doc.
 * Por eso no escribimos seatCount aquí — el webhook es la fuente de verdad.
 *
 * Best-effort: si la llamada a Stripe falla, logueamos pero no propagamos
 * (la mutación local de members ya está commiteada; no podemos rollback).
 * Una reconciliación scheduled puede corregir drift si aparece.
 */
export async function syncClubSeatCount(
  db: Firestore,
  appId: string,
  wsId: string,
): Promise<void> {
  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) return;
  const ws = wsSnap.data();
  if (!ws || ws.type !== "club") return;
  const billing = ws.billing ?? {};
  if (billing.tier !== "b2b") return;
  if (!billing.stripeSubscriptionId) return;
  // Estados en los que NO actualizamos quantity:
  // - canceled: la suscripción se borrará pronto, Stripe rechazará el update.
  // - unpaid: cliente debe regularizar pago antes de añadir seats.
  // past_due y active sí permiten cambio (Stripe prorratea normalmente).
  if (billing.status === "canceled" || billing.status === "unpaid") return;

  const membersSnap = await db
    .collection(`artifacts/${appId}/workspaces/${wsId}/members`)
    .get();
  const seatCount = membersSnap.size;
  if (seatCount === 0) {
    // No debería ocurrir (siempre queda al menos el owner), pero por seguridad
    // no enviamos quantity=0 a Stripe (rechaza la subscription).
    logger.warn("[syncClubSeatCount] zero members, skipping", { wsId, appId });
    return;
  }

  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
    const item = sub.items?.data?.[0];
    if (!item) {
      logger.error("[syncClubSeatCount] subscription has no items", {
        wsId,
        subId: billing.stripeSubscriptionId,
      });
      return;
    }
    if (item.quantity === seatCount) {
      // Ya está sincronizado. Evita escribir a Stripe innecesariamente.
      return;
    }
    await stripe.subscriptions.update(billing.stripeSubscriptionId, {
      items: [{ id: item.id, quantity: seatCount }],
      proration_behavior: "create_prorations",
    });
    logger.info("[syncClubSeatCount] quantity updated", {
      wsId,
      from: item.quantity,
      to: seatCount,
    });
  } catch (err) {
    logger.error("[syncClubSeatCount] Stripe update failed", {
      wsId,
      seatCount,
      err: (err as Error).message,
    });
  }
}
