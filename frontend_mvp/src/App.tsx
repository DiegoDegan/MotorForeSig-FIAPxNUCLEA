import React, { useState } from 'react';
import { LayoutDashboard, ShieldAlert, Crosshair, Activity, PieChart, Bell, User, ClipboardList } from 'lucide-react';
import { MFSLogo } from './components/shared';
import { CockpitScreen } from './modules/cockpit/CockpitScreen';
import { PoliticaRejeicaoScreen } from './modules/politica-rejeicao/PoliticaRejeicaoScreen';
import { RiscoSistemicoScreen } from './modules/risco-sistemico/RiscoSistemicoScreen';
import { GovernancaScreen } from './modules/governanca/GovernancaScreen';
import { ConcentracaoScreen } from './modules/concentracao/ConcentracaoScreen';
import { PDPerdaEstimadaScreen } from './modules/pd-perda/PDPerdaEstimadaScreen';

const pages = [
  { id: 'cockpit',      label: 'Visão Geral',        icon: LayoutDashboard },
  { id: 'risco',        label: 'Risco de Rede',       icon: Crosshair       },
  { id: 'pd',           label: 'PD & Perda Estimada', icon: Activity        },
  { id: 'concentracao', label: 'Concentração',        icon: PieChart        },
  { id: 'mesa',         label: 'Política de Rejeição', icon: ShieldAlert     },
  { id: 'governanca',   label: 'Governança',          icon: ClipboardList   },
];

export default function App() {
  const [activePage, setActivePage] = useState('cockpit');

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col">
      {/* ── Global Top Navigation ── */}
      <header className="fixed top-0 left-0 right-0 bg-surface border-b border-white/5 z-50">

        {/* Row 1 — Brand */}
        <div className="flex items-center gap-4 px-8 h-[58px] border-b border-white/5">
          <MFSLogo className="w-[50px] h-[50px] shrink-0" />
          <span className="flex-1 text-[20px] font-dm font-bold text-white tracking-widest">
            MotorForeSig — Motor de Visão Antecipada
          </span>
          <div className="flex items-center gap-4 shrink-0">
            <button className="text-white/50 hover:text-white transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-heat rounded-full" />
            </button>
            <button className="w-9 h-9 bg-surface-high border border-white/10 rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-colors">
              <User className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* Row 2 — Navigation tabs */}
        <nav className="flex items-center gap-1.5 px-8 h-[52px] overflow-x-auto no-scrollbar">
          {pages.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActivePage(id)}
              className={`flex items-center gap-2.5 px-5 py-2 rounded-lg text-[14px] font-display font-bold tracking-wide whitespace-nowrap uppercase transition-all ${activePage === id
                ? 'bg-mint/10 text-mint border border-mint/20'
                : 'text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent'
                }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {label}
            </button>
          ))}
        </nav>

      </header>

      {/* Page content — offset = row1 (58px) + row2 (52px) */}
      <main className="flex-1 mt-[110px] p-8 min-w-0">
        {activePage === 'cockpit'      && <CockpitScreen />}
        {activePage === 'risco'        && <RiscoSistemicoScreen />}
        {activePage === 'pd'           && <PDPerdaEstimadaScreen />}
        {activePage === 'mesa'         && <PoliticaRejeicaoScreen />}
        {activePage === 'concentracao' && <ConcentracaoScreen />}
        {activePage === 'governanca'   && <GovernancaScreen />}
      </main>
    </div>
  );
}
