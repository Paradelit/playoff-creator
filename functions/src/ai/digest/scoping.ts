import type { UserRole } from "./types";

/**
 * Lo que `members/{uid}` aporta al digest builder. `role` viene de Firestore;
 * `assignedTeamIds` puede ser undefined/null si el doc nunca recibió un set
 * (caso owner/coach donde el field no se popula).
 */
export interface MemberScope {
  role: UserRole;
  assignedTeamIds?: string[] | null;
}

/**
 * Resuelve el scope efectivo de teams visibles para el digest según role.
 *
 * Regla:
 * - owner / coach (DT): siempre ve todos los teams del workspace
 *   (assignedTeamIds se ignora aunque esté presente).
 * - assistant con assignedTeamIds no-vacío: solo ve esos team IDs.
 * - assistant sin assignedTeamIds (o vacío): no ve ninguno — el digest
 *   sale con teams: []. Es un estado válido, no un error.
 *
 * Devuelve `null` para indicar "sin filtro" (owner/DT), o un Set para
 * indicar el conjunto exacto. Cada builder consume este resultado y
 * filtra a su nivel.
 */
export function resolveScopedTeamIds(scope: MemberScope): Set<string> | null {
  if (scope.role === "owner" || scope.role === "coach") return null;
  // assistant
  const ids = Array.isArray(scope.assignedTeamIds) ? scope.assignedTeamIds : [];
  return new Set(ids);
}
