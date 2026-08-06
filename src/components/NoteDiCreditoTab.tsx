import React, { useMemo, useState } from 'react';
import { 
  Receipt, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  History, 
  AlertCircle,
  TrendingDown,
  CheckCircle,
  Search,
  ArrowRight,
  AlertOctagon,
  Ticket,
  Package,
  Calendar
} from 'lucide-react';
import { SearchResult, RubricaData } from '../types';
import { getRivenditaId, safeFormatDate } from '../utils/helpers';

interface NoteDiCreditoTabProps {
  rubrica: RubricaData;
  crmAnagrafiche: SearchResult[];
  stores: SearchResult[];
  giroVisite: SearchResult[];
  onEditHistory: (id: string, index: number, note: string, importo: number, data?: string, ora?: string, stato?: string, isEseguito?: boolean, dataEsecuzione?: string, items?: any[], dataEvasione?: string, visitaInizio?: string, visitaFine?: string, ndcEseguita?: boolean, dataEsecuzioneNdC?: string, paymentMethod?: string) => void;
  showToast: (message: string, type?: any) => void;
  onDeepLink: (id: string, isStore: boolean) => void;
}

const NoteDiCreditoTab: React.FC<NoteDiCreditoTabProps> = ({
  rubrica, crmAnagrafiche, stores, giroVisite, onEditHistory, showToast, onDeepLink
}) => {
  const [filterPeriod, setFilterPeriod] = useState<'oggi' | '7g' | 'mese' | 'mese_prec' | 'all' | 'custom'>('mese');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  // Logica di estrazione ottimizzata O(1) per lookup rivendite
  const { pendingNdc, completedNdc, stats } = useMemo(() => {
    const pNdc: any[] = [];
    const cNdc: any[] = [];
    const allRiv = [...crmAnagrafiche, ...stores, ...giroVisite];

    const isDateInFilter = (dateStr?: string) => {
      if (!dateStr) return false;
      if (filterPeriod === 'all') return true;
      const d = new Date(dateStr);
      const ora = new Date();

      if (filterPeriod === 'oggi') return d.toDateString() === ora.toDateString();
      if (filterPeriod === '7g') {
        const weekAgo = new Date();
        weekAgo.setDate(ora.getDate() - 7);
        return d >= weekAgo;
      }
      if (filterPeriod === 'mese') {
        const startOfMonth = new Date(ora.getFullYear(), ora.getMonth(), 1);
        return d >= startOfMonth;
      }
      if (filterPeriod === 'mese_prec') {
        const startOfPrevMonth = new Date(ora.getFullYear(), ora.getMonth() - 1, 1);
        const endOfPrevMonth = new Date(ora.getFullYear(), ora.getMonth(), 0, 23, 59, 59, 999);
        return d >= startOfPrevMonth && d <= endOfPrevMonth;
      }
      if (filterPeriod === 'custom' && customRange.start && customRange.end) {
        const start = new Date(customRange.start);
        const end = new Date(customRange.end);
        end.setHours(23, 59, 59, 999);
        return d >= start && d <= end;
      }
      return false;
    };
    
    const rivenditeMap = new Map();
    allRiv.forEach(r => rivenditeMap.set(String(getRivenditaId(r)), r));
    
    Object.entries(rubrica).forEach(([id, d]: [string, any]) => {
      const riv = rivenditeMap.get(String(id));
      if (!riv) return;
      
      const history = (d.history || []).map((h: any, index: number) => ({ ...h, originalIndex: index }));
      
      history.forEach((h: any) => {
        // Un ordine è una NdC se ha almeno un item con isCredito: true
        if (h.tipo === 'ORDINE' && h.items && h.items.some((i: any) => i.isCredito)) {
          const creditItems = h.items.filter((i: any) => i.isCredito);
          const isVoucher = creditItems.some((i: any) => i.isVoucher);
          
          // Calcolo totale credito considerando il moltiplicatore unità
          const totaleCredito = creditItems.reduce((acc: number, item: any) => {
             const unita = item.unita || 1;
             return acc + (item.prezzoApplicato * item.quantita * unita);
          }, 0);
          
          const isMismatch = h.isEseguito === true;
          const ndcObj = { id, riv, data: d, h, totaleCredito, creditItems, originalIndex: h.originalIndex, isMismatch, isVoucher };
          
          if (h.ndcEseguita) {
            if (isDateInFilter(h.dataEsecuzioneNdC || h.data)) cNdc.push(ndcObj);
          } else {
            if (isDateInFilter(h.data)) pNdc.push(ndcObj);
          }
        }
      });
    });
    
    const totalPending = pNdc.reduce((acc, item) => acc + item.totaleCredito, 0);
    const totalCompleted = cNdc.reduce((acc, item) => acc + item.totaleCredito, 0);

    return { 
       pendingNdc: pNdc.sort((a, b) => new Date(a.h.data).getTime() - new Date(b.h.data).getTime()),
       completedNdc: cNdc.sort((a, b) => new Date(b.h.dataEsecuzioneNdC || b.h.data).getTime() - new Date(a.h.dataEsecuzioneNdC || a.h.data).getTime()),
       stats: { totalPending, totalCompleted }
    };
  }, [rubrica, crmAnagrafiche, stores, giroVisite, filterPeriod, customRange]);

  const getDaysWait = (dateStr: string) => {
    const start = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const handleExecute = (ndc: any) => {
    onEditHistory(
      ndc.id, 
      ndc.originalIndex, 
      ndc.h.note, 
      ndc.h.importo, 
      undefined, // newData
      undefined, // newOra
      undefined, // newStato
      undefined, // isEseguito
      undefined, // dataEsecuzione
      undefined, // newItems
      undefined, // newDataEvasione
      undefined, // visitaInizio
      undefined, // visitaFine
      true,      // ndcEseguita
      ndc.h.data // Usa la data in cui il credito è stato emesso, NON forzare oggi
    );
    showToast(ndc.isVoucher ? "Voucher archiviato correttamente!" : "Nota di Credito archiviata correttamente!", "success");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Dashboard container */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 shrink-0">
        {/* INIZIO FILTRO PERIODO */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" /> Filtra Rimborsi
            </h2>
            <button
              onClick={() => setFilterPeriod(filterPeriod === 'custom' ? 'all' : 'custom')}
              className={`p-1.5 rounded-lg border transition-all shadow-sm ${filterPeriod === 'custom' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-100 text-emerald-600 border-slate-200'}`}
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {['all', 'oggi', '7g', 'mese', 'mese_prec'].map((p) => {
              let label = p;
              if (p === 'all') label = 'Tutti';
              if (p === 'oggi') label = 'Oggi';
              if (p === '7g') label = '7g';
              if (p === 'mese') label = new Date().toLocaleDateString('it-IT', { month: 'short' });
              if (p === 'mese_prec') {
                const prev = new Date();
                prev.setMonth(prev.getMonth() - 1);
                label = prev.toLocaleDateString('it-IT', { month: 'short' });
              }
              return (
                <button 
                  key={p} 
                  onClick={() => setFilterPeriod(p as any)} 
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg capitalize transition-all ${filterPeriod === p ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {filterPeriod === 'custom' && (
            <div className="flex gap-2 animate-in fade-in zoom-in-95">
              <input type="date" value={customRange.start} onChange={(e) => setCustomRange(prev => ({...prev, start: e.target.value}))} className="flex-1 h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500" />
              <input type="date" value={customRange.end} onChange={(e) => setCustomRange(prev => ({...prev, end: e.target.value}))} className="flex-1 h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
          )}
        </div>
        {/* FINE FILTRO PERIODO */}

        {/* Cruscotto Finanziario */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Da Rimborsare</span>
            </div>
            <div className="text-xl font-black text-emerald-700 tracking-tighter">
              €{stats.totalPending.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[9px] font-bold text-emerald-950/40 uppercase mt-0.5">
              {pendingNdc.length} Pratiche aperte
            </div>
          </div>

          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Archiviati</span>
            </div>
            <div className="text-xl font-black text-slate-600 tracking-tighter">
              €{stats.totalCompleted.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
              Totale rimborsi erogati
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Sezione In Sospeso */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Pratiche in Sospeso</h2>
            <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
              {pendingNdc.length} To-Do
            </span>
          </div>

          {pendingNdc.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center space-y-2">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-400 lowercase">Ottimo! Non ci sono rimborsi pendenti.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingNdc.map((ndc, i) => {
                const days = getDaysWait(ndc.h.data);
                const isUrgent = days > 15;
                
                return (
                  <div key={`pending-${i}`} className={`border rounded-xl p-3 shadow-sm relative overflow-hidden group mb-2 transition-all ${ndc.isMismatch ? 'bg-red-50/50 border-red-500 shadow-md shadow-red-100' : ndc.isVoucher ? 'bg-orange-50/30 border-orange-200' : 'bg-white border-slate-200'}`}>
                    <div className="flex justify-between items-start mb-2 gap-3">
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {ndc.isVoucher ? <Ticket className="shrink-0 w-3.5 h-3.5 text-orange-500" /> : <Receipt className="shrink-0 w-3.5 h-3.5 text-emerald-500" />}
                          <h3 className="font-black text-slate-800 text-[14px] leading-tight whitespace-normal break-words">
                            {ndc.riv.isStore ? ndc.riv.storeName : `${ndc.riv.Comune || 'Sconosciuto'}`}
                          </h3>
                          {!ndc.riv.isStore && (
                            <span className="px-1.5 py-0.5 bg-brand-100 text-brand-800 text-[10px] font-black rounded shrink-0">
                              RIV. {ndc.riv['Num. Rivendita']}
                            </span>
                          )}
                          {ndc.data.codiceLogista && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(ndc.data.codiceLogista || '');
                                if (typeof showToast === 'function') {
                                  showToast('Codice Logista copiato!', 'success');
                                }
                              }}
                              className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded tracking-widest shadow-sm cursor-pointer hover:bg-slate-700 active:scale-95 transition-all shrink-0"
                              title="Clicca per copiare il Codice Logista"
                            >
                              <Package className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                              <span>{ndc.data.codiceLogista}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {ndc.isMismatch ? (
                            <span className="shrink-0 bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
                              <AlertOctagon className="w-3 h-3 shrink-0" /> ⚠️ ORDINE EVASO: RICHIEDI NdC!
                            </span>
                          ) : (
                            <div className={`shrink-0 flex items-center gap-1 text-[10px] font-black uppercase ${isUrgent ? 'text-amber-500' : 'text-slate-400'}`}>
                              <Clock className="w-3 h-3 shrink-0" />
                              {days === 0 ? 'Oggi' : `${days} giorni`}
                              {isUrgent && <AlertCircle className="w-3 h-3 shrink-0" />}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-2 shrink-0">
                        <div className="text-right mt-0.5">
                          <span className={`text-[16px] font-black ${ndc.isVoucher ? 'text-orange-600' : 'text-emerald-600'} tracking-tighter block leading-none`}>
                            €{ndc.totaleCredito.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                          </span>
                          <span className={`text-[9px] font-bold ${ndc.isVoucher ? 'text-orange-400' : 'text-slate-400'} uppercase block mt-1`}>
                            {ndc.isVoucher ? 'One Shot' : 'Storno AM'}
                          </span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeepLink(ndc.id, !!ndc.riv.isStore); }} 
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-90 bg-slate-100/50 border border-slate-200 shrink-0"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Dettaglio Articoli */}
                    <div className="bg-slate-50 rounded-lg p-2 mb-2 space-y-1">
                      {ndc.creditItems.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                          <span className="truncate pr-4">• {item.descrizione || item.codice}</span>
                          <span className="shrink-0 text-slate-700">x{item.quantita} unità</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-600 uppercase tracking-wide">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        ORDINE DEL {safeFormatDate(ndc.h.data, 'short')}
                      </div>
                      <button 
                        onClick={() => handleExecute(ndc)}
                        className={`${ndc.isVoucher ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-black text-[10px] uppercase tracking-widest px-3 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ESEGUI
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Sezione Archiviati */}
        <section className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Rimborsi Archiviati ({completedNdc.length})</h2>
            </div>
          </div>

          <div className="space-y-2">
            {completedNdc.map((ndc, i) => (
              <div key={`completed-${i}`} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-sm opacity-80">
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-bold text-slate-700 whitespace-normal break-words leading-tight">
                      {ndc.riv.isStore ? ndc.riv.storeName : `${ndc.riv.Comune || 'Sconosciuto'}`}
                    </span>
                    {!ndc.riv.isStore && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black rounded shrink-0">
                        RIV. {ndc.riv['Num. Rivendita']}
                      </span>
                    )}
                    {ndc.data.codiceLogista && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(ndc.data.codiceLogista || '');
                          if (typeof showToast === 'function') {
                            showToast('Codice Logista copiato!', 'success');
                          }
                        }}
                        className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded tracking-widest shadow-sm cursor-pointer hover:bg-slate-700 active:scale-95 transition-all shrink-0"
                        title="Clicca per copiare il Codice Logista"
                      >
                        <Package className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                        <span>{ndc.data.codiceLogista}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                    {ndc.isVoucher ? <Ticket className="w-3 h-3 text-orange-400 shrink-0" /> : <Receipt className="w-3 h-3 text-emerald-400 shrink-0" />}
                    <span className={`shrink-0 ${ndc.isVoucher ? 'text-orange-500' : 'text-emerald-500'}`}>€{ndc.totaleCredito.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                    <span className="shrink-0">• {ndc.isVoucher ? 'VOUCHER' : 'NdC'} • {safeFormatDate(ndc.h.dataEsecuzioneNdC || ndc.h.data)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`w-7 h-7 ${ndc.isVoucher ? 'bg-orange-50 text-orange-500' : 'bg-emerald-50 text-emerald-500'} rounded-full flex items-center justify-center`}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeepLink(ndc.id, !!ndc.riv.isStore); }} 
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-90"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {completedNdc.length === 0 && (
              <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-[10px] font-bold text-slate-300 uppercase italic">
                Nessun rimborso archiviato in memoria
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default NoteDiCreditoTab;
