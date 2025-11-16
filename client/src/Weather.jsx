import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function Weather({ data, loading, error }) {
  const navigate = useNavigate();

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

  if (loading) {
    return (
      <div className="weather-page">
        <div className="loading">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="weather-page">
        <div className="error">
          <h2>Erreur</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="weather-page">
        <div className="error">
          <h2>Erreur</h2>
          <p>Aucune donnée météo disponible</p>
        </div>
      </div>
    );
  }

  // Group hourly forecasts by day
  const hourlyByDay = {};
  if (data.hourlyForecast && Array.isArray(data.hourlyForecast)) {
    data.hourlyForecast.forEach((item) => {
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

  // Get next 5 days (including today)
  const days = [];
  const today = new Date();
  for (let i = 0; i < 5; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayKey = date.toISOString().split('T')[0];
    days.push({
      date: dayKey,
      dateFormatted: formatDate(dayKey),
      hourly: hourlyByDay[dayKey] || [],
    });
  }

  return (
    <div className="weather-page">
      <div className="weather-page-header">
        <div className="weather-page-header-left">
          <button className="back-button" onClick={() => navigate('/')}>← Retour</button>
        </div>
        <h1 className="weather-page-main-title">Météo - {data.city}</h1>
        <div className="weather-page-header-right"></div>
      </div>
      
      {data.current && (
        <div className="weather-page-current">
          <div className="weather-page-current-main">
            <div className="weather-page-current-icon">
              <img 
                src={`https://openweathermap.org/img/wn/${data.current.icon}@2x.png`}
                alt={data.current.description}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <div className="weather-page-current-temp">
              <div className="weather-page-current-temp-value">{data.current.temp}°</div>
              <div className="weather-page-current-description">{data.current.description}</div>
            </div>
            <div className="weather-page-current-details">
              <div className="weather-page-current-detail-item">
                <span className="weather-page-detail-label">Min</span>
                <span className="weather-page-detail-value">{data.current.tempMin}°</span>
              </div>
              <div className="weather-page-current-detail-item">
                <span className="weather-page-detail-label">Max</span>
                <span className="weather-page-detail-value">{data.current.tempMax}°</span>
              </div>
              <div className="weather-page-current-detail-item">
                <span className="weather-page-detail-label">Humidité</span>
                <span className="weather-page-detail-value">{data.current.humidity}%</span>
              </div>
              <div className="weather-page-current-detail-item">
                <span className="weather-page-detail-label">Vent</span>
                <span className="weather-page-detail-value">{Math.round(data.current.windSpeed * 3.6)} km/h</span>
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
  );
}

export default Weather;

