import React from 'react';
import SpotifyWidget from '../widgets/SpotifyWidget';

/**
 * Deuxième page du dashboard - Spotify
 */
function HomePage2() {
  return (
    <div className="home-page-2">
      <div className="home-page-2-content home-page-2-spotify">
        <SpotifyWidget />
      </div>
    </div>
  );
}

export default HomePage2;

