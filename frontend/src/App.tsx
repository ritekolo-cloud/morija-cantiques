import React from 'react';
import { Routes, Route } from 'react-router-dom';

import { AppLayout } from './layouts/AppLayout';
import { SplashPage } from './pages/SplashPage';
import { HomePage } from './pages/HomePage';
import { CollectionsPage } from './pages/CollectionsPage';
import { CollectionPage } from './pages/CollectionPage';
import { HymnDetailPage } from './pages/HymnDetailPage';
import { SearchPage } from './pages/SearchPage';
import { FavoritesPage } from './pages/FavoritesPage';

export function App() {
  return (
    <Routes>
      {/* Splash */}
      <Route path="/" element={<SplashPage />} />

      {/* App Layout */}
      <Route path="/app" element={<AppLayout />}>
        <Route path="home" element={<HomePage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="collections/:slug" element={<CollectionPage />} />
        <Route path="hymns/:id" element={<HymnDetailPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
      </Route>

      {/* fallback */}
      <Route
        path="*"
        element={
          <div style={{ padding: 40, fontSize: 24 }}>
            404 Not Found
          </div>
        }
      />
    </Routes>
  );
}

export default App;