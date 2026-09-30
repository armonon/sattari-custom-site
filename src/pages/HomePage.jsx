import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CalendarClock,
  Drum,
  GraduationCap,
  Headphones,
  MapPin,
  Music2,
  SlidersHorizontal,
  Split,
  Wrench,
} from 'lucide-react';
import OptimizedProductImage from '../components/OptimizedProductImage';
import HomeHeroBackground from '../components/HomeHeroBackground';
import HomeLocalGallery from '../components/HomeLocalGallery';
import { BUSINESS, PAGE_SEO } from '../data/siteSeo';
import { bookingPrice, money } from '../utils/studioBooking';
import { SEO } from '../utils/seo';
import './HomePage.css';

const categories = [
  {
    name: 'Cymbals',
    note: 'Find your signature voice.',
    path: '/shop/cymbals',
    image: '/sattari site/cymbal.png',
    color: '#f2dc75',
  },
  {
    name: 'Sticks',
    note: 'The start of a good groove.',
    path: '/shop/sticks',
    image: '/sattari site/sticks.png',
    color: '#f1b7cd',
  },
  {
    name: 'Violins',
    note: 'A little more expression.',
    path: '/shop/violins',
    image: '/sattari site/violins/brescia-acoustic.jpg',
    color: '#b5d8f2',
  },
  {
    name: 'Guitar & bass',
    note: 'Six strings. Or four.',
    path: '/shop/guitar-bass',
    image: '/sattari site/guitars/flame-stratocaster.jpg',
    color: '#bce2c8',
  },
  {
    name: 'Essentials',
    note: 'The details make the kit.',
    path: '/shop/essentials',
    image: '/sattari site/drumpad.png',
    color: '#d9cbed',
  },
];
const services = [
  {
    name: 'Instrument repair',
    detail: 'Setups, tuning & a new lease on life.',
    path: '/services/instrument-repair-los-angeles',
    icon: Wrench,
  },
  {
    name: 'Instrument rentals',
    detail: 'The right gear for your next session.',
    path: '/services/instrument-rentals-los-angeles',
    icon: Drum,
  },
  {
    name: 'Lessons & classes',
    detail: 'Good guidance. Your own pace.',
    path: '/services/music-lessons-los-angeles',
    icon: GraduationCap,
  },
  {
    name: 'Studio & rehearsal',
    detail: 'A little room for your big ideas.',
    path: '/services/rehearsal-space-los-angeles',
    icon: Headphones,
  },
];
const HERO_ART_WIDTHS = [640, 960, 1280, 1536];
const tools = [
  {
    name: 'Studio',
    category: 'Make something',
    detail: 'Your decks. Your mix. Your next idea.',
    path: '/studio',
    image: '/images/tools/studio.jpg',
    alt: 'Sattari Studio with four decks and audio loaded',
    icon: SlidersHorizontal,
    status: 'Alpha',
    color: '#f2a4bd',
  },
  {
    name: 'Learn',
    category: 'Find your rhythm',
    detail: 'Turn the music you love into practice.',
    path: '/learn',
    image: '/images/tools/learn-guitar.jpg',
    alt: 'Sattari Learn song library and interactive guitar practice player',
    icon: Music2,
    status: 'Practice lab',
    color: '#a4ccf3',
  },
  {
    name: 'Stem Separator',
    category: 'Listen closer',
    detail: 'Vocals, drums, bass. A song, opened up.',
    path: '/stem-separator',
    image: '/images/tools/separator.jpg',
    alt: 'Stem Separator with completed drum and bass outputs',
    icon: Split,
    status: 'Beta',
    color: '#b9e3c3',
  },
];

