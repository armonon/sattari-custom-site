import { Helmet } from 'react-helmet-async';

// Route-scoped: the shop and other Sattari tools must not install as StemDeck.
export default function StudioInstallMetadata() {
  return (
    <Helmet>
      <link rel="manifest" href="/studio.webmanifest" />
      <link rel="apple-touch-icon" href="/images/stemdeck/apple-touch-icon.png" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="StemDeck" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    </Helmet>
  );
}
