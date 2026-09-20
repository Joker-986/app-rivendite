import React, { useMemo, useState } from 'react';
import { 
  Zap, Search, X, Calendar, TrendingUp, Wallet, ShoppingBag, 
  Clock, ExternalLink, ListOrdered, SearchX, Ghost,
  CalendarClock, Target, Phone, MessageCircle
} from 'lucide-react';
import { SearchResult, RubricaData } from '../types';
import { getRivenditaId, safeFormatDate } from '../utils/helpers';

interface StimeLogistaTabProps {
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

const StimeLogistaTab: React.FC<StimeLogistaTabProps> = ({
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
  const [visibleCount, setVisibleCount] = useState(25);

  // 1. LOGICA DATI: Calcolo metriche per ciascun cliente Logista e suddivisione
  const categoriesData = useMemo(() => {
    const allRiv = [...crmAnagrafiche, ...stores, ...giroVisite];
    const rivenditeMap = new Map<string, SearchResult>();
    allRiv.forEach(r => rivenditeMap.set(String(getRivenditaId(r)), r));

    const oggi = new Date();
    const currentMonth = oggi.getMonth();
    const currentYear = oggi.getFullYear();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const processed: LogistaItem[] = [];

    Object.entries(rubrica).forEach(([id, extra]: [string, any]) => {
      const riv = rivenditeMap.get(id);
      if (!riv) return;

      const logistaOrders = (extra.history || [])
        .filter((h: any) => h.tipo === 'ORDINE_LOGISTA')
        .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());

      if (logistaOrders.length === 0) return;

      // Metriche base
      const totalLogista = logistaOrders.reduce((sum: number, h: any) => sum + (parseFloat(String(h.importo)) || 0), 0);
      const count = logistaOrders.length;
      const mediaPerOrdine = count > 0 ? totalLogista / count : 0;

      // Data primo e ultimo ordine
      const lastDate = logistaOrders[0].data;
      const firstDate = logistaOrders[count - 1].data;

      const firstOrderTime = new Date(firstDate).getTime();
      const lastOrderTime = new Date(lastDate).getTime();
      const diffMs = Math.abs(lastOrderTime - firstOrderTime);
      const rawSpanDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const spanDays = Math.max(1, rawSpanDays);

      // Ciclo e giorni dall'ultimo riordino
      const daysSinceLastOrder = Math.max(0, Math.floor((oggi.getTime() - lastOrderTime) / (1000 * 3600 * 24)));
      let frequenzaGG = 0;
      if (count > 1) {
        frequenzaGG = Math.round(spanDays / (count - 1));
      }

      // NUOVO MOTORE DI CALCOLO RIGOROSO E STABILIZZATO (N >= 3, Floor 7gg e Arco temporale fino a OGGI)
      let stimaMensile = 0;
      let stimaNote = '';

      if (daysSinceLastOrder > 45) {
        stimaMensile = 0;
        stimaNote = 'Inattivo';
      } else {
        // Filtra ordini effettuati negli ultimi 90 giorni
        const cutoff90 = oggi.getTime() - (90 * 24 * 3600 * 1000);
        const recentOrders = logistaOrders.filter((o: any) => new Date(o.data).getTime() >= cutoff90);

        if (recentOrders.length < 3) {
          stimaMensile = 0;
          stimaNote = 'Storico insufficiente';
        } else {
          // 3 ordini più recenti
          const o1 = parseFloat(String(recentOrders[0].importo)) || 0;
          const o2 = parseFloat(String(recentOrders[1].importo)) || 0;
          const o3 = parseFloat(String(recentOrders[2].importo)) || 0;

          // Media Ponderata (50% recente, 30% penultimo, 20% terzultimo)
          const mediaPonderata = (o1 * 0.50) + (o2 * 0.30) + (o3 * 0.20);

          // Calcola i giorni trascorsi dal 3° ordine recente fino a OGGI
          const t3 = new Date(recentOrders[2].data).getTime();
          const spanFinoAdOggi = Math.max(1, Math.round((oggi.getTime() - t3) / (1000 * 3600 * 24)));

          // Ciclo minimo Logista fissato a 7 giorni
          const cicloRecente = Math.max(7, spanFinoAdOggi / 2);
          stimaMensile = mediaPonderata * (30 / cicloRecente);
          stimaNote = `${Math.round(cicloRecente)} gg`;
        }
      }

      // NUOVO DATO: currentMonthTotal + analisi ordini mese corrente e mese precedente
      let currentMonthTotal = 0;
      let orderedCurrentMonth = false;
      let orderedPrevMonth = false;

      logistaOrders.forEach((o: any) => {
        const orderDate = new Date(o.data);
        const importo = parseFloat(String(o.importo)) || 0;

        if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
          orderedCurrentMonth = true;
          currentMonthTotal += importo;
        }
        if (orderDate.getMonth() === prevMonth && orderDate.getFullYear() === prevYear) {
          orderedPrevMonth = true;
        }
      });

      const isMissingThisMonth = !orderedCurrentMonth;
      const stato = extra.stato || '';

      processed.push({
        id,
        riv,
        extra,
        orders: logistaOrders,
        totalLogista,
        count,
        mediaPerOrdine,
        firstDate,
        lastDate,
        lastOrderTime,
        spanDays,
        stimaMensile,
        stimaNote,
        currentMonthTotal,
        frequenzaGG,
        daysSinceLastOrder,
        orderedCurrentMonth,
        orderedPrevMonth,
        isMissingThisMonth,
        stato
      });
    });

    const attivi = processed.filter(p => !['RIP', 'Perso', 'Sospeso'].includes(p.stato) && p.daysSinceLastOrder <= 45);
    const persi = processed.filter(p => ['RIP', 'Perso', 'Sospeso'].includes(p.stato) || p.daysSinceLastOrder > 45);
    const mancanti = attivi.filter(p => !p.orderedCurrentMonth);

    return { attivi, persi, mancanti };
  }, [crmAnagrafiche, stores, giroVisite, rubrica]);

