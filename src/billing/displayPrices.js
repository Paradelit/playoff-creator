// src/billing/displayPrices.js
/**
 * Display-only price strings que se renderizan en la landing pública.
 *
 * IMPORTANT: estos strings DEBEN coincidir con los Stripe Prices configurados
 * en el dashboard. Cambiar aquí sin tocar Stripe (o viceversa) hace que la
 * landing mienta al usuario — y eso rompe la confianza desde el primer
 * minuto. Memoria del proyecto: "Landing pública vende la realidad sin mentir".
 *
 * Flujo de actualización al cambiar precio:
 *   1. Stripe Dashboard → editar Price (o crear uno nuevo y reemplazar el secret).
 *   2. Actualizar el valor aquí.
 *   3. Si los IDs cambian, actualizar también los secrets:
 *      - STRIPE_PRICE_MONTHLY / STRIPE_PRICE_ANNUAL (B2C)
 *      - STRIPE_PRICE_B2B_PER_SEAT (B2B)
 *      - VITE_STRIPE_PRICE_* equivalentes en GitHub repo secrets.
 */
export const DISPLAY_PRICES = {
  // B2C — definido en sub-5 y confirmado en Stripe Test Mode.
  proMonthly: '€4,99 / mes',
  proAnnual: '€49 / año',
  proAnnualSavings: '2 meses gratis',
  // B2B — sub-6. Placeholder hasta que el usuario fije precio y cree el Price
  // en Stripe. Cambiar aquí + en Stripe a la vez. Valor orientativo: la
  // industria para SaaS verticales suele ir 30-50% por debajo del B2C-per-mes
  // cuando hay >5 seats; para 2-3 seats casi paridad con B2C.
  proClubPerSeat: '€3,99 / asiento / mes',
};
