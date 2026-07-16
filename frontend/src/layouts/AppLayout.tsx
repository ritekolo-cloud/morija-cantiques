import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Search, Heart, Book } from 'lucide-react';
import clsx from 'clsx';

export function AppLayout() {
  const location = useLocation();

  const navItems = [
    { to: '/app/home', icon: Home, label: 'Home' },
    { to: '/app/collections', icon: Book, label: 'Collections' },
    { to: '/app/search', icon: Search, label: 'Search' },
    { to: '/app/favorites', icon: Heart, label: 'Favorites' },
  ];

  const isSongPage = location.pathname.includes('/hymns/');

  return (
    <div className="min-h-screen bg-[#07010a] text-cream font-nunito flex justify-center">
      <div 
        className={clsx(
          "w-full max-w-[430px] min-h-screen relative shadow-2xl flex flex-col transition-all duration-300",
          isSongPage ? "bg-[#140622]" : "bg-gradient-to-b from-[#1b0a2a] to-[#0c0214]"
        )}
      >
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-24 scroll-smooth relative z-10">
          <Outlet />
        </main>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-5 left-4 right-4 h-16 bg-[#0c0418]/80 backdrop-blur-md border border-white/10 rounded-2xl px-5 z-20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center justify-center">
          <ul className="w-full flex justify-between items-center">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <li key={item.to} className="flex-1 flex justify-center">
                  <NavLink
                    to={item.to}
                    className={clsx(
                      "flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-all duration-300 relative select-none",
                      isActive 
                        ? "text-[#E5B83B] scale-105 font-bold" 
                        : "text-cream/40 hover:text-cream/80"
                    )}
                  >
                    {/* Active Background Pill */}
                    {isActive && (
                      <div className="absolute inset-0 bg-white/[0.04] border border-white/[0.05] rounded-xl -z-10 animate-fade-in" />
                    )}
                    <item.icon className="w-5.5 h-5.5" strokeWidth={isActive ? 2.3 : 1.8} />
                    <span className="text-[9px] font-semibold tracking-wider uppercase">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
