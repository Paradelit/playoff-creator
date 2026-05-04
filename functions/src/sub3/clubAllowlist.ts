// Allowlist hardcodeada de uids autorizados a crear workspaces de tipo 'club'.
// Patrón mirror del SUPERADMIN_UID en migrations sub-2: redeploy para cambios.
// Si crece (>10 uids) o cambia frecuentemente, migrar a Firestore en sub-4.
export const CLUB_CREATION_ALLOWLIST: ReadonlyArray<string> = [
  'y6vqlMynjRQeRpAKUnYmQdUiMen1', // serpa2003@gmail.com (super-admin)
];

export function isInClubAllowlist(uid: string): boolean {
  return CLUB_CREATION_ALLOWLIST.includes(uid);
}
