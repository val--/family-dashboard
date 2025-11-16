import React from 'react';
import { useNavigate } from 'react-router-dom';

function ElectricityWidget({ data, loading, error, onClick, compact = false }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate('/electricity');
    }
  };

  const widgetStyle = onClick ? {} : { cursor: 'pointer' };

  if (loading) {
    return (
      <div className="electricity-widget" onClick={onClick ? undefined : handleClick} style={widgetStyle}>
        <div className="electricity-widget-header">
          <h2 className="electricity-widget-title">⚡ Consommation Électrique</h2>
        </div>
        <div className="electricity-widget-content">
          <div className="electricity-widget-loading">Chargement...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="electricity-widget" onClick={onClick ? undefined : handleClick} style={widgetStyle}>
        <div className="electricity-widget-header">
          <h2 className="electricity-widget-title">⚡ Consommation Électrique</h2>
        </div>
        <div className="electricity-widget-content">
          <div className="electricity-widget-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="electricity-widget" onClick={onClick ? undefined : handleClick} style={widgetStyle}>
        <div className="electricity-widget-header">
          <h2 className="electricity-widget-title">⚡ Consommation Électrique</h2>
        </div>
        <div className="electricity-widget-content">
          <div className="electricity-widget-empty">Aucune donnée disponible</div>
        </div>
      </div>
    );
  }

  const formatValue = (value) => {
    return value.toLocaleString('fr-FR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  // In compact mode, only show the 7-day chart
  if (compact) {
    // Limit dailyChartData to last 7 days
    const chartData = data.dailyChartData && data.dailyChartData.length > 0 
      ? data.dailyChartData.slice(-7) 
      : [];

    return (
      <div className="electricity-widget" onClick={onClick ? undefined : handleClick} style={widgetStyle}>
        <div className="electricity-widget-header">
          <h2 className="electricity-widget-title">⚡ Consommation Électrique</h2>
        </div>
        <div className="electricity-widget-content">
          {chartData.length > 0 ? (
            <div className="electricity-stat-card electricity-stat-chart">
              <div className="electricity-stat-label">Évolution sur 7 jours</div>
              <div className="electricity-chart">
                {chartData.map((day, index) => {
                  const maxValue = Math.max(...chartData.map(d => d.value), 1);
                  const height = maxValue > 0 ? (day.value / maxValue) * 100 : 0;
                  const isToday = index === chartData.length - 1;
                  
                  return (
                    <div key={day.date} className="electricity-chart-bar-container">
                      <div className="electricity-chart-bar-wrapper">
                        <div 
                          className={`electricity-chart-bar ${isToday ? 'electricity-chart-bar-today' : ''}`}
                          style={{ height: `${height}%` }}
                          title={isToday ? `${day.dateLabel}: à venir` : `${day.dateLabel}: ${formatValue(day.value)} kWh`}
                        >
                          <span className="electricity-chart-bar-value">
                            {isToday ? 'à venir' : (day.value > 0 ? formatValue(day.value) : '')}
                          </span>
                        </div>
                      </div>
                      <div className="electricity-chart-label">{day.dateLabel}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="electricity-widget-empty">Aucune donnée disponible</div>
          )}
        </div>
      </div>
    );
  }

  // Full mode: show all stats
  return (
    <div className="electricity-widget" onClick={onClick ? undefined : handleClick} style={widgetStyle}>
      <div className="electricity-widget-header">
        <h2 className="electricity-widget-title">Consommation Électrique</h2>
      </div>
      <div className="electricity-widget-content">
        <div className="electricity-stats">
          <div className="electricity-stat-card electricity-stat-today">
            <div className="electricity-stat-label">Hier</div>
            <div className="electricity-stat-value">
              {formatValue(data.yesterday)} <span className="electricity-stat-unit">kWh</span>
            </div>
            {data.dayBeforeYesterday > 0 && (
              <div className="electricity-stat-comparison">
                {data.yesterday < data.dayBeforeYesterday ? (
                  <>
                    <span className="electricity-stat-comparison-better">↓</span> Mieux que la veille ({Math.abs(data.yesterday - data.dayBeforeYesterday).toFixed(2)} kWh de moins)
                  </>
                ) : data.yesterday > data.dayBeforeYesterday ? (
                  <>
                    <span className="electricity-stat-comparison-worse">↑</span> En hausse par rapport à la veille (+{Math.abs(data.yesterday - data.dayBeforeYesterday).toFixed(2)} kWh)
                  </>
                ) : (
                  <>
                    <span className="electricity-stat-comparison-same">→</span> Identique à la veille
                  </>
                )}
              </div>
            )}
          </div>

          <div className="electricity-stat-card electricity-stat-week">
            <div className="electricity-stat-label">7 derniers jours</div>
            <div className="electricity-stat-value">
              {formatValue(data.weekTotal)} <span className="electricity-stat-unit">kWh</span>
            </div>
            <div className="electricity-stat-subvalue">
              Moyenne: {formatValue(data.weekAverage)} kWh/jour
            </div>
            {data.previousWeekTotal > 0 && (
              <div className="electricity-stat-comparison">
                {data.weekTotal < data.previousWeekTotal ? (
                  <>
                    <span className="electricity-stat-comparison-better">↓</span> Consommation en baisse par rapport à la semaine précédente ({Math.abs(data.weekTotal - data.previousWeekTotal).toFixed(2)} kWh de moins)
                  </>
                ) : data.weekTotal > data.previousWeekTotal ? (
                  <>
                    <span className="electricity-stat-comparison-worse">↑</span> Consommation en hausse par rapport à la semaine précédente (+{Math.abs(data.weekTotal - data.previousWeekTotal).toFixed(2)} kWh)
                  </>
                ) : (
                  <>
                    <span className="electricity-stat-comparison-same">→</span> Consommation identique à la semaine précédente
                  </>
                )}
              </div>
            )}
          </div>

          {data.contractInfo && (
            <div className="electricity-stat-card electricity-stat-power">
              <div className="electricity-stat-label">Puissance souscrite</div>
              <div className="electricity-stat-value">
                {data.contractInfo.subscribedPower} <span className="electricity-stat-unit">kVA</span>
              </div>
              {data.contractInfo.contractType && (
                <div className="electricity-stat-subvalue">
                  {data.contractInfo.contractType}
                </div>
              )}
            </div>
          )}

          {data.dailyChartData && data.dailyChartData.length > 0 && (
            <div className="electricity-stat-card electricity-stat-chart">
              <div className="electricity-stat-label">Évolution sur {data.dailyChartData.length} jours</div>
              <div className="electricity-chart">
                {data.dailyChartData.map((day, index) => {
                  const maxValue = Math.max(...data.dailyChartData.map(d => d.value), 1);
                  const height = maxValue > 0 ? (day.value / maxValue) * 100 : 0;
                  const isToday = index === data.dailyChartData.length - 1;
                  
                  return (
                    <div key={day.date} className="electricity-chart-bar-container">
                      <div className="electricity-chart-bar-wrapper">
                        <div 
                          className={`electricity-chart-bar ${isToday ? 'electricity-chart-bar-today' : ''}`}
                          style={{ height: `${height}%` }}
                          title={isToday ? `${day.dateLabel}: à venir` : `${day.dateLabel}: ${formatValue(day.value)} kWh`}
                        >
                          <span className="electricity-chart-bar-value">
                            {isToday ? 'à venir' : (day.value > 0 ? formatValue(day.value) : '')}
                          </span>
                        </div>
                      </div>
                      <div className="electricity-chart-label">{day.dateLabel}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.monthlyChartData && data.monthlyChartData.length > 0 && (
            <div className="electricity-stat-card electricity-stat-chart electricity-stat-chart-monthly">
              <div className="electricity-stat-label">Évolution sur 12 derniers mois</div>
              <div className="electricity-chart electricity-chart-monthly">
                {data.monthlyChartData.map((month, index) => {
                  const maxValue = Math.max(...data.monthlyChartData.map(m => m.value), 1);
                  const height = maxValue > 0 ? (month.value / maxValue) * 100 : 0;
                  
                  return (
                    <div key={month.month} className="electricity-chart-bar-container">
                      <div className="electricity-chart-bar-wrapper">
                        <div 
                          className="electricity-chart-bar electricity-chart-bar-monthly"
                          style={{ height: `${height}%` }}
                          title={`${month.monthLabel}: ${formatValue(month.value)} kWh`}
                        >
                          <span className="electricity-chart-bar-value">
                            {month.value > 0 ? formatValue(month.value) : ''}
                          </span>
                        </div>
                      </div>
                      <div className="electricity-chart-label electricity-chart-label-monthly">{month.monthLabel}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ElectricityWidget;

