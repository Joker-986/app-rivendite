import React, { useState } from 'react';
import { Sparkles, Target, Search, Coffee } from 'lucide-react';
import { RubricaData, SearchResult } from '../types';
import MorningBriefing from './MorningBriefing';
import OfferSniper from './OfferSniper';
import DataOracle from './DataOracle';

interface AiWarRoomTabProps {
  rubrica: RubricaData;
  crmAnagrafiche: SearchResult[];
  stores: SearchResult[];
}

const AiWarRoomTab: React.FC<AiWarRoomTabProps> = ({ rubrica, crmAnagrafiche, stores }) => {
  const [activeModule, setActiveModule] = useState<'briefing' | 'sniper' | 'oracle'>('briefing');

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden pb-24 pt-2 relative">
      
      {/* EFFETTI LUCE AI */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none z-0"></div>

      {/* HEADER WAR ROOM */}
      <div className="bg-white/80 backdrop-blur-md border-b border-indigo-100 px-4 py-4 shrink-0 space-y-4 shadow-sm relative z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-indigo-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" /> Copilota Strategico
          </h2>
          <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
            Gemini AI Ready
          </span>
        </div>

        {/* NAVIGATION PILL */}
        <div className="flex bg-slate-100/80 p-1 rounded-xl gap-1 border border-slate-200/50">
          <button 
            onClick={() => setActiveModule('briefing')} 
            className={`flex-1 flex flex-col items-center justify-center py-2 text-[10px] font-black rounded-lg transition-all ${activeModule === 'briefing' ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Coffee className="w-3.5 h-3.5 mb-0.5" /> Briefing
          </button>
          
          <button 
            onClick={() => setActiveModule('sniper')} 
            className={`flex-1 flex flex-col items-center justify-center py-2 text-[10px] font-black rounded-lg transition-all ${activeModule === 'sniper' ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Target className="w-3.5 h-3.5 mb-0.5" /> Offerte
          </button>

          <button 
            onClick={() => setActiveModule('oracle')} 
            className={`flex-1 flex flex-col items-center justify-center py-2 text-[10px] font-black rounded-lg transition-all ${activeModule === 'oracle' ? 'bg-slate-800 text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Search className="w-3.5 h-3.5 mb-0.5" /> Oracolo
          </button>
        </div>
      </div>

      {/* RENDERIZZATORE SOTTOMODULI (COMPARTIMENTI STAGNI) */}
      <div className="flex-1 overflow-y-auto p-4 relative z-10">
        
        {activeModule === 'briefing' && (
          <div className="h-full">
            <MorningBriefing rubrica={rubrica} crmAnagrafiche={crmAnagrafiche} />
          </div>
        )}

        {activeModule === 'sniper' && (
          <div className="h-full">
            <OfferSniper rubrica={rubrica} crmAnagrafiche={crmAnagrafiche} stores={stores} />
          </div>
        )}

        {activeModule === 'oracle' && (
          <div className="h-full">
            <DataOracle rubrica={rubrica} crmAnagrafiche={crmAnagrafiche} stores={stores} />
          </div>
        )}

      </div>
    </div>
  );
};

export default AiWarRoomTab;
