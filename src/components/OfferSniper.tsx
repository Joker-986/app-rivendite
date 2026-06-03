import React, { useState, useMemo } from 'react';
import { Target, Send, MessageCircle, Copy, Check, Loader2, UserCheck, AlertCircle } from 'lucide-react';
import { RubricaData, SearchResult } from '../types';
import { getRivenditaId } from '../utils/helpers';
import { generateTailoredOffers, GeneratedOffer } from '../services/offerSniperService';

interface OfferSniperProps {
  rubrica: RubricaData;
  crmAnagrafiche: SearchResult[];
  stores: SearchResult[];
}

const OfferSniper: React.FC<OfferSniperProps> = ({ rubrica, crmAnagrafiche, stores }) => {
  const [selectedId, setSelectedId] = useState<string>('');
  const [offers, setOffers] = useState<GeneratedOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Combina CRM e Store per il selettore, escludendo i morti (RIP)
  const availableClients = useMemo(() => {
    const combined = [...crmAnagrafiche, ...stores];
    return combined.filter(c => {
      const id = getRivenditaId(c);
      return rubrica[id] && rubrica[id]?.stato !== 'RIP';
    }).sort((a, b) => {
      const nomeA = a.isStore ? a.storeName : a['Comune'];
      const nomeB = b.isStore ? b.storeName : b['Comune'];
      return (nomeA || '').localeCompare(nomeB || '');
    });
  }, [crmAnagrafiche, stores, rubrica]);

  const handleGenerate = async () => {
    if (!selectedId) return;
    setIsLoading(true);
    setError(null);
    setOffers([]);
    
    try {
      const results = await generateTailoredOffers(selectedId, rubrica, [...crmAnagrafiche, ...stores]);
      setOffers(results);
    } catch (err: any) {
      setError(err.message || 'Errore durante la generazione delle offerte.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleWhatsApp = (text: string) => {
    const clientExtra = rubrica[selectedId];
    if (clientExtra && clientExtra.telefono) {
      const phone = clientExtra.telefono.replace(/\s+/g, '');
      const url = `https://wa.me/39${phone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    } else {
      // Fallback se non c'è il numero, apre WA generico per incollare
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in zoom-in-95 duration-300">
      
      {/* SELETTORE BERSAGLIO */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
            <Target className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Seleziona Bersaglio</h3>
            <p className="text-[10px] font-bold text-slate-400">Scegli il cliente da colpire</p>
          </div>
        </div>
        
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setOffers([]);
            setError(null);
          }}
          className="w-full h-12 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-medium shadow-sm"
        >
          <option value="">-- Seleziona una Rivendita/Store --</option>
          {availableClients.map(c => {
            const id = getRivenditaId(c);
            const nome = c.isStore ? c.storeName : `Riv. ${c['Num. Rivendita']} - ${c.Comune}`;
            return <option key={id} value={id}>{nome}</option>;
          })}
        </select>

        <button
          onClick={handleGenerate}
          disabled={!selectedId || isLoading}
          className="w-full h-12 bg-gradient-to-b from-rose-500 to-rose-600 text-white font-bold rounded-xl border border-rose-700 border-b-[3px] hover:brightness-110 active:border-b active:translate-y-[2px] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          Genera Offerte Mirate
        </button>
      </div>

      {/* AREA RISULTATI */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {error && (
          <div className="bg-red-50 p-4 rounded-2xl flex items-start gap-3 border border-red-100">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-xs font-bold text-red-700">{error}</p>
          </div>
        )}

        {offers.length > 0 && (
          <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
            {offers.map((offer, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{offer.tipo}</span>
                </div>
                
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap font-medium">
                  {offer.testo}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleCopy(offer.testo, idx)}
                    className="flex-1 h-10 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] rounded-lg transition-colors"
                  >
                    {copiedIndex === idx ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    {copiedIndex === idx ? 'COPIATO' : 'COPIA'}
                  </button>
                  <button
                    onClick={() => handleWhatsApp(offer.testo)}
                    className="flex-1 h-10 flex items-center justify-center gap-1.5 bg-[#E8F8F5] hover:bg-[#D1F2EB] text-[#27AE60] font-bold text-[11px] rounded-lg transition-colors border border-[#27AE60]/20"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WHATSAPP
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !error && offers.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 opacity-60">
             <UserCheck className="w-10 h-10 text-slate-300 mb-2" />
             <p className="text-xs font-bold text-center">Seleziona un cliente e premi Genera<br />per confezionare il messaggio perfetto.</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default OfferSniper;
