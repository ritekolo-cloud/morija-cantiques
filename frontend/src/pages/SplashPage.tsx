import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/app/home', { replace: true });
    }, 2800);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#180826] via-[#090212] to-[#040108] flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Background radial glow */}
      <div className="absolute w-[300px] h-[300px] rounded-full bg-[#E5B83B]/5 blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      {/* Cross and Branding container */}
      <div className="flex flex-col items-center z-10">
        {/* Animated Gold Cross SVG */}
        <div className="w-24 h-24 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(229,184,59,0.15)] animate-in scale-in duration-1000 ease-out">
          <svg
            className="w-14 h-14 text-[#E5B83B] filter drop-shadow-[0_0_12px_rgba(229,184,59,0.5)]"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Main Cross Bars */}
            <path d="M50 15 V85" strokeWidth="5.5" />
            <path d="M25 38 H75" strokeWidth="5.5" />
            
            {/* Fine Inner Accent Lines */}
            <path d="M50 20 V80" stroke="#FFF" strokeWidth="1" opacity="0.6" />
            <path d="M30 38 H70" stroke="#FFF" strokeWidth="1" opacity="0.6" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl font-extrabold tracking-wide text-cream text-center mb-2 animate-in slide-in-from-bottom duration-1000 delay-300">
          Morija Cantiques
        </h1>
        
        {/* Subtitle */}
        <p className="text-xs font-sans font-bold text-[#E5B83B] uppercase tracking-[0.25em] text-center opacity-90 animate-in slide-in-from-bottom duration-1000 delay-500">
          Premium Digital Hymnal
        </p>
      </div>

      {/* Bottom Loading Progress Pill */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#E5B83B] to-[#F3D070] rounded-full animate-[progressBar_2.5s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}

export default SplashPage;
