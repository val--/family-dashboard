import React, { useState, useEffect, useRef } from 'react';
import { REFRESH_INTERVAL } from '../../constants';

function NewsTicker() {
  const [newsData, setNewsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [newsType, setNewsType] = useState('france'); // 'france', 'monde', 'tech'
  const [showNewsTypeMenu, setShowNewsTypeMenu] = useState(false);
  const [animationDuration, setAnimationDuration] = useState(360); // Default duration for constant speed
  const tickerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const clickTimeoutRef = useRef(null);
  const menuRef = useRef(null);

  const getNewsTypeLabel = () => {
    switch (newsType) {
      case 'france':
        return 'France';
      case 'monde':
        return 'Monde';
      case 'tech':
        return 'Tech';
      default:
        return 'Actualités';
    }
  };

  const fetchNews = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/news?type=${newsType}`);
      const result = await response.json();
      
      if (result.success) {
        setNewsData(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch news data');
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      setError(err.message || 'Erreur lors du chargement des actualités');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    
    const interval = setInterval(() => {
      fetchNews();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [newsType]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && 
          !tickerRef.current?.contains(event.target)) {
        setShowNewsTypeMenu(false);
      }
    };

    if (showNewsTypeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showNewsTypeMenu]);

  // Calculate animation duration based on content width for constant speed
  // Target speed: approximately 50px per second
  useEffect(() => {
    if (scrollContainerRef.current && newsData && newsData.articles && newsData.articles.length > 0) {
      // Wait for DOM to render
      const timer = setTimeout(() => {
        const scrollText = scrollContainerRef.current?.querySelector('.news-ticker-scrolling-text');
        if (scrollText) {
          // Get the actual width of one set of items (we have 3 copies)
          const totalWidth = scrollText.scrollWidth / 3;
          // Calculate duration for constant speed: 50px per second
          const speedPxPerSecond = 50;
          const calculatedDuration = totalWidth / speedPxPerSecond;
          // Minimum duration of 60s, maximum of 600s
          const clampedDuration = Math.max(60, Math.min(600, calculatedDuration));
          setAnimationDuration(clampedDuration);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [newsData]);

  if (loading && !newsData) {
    return (
      <div className="news-ticker">
        <div className="news-ticker-label">
          <span className="news-ticker-label-icon">📰</span>
          <span>{getNewsTypeLabel()}</span>
        </div>
        <div className="news-ticker-content">
          <div className="news-ticker-loading">Chargement des actualités...</div>
        </div>
      </div>
    );
  }

  if (error && !newsData) {
    return (
      <div className="news-ticker">
        <div className="news-ticker-label">
          <span className="news-ticker-label-icon">📰</span>
          <span>{getNewsTypeLabel()}</span>
        </div>
        <div className="news-ticker-content">
          <div className="news-ticker-error">Actualités indisponibles</div>
        </div>
      </div>
    );
  }

  if (!newsData || !newsData.articles || newsData.articles.length === 0) {
    return (
      <div className="news-ticker">
        <div className="news-ticker-label">
          <span className="news-ticker-label-icon">📰</span>
          <span>{getNewsTypeLabel()}</span>
        </div>
        <div className="news-ticker-content">
          <div className="news-ticker-empty">Aucune actualité disponible</div>
        </div>
      </div>
    );
  }

  // Helper function to find article at a specific X position
  const findArticleAtPosition = (x, scrollContainer, scrollText, articles) => {
    const containerRect = scrollContainer.getBoundingClientRect();
    const searchX = x !== null ? x : containerRect.left + containerRect.width / 2;
    
    // Find all article wrappers
    const articleWrappers = scrollText.querySelectorAll('.news-ticker-item-wrapper');
    
    // Find the article that contains or is closest to the search position
    let closestArticle = null;
    let closestDistance = Infinity;
    
    articleWrappers.forEach((wrapper) => {
      const wrapperRect = wrapper.getBoundingClientRect();
      
      // Check if the click/search position is within this wrapper
      if (searchX >= wrapperRect.left && searchX <= wrapperRect.right) {
        // This wrapper contains the position, use it
        closestArticle = wrapper;
        closestDistance = 0;
      } else {
        // Calculate distance to this wrapper
        const wrapperCenterX = wrapperRect.left + wrapperRect.width / 2;
        const distance = Math.abs(wrapperCenterX - searchX);
        
        // Only consider wrappers that are at least partially visible
        if (wrapperRect.right > containerRect.left && wrapperRect.left < containerRect.right) {
          if (distance < closestDistance) {
            closestDistance = distance;
            closestArticle = wrapper;
          }
        }
      }
    });
    
    if (closestArticle) {
      const articleIndex = parseInt(closestArticle.getAttribute('data-article-index'), 10);
      if (!isNaN(articleIndex) && articleIndex >= 0 && articleIndex < articles.length) {
        return articles[articleIndex];
      }
    }
    return articles.length > 0 ? articles[0] : null;
  };

  // Handle click/touch to pause and show modal
  const handleTickerClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isPaused) {
      // If already paused, resume
      setIsPaused(false);
      setSelectedArticle(null);
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
    } else {
      // Pause and find which article is currently visible
      setIsPaused(true);
      
      // Find which article is visible by checking DOM elements at click position
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer && newsData && newsData.articles && newsData.articles.length > 0) {
        const scrollText = scrollContainer.querySelector('.news-ticker-scrolling-text');
        if (scrollText) {
          // Use the click coordinates to find the exact article clicked
          const clickX = e.clientX || (e.touches && e.touches[0]?.clientX) || (e.changedTouches && e.changedTouches[0]?.clientX);
          const clickY = e.clientY || (e.touches && e.touches[0]?.clientY) || (e.changedTouches && e.changedTouches[0]?.clientY);
          
          let selectedArticle = null;
          
          if (clickX !== undefined && clickY !== undefined) {
            // Find the element at the click position
            const elementAtPoint = document.elementFromPoint(clickX, clickY);
            
            // Traverse up the DOM tree to find the article wrapper
            let articleWrapper = elementAtPoint;
            while (articleWrapper && !articleWrapper.classList.contains('news-ticker-item-wrapper')) {
              articleWrapper = articleWrapper.parentElement;
            }
            
            if (articleWrapper && articleWrapper.classList.contains('news-ticker-item-wrapper')) {
              const articleIndex = parseInt(articleWrapper.getAttribute('data-article-index'), 10);
              if (!isNaN(articleIndex) && articleIndex >= 0 && articleIndex < newsData.articles.length) {
                selectedArticle = newsData.articles[articleIndex];
              }
            }
            
            // If we didn't find an article by traversing, use position-based search
            if (!selectedArticle) {
              selectedArticle = findArticleAtPosition(clickX, scrollContainer, scrollText, newsData.articles);
            }
          } else {
            // Fallback: find article at center of container
            selectedArticle = findArticleAtPosition(null, scrollContainer, scrollText, newsData.articles);
          }
          
          if (selectedArticle) {
            setSelectedArticle(selectedArticle);
          } else if (newsData.articles.length > 0) {
            setSelectedArticle(newsData.articles[0]);
          }
          
          // Set a timeout to allow overlay clicks after modal opens
          clickTimeoutRef.current = setTimeout(() => {
            clickTimeoutRef.current = null;
          }, 100);
        } else {
          // Fallback: use first article
          setSelectedArticle(newsData.articles[0]);
          clickTimeoutRef.current = setTimeout(() => {
            clickTimeoutRef.current = null;
          }, 100);
        }
      } else {
        // Fallback: use first article
        if (newsData && newsData.articles && newsData.articles.length > 0) {
          setSelectedArticle(newsData.articles[0]);
        }
        clickTimeoutRef.current = setTimeout(() => {
          clickTimeoutRef.current = null;
        }, 100);
      }
    }
  };

  const handleModalOverlayClick = (e) => {
    // Only close if clicking directly on the overlay, not on the modal itself
    // Don't close if we just opened (within the timeout period)
    if (e.target === e.currentTarget && !clickTimeoutRef.current) {
      setIsPaused(false);
      setSelectedArticle(null);
    }
  };

  const handleNewsTypeClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowNewsTypeMenu(!showNewsTypeMenu);
  };

  const handleNewsTypeSelect = (type, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setNewsType(type);
    setShowNewsTypeMenu(false);
    setIsPaused(false);
    setSelectedArticle(null);
    setLoading(true); // Force reload when changing type
    setNewsData(null); // Clear old data
  };

  // Format time for display
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Create a continuous stream of all news items with data attributes for identification
  const allNewsItems = newsData && newsData.articles ? newsData.articles.map((article, index) => (
    <span 
      key={index} 
      className="news-ticker-item-wrapper"
      data-article-index={index}
    >
      <span className="news-ticker-source">{article.source}</span>
      <span className="news-ticker-separator">•</span>
      <span className="news-ticker-title">{article.cleanTitle || article.title}</span>
      {article.publishedAt && (
        <>
          <span className="news-ticker-separator"> • </span>
          <span className="news-ticker-time">{formatTime(article.publishedAt)}</span>
        </>
      )}
      <span className="news-ticker-separator"> • </span>
    </span>
  )) : [];

  return (
    <>
      <div 
        className={`news-ticker ${isPaused ? 'news-ticker-paused' : ''}`} 
        ref={tickerRef}
        onClick={handleTickerClick}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleTickerClick(e);
        }}
        style={{ cursor: 'pointer' }}
      >
        <div 
          className="news-ticker-label"
          onClick={handleNewsTypeClick}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleNewsTypeClick(e);
          }}
          style={{ cursor: 'pointer' }}
        >
          <span className="news-ticker-label-icon">📰</span>
          <span>{getNewsTypeLabel()}</span>
          {showNewsTypeMenu && (
            <div 
              className="news-ticker-type-menu" 
              ref={menuRef} 
              onClick={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <div 
                className={`news-ticker-type-option ${newsType === 'france' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('france', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('france', e);
                }}
              >
                🇫🇷 France
              </div>
              <div 
                className={`news-ticker-type-option ${newsType === 'monde' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('monde', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('monde', e);
                }}
              >
                🌍 Monde
              </div>
              <div 
                className={`news-ticker-type-option ${newsType === 'tech' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('tech', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('tech', e);
                }}
              >
                💻 Tech
              </div>
            </div>
          )}
        </div>
        <div className="news-ticker-content">
          <div className="news-ticker-scroll-container" ref={scrollContainerRef}>
            <div 
              className={`news-ticker-scrolling-text ${isPaused ? 'paused' : ''}`}
              style={{
                animationDuration: `${animationDuration}s`
              }}
            >
              {/* Duplicate content for seamless infinite scroll */}
              {allNewsItems}
              {allNewsItems}
              {allNewsItems}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for article details */}
      {selectedArticle && (
        <div className="news-modal-overlay" onClick={handleModalOverlayClick}>
          <div className="news-modal" onClick={(e) => e.stopPropagation()}>
            <div className="news-modal-header">
              <h2 className="news-modal-title">{selectedArticle.cleanTitle || selectedArticle.title}</h2>
              <button 
                className="news-modal-close"
                onClick={() => { setIsPaused(false); setSelectedArticle(null); }}
              >
                ×
              </button>
            </div>
            <div className="news-modal-content">
              {selectedArticle.urlToImage && (
                <div className="news-modal-image">
                  <img 
                    src={selectedArticle.urlToImage} 
                    alt={selectedArticle.cleanTitle || selectedArticle.title}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="news-modal-source">
                <strong>Source:</strong> {selectedArticle.source}
                {selectedArticle.author && (
                  <span className="news-modal-author"> • Par {selectedArticle.author}</span>
                )}
              </div>
              {selectedArticle.description && (
                <div className="news-modal-description">
                  <p>{selectedArticle.description}</p>
                </div>
              )}
              {selectedArticle.content && (
                <div className="news-modal-content-text">
                  <p>{selectedArticle.content}</p>
                </div>
              )}
              {selectedArticle.publishedAt && (
                <div className="news-modal-date">
                  <small>
                    Publié le: {new Date(selectedArticle.publishedAt).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default NewsTicker;

