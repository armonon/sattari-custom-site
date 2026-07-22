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
            Based in Woodland Hills, California, Sattari Music is led by Mohammad Sattari—a
            professional drummer with over 30 years of international performance experience. Our
            mission is to serve drummers and musicians with curated gear, expert repairs, and a
            passion for the craft.
          </p>
          <p>
            Whether you’re a touring artist or a local student, you’ll find a home for your sound
            and your instrument here.
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
          <h3>@sattarimusic</h3>
          <a
            className="instagram-profile-link"
            href="https://instagram.com/sattarimusic"
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
