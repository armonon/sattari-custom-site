import { Link } from 'react-router-dom';
import { getNOWTenantProfileCard } from '../data/nowProfiles';

export default function NowTenantProfileCard({
  handle = 'armon',
  tenantId = 'sattari_market',
  variant,
  eyebrow = 'NOW profile card',
}) {
  const card = getNOWTenantProfileCard(handle, tenantId, variant);

  if (!card) return null;

  return (
    <article className="now-tenant-card" aria-label={`${card.displayName} NOW tenant profile card`}>
      <div className="now-card-avatar" aria-hidden="true">
        {card.avatarInitials}
      </div>
      <div className="now-card-copy">
        <p className="card-kicker">{eyebrow}</p>
        <h3>{card.title}</h3>
        <p>
          <strong>{card.displayName}</strong> · @{card.handle}
        </p>
        <p>{card.subtitle}</p>
        <ul className="now-card-trust-list" aria-label="NOW trust signals">
          {card.trustSignals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
        <Link className="text-link" to={`/profiles/${card.handle}`}>
          View full NOW profile
        </Link>
      </div>
    </article>
  );
}
