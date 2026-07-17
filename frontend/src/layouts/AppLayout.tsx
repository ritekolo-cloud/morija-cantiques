import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Search, Heart, Book, Tv } from 'lucide-react';
import clsx from 'clsx';

export function AppLayout() {
  const location = useLocation();

  const navItems = [
    { to: '/app/home', icon: Home, label: 'Home' },
    { to: '/app/collections', icon: Book, label: 'Collections' },
    { to: '/app/search', icon: Search, label: 'Search' },
    { to: '/app/present', icon: Tv, label: 'Presentation' },
    { to: '/app/favorites', icon: Heart, label: 'Favorites' },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF5] text-[#1A1A16] font-inter flex flex-col md:flex-row">
      {/* Desktop Sidebar Navigation — Warm cream/gold, welcoming & bright */}
      <aside className="hidden md:flex md:w-64 bg-[#FFFDF5] flex-col shrink-0 border-r border-[#E8E5D5] shadow-sm select-none">
        {/* Brand Header */}
        <div className="p-6 border-b border-[#E8E5D5] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E5B83B]/10 border border-[#E5B83B]/30 flex items-center justify-center shadow-sm">
            <svg
              className="w-6 h-6 text-[#C59828]"
              viewBox="0 0 100 100"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M50 15 V85" strokeWidth="6" />
              <path d="M25 38 H75" strokeWidth="6" />
            </svg>
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-[#1A1A16] tracking-wide">
              Morija Cantiques
            </h1>
            <p className="text-[9px] font-bold text-[#C59828] uppercase tracking-[0.2em]">
              Presentation System
            </p>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                  isActive
                    ? "text-[#C59828] font-bold bg-[#FDF2F4] border border-[#F9A8C9]/20"
                    : "text-[#6B6857] hover:text-[#1A1A16] hover:bg-[#FAFAF5]"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#E5B83B] rounded-r-full" />
                )}
                <item.icon className={clsx("w-5 h-5 transition-colors", isActive ? "text-[#C59828]" : "text-[#A8A592] group-hover:text-[#6B6857]")} strokeWidth={isActive ? 2.3 : 1.8} />
                <span className="text-sm font-medium tracking-wide">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#E8E5D5] text-center">
          <p className="text-[10px] text-[#A8A592] font-medium">Morija Tabernacle © 2026</p>
        </div>
      </aside>

      {/* Mobile Header / Top Bar */}
      <header className="md:hidden h-14 bg-[#FFFDF5] border-b border-[#E8E5D5] flex items-center justify-between px-5 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-2.5">
          <svg
            className="w-5 h-5 text-[#C59828]"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M50 15 V85" strokeWidth="7" />
            <path d="M25 38 H75" strokeWidth="7" />
          </svg>
          <span className="font-display font-bold text-base text-[#1A1A16] tracking-wide">Morija Cantiques</span>
        </div>
      </header>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#FAFAF5]">
        <main className="flex-1 overflow-y-auto pb-20 md:pb-8 scroll-smooth">
          <div className="max-w-7xl mx-auto w-full px-4 md:px-8 py-6 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 h-16 bg-[#FFFDF5]/95 backdrop-blur-md border border-[#E8E5D5] rounded-2xl px-3 z-20 shadow-[0_8px_32px_rgba(26,26,22,0.15)] flex items-center justify-center">
        <ul className="w-full flex justify-between items-center">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <li key={item.to} className="flex-1 flex justify-center">
                <NavLink
                  to={item.to}
                  className={clsx(
                    "flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-all duration-200 relative select-none w-14",
                    isActive
                      ? "text-[#C59828] scale-105 font-bold"
                      : "text-[#A8A592] hover:text-[#6B6857]"
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-[#FDF2F4] border border-[#F9A8C9]/20 rounded-xl -z-10" />
                  )}
                  <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.3 : 1.8} />
                  <span className="text-[8px] font-bold tracking-wider uppercase">{item.label === 'Presentation' ? 'Present' : item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export default AppLayout;
