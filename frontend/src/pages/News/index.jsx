
import React, { useState, useEffect } from "react";
import "./index.css";
import NewsCard from "../../components/NewsCard";

const API_KEY = process.env.REACT_APP_NEWS_API_KEY;

const News = () => {
  const [news, setNews] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const fetchArticles = async (url) => {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok || data.status === "error") {
        throw new Error(data.message || "Unable to fetch news.");
      }

      return (data.articles || [])
        .filter((article) => article.urlToImage && article.title)
        .slice(0, 6);
    };

    const loadNews = async () => {
      if (!API_KEY) {
        setError("News API key is missing. Configure REACT_APP_NEWS_API_KEY.");
        setLoading(false);
        return;
      }

      try {
        const [latest, healthAlerts] = await Promise.all([
          fetchArticles(
            `https://newsapi.org/v2/top-headlines?category=health&language=en&pageSize=6&apiKey=${API_KEY}`
          ),
          fetchArticles(
            `https://newsapi.org/v2/everything?q=health-alerts&sortBy=publishedAt&language=en&pageSize=6&apiKey=${API_KEY}`
          ),
        ]);

        setNews(latest);
        setAlerts(healthAlerts);
        setError("");
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Health news error:", err);
          setError(err.message || "Unable to load health news.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadNews();

    return () => controller.abort();
  }, []);

  const retryNews = () => {
    window.location.reload();
  };

  const renderArticles = (articles, type) => {
    if (loading) {
      return (
        <div className="news-grid">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div className="news-skeleton" key={item}>
              <div className="news-skeleton-image" />
              <div className="news-skeleton-line" />
              <div className="news-skeleton-line short" />
            </div>
          ))}
        </div>
      );
    }

    if (!articles.length) {
      return (
        <div className="news-empty">
          <span className="news-empty-icon">📰</span>
          <h3>No articles available</h3>
          <p>There are no articles to display in this section right now.</p>
        </div>
      );
    }

    return (
      <div className="news-grid">
        {articles.map((article, index) => (
          <div
            className="news-card-wrapper"
            key={`${type}-${article.url || index}`}
          >
            <NewsCard news={article} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <main className="health-news-page">
      <header className="health-news-header">
        <div className="health-news-heading">
          <span className="health-news-eyebrow">
            <span className="health-news-live-dot" />
            YOUR HEALTH INFORMATION HUB
          </span>

          <h1>Health News</h1>

          <p>
            Stay informed with the latest medical developments,
            healthcare insights and public health updates.
          </p>
        </div>

        <div className="health-news-header-icon">✚</div>
      </header>

      {error && (
        <div className="health-news-error" role="alert">
          <div>
            <strong>We couldn't load the news.</strong>
            <p>{error}</p>
          </div>
          <button type="button" onClick={retryNews}>
            Try again
          </button>
        </div>
      )}

      <section className="health-news-section">
        <div className="health-news-section-heading">
          <div className="health-news-section-icon">✦</div>
          <div>
            <h2>Latest Medical News</h2>
            <p>Discover recent healthcare and medical stories.</p>
          </div>
        </div>

        {renderArticles(news, "latest")}
      </section>

      <section className="health-news-section">
        <div className="health-news-section-heading">
          <div className="health-news-section-icon alert-icon">!</div>
          <div>
            <h2>Public Health Alerts</h2>
            <p>Updates and reports about public health concerns.</p>
          </div>
        </div>

        {renderArticles(alerts, "alerts")}
      </section>

      <footer className="health-news-footer">
        <span>✚ HealthAI</span>
        <p>
          News is provided by third-party publishers. Verify medical
          information with reliable sources and qualified professionals.
        </p>
      </footer>
    </main>
  );
};

export default News;
