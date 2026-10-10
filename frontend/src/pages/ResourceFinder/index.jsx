
import React, { useState } from 'react';
import './index.css';
import { BsFillArrowDownCircleFill } from 'react-icons/bs';
import {
  MdSearch,
  MdOndemandVideo,
  MdHealthAndSafety,
  MdArrowOutward,
  MdErrorOutline
} from 'react-icons/md';

const ResourceFinder = () => {
  const [content, setContent] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRecommendations = async () => {
    const query = input.trim();

    if (!query || loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://127.0.0.1:5000/resource', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: query }),
      });

      if (!response.ok) {
        throw new Error('Unable to fetch resources. Please try again.');
      }

      const data = await response.json();
      setContent(
        Array.isArray(data.recommendations) ? data.recommendations : []
      );
      setInput('');
    } catch (err) {
      console.error('Resource Finder error:', err);
      setError(
        'Resources load zale nahit. Backend server chalu aahe ka te check kar.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      fetchRecommendations();
    }
  };

  return (
    <main className="rf-page">
      <section className="rf-hero">
        <div className="rf-badge">
          <MdHealthAndSafety size={18} />
          <span>HEALTHAI RESOURCE CENTER</span>
        </div>

        <h1>
          Find the right <span>health resources.</span>
        </h1>

        <p className="rf-description">
          Discover helpful healthcare videos and educational resources
          tailored to what you want to learn.
        </p>

        <div className="rf-search">
          <MdSearch className="rf-search-icon" size={25} />

          <input
            type="text"
            placeholder="Search health topics, symptoms, or medical resources..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search health resources"
          />

          <button
            type="button"
            onClick={fetchRecommendations}
            disabled={loading || !input.trim()}
            aria-label="Find resources"
          >
            {loading ? (
              <span className="rf-spinner" />
            ) : (
              <>
                <span>Search</span>
                <BsFillArrowDownCircleFill size={23} />
              </>
            )}
          </button>
        </div>

        <div className="rf-search-hint">
          <span>Try searching for:</span>
          {['Heart health', 'Diabetes', 'Healthy lifestyle'].map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setInput(topic)}
            >
              {topic}
            </button>
          ))}
        </div>
      </section>

      <section className="rf-results">
        <div className="rf-section-heading">
          <div className="rf-heading-icon">
            <MdOndemandVideo size={23} />
          </div>

          <div>
            <h2>Recommended Resources</h2>
            <p>Educational videos selected for your search</p>
          </div>

          {content.length > 0 && (
            <span className="rf-result-count">
              {content.length} {content.length === 1 ? 'resource' : 'resources'}
            </span>
          )}
        </div>

        {loading && (
          <div className="rf-status">
            <span className="rf-spinner rf-spinner-blue" />
            <p>Finding useful resources for you...</p>
          </div>
        )}

        {!loading && error && (
          <div className="rf-message rf-error">
            <MdErrorOutline size={25} />
            <div>
              <strong>Something went wrong</strong>
              <p>{error}</p>
              <button type="button" onClick={fetchRecommendations}>
                Try again
              </button>
            </div>
          </div>
        )}

        {!loading && !error && content.length === 0 && (
          <div className="rf-empty">
            <div className="rf-empty-icon">
              <MdSearch size={36} />
            </div>
            <h3>What would you like to learn today?</h3>
            <p>
              Enter a health topic above and click Search to discover
              recommended educational videos.
            </p>
          </div>
        )}

        {!loading && content.length > 0 && (
          <div className="rf-grid">
            {content.map((video, index) => (
              <article className="rf-card" key={video.url || index}>
                <div className="rf-video">
                  {video.url ? (
                    <iframe
                      src={video.url}
                      title={video.title || 'Healthcare educational video'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    />
                  ) : (
                    <div className="rf-video-placeholder">
                      <MdOndemandVideo size={38} />
                      <span>Video preview unavailable</span>
                    </div>
                  )}
                </div>

                <div className="rf-card-body">
                  <span className="rf-card-label">
                    <MdHealthAndSafety size={15} />
                    HEALTH EDUCATION
                  </span>

                  <h3>{video.title || 'Healthcare Resource'}</h3>

                  {video.url && (
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rf-open-link"
                    >
                      Open resource <MdArrowOutward size={17} />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="rf-footer">
        <MdHealthAndSafety size={18} />
        <span>
          For educational purposes only. Consult a qualified healthcare
          professional for personal medical advice.
        </span>
      </footer>
    </main>
  );
};

export default ResourceFinder;
