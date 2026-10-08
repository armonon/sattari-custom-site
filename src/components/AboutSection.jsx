import SattariPortrait from './SattariPortrait';
import InstagramFeed from './InstagramFeed';

export function FounderIntro({ className = 'section section-contrast' }) {
  return (
    <section className={className}>
      <div className="container about-row">
        <div className="about-row-copy">
          <p className="eyebrow">About Sattari Music</p>
          <h2>Founded by Mohammad Sattari</h2>
          <p>
            Mohammad Sattari is a professional drummer with over 30 years of international
            performance experience, based in Woodland Hills, California. Sattari Music grew from
            that background: instruments hand-selected and sold directly, online tools built for
            practice and production, and an appointment-only shop in Woodland Hills for players in
            the San Fernando Valley who need repair, setup, rentals or lesson space.
          </p>
          <p>
            The catalog covers cymbals, drumsticks, violins, guitars and accessories. The online
            side includes a stem separator, a browser DAW, guitar lessons and free Mac audio
            plugins—all built and maintained in California.
          </p>
        </div>
        <div className="about-row-portrait">
          <SattariPortrait />
        </div>
      </div>
    </section>
  );
}

export function InstagramSection() {
  return (
    <section className="section instagram-row">
      <div className="instagram-row-inner">
        <div
          className="info-card instagram-card"
          style={{ width: '100%', margin: '0 auto', textAlign: 'center' }}
        >
          <p className="card-kicker">Follow us on Instagram</p>
          <h3>@sattari.music</h3>
          <a
            className="instagram-profile-link"
            href="https://www.instagram.com/sattari.music/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Instagram profile
          </a>
          <InstagramFeed />
        </div>
      </div>
    </section>
  );
}

export default function AboutSection() {
  return (
    <>
      <FounderIntro />
      <InstagramSection />
    </>
  );
}
