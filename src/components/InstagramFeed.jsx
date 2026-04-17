import { useEffect, useState } from 'react';

export default function InstagramFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadFeed() {
      try {
        setLoading(true);
        const response = await fetch('/.netlify/functions/instagram-feed');
        if (!response.ok) {
          throw new Error('Unable to load Instagram feed');
        }

        const data = await response.json();
        if (!mounted) return;

        setPosts(Array.isArray(data.posts) ? data.posts : []);
        setError('');
      } catch {
        if (!mounted) return;
        setError('Unable to load Instagram right now.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadFeed();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="instagram-feed-grid" aria-live="polite">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="instagram-feed-skeleton" />
        ))}
      </div>
    );
  }

  if (error || posts.length === 0) {
    return (
      <div className="instagram-placeholder">
        <span>{error || 'No Instagram posts available yet.'}</span>
      </div>
    );
  }

  return (
    <div className="instagram-feed-grid" aria-label="Recent Instagram photos">
      {posts.map((post) => (
        <a
          key={post.id}
          href={post.permalink}
          target="_blank"
          rel="noreferrer"
          className="instagram-feed-item"
          aria-label="Open Instagram post"
        >
          <img src={post.image} alt={post.caption || 'Instagram post'} loading="lazy" />
        </a>
      ))}
    </div>
  );
}
