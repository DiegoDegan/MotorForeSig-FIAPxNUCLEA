import React from 'react';
import Header from './components/Header';
import NetworkGraph from './components/NetworkGraph';
import SurvivalChart from './components/SurvivalChart';
import ExplainabilityPanel from './components/ExplainabilityPanel';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-mfs-bg text-white font-sans selection:bg-mfs-lime selection:text-black">
      <Header />
      
      <main className="p-4 md:p-6 h-[calc(100vh-64px)] overflow-hidden">
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 grid-rows-6 gap-4 h-full">
          
          {/* Main Stage: Risk Graph (Top Left, Large) */}
          <div className="lg:col-span-9 lg:row-span-4 bg-mfs-glass border border-mfs-border rounded-2xl relative shadow-2xl overflow-hidden group">
            {/* Corner Accents */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-mfs-mint/50 rounded-tl-lg z-20"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-mfs-mint/50 rounded-tr-lg z-20"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-mfs-mint/50 rounded-bl-lg z-20"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-mfs-mint/50 rounded-br-lg z-20"></div>
            
            <NetworkGraph />
          </div>

          {/* Right Panel: XAI (Right column, Full height) */}
          <div className="lg:col-span-3 lg:row-span-6 bg-mfs-bg border-l border-mfs-border/50 lg:bg-transparent lg:border-none">
             <div className="h-full bg-mfs-glass border border-mfs-border rounded-2xl shadow-xl overflow-hidden">
                <ExplainabilityPanel />
             </div>
          </div>

          {/* Bottom Panel: Survival Chart (Bottom Left, Wide) */}
          <div className="lg:col-span-9 lg:row-span-2 bg-mfs-glass border border-mfs-border rounded-2xl shadow-xl overflow-hidden relative">
             <SurvivalChart />
          </div>

        </div>
      </main>
      
      {/* Background Decorative Gradient Blob */}
      <div className="fixed -bottom-32 -left-32 w-96 h-96 bg-mfs-mint opacity-5 blur-[120px] pointer-events-none rounded-full z-0"></div>
      <div className="fixed -top-32 -right-32 w-96 h-96 bg-blue-600 opacity-5 blur-[120px] pointer-events-none rounded-full z-0"></div>
    </div>
  );
};

export default App;