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

  // Filtrer les départs pour n'afficher que :
  // - Ligne 30 depuis La Houssais
  // - Ligne C4 depuis Trois Moulins (les 2 directions)
  const filteredDepartures = busData?.departures?.filter(departure => {
    // Ligne 30 depuis La Houssais
    if (departure.line === '30' && departure.stopId === 'LHOU') {
      return true;
    }
    // Ligne C4 depuis Trois Moulins
    if (departure.line === 'C4' && departure.stopId === 'TMOU') {
      return true;
    }
    return false;
  }) || [];

  if (!busData || filteredDepartures.length === 0) {
    return (
      <div className="bus-widget">
        <div className="bus-widget-header">
          <h3 className="bus-widget-title">Prochains bus</h3>
        </div>
        <div className="bus-widget-content">
          <div className="bus-widget-empty">
            <p>Aucun arrêt configuré</p>
            <p>Aucun départ prévu</p>
          </div>
        </div>
      </div>
    );
  }

  // Grouper les départs par ligne et direction, et prendre les 3 prochains pour chaque combinaison
  const departuresByLineAndDirection = filteredDepartures.reduce((acc, departure) => {
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

  // Grouper les départs par ligne et direction, en fusionnant les départs de même direction
  const groupByLineAndDirection = (groups) => {
    const grouped = {};
    groups.forEach(group => {
      const key = `${group.line}-${group.direction}`;
      if (!grouped[key]) {
        grouped[key] = {
          line: group.line,
          direction: group.direction,
          departures: []
        };
      }
      // Fusionner tous les départs de cette direction
      grouped[key].departures.push(...group.departures);
    });
    return Object.values(grouped).sort((a, b) => a.direction.localeCompare(b.direction));
  };

  const line30Groups = groupByLineAndDirection(
    Object.values(departuresByLineAndDirection).filter(group => group.line === '30')
  );
  
  const lineC4Groups = groupByLineAndDirection(
    Object.values(departuresByLineAndDirection).filter(group => group.line === 'C4')
  );

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
          <h3 className="bus-widget-title">Prochains départs</h3>
          {busData.lastUpdate && (
            <span className="bus-widget-last-update">
              màj à {new Date(busData.lastUpdate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}
            </span>
          )}
        </div>
        <div className="bus-widget-content">
          <div className="bus-departures-two-columns">
            {/* Colonne gauche : Ligne 30 */}
            <div className="bus-departures-column bus-departures-column-left">
              {line30Groups.length > 0 ? (
                line30Groups.map((group, groupIndex) => {
                  // Extraire les temps et les formater
                  const times = group.departures.map(dep => {
                    // Extraire juste le nombre de minutes (ex: "Dans 9mn" -> "9mn")
                    const timeMatch = dep.time.match(/(\d+mn?)/);
                    return timeMatch ? timeMatch[1] : dep.time.replace('Dans ', '');
                  });
                  const hasRealTime = group.departures.some(dep => dep.isRealTime);
                  
                  return (
                    <div key={`${group.line}-${group.direction}-${groupIndex}`} className="bus-departure-item">
                      <span className="bus-line-number bus-line-30">{group.line}</span>
                      <div className="bus-departure-info">
                        <div className="bus-departure-direction">Vers {group.direction}</div>
                        <div className="bus-departure-time">
                          Dans {times.join(', ')}
                          {hasRealTime && (
                            <span className="bus-realtime-indicator" title="Temps réel">●</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bus-departures-empty">Aucun départ ligne 30</div>
              )}
            </div>
            
            {/* Colonne droite : Ligne C4 */}
            <div className="bus-departures-column bus-departures-column-right">
              {lineC4Groups.length > 0 ? (
                lineC4Groups.map((group, groupIndex) => {
                  // Extraire les temps et les formater
                  const times = group.departures.map(dep => {
                    // Extraire juste le nombre de minutes (ex: "Dans 9mn" -> "9mn")
                    const timeMatch = dep.time.match(/(\d+mn?)/);
                    return timeMatch ? timeMatch[1] : dep.time.replace('Dans ', '');
                  });
                  const hasRealTime = group.departures.some(dep => dep.isRealTime);
                  
                  return (
                    <div key={`${group.line}-${group.direction}-${groupIndex}`} className="bus-departure-item">
                      <span className="bus-line-number bus-line-c4">{group.line}</span>
                      <div className="bus-departure-info">
                        <div className="bus-departure-direction">Vers {group.direction}</div>
                        <div className="bus-departure-time">
                          Dans {times.join(', ')}
                          {hasRealTime && (
                            <span className="bus-realtime-indicator" title="Temps réel">●</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bus-departures-empty">Aucun départ ligne C4</div>
              )}
            </div>
          </div>
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
              <h2 className="bus-modal-title">Prochains départs</h2>
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
                {busData.lastUpdate && (
                  <div className="bus-modal-stop-info">
                    <p><strong>Dernière mise à jour:</strong> {new Date(busData.lastUpdate).toLocaleString('fr-FR', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric',
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}</p>
                  </div>
                )}

                {filteredDepartures && filteredDepartures.length > 0 && (
                  <div className="bus-modal-departures">
                    <h3 className="bus-modal-section-title">Tous les prochains départs</h3>
                    
                    {/* Grouper par arrêt, puis par ligne et direction */}
                    {(() => {
                      // Créer une liste d'arrêts uniques depuis les départs
                      const uniqueStops = {};
                      filteredDepartures.forEach(dep => {
                        if (dep.stopId && dep.stopName) {
                          if (!uniqueStops[dep.stopId]) {
                            uniqueStops[dep.stopId] = {
                              stopId: dep.stopId,
                              stopName: dep.stopName
                            };
                          }
                        }
                      });
                      
                      // Utiliser busData.stops si disponible, sinon utiliser les arrêts uniques trouvés
                      const stopsToDisplay = busData.stops && Array.isArray(busData.stops) && busData.stops.length > 0
                        ? busData.stops
                        : Object.values(uniqueStops);
                      
                      return stopsToDisplay.map(stop => {
                        const stopDepartures = filteredDepartures.filter(dep => dep.stopId === stop.stopId);
                        if (stopDepartures.length === 0) return null;
                        
                        // Grouper par ligne et direction
                        const byLineAndDirection = stopDepartures.reduce((acc, dep) => {
                          const key = `${dep.line}-${dep.direction}`;
                          if (!acc[key]) acc[key] = { line: dep.line, direction: dep.direction, departures: [] };
                          acc[key].departures.push(dep);
                          return acc;
                        }, {});
                        
                        return (
                          <div key={stop.stopId} className="bus-modal-stop-section">
                            <h4 className="bus-modal-stop-name">{stop.stopName}</h4>
                            {Object.values(byLineAndDirection)
                              .sort((a, b) => {
                                if (a.line !== b.line) {
                                  if (a.line === '30') return -1;
                                  if (b.line === '30') return 1;
                                  return a.line.localeCompare(b.line);
                                }
                                return a.direction.localeCompare(b.direction);
                              })
                              .map((group, idx) => (
                                <div key={idx} className="bus-modal-direction-group">
                                  <h5 className="bus-modal-direction-title">
                                    <span className={`bus-line-number ${group.line === '30' ? 'bus-line-30' : group.line === 'C4' ? 'bus-line-c4' : ''}`}>{group.line}</span>
                                    <span>Vers {group.direction}</span>
                                  </h5>
                                  <div className="bus-modal-departures-list">
                                    {group.departures.map((departure, index) => (
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
                        );
                      });
                    })()}
                  </div>
                )}

                {(!filteredDepartures || filteredDepartures.length === 0) && (
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

