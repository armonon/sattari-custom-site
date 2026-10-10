import { Helmet } from 'react-helmet-async';

// Route-scoped like StudioInstallMetadata: only the /studio/* tools install as
// the "Sattari" app; the shop, Press and the marketing pages never offer it.
export default function SattariAppMetadata() {
  return (
    <Helmet>
      <link rel="manifest" href="/studio/sattari.webmanifest" />
      <link rel="apple-touch-icon" href="/images/sattari-app/apple-touch-icon.png" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="Sattari" />
    </Helmet>
  );
}
