import React, { useState } from 'react';
import { Sparkles, Target, Search, Coffee, Settings2, X, Trash2, Plus } from 'lucide-react';
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
  
  const DEFAULT_MODEL = 'openrouter/free';
  const [openRouterModel, setOpenRouterModel] = useState(() => {
    const saved = localStorage.getItem('openRouterModel');
    return saved !== null ? saved : DEFAULT_MODEL;
  });
  
  const [savedModels, setSavedModels] = useState<string[]>(() => {
    const saved = localStorage.getItem('openRouterSavedModels');
    return saved ? JSON.parse(saved) : [DEFAULT_MODEL];
  });
  
  const [newModelInput, setNewModelInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const handleModelChange = (model: string) => {
    setOpenRouterModel(model);
    localStorage.setItem('openRouterModel', model);
  };

  const handleAddModel = () => {
    const trimmed = newModelInput.trim();
    if (trimmed && !savedModels.includes(trimmed)) {
      const newModels = [...savedModels, trimmed];
      setSavedModels(newModels);
      localStorage.setItem('openRouterSavedModels', JSON.stringify(newModels));
      handleModelChange(trimmed);
      setNewModelInput('');
    }
  };

  const handleDeleteModel = () => {
    if (!openRouterModel || openRouterModel === DEFAULT_MODEL) return;
    const newModels = savedModels.filter(m => m !== openRouterModel);
    setSavedModels(newModels);
    localStorage.setItem('openRouterSavedModels', JSON.stringify(newModels));
    handleModelChange(newModels.length > 0 ? newModels[0] : DEFAULT_MODEL);
  };

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
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
              {openRouterModel ? 'OpenRouter Ready' : 'Gemini AI Ready'}
            </span>
            <button onClick={() => setShowConfig(!showConfig)} className="p-1 text-indigo-400 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
               <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showConfig && (
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center">
               <label className="text-[10px] font-black text-indigo-800 uppercase tracking-widest block">Modello OpenRouter</label>
               <button onClick={() => setShowConfig(false)} className="text-indigo-400 hover:text-indigo-600"><X className="w-3 h-3"/></button>
            </div>
            
            {/* Selettore e Cestino */}
            <div className="flex items-center gap-2 w-full">
              <select 
                value={openRouterModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="flex-1 min-w-0 h-9 px-2 bg-white border border-indigo-200 rounded-lg outline-none text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-400 shadow-sm truncate"
              >
                <option value="">🤖 Usa Google Gemini (Nativo)</option>
                {savedModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <button 
                onClick={handleDeleteModel}
                disabled={!openRouterModel || openRouterModel === DEFAULT_MODEL || savedModels.length <= 1}
                className="w-9 h-9 flex items-center justify-center bg-white border border-red-200 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors shadow-sm shrink-0"
                title="Elimina Modello Selezionato"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Aggiunta Nuovo Modello */}
            <div className="flex items-center gap-2 w-full">
              <input 
                type="text" 
                value={newModelInput}
                onChange={(e) => setNewModelInput(e.target.value)}
                placeholder="Nuovo modello (es. mistralai/mistral...)"
                className="flex-1 min-w-0 h-9 px-3 bg-white border border-indigo-200 rounded-lg outline-none text-[11px] font-medium text-slate-700 focus:ring-2 focus:ring-indigo-400 shadow-sm truncate"
              />
              <button 
                onClick={handleAddModel}
                disabled={!newModelInput.trim()}
                className="w-9 h-9 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shrink-0"
                title="Aggiungi e Seleziona"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-[9px] text-indigo-600/80 leading-tight font-medium">
              Seleziona un modello. La API Key è protetta sul server.
            </p>
          </div>
        )}

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
