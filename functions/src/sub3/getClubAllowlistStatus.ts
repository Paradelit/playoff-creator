import { onCall, HttpsError } from "firebase-functions/v2/https";
import { isInClubAllowlist } from "./clubAllowlist";

export const getClubAllowlistStatus = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  return { allowed: isInClubAllowlist(request.auth.uid) };
});
