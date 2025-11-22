import React, { useState, useEffect } from 'react';
import { REFRESH_INTERVAL } from '../../constants';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useScreensaverContext } from '../../contexts/ScreensaverContext';
import HueCompactWidget from './HueCompactWidget';

function WeatherWidget() {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const screensaverContext = useScreensaverContext();

  const fetchWeather = async () => {
    try {
      setError(null);
      const response = await fetch('/api/weather');
      const result = await response.json();
      
      if (result.success) {
        setWeatherData(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch weather data');
      }
    } catch (err) {
      console.error('Error fetching weather:', err);
      setError(err.message || 'Erreur lors du chargement de la météo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    
    const interval = setInterval(() => {
      fetchWeather();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Update time every second
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  const handleTimeClick = (e) => {
    e.stopPropagation();
    if (screensaverContext?.activateScreensaver) {
      screensaverContext.activateScreensaver();
    }
  };

  if (loading && !weatherData) {
    return (
      <div className="weather-bar">
        <div className="weather-loading">Chargement météo...</div>
        <div className="weather-time-integrated" onClick={handleTimeClick} style={{ cursor: 'pointer' }} title="Cliquer pour activer le mode veille">
          {format(currentTime, 'HH:mm')}
        </div>
        <div className="weather-spacer">
          <HueCompactWidget />
        </div>
      </div>
    );
  }

  if (error && !weatherData) {
    return (
      <div className="weather-bar">
        <div className="weather-error">Météo indisponible ({error})</div>
        <div className="weather-time-integrated" onClick={handleTimeClick} style={{ cursor: 'pointer' }} title="Cliquer pour activer le mode veille">
          {format(currentTime, 'HH:mm')}
        </div>
        <div className="weather-spacer">
          <HueCompactWidget />
        </div>
      </div>
    );
  }

  if (!weatherData) {
    return (
      <div className="weather-bar">
        <div className="weather-error">Météo indisponible</div>
        <div className="weather-time-integrated" onClick={handleTimeClick} style={{ cursor: 'pointer' }} title="Cliquer pour activer le mode veille">
          {format(currentTime, 'HH:mm')}
        </div>
        <div className="weather-spacer">
          <HueCompactWidget />
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Demain";
    } else {
      return format(date, 'EEEE d MMMM', { locale: fr });
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return format(date, 'HH:mm', { locale: fr });
  };

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

  // Group hourly forecasts by day for modal
  const hourlyByDay = {};
  if (weatherData?.hourlyForecast && Array.isArray(weatherData.hourlyForecast)) {
    weatherData.hourlyForecast.forEach((item) => {
      const date = new Date(item.dt * 1000);
      const dayKey = date.toISOString().split('T')[0];
      if (!hourlyByDay[dayKey]) {
        hourlyByDay[dayKey] = [];
      }
      hourlyByDay[dayKey].push({
        ...item,
        time: formatTime(new Date(item.dt * 1000)),
        temp: Math.round(item.main?.temp || 0),
        tempMin: Math.round(item.main?.temp_min || 0),
        tempMax: Math.round(item.main?.temp_max || 0),
        description: item.weather?.[0]?.description || '',
        icon: item.weather?.[0]?.icon || '',
        humidity: item.main?.humidity || 0,
        windSpeed: item.wind?.speed || 0,
        windDeg: item.wind?.deg || 0,
        pressure: item.main?.pressure || 0,
        clouds: item.clouds?.all || 0,
      });
    });
  }

  // Get next 5 days (including today) for modal
  const days = [];
  const today = new Date();
  for (let i = 0; i < 5; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayKey = date.toISOString().split('T')[0];
    // Filtrer les prévisions à 01:00 pour gagner de la place
    const hourlyForDay = (hourlyByDay[dayKey] || []).filter(hour => hour.time !== '01:00');
    days.push({
      date: dayKey,
      dateFormatted: formatDate(dayKey),
      hourly: hourlyForDay,
    });
  }

  const widgetFormatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Demain";
    } else {
      const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      return days[date.getDay()];
    }
  };

  return (
    <>
      <div className="weather-bar weather-bar-clickable" onClick={handleWidgetClick}>
      <div className="weather-content-integrated">
        <div className="weather-current">
          <div className="weather-location">
            {weatherData.city}
          </div>
          {weatherData.current && (
            <div className="weather-today">
              <div className="weather-icon-temp">
                <img 
                  src={`https://openweathermap.org/img/wn/${weatherData.current.icon}@2x.png`}
                  alt={weatherData.current.description}
                  className="weather-icon"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="weather-temp-main">
                  <span className="weather-temp-value">{weatherData.current.temp}°</span>
                  <span className="weather-temp-range">
                    {weatherData.current.tempMin}° / {weatherData.current.tempMax}°
                  </span>
                </div>
              </div>
              <div className="weather-description">
                {weatherData.current.description}
              </div>
            </div>
          )}
        </div>
        
        <div className="weather-forecast">
          {weatherData.forecast && weatherData.forecast.length > 0 ? (
            weatherData.forecast.slice(0, 2).map((day, index) => (
              <div key={index} className="weather-forecast-item">
                <div className="weather-forecast-day">{widgetFormatDate(day.date)}</div>
                <img 
                  src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                  alt={day.description}
                  className="weather-forecast-icon"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="weather-forecast-temp">
                  <span className="weather-forecast-temp-max">{day.tempMax}°</span>
                  <span className="weather-forecast-temp-min">{day.tempMin}°</span>
                </div>
              </div>
            ))
          ) : (
            <div className="weather-forecast-empty">Aucune prévision</div>
          )}
        </div>
      </div>
      <div className="weather-time-integrated" onClick={handleTimeClick} style={{ cursor: 'pointer' }} title="Cliquer pour activer le mode veille">
        {format(currentTime, 'HH:mm')}
      </div>
      <div className="weather-spacer">
        <HueCompactWidget />
      </div>
    </div>

    {showModal && weatherData && (
      <div 
        className="weather-modal-overlay" 
        onClick={handleModalOverlayClick}
        onTouchEnd={handleModalOverlayClick}
      >
        <div className="weather-modal" onClick={(e) => e.stopPropagation()}>
          <div className="weather-modal-header">
            <h2 className="weather-modal-title">Météo - {weatherData.city}</h2>
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
            {weatherData.current && (
              <div className="weather-page-current">
                <div className="weather-page-current-main">
                  <div className="weather-page-current-icon">
                    <img 
                      src={`https://openweathermap.org/img/wn/${weatherData.current.icon}@2x.png`}
                      alt={weatherData.current.description}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="weather-page-current-temp">
                    <div className="weather-page-current-temp-value">{weatherData.current.temp}°</div>
                    <div className="weather-page-current-description">{weatherData.current.description}</div>
                  </div>
                  <div className="weather-page-current-details">
                    <div className="weather-page-current-detail-item">
                      <span className="weather-page-detail-label">Min</span>
                      <span className="weather-page-detail-value">{weatherData.current.tempMin}°</span>
                    </div>
                    <div className="weather-page-current-detail-item">
                      <span className="weather-page-detail-label">Max</span>
                      <span className="weather-page-detail-value">{weatherData.current.tempMax}°</span>
                    </div>
                    <div className="weather-page-current-detail-item">
                      <span className="weather-page-detail-label">Humidité</span>
                      <span className="weather-page-detail-value">{weatherData.current.humidity}%</span>
                    </div>
                    <div className="weather-page-current-detail-item">
                      <span className="weather-page-detail-label">Vent</span>
                      <span className="weather-page-detail-value">{Math.round(weatherData.current.windSpeed * 3.6)} km/h</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="weather-page-forecast">
              {days.map((day, dayIndex) => (
                <div key={dayIndex} className="weather-page-day">
                  <div className="weather-page-day-header">
                    <h2 className="weather-page-day-title">{day.dateFormatted}</h2>
                    {day.hourly.length > 0 && (
                      <div className="weather-page-day-summary">
                        <span className="weather-page-day-temp-min">
                          {Math.min(...day.hourly.map(h => h.tempMin))}°
                        </span>
                        <span className="weather-page-day-temp-max">
                          {Math.max(...day.hourly.map(h => h.tempMax))}°
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="weather-page-hourly">
                    {day.hourly.length > 0 ? (
                      day.hourly.map((hour, hourIndex) => (
                        <div key={hourIndex} className="weather-page-hourly-item">
                          <div className="weather-page-hourly-time">{hour.time}</div>
                          <img 
                            src={`https://openweathermap.org/img/wn/${hour.icon}.png`}
                            alt={hour.description}
                            className="weather-page-hourly-icon"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <div className="weather-page-hourly-temp">{hour.temp}°</div>
                          <div className="weather-page-hourly-details">
                            <div className="weather-page-hourly-detail">
                              <span className="weather-page-hourly-detail-label">💧</span>
                              <span>{hour.humidity}%</span>
                            </div>
                            <div className="weather-page-hourly-detail">
                              <span className="weather-page-hourly-detail-label">💨</span>
                              <span>{Math.round(hour.windSpeed * 3.6)} km/h</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="weather-page-hourly-empty">Aucune prévision disponible</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default WeatherWidget;

