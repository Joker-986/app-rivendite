import React, { useState, useEffect, useCallback } from 'react';
import { Radar, RefreshCw, Zap, Target, ShieldAlert } from 'lucide-react';
import { RubricaData, SearchResult } from '../types';
import { generateMorningBriefing } from '../services/aiStrategyService';

interface MorningBriefingProps {
  rubrica: RubricaData;
  crmAnagrafiche: SearchResult[];
}

const MorningBriefing: React.FC<MorningBriefingProps> = ({ rubrica, crmAnagrafiche }) => {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    try {
      const result = await generateMorningBriefing(rubrica, crmAnagrafiche);
      setBriefing(result);
    } catch (err: any) {
      setError(err.message || 'Errore durante la scansione tattica.');
    } finally {
      setIsScanning(false);
    }
  }, [rubrica, crmAnagrafiche]);

  // Esegue la scansione automaticamente al primo avvio
  useEffect(() => {
    if (!briefing && !isScanning && !error) {
      runScan();
    }
  }, [runScan, briefing, isScanning, error]);

  // Funzione semplice per renderizzare il grassetto del Markdown
  const renderFormattedText = (text: string) => {
    return text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-black text-indigo-900">{part.slice(2, -2)}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6 bg-slate-50 rounded-3xl p-6 shadow-inner border border-slate-100">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-32 h-32 bg-indigo-500/20 rounded-full animate-ping"></div>
          <div className="absolute w-24 h-24 bg-indigo-500/30 rounded-full animate-pulse"></div>
          <Radar className="w-12 h-12 text-indigo-600 relative z-10 animate-[spin_3s_linear_infinite]" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-1">Scansione Tattica in Corso</h3>
          <p className="text-xs font-bold text-slate-500">Compressione dati e interrogazione Gemini AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in zoom-in-95 duration-300">
      
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-indigo-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
            <Zap className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Briefing Generato</h3>
            <p className="text-[10px] font-bold text-slate-400">Analisi basata sui cicli di riordino</p>
          </div>
        </div>
        <button 
          onClick={runScan}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-[10px] font-black transition-all shadow-sm"
        >
          <RefreshCw className="w-3 h-3" /> AGGIORNA
        </button>
      </div>

      <div className="flex-1 bg-white p-5 rounded-3xl shadow-sm border border-slate-100 overflow-y-auto">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-500 space-y-2">
            <ShieldAlert className="w-8 h-8" />
            <p className="text-xs font-bold text-center">{error}</p>
          </div>
        ) : (
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {briefing ? renderFormattedText(briefing) : 'Nessun dato disponibile.'}
          </div>
        )}
      </div>

    </div>
  );
};

export default MorningBriefing;
