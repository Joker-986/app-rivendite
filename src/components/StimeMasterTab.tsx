import React, { useMemo, useState } from 'react';
import { 
  Zap, Search, X, Calendar, TrendingUp, TrendingDown, Wallet, ShoppingBag, 
  Clock, ExternalLink, ListOrdered, SearchX, Ghost,
  CalendarClock, Target, Phone, MessageCircle, ChevronLeft, ChevronRight, Layers
} from 'lucide-react';
import { SearchResult, RubricaData } from '../types';
import { getRivenditaId, safeFormatDate } from '../utils/helpers';

interface StimeMasterTabProps {
  rubrica: RubricaData;
  crmAnagrafiche: SearchResult[];
  stores: SearchResult[];
  giroVisite: SearchResult[];
  onDeepLink: (id: string, isStore: boolean) => void;
  handleRubricaUpdate?: (id: string, field: string, value: any) => void;
}

interface LogistaItem {
  id: string;
  riv: SearchResult;
  extra: any;
  orders: any[];
  totalLogista: number;
  count: number;
  mediaPerOrdine: number;
  firstDate: string;
  lastDate: string;
  lastOrderTime: number;
  spanDays: number;
  stimaMensile: number;
  stimaNote: string;
  currentMonthTotal: number;
  frequenzaGG: number;
  daysSinceLastOrder: number;
  orderedCurrentMonth: boolean;
  orderedPrevMonth: boolean;
  isMissingThisMonth: boolean;
  stato: string;
}