export default function HomePage() {
  return (
    <>
      <SEO {...PAGE_SEO.home} />
      <div className="home-page">
        <section className="home-hero" aria-labelledby="home-title">
          <HomeHeroBackground />
          {/* The largest paint on the page. WebP keeps the transparency at a
              fraction of the 1.9 MB PNG, which stays as the fallback. */}
          <picture>
            <source
              type="image/webp"
              srcSet={HERO_ART_WIDTHS.map(
                (width) => `/images/home/sattari-instruments-cutout-${width}.webp ${width}w`
              ).join(', ')}
              sizes="100vw"
            />
            <img
              className="home-hero-art"
              src="/images/home/sattari-instruments-cutout.png"
              alt="An editorial arrangement of Sattari cymbals, guitar, violin and piano keys"
              width="1536"
              height="1024"
              loading="eager"
              // React 18 warns about fetchPriority; the lowercase attribute renders as is.
              // eslint-disable-next-line react/no-unknown-property
              fetchpriority="high"
              decoding="async"
            />
          </picture>
          <div className="home-width home-hero-inner">
            <div className="home-hero-copy">
              <p className="home-eyebrow">
                <span className="home-location-dot" /> Woodland Hills, California
              </p>
              <h1 id="home-title">
                Sattari<span>Music.</span>
              </h1>
              <p className="home-hero-tagline">
                A world of sound.
                <br />
                All yours to play.
              </p>
              <p className="home-hero-description">
                Instruments to fall for. People to play with.
                <br className="home-desktop-break" /> A whole new space to create.
              </p>
              <div className="home-hero-actions">
                <Link to="/shop" className="home-button home-button-blue">
                  Find your sound <ArrowUpRight size={18} />
                </Link>
                <a href="#home-hub" className="home-text-link">
                  Explore the Hub <ArrowDown size={17} />
                </a>
              </div>
            </div>
            <span className="home-hero-edition">
              Independent spirit.
              <br />
              Endless possibilities.
            </span>
          </div>
        </section>

        <nav className="home-paths" aria-label="Explore Sattari">
          <div className="home-width">
            <a href="#home-shop">
              <span className="home-path-number">01</span>
              <span>
                <strong>Find your instrument</strong>
                <small>The shop</small>
              </span>
              <ArrowDown size={19} />
            </a>
            <a href="#home-local">
              <span className="home-path-number">02</span>
              <span>
                <strong>Make it happen</strong>
                <small>Local services & spaces</small>
              </span>
              <ArrowDown size={19} />
            </a>
            <a href="#home-hub">
              <span className="home-path-number">03</span>
              <span>
                <strong>Follow your curiosity</strong>
                <small>Sattari Hub</small>
              </span>
              <ArrowDown size={19} />
            </a>
          </div>
        </nav>

        <section
          id="home-shop"
          className="home-shop home-section"
          aria-labelledby="home-shop-title"
        >
          <div className="home-width">
            <div className="home-section-heading">
              <div>
                <p className="home-eyebrow">01 / The good stuff</p>
                <h2 id="home-shop-title">Meet your next instrument.</h2>
              </div>
              <Link to="/shop" className="home-text-link">
                Everything in the shop <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="home-products">
              {categories.map((category) => (
                <Link
                  to={category.path}
                  key={category.path}
                  className="home-product"
                  style={{ '--product-color': category.color }}
                  aria-label={`Shop ${category.name}`}
                >
                  <div className="home-product-photo">
                    <OptimizedProductImage
                      src={category.image}
                      alt={`Sattari ${category.name.toLowerCase()}`}
                      sizes="(max-width: 600px) 50vw, 20vw"
                    />
                  </div>
                  <div className="home-product-label">
                    <h3>{category.name}</h3>
                    <ArrowUpRight size={19} />
                  </div>
                  <p>{category.note}</p>
                </Link>
              ))}
            </div>
            <div className="home-shop-footnote">
              <span>Instruments, cymbals & the little things that matter.</span>
              <Link to="/visit">
                Online, or in person <MapPin size={14} />
              </Link>
            </div>
          </div>
        </section>

        <section
          id="home-local"
          className="home-local home-section"
          aria-labelledby="home-local-title"
        >
          <div className="home-width">
            <div className="home-section-heading">
              <div>
                <p className="home-eyebrow">02 / A real place. Real people.</p>
                <h2 id="home-local-title">More than a music store.</h2>
              </div>
              <Link to="/services" className="home-text-link">
                Local services <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="home-local-grid">
              <HomeLocalGallery />
              <div className="home-service-list">
                {services.map(({ name, detail, path, icon: Icon }) => (
                  <Link to={path} key={path} className="home-service">
                    <Icon size={23} strokeWidth={1.5} />
                    <div>
                      <h3>{name}</h3>
                      <p>{detail}</p>
                    </div>
                    <ArrowUpRight size={19} />
                  </Link>
                ))}
              </div>
            </div>
            <div className="home-booking">
              <CalendarClock size={29} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <h3>Your next session starts here.</h3>
                <p>Studio & rehearsal / Every day, 6 PM to midnight</p>
              </div>
              <div className="home-booking-rate">
                <strong>
                  {money(bookingPrice(1))}
                  <small> / hour</small>
                </strong>
                <span>or {money(bookingPrice(4))} for 4 hours</span>
              </div>
              <Link
                className="home-button home-button-dark"
                to="/services/rehearsal-space-los-angeles#local-inquiry"
              >
                Request a time <ArrowUpRight size={17} />
              </Link>
              <span className="home-booking-note">
                Los Angeles time. Subject to availability and confirmation. Payment after approval.
              </span>
            </div>
            <div className="home-address">
              <span>
                <MapPin size={16} /> {BUSINESS.addressLine}
              </span>
              <a href={BUSINESS.phoneHref}>{BUSINESS.shopHoursNote}</a>
              <a href={BUSINESS.directions} target="_blank" rel="noreferrer">
                Get directions <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </section>

        <section
          id="home-hub"
          className="home-digital home-section"
          aria-labelledby="home-hub-title"
        >
          <div className="home-width">
            <div className="home-section-heading">
              <div>
                <p className="home-eyebrow">
                  <AudioLines size={16} /> 03 / A space for your next idea
                </p>
                <h2 id="home-hub-title">
                  Sattari Hub<span>.</span>
                </h2>
                <p className="home-section-description">
                  Make a mix. Find a bassline. Learn something new.
                </p>
              </div>
              <Link to="/hub" className="home-button home-button-light">
                Enter the Hub <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="home-tools">
              {tools.map(
                ({ name, category, detail, path, image, alt, icon: Icon, status, color }) => (
                  <article className="home-tool" key={path} style={{ '--tool-color': color }}>
                    <Link to={path} className="home-tool-link" aria-label={`Open Sattari ${name}`}>
                      <div className="home-tool-eyebrow">
                        <span>
                          <Icon size={17} />
                          {category}
                        </span>
                        <small>{status}</small>
                      </div>
                      <h3>
                        {name}
                        <ArrowUpRight size={23} />
                      </h3>
                      <p>{detail}</p>
                      <div className="home-tool-image">
                        <img src={image} alt={alt} width="1440" height="1000" loading="lazy" />
                      </div>
                    </Link>
                    <Link to={`/tools${path}`} className="home-tool-details">
                      Formats, privacy & limits <ArrowRight size={14} />
                    </Link>
                  </article>
                )
              )}
            </div>
          </div>
        </section>

        <section className="home-signoff">
          <div className="home-width">
            <div>
              <p className="home-eyebrow">For the love of making music.</p>
              <h2>
                Come as you are.
                <br />
                Leave with a little more sound.
              </h2>
            </div>
            <Link to="/visit" className="home-button home-button-dark">
              Come say hello <ArrowUpRight size={19} />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
