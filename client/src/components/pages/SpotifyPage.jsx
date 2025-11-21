import React from 'react';
import SpotifyWidget from '../widgets/SpotifyWidget';

/**
 * Page Spotify du dashboard
 */
function SpotifyPage() {
  return (
    <div className="home-page-2">
      <div className="home-page-2-content home-page-2-spotify">
        <SpotifyWidget />
      </div>
    </div>
  );
}

export default SpotifyPage;