const StimeMasterTab: React.FC<StimeMasterTabProps> = ({
  rubrica,
  crmAnagrafiche,
  stores,
  giroVisite,
  onDeepLink,
  handleRubricaUpdate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'attivi' | 'mancanti' | 'persi'>('attivi');
  const [sortMode, setSortMode] = useState<'stima' | 'ultimo' | 'totale'>('stima');
  const [modalData, setModalData] = useState<LogistaItem | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [visibleCount, setVisibleCount] = useState(25);
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // 1. LOGICA DATI: Calcolo metriche sdoppiate (Logista + CR) e aggregazione Master
  const categoriesData = useMemo(() => {
    const allRiv = [...crmAnagrafiche, ...stores, ...giroVisite];
    const rivenditeMap = new Map<string, SearchResult>();
    allRiv.forEach(r => rivenditeMap.set(String(getRivenditaId(r)), r));

    const realToday = new Date();
    const currentMonthDate = new Date(realToday.getFullYear(), realToday.getMonth(), 1);
    const targetMonthDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

    const isPastMonth = targetMonthDate.getTime() < currentMonthDate.getTime();
    const isFutureMonth = targetMonthDate.getTime() > currentMonthDate.getTime();
    
    const cutoffDate = isPastMonth 
      ? new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999)
      : new Date(realToday.getFullYear(), realToday.getMonth(), realToday.getDate(), 23, 59, 59, 999);

    let referenceDateForRecency: Date;
    if (isPastMonth) {
      referenceDateForRecency = cutoffDate;
    } else if (isFutureMonth) {
      referenceDateForRecency = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 0, 0, 0, 0);
    } else {
      referenceDateForRecency = new Date(realToday.getFullYear(), realToday.getMonth(), realToday.getDate(), 23, 59, 59, 999);
    }

    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevYear = prevMonthDate.getFullYear();

    const processed: LogistaItem[] = [];

    const calcMetrics = (orders: any[]) => {
      if (orders.length === 0) return { stimaMensile: 0, currentMonthTotal: 0, orderedCurrentMonth: false };
      
      const lastOrderTime = new Date(orders[0].data).getTime();
      const daysSinceLastOrder = Math.max(0, Math.floor((referenceDateForRecency.getTime() - lastOrderTime) / (1000 * 3600 * 24)));
      
      let stimaMensile = 0;
      if (daysSinceLastOrder <= 45) {
        const cutoff365 = referenceDateForRecency.getTime() - (365 * 24 * 3600 * 1000);
        const annualOrders = orders.filter((o: any) => new Date(o.data).getTime() >= cutoff365);
        const nOrders = annualOrders.length;

        if (nOrders === 1) {
          stimaMensile = parseFloat(String(annualOrders[0].importo)) || 0;
        } else if (nOrders === 2) {
          const o1 = parseFloat(String(annualOrders[0].importo)) || 0;
          const o2 = parseFloat(String(annualOrders[1].importo)) || 0;
          const media = (o1 + o2) / 2;
          const t1 = new Date(annualOrders[0].data).getTime();
          const t2 = new Date(annualOrders[1].data).getTime();
          const distBetweenOrders = Math.max(1, Math.round((t1 - t2) / (1000 * 3600 * 24)));
          const distToToday = Math.max(1, Math.round((referenceDateForRecency.getTime() - t2) / (1000 * 3600 * 24)));
          const ciclo = Math.max(30, distBetweenOrders, distToToday);
          stimaMensile = media * (30 / ciclo);
        } else if (nOrders >= 3) {
          const o1 = parseFloat(String(annualOrders[0].importo)) || 0;
          const o2 = parseFloat(String(annualOrders[1].importo)) || 0;
          const o3 = parseFloat(String(annualOrders[2].importo)) || 0;
          const mediaPonderata = (o1 * 0.50) + (o2 * 0.30) + (o3 * 0.20);
          const t3 = new Date(annualOrders[2].data).getTime();
          const spanFinoAdOggi = Math.max(1, Math.round((referenceDateForRecency.getTime() - t3) / (1000 * 3600 * 24)));
          const cicloRecente = Math.max(7, spanFinoAdOggi / 2);
          stimaMensile = mediaPonderata * (30 / cicloRecente);
        }
      }

      let currentMonthTotal = 0;
      let orderedCurrentMonth = false;
      orders.forEach((o: any) => {
        const orderDate = new Date(o.data);
        if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
          orderedCurrentMonth = true;
          currentMonthTotal += parseFloat(String(o.importo)) || 0;
        }
      });

      return { stimaMensile, currentMonthTotal, orderedCurrentMonth };
    };

    Object.entries(rubrica).forEach(([id, extra]: [string, any]) => {
      const riv = rivenditeMap.get(id);
      if (!riv) return;

      const unifiedOrders = (extra.history || [])
        .filter((h: any) => (h.tipo === 'ORDINE_LOGISTA' || (h.tipo === 'ORDINE' && h.isEseguito)) && new Date(h.data).getTime() <= cutoffDate.getTime())
        .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());

      if (unifiedOrders.length === 0) return;

      const logistaOrders = unifiedOrders.filter((h: any) => h.tipo === 'ORDINE_LOGISTA');
      const crOrders = unifiedOrders.filter((h: any) => h.tipo === 'ORDINE');

      const logistaMetrics = calcMetrics(logistaOrders);
      const crMetrics = calcMetrics(crOrders);

      const stimaMensile = logistaMetrics.stimaMensile + crMetrics.stimaMensile;
      const currentMonthTotal = logistaMetrics.currentMonthTotal + crMetrics.currentMonthTotal;
      const orderedCurrentMonth = logistaMetrics.orderedCurrentMonth || crMetrics.orderedCurrentMonth;

      const totalSpeso = unifiedOrders.reduce((sum: number, h: any) => sum + (parseFloat(String(h.importo)) || 0), 0);
      const count = unifiedOrders.length;
      const mediaPerOrdine = count > 0 ? totalSpeso / count : 0;

      const lastDate = unifiedOrders[0].data;
      const firstDate = unifiedOrders[count - 1].data;
      const lastOrderTime = new Date(lastDate).getTime();
      
      const spanDays = Math.max(1, Math.round(Math.abs(lastOrderTime - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24)));
      const daysSinceLastOrder = Math.max(0, Math.floor((referenceDateForRecency.getTime() - lastOrderTime) / (1000 * 3600 * 24)));
      const frequenzaGG = count > 1 ? Math.round(spanDays / (count - 1)) : 0;

      let orderedPrevMonth = false;
      unifiedOrders.forEach((o: any) => {
        const d = new Date(o.data);
        if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) orderedPrevMonth = true;
      });

      processed.push({
        id, riv, extra, orders: unifiedOrders, totalLogista: totalSpeso, count, mediaPerOrdine, firstDate, lastDate, lastOrderTime, spanDays, stimaMensile, stimaNote: 'Logista + CR', currentMonthTotal, frequenzaGG, daysSinceLastOrder, orderedCurrentMonth, orderedPrevMonth, isMissingThisMonth: !orderedCurrentMonth, stato: extra.stato || ''
      });
    });

    const attivi = processed.filter(p => !['RIP', 'Perso', 'Sospeso'].includes(p.stato) && p.daysSinceLastOrder <= 45 && p.orderedCurrentMonth);
    const mancanti = processed.filter(p => !['RIP', 'Perso', 'Sospeso'].includes(p.stato) && p.daysSinceLastOrder <= 45 && !p.orderedCurrentMonth);
    const persi = processed.filter(p => ['RIP', 'Perso', 'Sospeso'].includes(p.stato) || p.daysSinceLastOrder > 45);

    return { attivi, persi, mancanti };
  }, [crmAnagrafiche, stores, giroVisite, rubrica, selectedDate]);

  // KPI aggregati puliti: Target Potenziale Puro vs Fatto Mese Reale Totale
  const kpis = useMemo(() => {
    let totalTarget = 0;
    let totalFattoMese = 0;

    const allItems = [...categoriesData.attivi, ...categoriesData.mancanti, ...categoriesData.persi];

    allItems.forEach(item => {
      totalTarget += item.stimaMensile;
      totalFattoMese += item.currentMonthTotal;
    });

    const realToday = new Date();
    const isCurrentMonth = selectedDate.getMonth() === realToday.getMonth() && selectedDate.getFullYear() === realToday.getFullYear();

    const deltaPercent = totalTarget > 0 
      ? isCurrentMonth
        ? (totalFattoMese / totalTarget) * 100
        : ((totalFattoMese - totalTarget) / totalTarget) * 100 
      : 0;

    return {
      clientiCount: categoriesData.attivi.length + categoriesData.mancanti.length,
      totalTarget,
      totalFattoMese,
      deltaPercent,
      isCurrentMonth
    };
  }, [categoriesData, selectedDate]);

  // Filtro ricerca e ordinamento
  const filteredAndSortedItems = useMemo(() => {
    let targetList = categoriesData[filterMode];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      targetList = targetList.filter(item => {
        const comune = (item.riv.Comune || '').toLowerCase();
        const numRiv = String(item.riv['Num. Rivendita'] || '').toLowerCase();
        const storeName = String(item.riv.storeName || '').toLowerCase();
        const storeNumber = String(item.riv.storeNumber || '').toLowerCase();
        const codiceLogista = String(item.extra?.codiceLogista || '').toLowerCase();

        return (
          comune.includes(term) ||
          numRiv.includes(term) ||
          storeName.includes(term) ||
          storeNumber.includes(term) ||
          codiceLogista.includes(term)
        );
      });
    }

    return [...targetList].sort((a, b) => {
      if (sortMode === 'stima') {
        return b.stimaMensile - a.stimaMensile;
      }
      if (sortMode === 'ultimo') {
        return b.lastOrderTime - a.lastOrderTime;
      }
      if (sortMode === 'totale') {
        return b.totalLogista - a.totalLogista;
      }
      return 0;
    });
  }, [categoriesData, filterMode, searchTerm, sortMode]);

  return (
    <div className="flex flex-col h-full bg-slate-50/50 -m-4">
      {/* 2. HEADER E FILTRI */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 space-y-3 shadow-sm relative z-10">
        
        {/* BANNER KPI AGGREGATI MASTER */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-100 leading-none mb-1.5">
                  Stime Potenziale Globale
                </span>
                <div className="flex items-center gap-1.5 bg-black/20 rounded-md w-fit pl-0.5 pr-2 py-0.5 border border-white/10 shadow-inner">
                  <button 
                    onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))} 
                    className="p-0.5 hover:bg-white/10 rounded transition-colors text-white active:scale-90"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-50 min-w-[75px] text-center">
                    {selectedDate.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}
                  </span>
                  <button 
                    onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))} 
                    disabled={(() => {
                      const realToday = new Date();
                      const maxFutureDate = new Date(realToday.getFullYear(), realToday.getMonth() + 1, 1);
                      return selectedDate.getFullYear() > maxFutureDate.getFullYear() || 
                        (selectedDate.getFullYear() === maxFutureDate.getFullYear() && selectedDate.getMonth() >= maxFutureDate.getMonth());
                    })()} 
                    className="p-0.5 hover:bg-white/10 rounded transition-colors text-white disabled:opacity-30 disabled:active:scale-100 active:scale-90"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <span className="text-[10px] font-black bg-white/20 px-2.5 py-1 rounded-full shadow-sm border border-white/10 shrink-0">
              {kpis.clientiCount} {kpis.clientiCount === 1 ? 'Cliente' : 'Clienti'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* BOX 1: Target Potenziale Mese (Puro) */}
            <div className="bg-black/15 rounded-xl p-2.5 border border-white/10">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                Target Potenziale
              </p>
              <p className="text-xl font-black tracking-tight mt-0.5">
                €{kpis.totalTarget.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[9px] font-bold text-emerald-200/80 mt-1 uppercase tracking-wider">
                Stima Teorica
              </p>
            </div>

            {/* BOX 2: Fatto Mese Reale con Delta / Avanzamento % */}
            <div className="bg-black/15 rounded-xl p-2.5 border border-white/10">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                {kpis.isCurrentMonth ? 'Fatto Mese Corrente' : 'Fatto Mese Reale'}
              </p>
              <p className="text-xl font-black tracking-tight mt-0.5">
                €{kpis.totalFattoMese.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[9px] font-bold text-emerald-200/80 mt-1 truncate">
                {kpis.isCurrentMonth ? (
                  <span>
                    Avanzamento: <span className="font-black text-emerald-300">{kpis.deltaPercent.toFixed(1)}%</span>
                  </span>
                ) : (
                  <span>
                    vs Target: <span className={`font-black ${kpis.deltaPercent >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {kpis.deltaPercent >= 0 ? '+' : ''}{kpis.deltaPercent.toFixed(1)}%
                    </span>
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* 3 BOTTONI DI FILTRO (Reali, Mancanti con badge numerico, Fantasmi) */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          <button 
            onClick={() => { setFilterMode('attivi'); setVisibleCount(25); }} 
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black rounded-lg transition-all ${filterMode === 'attivi' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Wallet className="w-3.5 h-3.5 shrink-0" /> 
            <span className="truncate">REALI ({categoriesData.attivi.length})</span>
          </button>
          
          <button 
            onClick={() => { setFilterMode('mancanti'); setVisibleCount(25); }} 
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black rounded-lg transition-all relative ${filterMode === 'mancanti' ? 'bg-amber-100 text-amber-700 shadow-sm border border-amber-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <SearchX className="w-3.5 h-3.5 shrink-0" /> 
            <span className="truncate">MANCANTI</span>
            {categoriesData.mancanti.length > 0 ? (
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${filterMode === 'mancanti' ? 'bg-red-500 text-white animate-pulse' : 'bg-red-100 text-red-600'}`}>
                {categoriesData.mancanti.length}
              </span>
            ) : (
              <span className="truncate">({categoriesData.mancanti.length})</span>
            )}
          </button>

          <button 
            onClick={() => { setFilterMode('persi'); setVisibleCount(25); }} 
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black rounded-lg transition-all ${filterMode === 'persi' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Ghost className="w-3.5 h-3.5 shrink-0" /> 
            <span className="truncate">FANTASMI ({categoriesData.persi.length})</span>
          </button>
        </div>

        {/* SEARCH & SORT BAR */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca per comune, rivendita o store..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setVisibleCount(25); }}
              className="w-full h-10 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow shadow-inner"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          
          <select 
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as any)}
            className="h-10 text-[10px] font-black text-slate-700 bg-white rounded-xl px-2.5 outline-none border border-slate-200 cursor-pointer shadow-sm shrink-0"
          >
            <option value="stima">Ordina: Stima Mensile</option>
            <option value="ultimo">Ordina: Ultimo Ordine</option>
            <option value="totale">Ordina: Spesa Totale</option>
          </select>
        </div>
      </div>

      {/* 3. LISTA CARD */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
        {filteredAndSortedItems.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center border border-slate-100 shadow-sm mt-4">
            <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
              <Layers className="w-6 h-6" />
            </div>
            <p className="text-slate-700 text-sm font-black">
              {searchTerm 
                ? 'Nessun cliente trovato per la ricerca' 
                : filterMode === 'mancanti'
                ? 'Nessun cliente con riordino mancante questo mese'
                : filterMode === 'persi'
                ? 'Nessun cliente contrassegnato come perso o sospeso'
                : 'Nessun ordine registrato'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchTerm 
                ? 'Prova a modificare i termini di ricerca' 
                : 'Gli ordini possono essere inseriti nella scheda della rivendita o importati da Excel'}
            </p>
          </div>
        ) : (
          <>
            {filteredAndSortedItems.slice(0, visibleCount).map((item) => {
              const isLate = item.frequenzaGG > 0 && item.daysSinceLastOrder > item.frequenzaGG;
              const hasStima = item.stimaMensile > 0;
              const perfPercent = hasStima ? Math.round((item.currentMonthTotal / item.stimaMensile) * 100) : 0;
              const isTargetReached = hasStima && perfPercent >= 100;

              return (
                <div 
                  key={item.id} 
                  className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:shadow transition-all"
                >
                  {/* CARD HEADER */}
                  <div className="flex justify-between items-start gap-3 mb-2.5">
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <h3 className="font-black text-slate-800 text-[14px] leading-tight whitespace-normal break-words">
                          {item.riv.isStore ? item.riv.storeName : `${item.riv.Comune || 'Sconosciuto'}`}
                        </h3>
                        {!item.riv.isStore && item.riv['Num. Rivendita'] && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded">
                            RIV. {item.riv['Num. Rivendita']}
                          </span>
                        )}
                        {item.riv.isStore && item.riv.storeNumber && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded">
                            STORE {item.riv.storeNumber}
                          </span>
                        )}
                        {item.extra?.codiceLogista && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded">
                            LOG: {item.extra.codiceLogista}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start shrink-0">
                      <button 
                        onClick={() => setModalData(item)}
                        className="p-1.5 rounded-lg text-white bg-slate-800 hover:bg-slate-700 transition-all active:scale-90 shadow-sm flex items-center gap-1"
                        title="Vedi cronologia ordini Globale"
                      >
                        <ListOrdered className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* CORPO CARD */}
                  <div className="flex flex-col gap-1.5">
                    {/* RIGA 1: Box "Ordini (count / ltv)" e Box "Media" */}
                    <div className="flex gap-2">
                      <div className="flex-1 bg-slate-50 rounded-lg p-2 border border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <ShoppingBag className="w-3 h-3 text-slate-400" />
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Ordini</span>
                        </div>
                        <div className="text-xs font-black text-slate-700">
                          {item.count} <span className="text-[9px] font-bold text-slate-400">/ €{item.totalLogista.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>

                      <div className="flex-1 bg-slate-50 rounded-lg p-2 border border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <Wallet className="w-3 h-3 text-slate-400" />
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Media</span>
                        </div>
                        <div className="text-xs font-black text-slate-700">
                          €{item.mediaPerOrdine.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>

                    {/* RIGA 2: Box "Ciclo" (Azzurro/Arancione se in ritardo) */}
                    <div className={`rounded-lg px-2.5 py-1.5 border flex items-center justify-between ${isLate && filterMode !== 'persi' ? 'bg-amber-100 border-amber-200' : 'bg-blue-50 border-blue-100'}`}>
                      <div className="flex items-center gap-1.5">
                        <CalendarClock className={`w-3.5 h-3.5 ${isLate && filterMode !== 'persi' ? 'text-amber-600' : 'text-blue-500'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isLate && filterMode !== 'persi' ? 'text-amber-700' : 'text-blue-800'}`}>
                          Ciclo: {item.frequenzaGG > 0 ? `${item.frequenzaGG} gg` : 'Irregolare'}
                        </span>
                      </div>
                      <span className={`text-[9px] font-bold ${isLate && filterMode !== 'persi' ? 'text-amber-600' : 'text-blue-600/70'}`}>
                        Ultimo: {safeFormatDate(item.lastDate, 'short')} ({item.daysSinceLastOrder} gg fa)
                      </span>
                    </div>

                    {/* RIGA 3: Fatto Mese con Indicatore Performance e Barra Progresso */}
                    <div className={`rounded-lg px-2.5 py-2 border flex flex-col gap-1.5 transition-all ${isTargetReached ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Calendar className={`w-3.5 h-3.5 ${isTargetReached ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            Fatto Mese:
                            {hasStima ? (() => {
                              const deltaPercent = ((item.currentMonthTotal - item.stimaMensile) / item.stimaMensile) * 100;
                              const isPlus = deltaPercent >= 0;
                              return (
                                <span className={`px-1.5 py-0.5 rounded text-white text-[8px] font-black tracking-normal shadow-xs flex items-center gap-0.5 ${
                                  isPlus ? 'bg-emerald-600' : 'bg-amber-600'
                                }`}>
                                  {isPlus ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                  {isPlus ? `+${deltaPercent.toFixed(1)}%` : `${deltaPercent.toFixed(1)}%`}
                                </span>
                              );
                            })() : (
                              <span className="text-slate-400 font-bold ml-1">{item.orderedCurrentMonth ? 'Ordinato' : 'Non ordinato'}</span>
                            )}
                          </span>
                        </div>
                        <span className={`text-sm font-black ${isTargetReached ? 'text-emerald-900' : item.currentMonthTotal > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                          €{item.currentMonthTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Micro Barra di Avanzamento Target */}
                      {hasStima && (
                        <div className="w-full bg-slate-200/80 h-1 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isTargetReached ? 'bg-emerald-500' : 'bg-emerald-500/80'}`}
                            style={{ width: `${Math.min(100, perfPercent)}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* RIGA 4: Stima Potenziale */}
                    <div className="rounded-lg px-2.5 py-2 bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1">
                          Stima Mese <span className="text-[9px] text-emerald-600 font-bold ml-0.5">({item.stimaNote})</span>
                        </span>
                      </div>
                      <div className="text-right leading-none flex items-baseline gap-1">
                        <span className="text-sm font-black text-emerald-900">
                          €{item.stimaMensile.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] font-black text-emerald-600 uppercase">
                          / Mese
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}

            {/* PAGINAZIONE */}
            {visibleCount < filteredAndSortedItems.length && (
              <div className="pt-2 pb-6 px-1 flex justify-center">
                <button 
                  onClick={() => setVisibleCount(prev => prev + 25)}
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-widest rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
                >
                  Mostra Altri ({filteredAndSortedItems.length - visibleCount} rimanenti)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. MODALE DETTAGLIO */}
      {modalData && (
        <div 
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setModalData(null)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div className="bg-slate-800 p-4 flex justify-between items-start shrink-0">
              <div className="min-w-0 pr-4">
                <h3 className="text-white font-black text-lg leading-tight whitespace-normal break-words">
                  {modalData.riv.isStore ? modalData.riv.storeName : modalData.riv.Comune}
                </h3>
                <p className="text-emerald-400 text-xs font-bold uppercase mt-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  {!modalData.riv.isStore && modalData.riv['Num. Rivendita'] 
                    ? `Rivendita N. ${modalData.riv['Num. Rivendita']}`
                    : `Store ${modalData.riv.storeNumber || ''}`}
                  {modalData.extra?.codiceLogista && ` • Cod. ${modalData.extra.codiceLogista}`}
                </p>
              </div>
              <button 
                onClick={() => setModalData(null)} 
                className="p-1.5 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BARRA AZIONI RAPIDE (Chiama, Whatsapp, Scheda CRM) */}
            {(() => {
              const telefono = modalData.extra?.telefono || (modalData.riv as any)?.Telefono || (modalData.riv as any)?.telefono || '';
              return (
                <div className="p-3 bg-slate-100 flex gap-2 overflow-x-auto shrink-0 hide-scrollbar items-center justify-between border-b border-slate-200">
                  <div className="flex gap-2 shrink-0">
                    {telefono && (
                      <>
                        <a 
                          href={`tel:${telefono}`} 
                          className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 text-[10px] font-black rounded-lg border border-slate-200 shadow-sm shrink-0 active:scale-95 hover:bg-slate-50 transition-all"
                        >
                          <Phone className="w-3.5 h-3.5 text-blue-600" /> CHIAMA
                        </a>
                        <a 
                          href={`https://wa.me/39${String(telefono).replace(/\s+/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 text-[10px] font-black rounded-lg border border-slate-200 shadow-sm shrink-0 active:scale-95 hover:bg-slate-50 transition-all"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-500" /> WHATSAPP
                        </a>
                      </>
                    )}
                    <button 
                      onClick={() => { 
                        onDeepLink(modalData.id, !!modalData.riv.isStore); 
                        setModalData(null); 
                      }} 
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white text-[10px] font-black rounded-lg shadow-sm shrink-0 active:scale-95 hover:bg-slate-700 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> SCHEDA CRM
                    </button>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">
                    {modalData.count} {modalData.count === 1 ? 'ordine' : 'ordini'}
                  </span>
                </div>
              );
            })()}

            {/* BODY SCROLLABILE */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 bg-slate-50">
              {/* BOX VERDE: RIEPILOGO STIMA E FATTO MESE CORRENTE */}
              <div className="bg-emerald-600 text-white rounded-xl p-3.5 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200 block">
                      Stima Potenziale Mensile
                    </span>
                    <span className="text-2xl font-black tracking-tight">
                      €{modalData.stimaMensile.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-emerald-200 block uppercase">
                      Span Temporale
                    </span>
                    <span className="text-xs font-black">
                      {modalData.spanDays} {modalData.spanDays === 1 ? 'giorno' : 'giorni'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/20 text-xs">
                  <div>
                    <span className="text-[9px] text-emerald-200 block uppercase">Fatto Mese</span>
                    <span className="font-bold">
                      €{modalData.currentMonthTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-emerald-200 block uppercase">Totale Speso</span>
                    <span className="font-bold">
                      €{modalData.totalLogista.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-emerald-200 block uppercase">Media Ordine</span>
                    <span className="font-bold">
                      €{modalData.mediaPerOrdine.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* TIMELINE CRONOLOGICA DEGLI ORDINI GLOBALE */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Cronologia Ordini Globale
                </h4>

                <div className="space-y-2">
                  {modalData.orders.map((ord: any, idx: number) => {
                    const importo = parseFloat(String(ord.importo)) || 0;
                    const itemCount = ord.items ? ord.items.length : 0;
                    return (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedOrder(ord)}
                        className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                            <img src={ord.tipo === 'ORDINE_LOGISTA' ? '/logista_logo.jpg' : '/CR.jpg'} alt="Logo" className="w-full h-full object-cover rounded-md" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800">
                              {safeFormatDate(ord.data)}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {itemCount > 0 ? `${itemCount} voci carrello` : (ord.note || (ord.tipo === 'ORDINE_LOGISTA' ? 'Ordine Logista' : 'Ordine Magazzino'))}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black text-emerald-700">
                            €{importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODALE DETTAGLIO CARRELLO ORDINE (Stile Storico) */}
      {selectedOrder && (
        <div 
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedOrder(null)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Carrello */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-start">
              <div>
                <h3 className="text-slate-900 font-black text-lg">
                  {safeFormatDate(selectedOrder.data)}
                </h3>
                <p className="text-slate-400 text-xs font-medium mt-0.5">
                  {selectedOrder.items ? selectedOrder.items.length : 0} voci carrello
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xl font-black text-emerald-600">
                  €{(parseFloat(String(selectedOrder.importo)) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <button 
                  onClick={() => setSelectedOrder(null)} 
                  className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lista Articoli */}
            <div className="p-4 overflow-y-auto space-y-2 bg-slate-50/50 flex-1">
              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                selectedOrder.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 rounded-lg px-2 py-1.5 mb-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {item.categoria && (
                        <span className="text-[9px] font-bold bg-slate-200/80 text-slate-500 px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wide">
                          {item.categoria}
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-slate-700 truncate">
                        {item.descrizione}
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded shrink-0 ml-2">
                      x{item.quantita}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center p-6 text-slate-400 text-sm font-bold">
                  Nessun dettaglio articoli disponibile per questo ordine.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StimeMasterTab;
