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
    <div
      className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden select-none"
      style={{
        backgroundImage: `url('/bg-worship.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Soft warm overlay so text pops */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#FFFDF5]/60 via-[#FFF9E0]/70 to-[#FFFDF5]/80 pointer-events-none" />

      {/* Warm glow layer */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-[#E5B83B]/20 blur-[140px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      {/* Branding */}
      <div className="flex flex-col items-center z-10 text-center space-y-6 max-w-md">
        {/* Gold Cross Emblem */}
        <div className="w-28 h-28 rounded-3xl bg-white/80 border border-[#E5B83B]/30 flex items-center justify-center shadow-[0_8px_40px_rgba(229,184,59,0.25)] backdrop-blur-sm">
          <svg
            className="w-16 h-16 text-[#C59828] filter drop-shadow-[0_0_8px_rgba(229,184,59,0.4)]"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M50 15 V85" strokeWidth="5.5" />
            <path d="M25 38 H75" strokeWidth="5.5" />
            <path d="M50 20 V80" stroke="#FFFDF5" strokeWidth="1.2" opacity="0.7" />
            <path d="M30 38 H70" stroke="#FFFDF5" strokeWidth="1.2" opacity="0.7" />
          </svg>
        </div>

        {/* Text details */}
        <div className="space-y-2">
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-wide text-[#1A1A16]">
            Morija Cantiques
          </h1>
          <p className="text-[10px] md:text-xs font-bold text-[#C59828] uppercase tracking-[0.25em]">
            Professional Church Presentation System
          </p>
        </div>
      </div>

      {/* Bottom loading progress */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-40 h-1.5 bg-[#E8E5D5] rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#E5B83B] to-[#F3D070] rounded-full w-full origin-left animate-[loading_2.2s_ease-in-out_infinite]" />
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: scaleX(0); transform-origin: left; }
          45% { transform: scaleX(1); transform-origin: left; }
          50% { transform: scaleX(1); transform-origin: right; }
          100% { transform: scaleX(0); transform-origin: right; }
        }
      `}</style>
    </div>
  );
}

export default SplashPage;
