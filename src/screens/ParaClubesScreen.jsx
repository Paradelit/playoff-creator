import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Building2, Users, Calendar, BarChart3, Shield, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePublicTheme } from '../hooks/usePublicTheme';
import LandingFooter from '../components/landing/LandingFooter';
import { DISPLAY_PRICES } from '../billing/displayPrices';
import { SITE_URL } from '../siteConfig';

const TITLE = 'Pick&Coach para clubes · Workspace compartido para el staff';
const DESCRIPTION =
  'Director técnico, coaches y equipos en un workspace coordinado. Pick para cada miembro, calendario cruzado, KPIs club-wide. Per-seat sin mínimo.';

const FEATURES = [
  {
    icon: Users,
    title: 'Roles claros',
    body: 'Owner del club (DT principal) invita coaches por link y asigna equipos. Cada coach ve solo lo suyo. El DT lo ve todo.',
  },
  {
    icon: Calendar,
    title: 'Calendario cruzado',
    body: 'Entrenos, partidos y playoffs de TODOS los equipos en una sola vista. Color por team, filtrable. Coach ve sus partidos, DT ve la semana del club.',
  },
  {
    icon: BarChart3,
    title: 'KPIs del club',
    body: 'Cuántos equipos, cuántos entrenos esta semana, cuántos partidos en 14 días, cuánto staff activo. Dashboard de DT con la foto entera.',
  },
  {
    icon: Shield,
    title: 'Facturación per-seat',
    body: 'Pagas solo por miembros activos. Stripe prorratea automáticamente al añadir o quitar staff. Sin mínimo, sin sorpresas.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Activas Pro Club',
    body: 'El DT entra a su área privada, va a Plan del club y activa Pro Club desde Stripe Checkout.',
  },
  {
    step: '2',
    title: 'Invitas a tu staff',
    body: 'Generas links de invitación con rol (DT/coach) + equipos asignados. Cada link es de un solo uso, expira en 7 días.',
  },
  {
    step: '3',
    title: 'El staff acepta y entra',
    body: 'El coach abre el link, hace login (Google o email) y aterriza en su contexto del club ya configurado.',
  },
  {
    step: '4',
    title: 'Pick trabaja para todos',
    body: 'Cada miembro tiene Pick ilimitado. El cuaderno, calendario y biblioteca son del club. Si un coach se va, sus datos quedan en el club.',
  },
];

export default function ParaClubesScreen() {
  const { user } = useAuth();
  const { theme } = usePublicTheme();
  const dark = theme === 'dark';

  const ctaTo = user ? '/upgrade/club' : '/login?redirect=%2Fupgrade%2Fclub';

  return (
    <>
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={SITE_URL + '/para-clubes'} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={SITE_URL + '/para-clubes'} />
      </Helmet>

      <main className={dark ? 'bg-[#05050d]' : 'bg-white'}>
        <section
          className="relative overflow-hidden px-6 pt-20 pb-16 lg:px-8 lg:pt-28 lg:pb-24"
          style={{
            background: dark
              ? 'linear-gradient(180deg,#05050d 0%,#0f0f24 100%)'
              : 'linear-gradient(180deg,#fff 0%,#eef2ff 100%)',
          }}
        >
          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5">
              <Building2 size={13} className="text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
                Para clubes
              </span>
            </div>
            <h1
              className={`mb-5 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl ${dark ? 'text-white' : 'text-slate-900'}`}
            >
              Un workspace
              <br />
              para todo el staff.
            </h1>
            <p className={`mx-auto mb-8 max-w-2xl text-lg ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              Director técnico + coaches en un único contexto. Calendario, cuaderno y Pick compartidos. Facturación
              per-seat — pagas solo por quien está activo.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to={ctaTo}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-bold text-white shadow-xl transition-all hover:scale-[1.03]"
                style={{ background: 'linear-gradient(135deg,#6366f1,#4338ca)' }}
              >
                Activar Pro Club <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                to="/precios"
                className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-bold transition-all hover:scale-[1.03] ${
                  dark
                    ? 'border border-white/20 text-white hover:bg-white/10'
                    : 'border border-slate-300 text-slate-900 hover:bg-slate-50'
                }`}
              >
                Ver precios
              </Link>
            </div>
            <p className={`mt-4 text-xs ${dark ? 'text-slate-500' : 'text-slate-500'}`}>
              {DISPLAY_PRICES.proClubPerSeat} · Sin mínimo · Cancelas cuando quieras.
            </p>
          </div>
        </section>

        <section className="px-6 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <h2
              className={`mb-12 text-center text-2xl font-extrabold sm:text-3xl ${dark ? 'text-white' : 'text-slate-900'}`}
            >
              Cómo es la vida del club en Pick
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className={`flex gap-4 rounded-2xl border p-6 ${
                    dark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white shadow-sm'
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      dark ? 'bg-indigo-500/20' : 'bg-indigo-100'
                    }`}
                  >
                    <Icon size={22} className="text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className={`mb-1.5 font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
                    <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'}`}>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className={`border-t px-6 py-16 lg:px-8 lg:py-24 ${dark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}
        >
          <div className="mx-auto max-w-4xl">
            <h2
              className={`mb-12 text-center text-2xl font-extrabold sm:text-3xl ${dark ? 'text-white' : 'text-slate-900'}`}
            >
              Cómo se monta en 4 pasos
            </h2>
            <ol className="space-y-6">
              {HOW_IT_WORKS.map(({ step, title, body }) => (
                <li
                  key={step}
                  className={`flex gap-5 rounded-2xl border p-6 ${
                    dark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white shadow-sm'
                  }`}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-white"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#4338ca)' }}
                    aria-hidden="true"
                  >
                    {step}
                  </div>
                  <div>
                    <h3 className={`mb-1.5 font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
                    <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'}`}>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className={`mb-6 text-3xl font-extrabold sm:text-4xl ${dark ? 'text-white' : 'text-slate-900'}`}>
              Mete a tu staff
              <br />
              en el mismo plano.
            </h2>
            <p className={`mb-8 text-lg ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              Activas Pro Club desde tu área privada en menos de un minuto. Stripe Test Mode hasta que estés listo para
              cobrar de verdad.
            </p>
            <Link
              to={ctaTo}
              className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-lg font-bold text-white shadow-xl transition-all hover:scale-[1.03]"
              style={{ background: 'linear-gradient(135deg,#6366f1,#4338ca)' }}
            >
              Activar Pro Club <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <LandingFooter />
      </main>
    </>
  );
}
