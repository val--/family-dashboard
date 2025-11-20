import React from 'react';
import { useNavigate } from 'react-router-dom';
import ElectricityWidget from '../widgets/ElectricityWidget';

function Electricity({ data, loading, error }) {
  const navigate = useNavigate();

  return (
    <div className="electricity-page">
      <div className="electricity-page-header">
        <div className="electricity-page-header-left">
          <button className="back-button" onClick={() => navigate('/')}>← Retour</button>
        </div>
        <h1 className="electricity-page-main-title">Consommation Électrique</h1>
        <div className="electricity-page-header-right"></div>
      </div>
      <div className="electricity-page-content">
        <ElectricityWidget data={data} loading={loading} error={error} onClick={() => {}} />
      </div>
    </div>
  );
}

export default Electricity;

