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
                    // Si c'est "Départ proche", le garder tel quel
                    if (dep.time === 'Départ proche') {
                      return dep.time;
                    }
                    // Extraire juste le nombre de minutes (ex: "Dans 9mn" -> "9mn")
                    const timeMatch = dep.time.match(/(\d+mn?)/);
                    return timeMatch ? timeMatch[1] : dep.time.replace('Dans ', '');
                  });
                  const hasRealTime = group.departures.some(dep => dep.isRealTime);
                  
                  // Vérifier si le premier temps est "Départ proche"
                  const firstTime = times[0];
                  const isFirstDepartureProche = firstTime === 'Départ proche';
                  
                  // Formater l'affichage
                  let timeDisplay;
                  if (isFirstDepartureProche && times.length > 1) {
                    // "Départ proche, puis dans 13mn"
                    const otherTimes = times.slice(1).join(', ');
                    timeDisplay = `Départ proche, puis dans ${otherTimes}`;
                  } else if (isFirstDepartureProche) {
                    // Juste "Départ proche"
                    timeDisplay = 'Départ proche';
                  } else {
                    // "Dans 9mn, 13mn"
                    timeDisplay = `Dans ${times.join(', ')}`;
                  }
                  
                  return (
                    <div key={`${group.line}-${group.direction}-${groupIndex}`} className="bus-departure-item">
                      <span className="bus-line-number bus-line-30">{group.line}</span>
                      <div className="bus-departure-info">
                        <div className="bus-departure-direction">Vers {group.direction}</div>
                        <div className="bus-departure-time">
                          {timeDisplay}
                          {hasRealTime && (
                            <span className="bus-realtime-indicator" title="Temps réel">●</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bus-departures-empty">Pas de prochain départ avant demain matin</div>
              )}
            </div>
            
            {/* Colonne droite : Ligne C4 */}
            <div className="bus-departures-column bus-departures-column-right">
              {lineC4Groups.length > 0 ? (
                lineC4Groups.map((group, groupIndex) => {
                  // Extraire les temps et les formater
                  const times = group.departures.map(dep => {
                    // Si c'est "Départ proche", le garder tel quel
                    if (dep.time === 'Départ proche') {
                      return dep.time;
                    }
                    // Extraire juste le nombre de minutes (ex: "Dans 9mn" -> "9mn")
                    const timeMatch = dep.time.match(/(\d+mn?)/);
                    return timeMatch ? timeMatch[1] : dep.time.replace('Dans ', '');
                  });
                  const hasRealTime = group.departures.some(dep => dep.isRealTime);
                  
                  // Vérifier si le premier temps est "Départ proche"
                  const firstTime = times[0];
                  const isFirstDepartureProche = firstTime === 'Départ proche';
                  
                  // Formater l'affichage
                  let timeDisplay;
                  if (isFirstDepartureProche && times.length > 1) {
                    // "Départ proche, puis dans 13mn"
                    const otherTimes = times.slice(1).join(', ');
                    timeDisplay = `Départ proche, puis dans ${otherTimes}`;
                  } else if (isFirstDepartureProche) {
                    // Juste "Départ proche"
                    timeDisplay = 'Départ proche';
                  } else {
                    // "Dans 9mn, 13mn"
                    timeDisplay = `Dans ${times.join(', ')}`;
                  }
                  
                  return (
                    <div key={`${group.line}-${group.direction}-${groupIndex}`} className="bus-departure-item">
                      <span className="bus-line-number bus-line-c4">{group.line}</span>
                      <div className="bus-departure-info">
                        <div className="bus-departure-direction">Vers {group.direction}</div>
                        <div className="bus-departure-time">
                          {timeDisplay}
                          {hasRealTime && (
                            <span className="bus-realtime-indicator" title="Temps réel">●</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bus-departures-empty">Pas de prochain départ avant demain matin</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && busData && (
        <div 
          className="weather-modal-overlay" 
          onClick={handleModalOverlayClick}
          onTouchEnd={handleModalOverlayClick}
        >
          <div className="weather-modal" onClick={(e) => e.stopPropagation()}>
            <div className="weather-modal-header">
              <div className="bus-modal-header-left">
                <h2 className="weather-modal-title">Prochains départs</h2>
                {busData.lastUpdate && (
                  <span className="bus-modal-last-update">
                    Mise à jour: {new Date(busData.lastUpdate).toLocaleTimeString('fr-FR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                )}
              </div>
              <button 
                className="weather-modal-close" 
                onClick={handleModalClose}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleModalClose(e);
                }}
              >
                ×
              </button>
            </div>
            <div className="weather-modal-content">
              <div className="bus-modal-info">
                {filteredDepartures && filteredDepartures.length > 0 && (
                  <div className="bus-modal-departures-compact">
                    <div className="bus-modal-two-columns">
                      {/* Colonne gauche : Ligne 30 */}
                      <div className="bus-modal-column bus-modal-column-left">
                        <h4 className="bus-modal-column-title">
                          <span className="bus-line-number bus-line-30">30</span>
                          <span>Ligne 30</span>
                        </h4>
                        {(() => {
                          const line30Departures = filteredDepartures.filter(dep => dep.line === '30');
                          if (line30Departures.length === 0) {
                            return <div className="bus-modal-empty-column">Aucun départ</div>;
                          }
                          
                          // Grouper par direction
                          const byDirection = line30Departures.reduce((acc, dep) => {
                            if (!acc[dep.direction]) {
                              acc[dep.direction] = [];
                            }
                            acc[dep.direction].push(dep);
                            return acc;
                          }, {});
                          
                          return Object.entries(byDirection).map(([direction, departures]) => (
                            <div key={direction} className="bus-modal-direction-compact">
                              <div className="bus-modal-direction-label">Vers {direction}</div>
                              <div className="bus-modal-departures-compact-list">
                                {departures.map((departure, index) => {
                                  // Calculer l'heure de passage
                                  const calculatePassageTime = (timeStr) => {
                                    if (timeStr === 'Départ proche') {
                                      const now = new Date(currentTime);
                                      return now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                                    }
                                    const match = timeStr.match(/(\d+)\s*mn/);
                                    if (match) {
                                      const minutes = parseInt(match[1]);
                                      const passageTime = new Date(currentTime);
                                      passageTime.setMinutes(passageTime.getMinutes() + minutes);
                                      return passageTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                                    }
                                    return null;
                                  };
                                  
                                  const passageTime = calculatePassageTime(departure.time);
                                  
                                  return (
                                    <div key={index} className="bus-modal-departure-compact">
                                      <div className="bus-modal-departure-time-compact">
                                        <span className="bus-modal-time-wait">{departure.time}</span>
                                        {passageTime && (
                                          <span className="bus-modal-time-passage">{passageTime}</span>
                                        )}
                                        {departure.isRealTime && (
                                          <span className="bus-realtime-indicator" title="Temps réel">●</span>
                                        )}
                                      </div>
                                      {departure.platform && (
                                        <div className="bus-modal-platform-compact">Quai: {departure.platform}</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                      
                      {/* Colonne droite : Ligne C4 */}
                      <div className="bus-modal-column bus-modal-column-right">
                        <h4 className="bus-modal-column-title">
                          <span className="bus-line-number bus-line-c4">C4</span>
                          <span>Ligne C4</span>
                        </h4>
                        {(() => {
                          const lineC4Departures = filteredDepartures.filter(dep => dep.line === 'C4');
                          if (lineC4Departures.length === 0) {
                            return <div className="bus-modal-empty-column">Aucun départ</div>;
                          }
                          
                          // Grouper par direction
                          const byDirection = lineC4Departures.reduce((acc, dep) => {
                            if (!acc[dep.direction]) {
                              acc[dep.direction] = [];
                            }
                            acc[dep.direction].push(dep);
                            return acc;
                          }, {});
                          
                          return Object.entries(byDirection).map(([direction, departures]) => (
                            <div key={direction} className="bus-modal-direction-compact">
                              <div className="bus-modal-direction-label">Vers {direction}</div>
                              <div className="bus-modal-departures-compact-list">
                                {departures.map((departure, index) => {
                                  // Calculer l'heure de passage
                                  const calculatePassageTime = (timeStr) => {
                                    if (timeStr === 'Départ proche') {
                                      const now = new Date(currentTime);
                                      return now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                                    }
                                    const match = timeStr.match(/(\d+)\s*mn/);
                                    if (match) {
                                      const minutes = parseInt(match[1]);
                                      const passageTime = new Date(currentTime);
                                      passageTime.setMinutes(passageTime.getMinutes() + minutes);
                                      return passageTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                                    }
                                    return null;
                                  };
                                  
                                  const passageTime = calculatePassageTime(departure.time);
                                  
                                  return (
                                    <div key={index} className="bus-modal-departure-compact">
                                      <div className="bus-modal-departure-time-compact">
                                        <span className="bus-modal-time-wait">{departure.time}</span>
                                        {passageTime && (
                                          <span className="bus-modal-time-passage">{passageTime}</span>
                                        )}
                                        {departure.isRealTime && (
                                          <span className="bus-realtime-indicator" title="Temps réel">●</span>
                                        )}
                                      </div>
                                      {departure.platform && (
                                        <div className="bus-modal-platform-compact">Quai: {departure.platform}</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
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

