import { Link, useLocation } from 'react-router-dom';

function useQuery() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

export default function InstagramCallback() {
  const query = useQuery();
  const code = query.get('code');
  const error = query.get('error') || query.get('error_description');

  return (
    <section className="section page-header-offset">
      <div className="container" style={{ maxWidth: 760 }}>
        <article className="info-card" style={{ padding: '2rem' }}>
          <p className="eyebrow">Instagram connection</p>
          <h1 style={{ marginTop: 0 }}>OAuth callback received</h1>

          {error ? (
            <p style={{ color: '#ff8e8e' }}>
              Instagram returned an error: {error}
            </p>
          ) : code ? (
            <>
              <p>
                Success. Instagram returned an authorization `code`. This means your redirect URL is configured correctly.
              </p>
              <p style={{ wordBreak: 'break-all', fontSize: '0.95rem', opacity: 0.9 }}>
                Code preview: {code.slice(0, 18)}...
              </p>
            </>
          ) : (
            <p>No code was found in the callback URL.</p>
          )}

          <p style={{ marginTop: '1rem', opacity: 0.9 }}>
            Next step: exchange this `code` on the server for an Instagram access token.
          </p>

          <div style={{ marginTop: '1rem' }}>
            <Link to="/" className="button button-outline">Back to home</Link>
          </div>
        </article>
      </div>
    </section>
  );
}
