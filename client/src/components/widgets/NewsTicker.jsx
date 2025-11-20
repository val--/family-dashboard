import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { REFRESH_INTERVAL } from '../../constants';
import spotifyIcon from '../../assets/spotify.svg';

function NewsTicker() {
  const [newsData, setNewsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [newsType, setNewsType] = useState('news'); // 'news', 'tech', 'crime', 'entertainment', 'lifestyle', 'world', 'domestic', 'education', 'environment', 'health', 'politics', 'tourism'
  const [showNewsTypeMenu, setShowNewsTypeMenu] = useState(false);
  const [animationDuration, setAnimationDuration] = useState(360); // Default duration for constant speed
  const tickerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const clickTimeoutRef = useRef(null);
  const menuRef = useRef(null);
  const [spotifyStatus, setSpotifyStatus] = useState({
    loading: true,
    authenticated: false,
    isPlaying: false,
    track: null,
    lastTrack: null,
    error: null,
  });
  const [hasActiveDevice, setHasActiveDevice] = useState(false);
  const [isSpotifyActionPending, setIsSpotifyActionPending] = useState(false);
  const navigate = useNavigate();

  const getNewsTypeLabel = () => {
    switch (newsType) {
      case 'news':
        return 'Actualités';
      case 'tech':
        return 'Tech';
      case 'crime':
        return 'Crime';
      case 'entertainment':
        return 'Divertissement';
      case 'lifestyle':
        return 'Mode de vie';
      case 'world':
        return 'Monde';
      case 'domestic':
        return 'National';
      case 'education':
        return 'Éducation';
      case 'environment':
        return 'Environnement';
      case 'health':
        return 'Santé';
      case 'politics':
        return 'Politique';
      case 'tourism':
        return 'Tourisme';
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

  const fetchSpotifyStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/status');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch Spotify status');
      }

      setSpotifyStatus({
        loading: false,
        authenticated: data.authenticated,
        isPlaying: data.isPlaying,
        track: data.track || null,
        lastTrack: data.lastPlayedTrack || null,
        error: null,
      });

      // Vérifier s'il y a un device actif
      if (data.authenticated) {
        try {
          const devicesResponse = await fetch('/api/spotify/devices');
          const devicesData = await devicesResponse.json();
          if (devicesData.success && devicesData.devices) {
            const activeDevice = devicesData.devices.find(d => d.isActive);
            setHasActiveDevice(!!activeDevice);
          } else {
            setHasActiveDevice(false);
          }
        } catch (err) {
          console.error('Error fetching devices:', err);
          setHasActiveDevice(false);
        }
      } else {
        setHasActiveDevice(false);
      }
    } catch (err) {
      setSpotifyStatus((prev) => ({
        ...prev,
        loading: false,
        authenticated: false,
        isPlaying: false,
        track: null,
        error: err.message,
      }));
      setHasActiveDevice(false);
    }
  }, []);

  useEffect(() => {
    fetchSpotifyStatus();
    const interval = setInterval(fetchSpotifyStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchSpotifyStatus]);

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

  const handleSpotifyOpen = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    navigate('/spotify');
  }, [navigate]);

  const handleSpotifyTogglePlayback = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!spotifyStatus.authenticated) {
      handleSpotifyOpen(e);
      return;
    }
    if (isSpotifyActionPending) return;
    setIsSpotifyActionPending(true);
    try {
      const endpoint = spotifyStatus.isPlaying ? '/api/spotify/pause' : '/api/spotify/play';
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Spotify action failed');
      }
      fetchSpotifyStatus();
    } catch (err) {
      console.error('Erreur Spotify mini-player:', err);
    } finally {
      setIsSpotifyActionPending(false);
    }
  };

  const stopPropagationTouch = (handler) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    handler && handler(e);
  };

  const openSpotifyFromMini = (e) => {
    handleSpotifyOpen(e);
  };

  const renderSpotifyMiniPlayer = () => {
    const displayTrack = spotifyStatus.track || spotifyStatus.lastTrack;
    return (
      <div
        className="news-ticker-spotify"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <button
          className="news-ticker-spotify-icon-button"
          onClick={handleSpotifyOpen}
          onTouchEnd={stopPropagationTouch(handleSpotifyOpen)}
          title="Afficher Spotify"
        >
          <img src={spotifyIcon} alt="Spotify" className="news-ticker-spotify-icon" />
        </button>
        <div className="news-ticker-spotify-info">
          {spotifyStatus.loading ? (
            <div className="news-ticker-spotify-status-text">Chargement…</div>
          ) : displayTrack ? (
            <>
              <button
                className="news-ticker-spotify-track"
                onClick={openSpotifyFromMini}
                onTouchEnd={stopPropagationTouch(openSpotifyFromMini)}
              >
                {displayTrack.name}
              </button>
              <button
                className="news-ticker-spotify-artist"
                onClick={openSpotifyFromMini}
                onTouchEnd={stopPropagationTouch(openSpotifyFromMini)}
              >
                {displayTrack.artists}
              </button>
            </>
          ) : (
            <div className="news-ticker-spotify-status-text">
              {spotifyStatus.authenticated ? 'En pause' : 'Non connecté'}
            </div>
          )}
        </div>
        {spotifyStatus.authenticated && displayTrack && (
          <button
            className="news-ticker-spotify-toggle"
            onClick={handleSpotifyTogglePlayback}
            onTouchEnd={stopPropagationTouch(handleSpotifyTogglePlayback)}
            disabled={isSpotifyActionPending || !hasActiveDevice}
            aria-label={spotifyStatus.isPlaying ? 'Mettre en pause' : 'Lecture'}
          >
            {spotifyStatus.isPlaying ? (
              <svg className="news-ticker-spotify-toggle-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            ) : (
              <svg className="news-ticker-spotify-toggle-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
        )}
      </div>
    );
  };

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

  const handleCloseModal = () => {
    setIsPaused(false);
    setSelectedArticle(null);
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

  const hasArticles = newsData && newsData.articles && newsData.articles.length > 0;

  const newsTypeMenu = showNewsTypeMenu && (
    <div
      className="news-ticker-type-menu"
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
              <div 
                className={`news-ticker-type-option ${newsType === 'news' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('news', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('news', e);
                }}
              >
                Actualités
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
                Tech
              </div>
              <div 
                className={`news-ticker-type-option ${newsType === 'crime' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('crime', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('crime', e);
                }}
              >
                Crime
              </div>
              <div 
                className={`news-ticker-type-option ${newsType === 'entertainment' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('entertainment', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('entertainment', e);
                }}
              >
                Divertissement
              </div>
              <div 
                className={`news-ticker-type-option ${newsType === 'lifestyle' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('lifestyle', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('lifestyle', e);
                }}
              >
                Mode de vie
              </div>
              <div 
                className={`news-ticker-type-option ${newsType === 'world' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('world', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('world', e);
                }}
              >
                Monde
              </div>
              <div 
                className={`news-ticker-type-option ${newsType === 'domestic' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('domestic', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('domestic', e);
                }}
              >
                National
              </div>
              <div 
                className={`news-ticker-type-option ${newsType === 'education' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('education', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('education', e);
                }}
              >
                Éducation
              </div>
              <div 
                className={`news-ticker-type-option ${newsType === 'environment' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('environment', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('environment', e);
                }}
              >
                Environnement
              </div>
              <div 
                className={`news-ticker-type-option ${newsType === 'health' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('health', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('health', e);
                }}
              >
                Santé
              </div>
              <div 
                className={`news-ticker-type-option ${newsType === 'politics' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('politics', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('politics', e);
                }}
              >
                Politique
              </div>
              <div 
                className={`news-ticker-type-option ${newsType === 'tourism' ? 'active' : ''}`}
                onClick={(e) => handleNewsTypeSelect('tourism', e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewsTypeSelect('tourism', e);
                }}
              >
                Tourisme
              </div>
    </div>
  );

  let tickerContent;
  if (loading && !newsData) {
    tickerContent = <div className="news-ticker-loading">Chargement des actualités...</div>;
  } else if (error && !newsData) {
    tickerContent = <div className="news-ticker-error">Actualités indisponibles</div>;
  } else if (!hasArticles) {
    tickerContent = <div className="news-ticker-empty">Aucune actualité disponible</div>;
  } else {
    tickerContent = (
      <div className="news-ticker-scroll-container" ref={scrollContainerRef}>
        <div
          className={`news-ticker-scrolling-text ${isPaused ? 'paused' : ''}`}
          style={{
            animationDuration: `${animationDuration}s`,
          }}
        >
          {/* Duplicate content for seamless infinite scroll */}
          {allNewsItems}
          {allNewsItems}
          {allNewsItems}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`news-ticker ${isPaused ? 'news-ticker-paused' : ''}`}
        ref={tickerRef}
        onClick={hasArticles ? handleTickerClick : undefined}
        onTouchEnd={hasArticles ? stopPropagationTouch(handleTickerClick) : undefined}
        style={{ cursor: hasArticles ? 'pointer' : 'default' }}
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
          <span>{getNewsTypeLabel()}</span>
          {newsTypeMenu}
        </div>
        <div className="news-ticker-content">{tickerContent}</div>
        {renderSpotifyMiniPlayer()}
      </div>

      {/* Modal for article details */}
      {selectedArticle && (
        <div className="news-modal-overlay" onClick={handleModalOverlayClick}>
          <div className="news-modal" onClick={(e) => e.stopPropagation()}>
            <div className="news-modal-header">
              <h2 className="news-modal-title">{selectedArticle.cleanTitle || selectedArticle.title}</h2>
              <button 
                className="news-modal-close"
                onClick={handleCloseModal}
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
              {selectedArticle.url && (
                <div className="news-modal-qr">
                  <p className="news-modal-qr-label">Scanner pour lire l'article complet :</p>
                  <div className="news-modal-qr-code">
                    <QRCodeSVG
                      value={selectedArticle.url}
                      size={200}
                      level="M"
                      includeMargin={true}
                    />
                  </div>
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

