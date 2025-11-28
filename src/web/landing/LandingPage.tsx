/**
 * Grumo Landing Page
 *
 * Landing page for grumo.app - converts visitors to store owners
 */

import {
  Header,
  Hero,
  AppVsWeb,
  PushNotifications,
  HowItWorks,
  Pricing,
  FinalCTA,
  Footer,
} from './components';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <PushNotifications />
        <AppVsWeb />
        <HowItWorks />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
