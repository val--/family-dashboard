import React, { useState, useEffect } from 'react';
import { BUS_REFRESH_INTERVAL } from '../../constants';

function BusWidget() {
  const [busData, setBusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showModal, setShowModal] = useState(false);

  const fetchBusData = async () => {
    try {
      setError(null);
      const response = await fetch('/api/bus');
      const result = await response.json();
      
      if (result.success) {
        setBusData(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch bus data');
      }
    } catch (err) {
      console.error('Error fetching bus data:', err);
      setError(err.message || 'Erreur lors du chargement des horaires de bus');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusData();
    
    // Rafraîchir plus fréquemment pour les horaires de bus (1 minute)
    const interval = setInterval(() => {
      fetchBusData();
    }, BUS_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Mettre à jour l'heure actuelle chaque seconde
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  if (loading) {
    return (
      <div className="bus-widget">
        <div className="bus-widget-header">
          <h3 className="bus-widget-title">Prochains bus</h3>
        </div>
        <div className="bus-widget-content">
          <div className="bus-widget-loading">Chargement...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bus-widget">
        <div className="bus-widget-header">
          <h3 className="bus-widget-title">Prochains bus</h3>
        </div>
        <div className="bus-widget-content">
          <div className="bus-widget-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!busData || !busData.departures || busData.departures.length === 0) {
    return (
      <div className="bus-widget">
        <div className="bus-widget-header">
          <h3 className="bus-widget-title">Prochains bus</h3>
        </div>
        <div className="bus-widget-content">
          <div className="bus-widget-empty">
            <p>{busData?.stopName || 'Aucun arrêt configuré'}</p>
            <p>Aucun départ prévu</p>
          </div>
        </div>
      </div>
    );
  }

  // Grouper les départs par ligne et direction, et prendre les 3 prochains pour chaque combinaison
  const departuresByLineAndDirection = busData.departures.reduce((acc, departure) => {
    const line = departure.line;
    const direction = departure.direction;
    const key = `${line}-${direction}`;
    
    if (!acc[key]) {
      acc[key] = {
        line: line,
        direction: direction,
        departures: []
      };
    }
    // Limiter à 3 départs par ligne/direction
    if (acc[key].departures.length < 3) {
      acc[key].departures.push(departure);
    }
    return acc;
  }, {});

  // Convertir en tableau et trier par ligne puis par direction
  const departureGroups = Object.values(departuresByLineAndDirection)
    .sort((a, b) => {
      // Trier d'abord par ligne
      if (a.line !== b.line) {
        return a.line.localeCompare(b.line);
      }
      // Puis par direction
      return a.direction.localeCompare(b.direction);
    });

  const handleWidgetClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowModal(true);
  };

  const handleModalOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      setShowModal(false);
    }
  };

  const handleModalClose = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowModal(false);
  };

  return (
    <>
      <div 
        className="bus-widget bus-widget-clickable"
        onClick={handleWidgetClick}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleWidgetClick(e);
        }}
        style={{ cursor: 'pointer' }}
      >
        <div className="bus-widget-header">
          <h3 className="bus-widget-title">Prochains départs à partir de {busData.stopName || 'La Houssais'}</h3>
        </div>
        <div className="bus-widget-content">
          <div className="bus-departures">
            {departureGroups.map((group, groupIndex) => (
              <div key={`${group.line}-${group.direction}-${groupIndex}`} className="bus-line-group">
                {group.departures.map((departure, index) => (
                  <div key={index} className="bus-departure-item">
                    <span className={`bus-line-number ${group.line === '30' ? 'bus-line-30' : ''}`}>{group.line}</span>
                    <div className="bus-departure-info">
                      <div className="bus-departure-direction">Vers {group.direction}</div>
                      <div className="bus-departure-time">
                        {departure.time}
                        {departure.isRealTime && (
                          <span className="bus-realtime-indicator" title="Temps réel">●</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {busData.lastUpdate && (
            <div className="bus-widget-footer">
              Dernière mise à jour à {new Date(busData.lastUpdate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {showModal && busData && (
        <div 
          className="bus-modal-overlay" 
          onClick={handleModalOverlayClick}
          onTouchEnd={handleModalOverlayClick}
        >
          <div className="bus-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bus-modal-header">
              <h2 className="bus-modal-title">Ligne 30 - {busData.stopName || 'La Houssais'}</h2>
              <button 
                className="bus-modal-close" 
                onClick={handleModalClose}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleModalClose(e);
                }}
              >
                ×
              </button>
            </div>
            <div className="bus-modal-content">
              <div className="bus-modal-info">
                <div className="bus-modal-stop-info">
                  <p><strong>Arrêt:</strong> {busData.stopName || 'La Houssais'} ({busData.stopId})</p>
                  {busData.lastUpdate && (
                    <p><strong>Dernière mise à jour:</strong> {new Date(busData.lastUpdate).toLocaleString('fr-FR', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric',
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}</p>
                  )}
                </div>

                {busData.departures && busData.departures.length > 0 && (
                  <div className="bus-modal-departures">
                    <h3 className="bus-modal-section-title">Tous les prochains départs</h3>
                    
                    {/* Grouper par direction */}
                    {Object.entries(
                      busData.departures.reduce((acc, dep) => {
                        const key = dep.direction;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(dep);
                        return acc;
                      }, {})
                    ).map(([direction, deps]) => (
                      <div key={direction} className="bus-modal-direction-group">
                        <h4 className="bus-modal-direction-title">
                          <span className={`bus-line-number bus-line-30`}>30</span>
                          <span>Vers {direction}</span>
                        </h4>
                        <div className="bus-modal-departures-list">
                          {deps.map((departure, index) => (
                            <div key={index} className="bus-modal-departure-detail">
                              <div className="bus-modal-departure-time-detail">
                                <span className="bus-modal-time-value">{departure.time}</span>
                                {departure.isRealTime && (
                                  <span className="bus-realtime-indicator" title="Temps réel">●</span>
                                )}
                              </div>
                              {departure.platform && (
                                <div className="bus-modal-platform">
                                  Quai: {departure.platform}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(!busData.departures || busData.departures.length === 0) && (
                  <div className="bus-modal-empty">
                    <p>Aucun départ prévu pour le moment</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BusWidget;

