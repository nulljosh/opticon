import { useState, useEffect } from 'react';

export default function NewsWidget({ dark, t }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch from api/news endpoint
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setArticles(data.articles || []);
        setError(null);
        setLoading(false);
      } catch (err) {
        console.error('News fetch error:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchNews();
    // Refresh every 5 minutes
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ color: t.textTertiary, fontSize: 12 }}>Loading news...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ color: t.red, fontSize: 11 }}>News unavailable: {error}</div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ color: t.textTertiary, fontSize: 12 }}>No news articles available</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {articles.slice(0, 10).map((article, i) => (
        <a
          key={i}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            display: 'block',
            background: t.glass,
            backdropFilter: 'blur(40px)',
            border: `0.5px solid ${t.border}`,
            borderRadius: 12,
            padding: 12,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            {article.image && (
              <img
                src={article.image}
                alt=""
                style={{ width: 60, height: 60, borderRadius: 6, objectFit: 'cover' }}
              />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>
                {article.title}
              </div>
              <div style={{ fontSize: 10, color: t.textTertiary }}>
                {article.source} • {new Date(article.publishedAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
