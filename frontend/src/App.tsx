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
      <Route path="/" element={<SplashPage />} />
      
      {/* App Routes */}
      <Route path="/app" element={<AppLayout />}>
        <Route path="home" element={<HomePage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="collections/:slug" element={<CollectionPage />} />
        <Route path="hymns/:id" element={<HymnDetailPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<div className="min-h-screen flex items-center justify-center">404 Not Found</div>} />
    </Routes>
  );
}

export default App;
