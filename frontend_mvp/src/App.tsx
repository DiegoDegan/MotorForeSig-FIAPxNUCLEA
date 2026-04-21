import React, { useState } from 'react';
import { Terminal, LayoutDashboard, ShieldAlert, Crosshair, Activity, Settings, LogOut } from 'lucide-react';
import { MFSLogo } from './components/shared';
import { CockpitScreen } from './modules/cockpit/CockpitScreen';
import { MesaCreditoScreen } from './modules/mesa-credito/MesaCreditoScreen';
import { RiscoSistemicoScreen } from './modules/risco-sistemico/RiscoSistemicoScreen';
import { GovernancaScreen } from './modules/governanca/GovernancaScreen';

const Sidebar = ({ activePage, setActivePage }: { activePage: string, setActivePage: (page: string) => void }) => (
  <aside className="w-20 fixed left-0 top-0 bottom-0 bg-surface-high border-r border-white/5 flex flex-col items-center py-6 z-50">
    <div className="mb-12">
      <MFSLogo className="w-[58px] h-[58px]" />
    </div>
    
    <nav className="flex flex-col gap-8 flex-1">
      <button 
        onClick={() => setActivePage('cockpit')}
        className={`p-3 rounded-lg relative group transition-colors ${activePage === 'cockpit' ? 'bg-mint/10 text-mint' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
      >
        {activePage === 'cockpit' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-mint rounded-r-md" />}
        <LayoutDashboard className="w-6 h-6" />
      </button>
      <button 
        onClick={() => setActivePage('mesa')}
        className={`p-3 rounded-lg relative group transition-colors ${activePage === 'mesa' ? 'bg-mint/10 text-mint' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
      >
        {activePage === 'mesa' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-mint rounded-r-md" />}
        <ShieldAlert className="w-6 h-6" />
      </button>
      <button 
        onClick={() => setActivePage('risco')}
        className={`p-3 rounded-lg relative group transition-colors ${activePage === 'risco' ? 'bg-mint/10 text-mint' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
      >
        {activePage === 'risco' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-mint rounded-r-md" />}
        <Crosshair className="w-6 h-6" />
      </button>
      <button 
        onClick={() => setActivePage('gov')}
        className={`p-3 rounded-lg relative group transition-colors ${activePage === 'gov' ? 'bg-mint/10 text-mint' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
      >
        {activePage === 'gov' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-mint rounded-r-md" />}
        <Activity className="w-6 h-6" />
      </button>
    </nav>
    
    <div className="flex flex-col gap-6">
      <button className="p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
        <Settings className="w-6 h-6" />
      </button>
      <button className="p-3 text-white/40 hover:text-heat hover:bg-heat/10 rounded-lg transition-colors">
        <LogOut className="w-6 h-6" />
      </button>
    </div>
  </aside>
);

export default function App() {
  const [activePage, setActivePage] = useState('cockpit');

  return (
    <div className="min-h-screen bg-obsidian text-white flex">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-1 ml-20 p-8 min-w-0">
        {activePage === 'cockpit' ? <CockpitScreen /> : 
         activePage === 'mesa' ? <MesaCreditoScreen /> : 
         activePage === 'risco' ? <RiscoSistemicoScreen /> :
         <GovernancaScreen />}
      </main>
    </div>
  );
}
