import React, { useState, useEffect } from 'react';
import { REFRESH_INTERVAL } from './constants';

function BusWidget() {
  const [busData, setBusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    
    const interval = setInterval(() => {
      fetchBusData();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bus-widget">
        <div className="bus-widget-header">
          <h3 className="bus-widget-title">🚌 Prochains bus</h3>
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
          <h3 className="bus-widget-title">🚌 Prochains bus</h3>
        </div>
        <div className="bus-widget-content">
          <div className="bus-widget-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!busData || !busData.stops || busData.stops.length === 0) {
    return (
      <div className="bus-widget">
        <div className="bus-widget-header">
          <h3 className="bus-widget-title">🚌 Prochains bus</h3>
        </div>
        <div className="bus-widget-content">
          <div className="bus-widget-empty">Aucun arrêt configuré</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bus-widget">
      <div className="bus-widget-header">
        <h3 className="bus-widget-title">🚌 Prochains bus</h3>
      </div>
      <div className="bus-widget-content">
        {/* TODO: Display bus stops and next departures */}
        <div className="bus-widget-placeholder">
          Widget en cours de configuration
        </div>
      </div>
    </div>
  );
}

export default BusWidget;

