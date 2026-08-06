import React, { useMemo, useState } from 'react';
import { 
  ShoppingBag, 
  CheckCircle2, 
  Clock, 
  History, 
  ChevronRight,
  AlertCircle,
  TrendingUp,
  AlertOctagon,
  Package,
  ArrowRight,
  Calendar,
  CreditCard,
  Wallet
} from 'lucide-react';
import { SearchResult, RubricaData } from '../types';
import { getRivenditaId, safeFormatDate, getTodayLocalISO } from '../utils/helpers';
import { useModals } from '../contexts/ModalContext';

interface OrdiniTabProps {
  rubrica: RubricaData;
  crmAnagrafiche: SearchResult[];
  stores: SearchResult[];
  giroVisite: SearchResult[];
  onEditHistory: (id: string, index: number, note: string, importo: number, data?: string, ora?: string, stato?: string, isEseguito?: boolean, dataEsecuzione?: string, items?: any[], dataEvasione?: string) => void;
  showToast: (message: string, type?: any) => void;
  onDeepLink: (id: string, isStore: boolean) => void;
}

const getLocalMidnightTime = (dateStr: string) => {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const OrdiniTab: React.FC<OrdiniTabProps> = ({
  rubrica, crmAnagrafiche, stores, giroVisite, onEditHistory, showToast, onDeepLink
}) => {
  const { openQuickEdit } = useModals();
  const [filterPeriod, setFilterPeriod] = useState<'oggi' | '7g' | 'mese' | 'mese_prec' | 'all' | 'custom'>('mese');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const { pendingOrders, completedOrders, stats } = useMemo(() => {
    const pOrders: any[] = [];
    const cOrders: any[] = [];
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
        if (h.tipo === 'ORDINE') {
          const totaleOrdine = parseFloat(h.importo || 0);
          const obj = { id, riv, data: d, h, totaleOrdine, originalIndex: h.originalIndex };

          if (h.isEseguito === true) {
            if (isDateInFilter(h.dataEsecuzione || h.data)) cOrders.push(obj);
          } else {
            if (isDateInFilter(h.dataEvasione || h.data)) pOrders.push(obj);
          }
        }
      });
    });

    const totalPending = pOrders.reduce((acc, item) => acc + item.totaleOrdine, 0);
    const totalCompleted = cOrders.reduce((acc, item) => acc + item.totaleOrdine, 0);

    return { 
       pendingOrders: pOrders.sort((a, b) => getLocalMidnightTime(a.h.dataEvasione || a.h.data) - getLocalMidnightTime(b.h.dataEvasione || b.h.data)),
       completedOrders: cOrders.sort((a, b) => new Date(b.h.dataEsecuzione || b.h.data).getTime() - new Date(a.h.dataEsecuzione || a.h.data).getTime()),
       stats: { totalPending, totalCompleted }
    };
  }, [rubrica, crmAnagrafiche, stores, giroVisite, filterPeriod, customRange]);

  const getTodayTime = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const handleExecute = (e: React.MouseEvent, ord: any) => {
    e.stopPropagation(); // Evita di aprire la modale
    onEditHistory(
      ord.id, 
      ord.originalIndex, 
      ord.h.note, 
      ord.h.importo, 
      undefined, undefined, undefined, 
      true, // isEseguito
      getTodayLocalISO(), // dataEsecuzione
      ord.h.items, 
      ord.h.dataEvasione
    );
    showToast("Ordine evaso e archiviato!", "success");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden pb-24 pt-2">
      {/* Dashboard container */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 shrink-0 space-y-4">
        
        {/* INIZIO FILTRO PERIODO */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" /> Filtra Ordini
            </h2>
            <button
              onClick={() => setFilterPeriod(filterPeriod === 'custom' ? 'all' : 'custom')}
              className={`p-1.5 rounded-lg border transition-all shadow-sm ${filterPeriod === 'custom' ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-100 text-blue-600 border-slate-200'}`}
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
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg capitalize transition-all ${filterPeriod === p ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {filterPeriod === 'custom' && (
            <div className="flex gap-2 animate-in fade-in zoom-in-95">
              <input type="date" value={customRange.start} onChange={(e) => setCustomRange(prev => ({...prev, start: e.target.value}))} className="flex-1 h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500" />
              <input type="date" value={customRange.end} onChange={(e) => setCustomRange(prev => ({...prev, end: e.target.value}))} className="flex-1 h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          )}
        </div>
        {/* FINE FILTRO PERIODO */}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Da Evadere</span>
            </div>
            <div className="text-xl font-black text-blue-700 tracking-tighter">
              €{stats.totalPending.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[9px] font-bold text-blue-950/40 uppercase mt-0.5">
              {pendingOrders.length} Ordini in attesa
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Evasi</span>
            </div>
            <div className="text-xl font-black text-emerald-700 tracking-tighter">
              €{stats.totalCompleted.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[9px] font-bold text-emerald-950/40 uppercase mt-0.5">
              Fatturato consolidato
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Ordini in Sospeso</h2>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center space-y-2">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-400 lowercase">Non ci sono ordini da evadere.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((ord, i) => {
                const targetTime = getLocalMidnightTime(ord.h.dataEvasione || ord.h.data);
                const isOverdue = targetTime < getTodayTime();
                const isToday = targetTime === getTodayTime();
                
                return (
                  <div 
                    key={`pending-${i}`} 
                    onClick={() => openQuickEdit('ORDINE', ord.id, ord.data, ord.originalIndex)}
                    className={`border rounded-xl p-3 shadow-sm relative overflow-hidden group mb-2 transition-all cursor-pointer ${isOverdue ? 'bg-red-50/50 border-red-200 hover:bg-red-50' : 'bg-white border-blue-200 hover:bg-blue-50/50'}`}
                  >
                    <div className="flex justify-between items-start mb-2 gap-3">
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <ShoppingBag className={`shrink-0 w-3.5 h-3.5 ${isOverdue ? 'text-red-500' : 'text-blue-500'}`} />
                          <h3 className="font-black text-slate-800 text-[14px] leading-tight whitespace-normal break-words">
                            {ord.riv.isStore ? ord.riv.storeName : `${ord.riv.Comune || 'Sconosciuto'}`}
                          </h3>
                          {!ord.riv.isStore && (
                            <span className="px-1.5 py-0.5 bg-brand-100 text-brand-800 text-[10px] font-black rounded shrink-0">
                              RIV. {ord.riv['Num. Rivendita']}
                            </span>
                          )}
                          {ord.data.codiceLogista && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(ord.data.codiceLogista || '');
                                if (typeof showToast === 'function') {
                                  showToast('Codice Logista copiato!', 'success');
                                }
                              }}
                              className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded tracking-widest shadow-sm cursor-pointer hover:bg-slate-700 active:scale-95 transition-all shrink-0"
                              title="Clicca per copiare il Codice Logista"
                            >
                              <Package className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                              <span>{ord.data.codiceLogista}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                           {isOverdue && <span className="shrink-0 text-[8px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded">SCADUTO</span>}
                           {isToday && <span className="shrink-0 text-[8px] font-black text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">OGGI</span>}
                           <span className={`shrink-0 text-[10px] font-bold ${isOverdue ? 'text-red-600' : 'text-slate-500'} flex items-center gap-1`}>
                             <Clock className="w-3 h-3 shrink-0" />
                             Consegna: {safeFormatDate(ord.h.dataEvasione || ord.h.data, 'short')}
                           </span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 shrink-0">
                        <div className="text-right mt-0.5">
                          <span className={`text-[16px] font-black ${isOverdue ? 'text-red-600' : 'text-blue-600'} tracking-tighter block leading-none`}>
                            €{ord.totaleOrdine.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeepLink(ord.id, !!ord.riv.isStore); }} 
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-90 bg-slate-100/50 border border-slate-200 shrink-0" 
                          title="Vai alla Scheda"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 mt-2 border-t border-slate-100/50">
                      {/* Metodo di Pagamento */}
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wide">
                        <CreditCard className="w-3 h-3 text-blue-400 shrink-0" />
                        <span className="truncate text-blue-700/80 bg-blue-50 px-1.5 py-0.5 rounded">
                          {ord.h.paymentMethod || 'Non specificato'}
                        </span>
                      </div>
                      
                      {/* Note e Tasto ESEGUI */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wide truncate">
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          <span className="truncate">{ord.h.note || 'Nessuna nota'}</span>
                        </div>
                        <button 
                          onClick={(e) => handleExecute(e, ord)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-lg shadow-sm transition-all shrink-0 active:scale-95"
                        >
                          ESEGUI
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Ordini Archiviati ({completedOrders.length})</h2>
            </div>
          </div>

          <div className="space-y-2">
            {completedOrders.map((ord, i) => (
              <div 
                key={`completed-${i}`} 
                onClick={() => openQuickEdit('ORDINE', ord.id, ord.data, ord.originalIndex)}
                className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-sm opacity-80 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-bold text-slate-700 whitespace-normal break-words leading-tight">
                      {ord.riv.isStore ? ord.riv.storeName : `${ord.riv.Comune || 'Sconosciuto'}`}
                    </span>
                    {!ord.riv.isStore && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black rounded shrink-0">
                        RIV. {ord.riv['Num. Rivendita']}
                      </span>
                    )}
                    {ord.data.codiceLogista && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(ord.data.codiceLogista || '');
                          if (typeof showToast === 'function') {
                            showToast('Codice Logista copiato!', 'success');
                          }
                        }}
                        className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded tracking-widest shadow-sm cursor-pointer hover:bg-slate-700 active:scale-95 transition-all shrink-0"
                        title="Clicca per copiare il Codice Logista"
                      >
                        <Package className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                        <span>{ord.data.codiceLogista}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="text-emerald-600 shrink-0">€{ord.totaleOrdine.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                    <span className="shrink-0">• {safeFormatDate(ord.h.dataEsecuzione || ord.h.data)}</span>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeepLink(ord.id, !!ord.riv.isStore); }} 
                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-90 ml-2 shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default OrdiniTab;
