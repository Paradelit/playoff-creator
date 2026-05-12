import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Check, Sparkles, Building2, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePublicTheme } from '../hooks/usePublicTheme';
import LandingFooter from '../components/landing/LandingFooter';
import { DISPLAY_PRICES } from '../billing/displayPrices';
import { SITE_URL } from '../siteConfig';

const TITLE = 'Pick&Coach · Precios';
const DESCRIPTION =
  'Plan Free, Pro para entrenadores y Pro Club per-seat para clubes con director técnico. Sin compromiso, sin sorpresas.';

const PERSONAL_FEATURES = [
  'Calendario, cuaderno, biblioteca, brackets manuales',
  'Convocatorias, scouting y análisis de partidos',
  '50 acciones de IA al mes (Free) o ilimitadas (Pro)',
  'Centro de ayuda completo con casos prácticos',
];

const PRO_FEATURES = [
  'Todo lo del Free',
  'Pick ilimitado (chat, brackets IA, calendar AI)',
  'Cancela cuando quieras desde el Customer Portal',
  'Métricas mensuales y exports avanzados',
];

const CLUB_FEATURES = [
  'Workspace compartido para todo el staff',
  'Director Técnico gestiona invitaciones y permisos',
  'Pick ilimitado para cada miembro activo',
  'Calendario cruzado, KPIs club-wide, scouting compartido',
  'Facturación per-seat: pagas solo por miembros activos',
];

