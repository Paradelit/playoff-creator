// functions/src/billing/createPortalSession.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { getStripe, stripeSecretKey } from "./stripeClient";

interface HandlerArgs {
  db: Firestore;
  auth: { uid: string };
  data: { wsId: string; appId: string; returnUrl: string };
}

/**
 * Allowlist de orígenes válidos para el `return_url` del Customer Portal.
 * Stripe NO valida el return_url contra el dominio configurado — redirige a
 * cualquier URL. Sin esta validación, un atacante podría llamar a la callable
 * con returnUrl='https://phish.example/looks-like-stripe' y phishear sesiones
 * post-portal. APP_BASE_URL es el origen primario; los preview channels de
 * Firebase Hosting siguen el patrón `*.web.app` con un sufijo único.
 */
function isAllowedReturnUrlOrigin(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  const allowedOrigins = new Set<string>();
  const appBase = process.env.APP_BASE_URL;
  if (appBase) {
    try {
      allowedOrigins.add(new URL(appBase).origin);
    } catch {
      /* malformed env, ignore */
    }
  }
  // Default canónico — coincide con el firebase project para deploys vanilla.
  allowedOrigins.add("https://playoff-creator.web.app");
  allowedOrigins.add("https://playoff-creator.firebaseapp.com");
  // Localhost / dev — se aceptan los puertos típicos de Vite (5173, 4173) y CRA (3000).
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
    return true;
  }
  // Preview channels (FirebaseHosting genera URLs `playoff-creator--<channel>-<hash>.web.app`).
  if (parsed.hostname.endsWith(".web.app") || parsed.hostname.endsWith(".firebaseapp.com")) {
    return parsed.hostname.includes("playoff-creator");
  }
  return allowedOrigins.has(parsed.origin);
}

export async function handleCreatePortalSession({ db, auth, data }: HandlerArgs) {
  const { wsId, appId, returnUrl } = data;
  if (!wsId || !appId || !returnUrl) {
    throw new HttpsError("invalid-argument", "Missing wsId, appId or returnUrl");
  }
  if (!isAllowedReturnUrlOrigin(returnUrl)) {
    throw new HttpsError("invalid-argument", "returnUrl origin not allowed");
  }

  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) {
    throw new HttpsError("not-found", "workspace not found");
  }
  const ws = wsSnap.data();
  if (!ws || ws.ownerId !== auth.uid) {
    throw new HttpsError("permission-denied", "Only the workspace owner can manage billing");
  }
  const customerId: string | undefined = ws.billing?.stripeCustomerId;
  if (!customerId) {
    throw new HttpsError("failed-precondition", "no Stripe customer for this workspace");
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}

export const createPortalSession = onCall(
  { secrets: [stripeSecretKey], region: "europe-west1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
    return handleCreatePortalSession({
      db: getFirestore(),
      auth: { uid: request.auth.uid },
      data: request.data,
    });
  }
);
