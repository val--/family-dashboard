import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { REFRESH_INTERVAL } from '../../constants';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function WeatherWidget() {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 1024);
  const navigate = useNavigate();

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

  // Detect screen size for date formatting
  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderDateTime = () => {
    const dateFormat = isSmallScreen 
      ? format(currentTime, 'EEE d MMM yyyy', { locale: fr }) // Abrégé: "Sam 16 Nov 2025"
      : format(currentTime, 'EEEE d MMMM yyyy', { locale: fr }); // Complet: "Samedi 16 Novembre 2025"
    
    return (
      <div className="weather-datetime">
        <div className="weather-date">
          {dateFormat}
        </div>
        <div className="weather-time">
          <span className="weather-time-icon">🕐</span>
          {format(currentTime, 'HH:mm:ss')}
        </div>
      </div>
    );
  };

  if (loading && !weatherData) {
    return (
      <div className="weather-bar">
        {renderDateTime()}
        <div className="weather-loading">Chargement météo...</div>
      </div>
    );
  }

  if (error && !weatherData) {
    return (
      <div className="weather-bar">
        {renderDateTime()}
        <div className="weather-error">Météo indisponible ({error})</div>
      </div>
    );
  }

  if (!weatherData) {
    return (
      <div className="weather-bar">
        {renderDateTime()}
        <div className="weather-error">Météo indisponible</div>
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
      const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      return days[date.getDay()];
    }
  };

  return (
    <div className="weather-bar weather-bar-clickable" onClick={() => navigate('/weather')}>
      {renderDateTime()}
      <div className="weather-content-right">
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
            weatherData.forecast.map((day, index) => (
              <div key={index} className="weather-forecast-item">
                <div className="weather-forecast-day">{formatDate(day.date)}</div>
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
    </div>
  );
}

export default WeatherWidget;

