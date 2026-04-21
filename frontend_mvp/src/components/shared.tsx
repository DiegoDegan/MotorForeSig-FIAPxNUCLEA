import React from 'react';
import { Bell, Calendar, User } from 'lucide-react';

export const BentoCell = ({ children, title, status = 'mint', className = '', icon: Icon }: any) => {
  const statusColors: any = {
    mint: 'bg-mint',
    lime: 'bg-lime',
    heat: 'bg-heat',
    none: 'bg-transparent'
  };

  return (
    <div className={`relative bg-surface border border-white/5 p-5 rounded-lg ${className}`}>
      {status !== 'none' && (
        <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${statusColors[status]}`} />
      )}

      {title && (
        <div className="flex items-center gap-2 mb-4">
          {Icon && <Icon className="w-4 h-4 text-white/50" />}
          <h3 className="text-[10px] text-white/50 uppercase tracking-[0.1em] font-mono">
            {title.replace(/_/g, ' ')}
          </h3>
        </div>
      )}
      {children}
    </div>
  );
};

export const SegmentedBar = ({ value, max = 100, color = 'mint' }: any) => {
  const segments = 12;
  const filled = Math.round((value / max) * segments);
  const colorClass = color === 'mint' ? 'bg-mint' : color === 'heat' ? 'bg-heat' : 'bg-lime';
  const glowVar = color === 'mint' ? 'var(--color-mint)' : color === 'heat' ? 'var(--color-heat)' : 'var(--color-lime)';

  return (
    <div className="flex gap-1 mt-3">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-sm ${i < filled ? colorClass : 'bg-white/10'}`}
          style={{ boxShadow: i < filled ? `0 0 8px ${glowVar}` : 'none' }}
        />
      ))}
    </div>
  );
};

export const MFSLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <img
    src="/logo.png"
    alt="MFS Logo"
    className={`${className} object-contain`}
  />
);

export const TopNav = ({ title, subtitle }: { title: string, subtitle: string }) => (
  <header className="flex items-center justify-between mb-8">
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-[10px] font-mono text-mint tracking-widest uppercase">{subtitle.replace(/_/g, ' ')}</span>
      </div>
      <h1 className="text-3xl font-display font-bold text-white tracking-wide uppercase">
        {title.replace(/_/g, ' ')}
      </h1>
    </div>

    <div className="flex items-center gap-8">
      <div className="flex gap-6 font-mono text-[10px] text-white/60 text-right">
        {/* Status/Updates removidos conforme solicitação */}
      </div>

      <div className="flex items-center gap-4 border-l border-white/10 pl-8">
        <button className="text-white/50 hover:text-white transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-heat rounded-full" />
        </button>
        <button className="text-white/50 hover:text-white transition-colors">
          <Calendar className="w-5 h-5" />
        </button>
        <button className="w-8 h-8 bg-surface-high border border-white/10 rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-colors">
          <User className="w-4 h-4" />
        </button>
      </div>
    </div>
  </header>
);
