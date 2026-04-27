import React from 'react';
import { Helmet } from 'react-helmet-async';
import HeroSection from '../components/landing/HeroSection';
import FeaturesGrid from '../components/landing/FeaturesGrid';
import PlayoffScrollTelling from '../components/landing/PlayoffScrollTelling';
import HowItWorks from '../components/landing/HowItWorks';
import FeaturedHelp from '../components/landing/FeaturedHelp';
import FinalCTA from '../components/landing/FinalCTA';
import LandingFooter from '../components/landing/LandingFooter';
import { SITE_URL, OG_IMAGE } from '../siteConfig';

const TITLE = 'Pick&Coach — Copiloto IA para entrenadores de baloncesto';
const DESCRIPTION =
  'Playoffs, entrenamientos, calendario y scouting. Todo en un sitio, con un copiloto IA que hace el trabajo contigo.';

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Pick&Coach',
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web',
  description: DESCRIPTION,
  url: SITE_URL,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
  },
};

export default function LandingScreen() {
  return (
    <>
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={SITE_URL + '/'} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={SITE_URL + '/'} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <script type="application/ld+json">{JSON.stringify(JSON_LD)}</script>
      </Helmet>

      <HeroSection />
      <FeaturesGrid />
      <PlayoffScrollTelling />
      <HowItWorks />
      <FeaturedHelp />
      <FinalCTA />
      <LandingFooter />
    </>
  );
}
