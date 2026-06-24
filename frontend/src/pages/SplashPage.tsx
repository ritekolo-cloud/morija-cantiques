import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
export function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/app/home', { replace: true });
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 animate-in fade-in duration-1000">
      <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(255,255,0,0.3)] scale-in duration-700">
        <span className="text-yellow text-6xl leading-none">✝</span>
      </div>
      <h1 className="font-playfair text-4xl font-bold tracking-tight text-cream mb-2 slide-in-bottom duration-700 delay-300">
        Morija Cantiques
      </h1>
      <p className="text-cream/60 slide-in-bottom duration-700 delay-500">
        Premium Church Hymnal
      </p>
    </div>
  );
}
