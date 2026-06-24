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
        <nav className="absolute bottom-0 left-0 right-0 h-20 bg-[#0a0212]/95 backdrop-blur-xl border-t border-white/5 px-6 pb-safe z-20">
          <ul className="h-full flex justify-between items-center">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={clsx(
                      "flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-300",
                      isActive 
                        ? "text-yellow scale-110 font-bold" 
                        : "text-cream/40 hover:text-cream/80"
                    )}
                  >
                    <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
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
