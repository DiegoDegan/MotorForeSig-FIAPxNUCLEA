
import React, { useState, useEffect } from 'react';
import { User, Bell, Search } from 'lucide-react';

const Header: React.FC = () => {
  const [pdValue, setPdValue] = useState(4.20);
  const [alerts, setAlerts] = useState(12);

  // Simulate live data ticking
  useEffect(() => {
    const interval = setInterval(() => {
      setPdValue(prev => +(prev + (Math.random() * 0.1 - 0.05)).toFixed(2));
      if (Math.random() > 0.95) setAlerts(prev => prev + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-mfs-border bg-mfs-bg/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {/* LOGO DEFINITIVO (SVG INLINE) - Zero dependência externa */}
          <div className="w-9 h-9 relative flex-shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_8px_rgba(87,217,174,0.4)]">
              <defs>
                <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#57D9AE" />
                  <stop offset="100%" stopColor="#CCFF00" />
                </linearGradient>
              </defs>
              
              {/* Background Circle */}
              <circle cx="50" cy="50" r="48" fill="#0F1218" stroke="url(#logo-grad)" strokeWidth="1.5" />
              
              {/* Tech Elements */}
              <circle cx="50" cy="50" r="35" stroke="#57D9AE" strokeWidth="0.5" fill="none" opacity="0.3" strokeDasharray="4 2" />
              
              {/* The "M" / Graph Symbol */}
              <path 
                d="M25 60 L40 35 L60 55 L75 25" 
                stroke="url(#logo-grad)" 
                strokeWidth="5" 
                fill="none" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              
              {/* Data Points */}
              <circle cx="25" cy="60" r="3" fill="#57D9AE" />
              <circle cx="40" cy="35" r="3" fill="#57D9AE" />
              <circle cx="60" cy="55" r="3" fill="#CCFF00" />
              <circle cx="75" cy="25" r="4" fill="#CCFF00" className="animate-pulse" />
            </svg>
          </div>

          <h1 className="font-sans font-bold text-xl tracking-tight text-white">
            MOTOR<span className="text-mfs-mint">FORE</span><span className="text-mfs-lime">SIG</span>
          </h1>
        </div>
        <div className="h-6 w-px bg-mfs-border mx-2"></div>
        <nav className="hidden md:flex gap-6 text-sm text-mfs-text font-medium">
          <span className="text-white cursor-pointer hover:text-mfs-mint transition-colors">Dashboard</span>
          <span className="cursor-pointer hover:text-mfs-mint transition-colors">Carteiras</span>
          <span className="cursor-pointer hover:text-mfs-mint transition-colors">Cedentes</span>
        </nav>
      </div>

      <div className="flex items-center gap-8">
        {/* KPIs */}
        <div className="flex gap-8 font-mono text-sm">
          <div className="flex flex-col items-end">
            <span className="text-mfs-text text-xs font-sans uppercase tracking-wider">Carteira Total</span>
            <span className="text-white font-bold">R$ 11.5M</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-mfs-text text-xs font-sans uppercase tracking-wider">PD Médio</span>
            <span className="text-mfs-lime font-bold animate-pulse shadow-mfs-lime drop-shadow-[0_0_5px_rgba(204,255,0,0.5)]">
              {pdValue.toFixed(2)}%
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-mfs-text text-xs font-sans uppercase tracking-wider">Alertas Hoje</span>
            <span className="text-mfs-red font-bold flex items-center gap-1">
               {alerts}
               <span className="w-2 h-2 rounded-full bg-mfs-red animate-ping"></span>
            </span>
          </div>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-4 border-l border-mfs-border pl-6">
          <Search className="w-5 h-5 text-mfs-text hover:text-white cursor-pointer" />
          <div className="relative">
            <Bell className="w-5 h-5 text-mfs-text hover:text-white cursor-pointer" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-mfs-lime rounded-full"></span>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-mfs-mint to-blue-500 border border-white/20 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