export default function PricingScreen() {
  const { user } = useAuth();
  const { theme } = usePublicTheme();
  const dark = theme === 'dark';

  // Los CTAs llevan al checkout en /upgrade o /upgrade/club. Si el visitante no
  // está autenticado, AppRouter redirige a /login con redirect param — el flujo
  // funciona uniforme entre logueado y no logueado.
  const proCta = user ? '/upgrade' : '/login?redirect=%2Fupgrade';
  const clubCta = user ? '/upgrade/club' : '/login?redirect=%2Fupgrade%2Fclub';

  return (
    <>
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={SITE_URL + '/precios'} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={SITE_URL + '/precios'} />
      </Helmet>

      <main className={dark ? 'bg-[#05050d]' : 'bg-white'}>
        <section className="px-6 pt-16 pb-12 lg:px-8 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5">
              <Sparkles size={13} className="text-orange-400" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-300">
                Precios claros
              </span>
            </div>
            <h1
              className={`mb-4 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl ${dark ? 'text-white' : 'text-slate-900'}`}
            >
              Tú entrenas. Pick trabaja.
            </h1>
            <p className={`text-lg ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
              Empieza gratis. Cuando Pick deje de ser un extra y pase a ser pieza del staff, eliges plan.
            </p>
          </div>
        </section>

        <section className="px-6 pb-20 lg:px-8 lg:pb-28">
          <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
            {/* Coach Free */}
            <article
              className={`flex flex-col rounded-2xl border p-6 ${
                dark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white shadow-sm'
              }`}
            >
              <div className="mb-4 flex items-center gap-2">
                <User size={18} className="text-slate-500" aria-hidden="true" />
                <span
                  className={`text-sm font-bold uppercase tracking-wider ${dark ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  Coach Free
                </span>
              </div>
              <p className={`mb-1 text-3xl font-extrabold ${dark ? 'text-white' : 'text-slate-900'}`}>Gratis</p>
              <p className={`mb-5 text-xs ${dark ? 'text-slate-500' : 'text-slate-500'}`}>Para siempre. Sin tarjeta.</p>
              <ul className="mb-6 flex-1 space-y-2 text-sm">
                {PERSONAL_FEATURES.map((feat) => (
                  <li key={feat} className={`flex items-start gap-2 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={user ? '/area-privada' : '/login'}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition-all hover:scale-[1.02] ${
                  dark
                    ? 'border border-white/20 text-white hover:bg-white/10'
                    : 'border border-slate-300 text-slate-900 hover:bg-slate-50'
                }`}
              >
                {user ? 'Ir a tu área' : 'Empezar gratis'}
              </Link>
            </article>

            {/* Coach Pro */}
            <article
              className={`relative flex flex-col rounded-2xl border-2 p-6 ${
                dark ? 'border-orange-500/60 bg-orange-500/10' : 'border-orange-500 bg-orange-50 shadow-lg'
              }`}
            >
              <span
                className="absolute -top-3 right-6 rounded-full bg-orange-500 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white"
                aria-hidden="true"
              >
                Más popular
              </span>
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-orange-500" aria-hidden="true" />
                <span
                  className={`text-sm font-bold uppercase tracking-wider ${dark ? 'text-orange-200' : 'text-orange-700'}`}
                >
                  Coach Pro
                </span>
              </div>
              <p className={`mb-1 text-3xl font-extrabold ${dark ? 'text-white' : 'text-slate-900'}`}>
                {DISPLAY_PRICES.proMonthly}
              </p>
              <p className={`mb-5 text-xs ${dark ? 'text-orange-200' : 'text-orange-700'}`}>
                o {DISPLAY_PRICES.proAnnual} ({DISPLAY_PRICES.proAnnualSavings})
              </p>
              <ul className="mb-6 flex-1 space-y-2 text-sm">
                {PRO_FEATURES.map((feat) => (
                  <li key={feat} className={`flex items-start gap-2 ${dark ? 'text-slate-200' : 'text-slate-800'}`}>
                    <Check size={16} className="mt-0.5 shrink-0 text-orange-500" aria-hidden="true" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={proCta}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
              >
                Hazte Pro <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>

            {/* Pro Club */}
            <article
              className={`flex flex-col rounded-2xl border p-6 ${
                dark ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-indigo-200 bg-indigo-50 shadow-sm'
              }`}
            >
              <div className="mb-4 flex items-center gap-2">
                <Building2 size={18} className="text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
                <span
                  className={`text-sm font-bold uppercase tracking-wider ${dark ? 'text-indigo-200' : 'text-indigo-700'}`}
                >
                  Pro Club
                </span>
              </div>
              <p className={`mb-1 text-3xl font-extrabold ${dark ? 'text-white' : 'text-slate-900'}`}>
                {DISPLAY_PRICES.proClubPerSeat}
              </p>
              <p className={`mb-5 text-xs ${dark ? 'text-indigo-200' : 'text-indigo-700'}`}>
                Sin mínimo. Stripe prorratea al añadir/quitar staff.
              </p>
              <ul className="mb-6 flex-1 space-y-2 text-sm">
                {CLUB_FEATURES.map((feat) => (
                  <li key={feat} className={`flex items-start gap-2 ${dark ? 'text-slate-200' : 'text-slate-800'}`}>
                    <Check size={16} className="mt-0.5 shrink-0 text-indigo-500" aria-hidden="true" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/para-clubes"
                className={`mb-2 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition-all hover:scale-[1.02] ${
                  dark ? 'text-indigo-200 hover:text-white' : 'text-indigo-700 hover:text-indigo-900'
                }`}
              >
                Cómo funciona para clubes →
              </Link>
              <Link
                to={clubCta}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg,#6366f1,#4338ca)' }}
              >
                Activar Pro Club <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          </div>
        </section>

        <section
          className={`border-t px-6 py-16 ${dark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}
        >
          <div className="mx-auto max-w-3xl">
            <h2 className={`mb-6 text-2xl font-extrabold ${dark ? 'text-white' : 'text-slate-900'}`}>Dudas comunes</h2>
            <dl className="space-y-5 text-sm">
              <div>
                <dt className={`font-bold ${dark ? 'text-slate-200' : 'text-slate-900'}`}>
                  ¿Qué pasa si me paso del cap de Free?
                </dt>
                <dd className={dark ? 'text-slate-400' : 'text-slate-600'}>
                  Pick te avisa al 80% y bloquea las acciones de IA al 100%. El resto de la app (calendario, cuaderno,
                  brackets) sigue funcionando. Pasa el día 1 de mes y se reinicia el contador.
                </dd>
              </div>
              <div>
                <dt className={`font-bold ${dark ? 'text-slate-200' : 'text-slate-900'}`}>
                  ¿Puedo cancelar Pro cuando quiera?
                </dt>
                <dd className={dark ? 'text-slate-400' : 'text-slate-600'}>
                  Sí, desde el Customer Portal de Stripe. Tienes acceso a Pro hasta el final del periodo pagado y luego
                  vuelves a Free sin perder datos.
                </dd>
              </div>
              <div>
                <dt className={`font-bold ${dark ? 'text-slate-200' : 'text-slate-900'}`}>¿Cómo funciona Pro Club?</dt>
                <dd className={dark ? 'text-slate-400' : 'text-slate-600'}>
                  El director técnico crea el club, invita coaches por link, y Stripe factura mes a mes según el número
                  de miembros activos. Si un coach se va, el seat baja y el mes siguiente facturas menos. Sin mínimo de
                  miembros.
                </dd>
              </div>
              <div>
                <dt className={`font-bold ${dark ? 'text-slate-200' : 'text-slate-900'}`}>
                  ¿Quién paga, el coach o el club?
                </dt>
                <dd className={dark ? 'text-slate-400' : 'text-slate-600'}>
                  En Pro Club lo paga el club entero. Si un coach está en un club Free, también puede tener Pro personal
                  en su propio workspace — son contextos independientes.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <LandingFooter />
      </main>
    </>
  );
}