  // KPI aggregati operativi basati sui clienti attivi
  const kpis = useMemo(() => {
    let totalBaselineStima = 0;
    let totalProiezione = 0;
    let totalFattoMese = 0;

    categoriesData.attivi.forEach(item => {
      totalBaselineStima += item.stimaMensile;
      totalFattoMese += item.currentMonthTotal;
      totalProiezione += Math.max(item.stimaMensile, item.currentMonthTotal);
    });

    const deltaPercent = totalBaselineStima > 0 
      ? ((totalProiezione - totalBaselineStima) / totalBaselineStima) * 100 
      : 0;

    return {
      clientiCount: categoriesData.attivi.length,
      totalProiezione,
      totalBaselineStima,
      totalFattoMese,
      deltaPercent
    };
  }, [categoriesData.attivi]);

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
        
        {/* BANNER KPI AGGREGATI (Calcolati sui clienti attivi) */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden p-0.5">
                <img src="/logista_logo.jpg" alt="Logista" className="w-full h-full object-cover rounded-md" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-100">
                Stime Potenziale Logista
              </span>
            </div>
            <span className="text-[10px] font-black bg-white/20 px-2.5 py-0.5 rounded-full">
              {kpis.clientiCount} {kpis.clientiCount === 1 ? 'Cliente Attivo' : 'Clienti Attivi'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* BOX 1: Proiezione a Fine Mese + Target Delta */}
            <div className="bg-black/15 rounded-xl p-2.5 border border-white/10">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                Proiezione Chiusura
              </p>
              <p className="text-xl font-black tracking-tight mt-0.5">
                €{kpis.totalProiezione.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[9px] font-bold text-emerald-200/80 mt-1 truncate">
                Target: €{kpis.totalBaselineStima.toLocaleString('it-IT', { maximumFractionDigits: 0 })} 
                <span className={`ml-1 font-black ${kpis.deltaPercent >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  ({kpis.deltaPercent >= 0 ? '+' : ''}{kpis.deltaPercent.toFixed(1)}%)
                </span>
              </p>
            </div>

            {/* BOX 2: Fatto Mese Reale Incassato */}
            <div className="bg-black/15 rounded-xl p-2.5 border border-white/10">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                Fatto Mese Corrente
              </p>
              <p className="text-xl font-black tracking-tight mt-0.5">
                €{kpis.totalFattoMese.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[9px] font-bold text-emerald-200/80 mt-1 uppercase tracking-wider">
                Reale Incassato
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
            <img src="/logista_logo.jpg" alt="Logista" className="w-12 h-12 mx-auto mb-3 opacity-40 grayscale rounded-xl" />
            <p className="text-slate-700 text-sm font-black">
              {searchTerm 
                ? 'Nessun cliente trovato per la ricerca' 
                : filterMode === 'mancanti'
                ? 'Nessun cliente con riordino mancante questo mese'
                : filterMode === 'persi'
                ? 'Nessun cliente contrassegnato come perso o sospeso'
                : 'Nessun ordine Logista registrato'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchTerm 
                ? 'Prova a modificare i termini di ricerca' 
                : 'Gli ordini Logista possono essere inseriti nella scheda della rivendita o tramite import Excel'}
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
                        title="Vedi cronologia ordini Logista"
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
                            {hasStima ? (
                              isTargetReached ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[8px] font-black tracking-normal shadow-xs flex items-center gap-0.5">
                                  <TrendingUp className="w-2.5 h-2.5" /> SUPERATO ({perfPercent}%)
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[8px] font-black tracking-normal">
                                  {perfPercent}% DEL TARGET
                                </span>
                              )
                            ) : (
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
                  <img src="/logista_logo.jpg" alt="L" className="w-3.5 h-3.5 rounded-sm" />
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

              {/* TIMELINE CRONOLOGICA DEGLI ORDINI LOGISTA */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Cronologia Ordini Logista
                </h4>

                <div className="space-y-2">
                  {modalData.orders.map((ord: any, idx: number) => {
                    const importo = parseFloat(String(ord.importo)) || 0;
                    return (
                      <div 
                        key={idx} 
                        className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                            <img src="/logista_logo.jpg" alt="Logista" className="w-full h-full object-cover rounded-md" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800">
                              {safeFormatDate(ord.data)}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {ord.note || 'Ordine Logista'}
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
    </div>
  );
};

export default StimeLogistaTab;
