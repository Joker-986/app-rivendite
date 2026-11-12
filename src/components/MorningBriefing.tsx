import React, { useState, useEffect, useCallback } from 'react';
import { BrainCircuit, RefreshCw, Zap, ShieldAlert, BellOff, ChevronDown, ChevronUp, BellRing, Eye, EyeOff } from 'lucide-react';
import { RubricaData, SearchResult } from '../types';
import { generateMorningBriefing } from '../services/aiStrategyService';
import { getRivenditaId } from '../utils/helpers';
import { useProducts } from '../contexts/ProductContext';

interface MorningBriefingProps {
  rubrica: RubricaData;
  crmAnagrafiche: SearchResult[];
}

const MorningBriefing: React.FC<MorningBriefingProps> = ({ rubrica, crmAnagrafiche }) => {
  const { products } = useProducts();
  const [briefing, setBriefing] = useState<string | null>(null);
  const [suggestedIds, setSuggestedIds] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [showSnooze, setShowSnooze] = useState(false);
  const [showUnsnooze, setShowUnsnooze] = useState(false);
  const [snoozeClient, setSnoozeClient] = useState('');
  const [snoozeDays, setSnoozeDays] = useState('7');
  
  const [snoozedCount, setSnoozedCount] = useState(0);
  const [snoozedList, setSnoozedList] = useState<Record<string, number>>({});

  // Spazzino: Pulisce i vecchi snooze scaduti e aggiorna lo stato
  const cleanExpiredSnoozes = useCallback(() => {
    const raw = localStorage.getItem('tgest_briefing_snooze');
    if (!raw) {
      setSnoozedList({});
      return 0;
    }
    try {
      const data = JSON.parse(raw);
      const now = new Date().getTime();
      let activeCount = 0;
      const cleanData: Record<string, number> = {};
      Object.entries(data).forEach(([id, expiry]) => {
        if (typeof expiry === 'number' && expiry > now) {
          cleanData[id] = expiry as number;
          activeCount++;
        }
      });
      localStorage.setItem('tgest_briefing_snooze', JSON.stringify(cleanData));
      setSnoozedList(cleanData);
      return activeCount;
    } catch {
      localStorage.removeItem('tgest_briefing_snooze');
      setSnoozedList({});
      return 0;
    }
  }, []);

  const runScan = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    setSnoozedCount(cleanExpiredSnoozes());
    try {
      const result = await generateMorningBriefing(rubrica, crmAnagrafiche, products);
      setBriefing(result.testo);
      setSuggestedIds(result.idSuggeriti);
      setShowSnooze(false);
      setShowUnsnooze(false);
    } catch (err: any) {
      setError(err.message || 'Errore durante la scansione tattica.');
    } finally {
      setIsScanning(false);
    }
  }, [rubrica, crmAnagrafiche, cleanExpiredSnoozes, products]);

  const handleRemoveSnooze = (idToRemove: string) => {
    const raw = localStorage.getItem('tgest_briefing_snooze');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      delete data[idToRemove];
      localStorage.setItem('tgest_briefing_snooze', JSON.stringify(data));
      setSnoozedCount(cleanExpiredSnoozes());
      if (Object.keys(data).length === 0) {
        setShowUnsnooze(false);
      }
      // Non forziamo runScan() automaticamente per permettere rimozioni multiple, 
      // l'utente premerà "Aggiorna" quando pronto.
    } catch (e) {
      console.error("Errore rimozione snooze", e);
    }
  };

  // L'avvio automatico è stato disattivato. L'utente avvia l'analisi manualmente.
  useEffect(() => {
    setSnoozedCount(cleanExpiredSnoozes());
  }, [cleanExpiredSnoozes]);

  const handleSnooze = () => {
    if (!snoozeClient) return;
    const days = parseInt(snoozeDays) || 7;
    const expiry = new Date().getTime() + (days * 24 * 60 * 60 * 1000);
    const raw = localStorage.getItem('tgest_briefing_snooze');
    const data = raw ? JSON.parse(raw) : {};
    data[snoozeClient] = expiry;
    localStorage.setItem('tgest_briefing_snooze', JSON.stringify(data));
    setSnoozeClient('');
    runScan(); // Rigenera escludendo il silenziato
  };

  const renderBriefingContent = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentCategory: string | null = null;
    let currentSkus: { name: string; qta: string; motivo: string }[] = [];

    const flushCategoryGroup = (keyPrefix: string | number) => {
      if (currentCategory || currentSkus.length > 0) {
        elements.push(
          <div
            key={`cat-group-${keyPrefix}`}
            className="my-2.5 p-3 bg-slate-50/90 border border-slate-200/90 rounded-2xl shadow-xs"
          >
            {currentCategory && (
              <div className="flex items-center pb-2 mb-1 border-b border-slate-200/70">
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-md uppercase tracking-wider">
                  {currentCategory.replace(/[\[\]]/g, '')}
                </span>
              </div>
            )}
            <div className="divide-y divide-slate-200/70">
              {currentSkus.map((sku, sIdx) => (
                <div key={sIdx} className="py-2 first:pt-1 last:pb-0 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2 w-full">
                    <span className="text-xs font-bold text-slate-800 leading-snug break-words flex-1">
                      {sku.name}
                    </span>
                    {sku.qta && (
                      <span className="shrink-0 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-md border border-emerald-200/80">
                        {sku.qta}
                      </span>
                    )}
                  </div>
                  {sku.motivo && (
                    <div className="w-full bg-white/80 px-2 py-1 rounded-md border border-slate-200/50">
                      <span className="text-[10px] font-medium text-slate-500 italic break-words block leading-tight">
                        {sku.motivo}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
        currentCategory = null;
        currentSkus = [];
      }
    };

    lines.forEach((rawLine, idx) => {
      const trimmed = rawLine.trim();

      if (trimmed.startsWith('CAT_GROUP:')) {
        flushCategoryGroup(idx);
        currentCategory = trimmed.replace(/^CAT_GROUP:\s*/, '').trim();
        return;
      }

      if (trimmed.startsWith('SKU_ROW:')) {
        const cleanContent = trimmed.replace(/^SKU_ROW:\s*/, '');
        const parts = cleanContent.split('|').map(p => p.trim());
        let rawName = parts[0] || '';

        // Pulizia deterministica: rimuove dal nome prodotto eventuali prefissi ridondanti già presenti nella categoria
        if (currentCategory && rawName) {
          const catClean = currentCategory.replace(/[\[\]]/g, '').trim();
          const catWords = catClean.toUpperCase().split(/\s+/).filter(Boolean);
          const nameWords = rawName.split(/\s+/);

          // Rimuove le parole iniziali del nome prodotto se appartengono al set di parole della categoria (es. "ESSENTIAL 2 STARTER KIT" vs "STARTER KIT ESSENTIAL 2")
          let cutIndex = 0;
          while (
            cutIndex < nameWords.length - 1 &&
            catWords.includes(nameWords[cutIndex].toUpperCase())
          ) {
            cutIndex++;
          }
          if (cutIndex > 0) {
            rawName = nameWords.slice(cutIndex).join(' ').replace(/^[-–:]+\s*/, '').trim();
          }
        }

        currentSkus.push({
          name: rawName,
          qta: parts[1] || '',
          motivo: parts[2] || ''
        });
        return;
      }

      // Se incontriamo una riga normale mentre un gruppo categoria è aperto, chiudiamo prima il gruppo
      if (currentCategory || currentSkus.length > 0) {
        flushCategoryGroup(idx);
      }

      const parts = rawLine.split(/(\*\*.*?\*\*)/g);
      elements.push(
        <div key={`line-${idx}`} className="min-h-[1.25rem]">
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-black text-indigo-950">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <span key={pIdx}>{part}</span>;
          })}
        </div>
      );
    });

    flushCategoryGroup('end');
    return elements;
  };

  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6 bg-slate-50 rounded-3xl p-6 shadow-inner border border-slate-100">
        <div className="relative flex items-center justify-center w-20 h-20 overflow-hidden rounded-full border border-indigo-100 bg-indigo-50 shadow-sm">
           {/* Effetto Glow Confinato */}
          <div className="absolute w-full h-full bg-indigo-500/20 rounded-full animate-pulse"></div>
          <div className="absolute w-12 h-12 bg-indigo-500/30 rounded-full animate-ping"></div>
          <BrainCircuit className="w-8 h-8 text-indigo-600 relative z-10 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-1">Elaborazione Neurale</h3>
          <p className="text-xs font-bold text-slate-500">Analisi dati e ragionamento strategico...</p>
        </div>
      </div>
    );
  }

  // Lista clienti (solo quelli attivi non silenziati) per il menu a tendina
  const availableClients = crmAnagrafiche
    .filter(a => {
      const id = getRivenditaId(a);
      const data = rubrica[id];
      if (!data) return false;
      const rawSnooze = localStorage.getItem('tgest_briefing_snooze');
      const snoozed = rawSnooze ? JSON.parse(rawSnooze) : {};
      if (snoozed[id] && snoozed[id] > new Date().getTime()) return false;
      return true;
    })
    .sort((a, b) => (a.Comune || '').localeCompare(b.Comune || ''));

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in zoom-in-95 duration-300">
      
      {/* HEADER COMPATTO IN SINGOLA RIGA */}
      <div className="flex flex-col bg-white p-3 rounded-2xl shadow-sm border border-indigo-50">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest truncate">Briefing Generato</h3>
              <p className="text-[10px] font-bold text-slate-400 truncate">Analisi master cicli riordino</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {snoozedCount > 0 && (
              <button
                onClick={() => setShowUnsnooze(!showUnsnooze)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-black transition-colors border ${showUnsnooze ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-500 hover:text-slate-700 border-slate-200'}`}
                title="Gestisci silenziati"
              >
                {showUnsnooze ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span className="hidden sm:inline">{snoozedCount} SILENZIATI</span>
                <span className="sm:hidden">{snoozedCount}</span>
              </button>
            )}
            <button 
              onClick={runScan}
              className="flex justify-center items-center w-8 h-8 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 hover:text-emerald-800 rounded-lg transition-all shadow-sm"
              title="Avvia/Aggiorna Briefing"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PANNELLO UNSNOOZE (A SCOMPARSA) */}
        {showUnsnooze && snoozedCount > 0 && (
          <div className="mt-2 p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 animate-in slide-in-from-top-2">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Clienti in Standby</h4>
            <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-1">
              {Object.entries(snoozedList).map(([id]) => {
                const riv = crmAnagrafiche.find(a => String(getRivenditaId(a)) === id);
                const nome = riv ? (riv.isStore ? riv.storeName : `${riv.Comune} - Riv. ${riv['Num. Rivendita']}`) : `ID: ${id}`;
                return (
                  <div key={id} className="flex justify-between items-center bg-white p-2 border border-slate-200 rounded-lg shadow-sm">
                    <span className="text-xs font-bold text-slate-700 truncate mr-2">{nome}</span>
                    <button 
                      onClick={() => handleRemoveSnooze(id)}
                      className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded text-[9px] font-black shrink-0 transition-colors"
                    >
                      <BellRing className="w-3 h-3" /> RIATTIVA
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] text-slate-400 font-medium italic text-center mt-1">
              Premi AGGIORNA dopo aver riattivato per includerli nel briefing.
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 bg-white p-5 rounded-3xl shadow-sm border border-slate-100 overflow-y-auto">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-500 space-y-2">
            <ShieldAlert className="w-8 h-8" />
            <p className="text-xs font-bold text-center">{error}</p>
          </div>
        ) : briefing ? (
          <div className="text-sm text-slate-700 leading-relaxed space-y-1">
            {renderBriefingContent(briefing)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
            <Zap className="w-8 h-8 text-indigo-200" />
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Copilota in Attesa</p>
              <p className="text-[10px] font-medium">Seleziona il modello e premi l'icona Aggiorna per iniziare.</p>
            </div>
          </div>
        )}
      </div>

      {/* PANNELLO SNOOZE MANUALE LIMITATO */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden shrink-0">
        <button 
          onClick={() => {
            setShowSnooze(!showSnooze);
            if (!showSnooze) setShowUnsnooze(false);
          }}
          className="w-full p-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BellOff className="w-4 h-4 text-slate-500" />
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Escludi cliente dal radar</span>
          </div>
          {showSnooze ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        
        {showSnooze && (
          <div className="p-3 border-t border-slate-100 space-y-3 bg-white">
            {suggestedIds.length === 0 ? (
               <p className="text-xs text-slate-500 italic text-center py-2">Nessun cliente suggerito nel briefing attuale da poter silenziare.</p>
            ) : (
              <>
                <select 
                  value={snoozeClient}
                  onChange={(e) => setSnoozeClient(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="">Seleziona cliente da silenziare...</option>
                  {suggestedIds.map(id => {
                    const riv = crmAnagrafiche.find(a => String(getRivenditaId(a)) === id);
                    if (!riv) return null;
                    return (
                      <option key={id} value={id}>
                        {riv.isStore ? riv.storeName : `${riv.Comune} - Riv. ${riv['Num. Rivendita']}`}
                      </option>
                    );
                  })}
                </select>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="1" 
                    max="90"
                    value={snoozeDays}
                    onChange={(e) => setSnoozeDays(e.target.value)}
                    placeholder="Giorni (es. 7)"
                    className="w-24 h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center outline-none"
                  />
                  <span className="text-xs font-bold text-slate-500">Giorni</span>
                  <div className="flex-1"></div>
                  <button 
                    onClick={handleSnooze}
                    disabled={!snoozeClient || !snoozeDays}
                    className="px-4 py-2 bg-indigo-600 text-white text-[11px] font-black rounded-lg disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                  >
                    SILENZIA
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default MorningBriefing;
