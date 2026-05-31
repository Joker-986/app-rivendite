import React, { useMemo, useState } from 'react';
import { 
  History, ChevronRight, Activity, Calendar, Wallet, ShoppingBag, 
  Ghost, Phone, MessageCircle, X, ExternalLink, CalendarClock, ListOrdered, Package, TrendingUp, ChevronDown, ChevronUp, Percent, SearchX
} from 'lucide-react';
import { SearchResult, RubricaData } from '../types';
import { getRivenditaId, safeFormatDate } from '../utils/helpers';

interface StoricoTabProps {
  rubrica: RubricaData;
  crmAnagrafiche: SearchResult[];
  stores: SearchResult[];
  giroVisite: SearchResult[];
  onDeepLink: (id: string, isStore: boolean) => void;
  handleRubricaUpdate: (id: string, field: string, value: any) => void;
}

const StoricoTab: React.FC<StoricoTabProps> = ({
  rubrica, crmAnagrafiche, stores, giroVisite, onDeepLink, handleRubricaUpdate
}) => {
  const [filterMode, setFilterMode] = useState<'attivi' | 'persi' | 'mancanti'>('attivi');
  const [sortMode, setSortMode] = useState<'rischio' | 'recenti' | 'lontani' | 'fatturato'>('rischio');
  const [modalData, setModalData] = useState<any | null>(null);
  const [isTopProdExpanded, setIsTopProdExpanded] = useState(false);
  const [displayMode, setDisplayMode] = useState<'units' | 'percent'>('units');

  const categoriesData = useMemo(() => {
    const allRiv = [...crmAnagrafiche, ...stores, ...giroVisite];
    const rivenditeMap = new Map();
    allRiv.forEach(r => rivenditeMap.set(String(getRivenditaId(r)), r));

    const processed: any[] = [];
    const oggi = new Date();
    const currentMonth = oggi.getMonth();
    const currentYear = oggi.getFullYear();
    
    // Calcolo mese precedente gestendo il cambio d'anno
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    Object.entries(rubrica).forEach(([id, d]: [string, any]) => {
      const riv = rivenditeMap.get(id);
      if (!riv) return;

      const stato = d.stato || '';
      const extra = d;
      
      const validOrders = (d.history || [])
        .filter((h: any) => h.tipo === 'ORDINE' && h.isEseguito === true)
        .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());

      if (validOrders.length === 0) return;

      let orderedCurrentMonth = false;
      let orderedPrevMonth = false;

      const productCounts: Record<string, number> = {};
      let totalLifetimeUnits = 0;

      validOrders.forEach((o: any) => {
        const orderDate = new Date(o.data);
        if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) orderedCurrentMonth = true;
        if (orderDate.getMonth() === prevMonth && orderDate.getFullYear() === prevYear) orderedPrevMonth = true;

        if (o.items && Array.isArray(o.items)) {
          o.items.forEach((it: any) => {
            const cat = it.categoria || 'VARIE';
            const name = it.descrizione || 'Sconosciuto';
            const key = `${cat}|${name}`;
            const qta = Number(it.quantita) || 1;
            
            productCounts[key] = (productCounts[key] || 0) + qta;
            totalLifetimeUnits += qta;
          });
        }
      });

      const topProdotti = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => {
          const [categoria, nome] = entry[0].split('|');
          return { categoria, nome, quantita: entry[1] };
        });

      const count = validOrders.length;
      const ltv = validOrders.reduce((acc: number, curr: any) => acc + (Number(curr.importo) || 0), 0);
      const scontrinoMedio = ltv / count;

      const firstOrderDate = new Date(validOrders[count - 1].data).getTime();
      const lastOrderDate = new Date(validOrders[0].data).getTime();
      const daysSinceLastOrder = Math.floor((oggi.getTime() - lastOrderDate) / (1000 * 3600 * 24));
      
      let frequenzaGG = 0;
      if (count > 1) {
        const spanDays = (lastOrderDate - firstOrderDate) / (1000 * 3600 * 24);
        frequenzaGG = Math.round(spanDays / (count - 1));
      }

      processed.push({
        id, riv, d, stato, extra,
        count, ltv, scontrinoMedio, frequenzaGG, daysSinceLastOrder,
        lastOrderDate, validOrders, topProdotti, totalLifetimeUnits,
        lastOrderDateStr: validOrders[0].dataEsecuzione || validOrders[0].data,
        isMissingThisMonth: orderedPrevMonth && !orderedCurrentMonth // IL RAGGIO X
      });
    });

    const attivi = processed.filter(p => !['RIP', 'Perso', 'Sospeso'].includes(p.stato));
    const persi = processed.filter(p => ['RIP', 'Perso', 'Sospeso'].includes(p.stato));
    const mancanti = attivi.filter(p => p.isMissingThisMonth);

    return { attivi, persi, mancanti };
  }, [rubrica, crmAnagrafiche, stores, giroVisite]);

  const listToShow = useMemo(() => {
    let targetList = categoriesData.attivi;
    if (filterMode === 'persi') targetList = categoriesData.persi;
    if (filterMode === 'mancanti') targetList = categoriesData.mancanti;

    return [...targetList].sort((a, b) => {
      if (sortMode === 'recenti') return b.lastOrderDate - a.lastOrderDate;
      if (sortMode === 'lontani') return a.lastOrderDate - b.lastOrderDate;
      if (sortMode === 'fatturato') return b.scontrinoMedio - a.scontrinoMedio;
      
      const riskA = a.frequenzaGG > 0 ? (a.daysSinceLastOrder / a.frequenzaGG) : 0;
      const riskB = b.frequenzaGG > 0 ? (b.daysSinceLastOrder / b.frequenzaGG) : 0;
      return riskB - riskA;
    });
  }, [categoriesData, filterMode, sortMode]);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden pb-24 pt-2">
      
      {/* HEADER DASHBOARD */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 shrink-0 space-y-4 shadow-sm relative z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-600" /> Analitica Storico
          </h2>
          
          <select 
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as any)}
            className="text-[10px] font-black text-slate-700 bg-slate-100 rounded-md px-2 py-1 outline-none border border-slate-200 cursor-pointer"
          >
            <option value="rischio">Ordina per: Rischio</option>
            <option value="recenti">Ordina per: Più Recenti</option>
            <option value="lontani">Ordina per: Più Lontani</option>
            <option value="fatturato">Ordina per: Media Fatturato</option>
          </select>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          <button 
            onClick={() => setFilterMode('attivi')} 
            className={`flex-1 flex flex-col items-center justify-center py-1.5 text-[10px] font-black rounded-lg transition-all ${filterMode === 'attivi' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span className="flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> REALI</span>
            <span className="text-[9px] mt-0.5">({categoriesData.attivi.length})</span>
          </button>
          
          {/* IL NUOVO FILTRO: MANCANTI QUESTO MESE */}
          <button 
            onClick={() => setFilterMode('mancanti')} 
            className={`flex-1 flex flex-col items-center justify-center py-1.5 text-[10px] font-black rounded-lg transition-all relative ${filterMode === 'mancanti' ? 'bg-amber-100 text-amber-700 shadow-sm border border-amber-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span className="flex items-center gap-1"><SearchX className="w-3.5 h-3.5" /> MANCANTI</span>
            <span className="text-[9px] mt-0.5">({categoriesData.mancanti.length})</span>
            {categoriesData.mancanti.length > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-white"></span>}
          </button>

          <button 
            onClick={() => setFilterMode('persi')} 
            className={`flex-1 flex flex-col items-center justify-center py-1.5 text-[10px] font-black rounded-lg transition-all ${filterMode === 'persi' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span className="flex items-center gap-1"><Ghost className="w-3.5 h-3.5" /> FANTASMI</span>
            <span className="text-[9px] mt-0.5">({categoriesData.persi.length})</span>
          </button>
        </div>
      </div>

      {/* LISTA CARD */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
        {listToShow.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center border border-slate-100 shadow-sm mt-4">
             <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
             <p className="text-slate-500 text-sm font-bold">
               {filterMode === 'mancanti' ? 'Tutti i clienti del mese scorso hanno già riordinato!' : 'Nessun dato storico trovato.'}
             </p>
          </div>
        ) : (
          listToShow.map((item, idx) => {
            const isLate = item.frequenzaGG > 0 && item.daysSinceLastOrder > (item.frequenzaGG + 7);

            return (
              <div key={item.id} className={`bg-white border rounded-2xl p-3 shadow-sm transition-all ${isLate && filterMode !== 'persi' ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}`}>
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-black text-slate-800 text-[14px] leading-tight whitespace-normal break-words">
                        {item.riv.isStore ? item.riv.storeName : `${item.riv.Comune || 'Sconosciuto'}`}
                      </h3>
                      {!item.riv.isStore && (
                        <span className="shrink-0 px-1.5 py-0.5 bg-brand-100 text-brand-800 text-[10px] font-black rounded">
                          RIV. {item.riv['Num. Rivendita']}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start shrink-0">
                    <button 
                      onClick={() => { setModalData(item); setIsTopProdExpanded(false); setDisplayMode('units'); }}
                      className="p-1.5 rounded-lg text-white bg-slate-800 hover:bg-slate-700 transition-all active:scale-90 shadow-sm flex items-center gap-1" 
                    >
                      <ListOrdered className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ordini (LTV)</span>
                    </div>
                    <div className="text-sm font-black text-slate-700">
                      {item.count} <span className="text-[10px] font-bold text-slate-400">/ €{item.ltv.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>

                  <div className={`rounded-xl p-2 border ${sortMode === 'fatturato' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Wallet className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                        Media {sortMode === 'fatturato' && <TrendingUp className="w-2.5 h-2.5 text-emerald-600" />}
                      </span>
                    </div>
                    <div className={`text-sm font-black ${sortMode === 'fatturato' ? 'text-emerald-700' : 'text-slate-700'}`}>
                      €{item.scontrinoMedio.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                    </div>
                  </div>

                  <div className={`col-span-2 rounded-xl p-2 border flex items-center justify-between ${isLate && filterMode !== 'persi' ? 'bg-amber-100 border-amber-200' : 'bg-blue-50 border-blue-100'}`}>
                     <div className="flex items-center gap-2">
                       <CalendarClock className={`w-4 h-4 ${isLate && filterMode !== 'persi' ? 'text-amber-600' : 'text-blue-500'}`} />
                       <div className="flex flex-col">
                         <span className={`text-[10px] font-black uppercase tracking-widest ${isLate && filterMode !== 'persi' ? 'text-amber-700' : 'text-blue-800'}`}>
                           Ciclo: {item.frequenzaGG > 0 ? `Ogni ${item.frequenzaGG} gg` : 'Irregolare'}
                         </span>
                         <span className={`text-[9px] font-bold ${isLate && filterMode !== 'persi' ? 'text-amber-600' : 'text-blue-600/70'}`}>
                           Ultimo: {safeFormatDate(item.lastOrderDateStr, 'short')} ({item.daysSinceLastOrder} gg fa)
                         </span>
                       </div>
                     </div>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* MODALE DETTAGLIO */}
      {modalData && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4">
            
            <div className="bg-slate-800 p-4 flex justify-between items-start shrink-0">
              <div className="min-w-0 pr-4">
                <h3 className="text-white font-black text-lg leading-tight whitespace-normal break-words">
                  {modalData.riv.isStore ? modalData.riv.storeName : modalData.riv.Comune}
                </h3>
                {!modalData.riv.isStore && <p className="text-slate-400 text-xs font-bold uppercase mt-1">RIV. {modalData.riv['Num. Rivendita']}</p>}
              </div>
              <button onClick={() => setModalData(null)} className="p-1.5 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-100 flex gap-2 overflow-x-auto shrink-0 hide-scrollbar items-center justify-between border-b border-slate-200">
              <div className="flex gap-2 shrink-0">
                {modalData.extra.telefono && (
                  <>
                    <a href={`tel:${modalData.extra.telefono}`} className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 text-[10px] font-black rounded-lg border border-slate-200 shadow-sm shrink-0 active:scale-95">
                      <Phone className="w-3.5 h-3.5 text-brand-600" /> CHIAMA
                    </a>
                    <a href={`https://wa.me/39${modalData.extra.telefono.replace(/\s+/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 text-[10px] font-black rounded-lg border border-slate-200 shadow-sm shrink-0 active:scale-95">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-500" /> WHATSAPP
                    </a>
                  </>
                )}
                <button onClick={() => { setModalData(null); onDeepLink(modalData.id, !!modalData.riv.isStore); }} className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white text-[10px] font-black rounded-lg shadow-sm shrink-0 active:scale-95">
                  <ExternalLink className="w-3.5 h-3.5" /> SCHEDA CRM
                </button>
              </div>

              <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg border border-slate-200 shrink-0 shadow-inner">
                <button 
                  onClick={() => setDisplayMode('units')}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${displayMode === 'units' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Mostra Quantità (Pezzi)"
                >
                  PZ
                </button>
                <button 
                  onClick={() => setDisplayMode('percent')}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${displayMode === 'percent' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Mostra in Percentuale"
                >
                  %
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-5 flex-1 bg-slate-50">
              
              {/* STATUS UPDATE */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Ghost className="w-3 h-3" /> Gestione Stato</h4>
                <select 
                  value={modalData.stato}
                  onChange={(e) => { handleRubricaUpdate(modalData.id, 'stato', e.target.value); setModalData({...modalData, stato: e.target.value}); }}
                  className="w-full text-xs font-black uppercase rounded-lg px-3 py-2 outline-none border border-slate-200 bg-white shadow-sm cursor-pointer"
                >
                  <option value="Attivata">Cliente Attivo</option>
                  <option value="Sospeso">Sospeso (Fantasma)</option>
                  <option value="Perso">Perso (Fantasma)</option>
                  <option value="RIP">Chiuso (RIP)</option>
                </select>
              </div>

              {/* TOP PRODOTTI CON ESPANSIONE */}
              {modalData.topProdotti.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Package className="w-3 h-3" /> Top Prodotti Ordinati</h4>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    {(isTopProdExpanded ? modalData.topProdotti : modalData.topProdotti.slice(0, 7)).map((prod: any, i: number, arr: any[]) => {
                      const pct = modalData.totalLifetimeUnits > 0 ? Math.round((prod.quantita / modalData.totalLifetimeUnits) * 100) : 0;
                      
                      return (
                        <div key={i} className={`flex justify-between items-center p-2.5 ${i !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                            {prod.categoria && prod.categoria !== 'VARIE' && (
                              <span className="shrink-0 text-[8px] font-black uppercase tracking-wider bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                                {prod.categoria}
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-700 truncate">{prod.nome}</span>
                          </div>
                          
                          <span className={`text-[10px] font-black px-2 py-1 rounded shrink-0 transition-all duration-150 ${displayMode === 'percent' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                            {displayMode === 'units' ? `x${prod.quantita}` : `${pct}%`}
                          </span>
                        </div>
                      );
                    })}
                    
                    {modalData.topProdotti.length > 7 && (
                      <button 
                        onClick={() => setIsTopProdExpanded(!isTopProdExpanded)}
                        className="w-full py-2.5 bg-slate-50 text-[10px] font-black text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all border-t border-slate-200 flex items-center justify-center gap-1"
                      >
                        {isTopProdExpanded ? (
                          <><ChevronUp className="w-3 h-3" /> RIDUCI LISTA</>
                        ) : (
                          <><ChevronDown className="w-3 h-3" /> MOSTRA TUTTI E {modalData.topProdotti.length} I PRODOTTI</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STORICO ORDINI CRONOLOGICO */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><History className="w-3 h-3" /> Timeline Ordini</h4>
                <div className="space-y-2">
                  {modalData.validOrders.map((ord: any, idx: number) => {
                    const orderTotalUnits = (ord.items || []).reduce((acc: number, curr: any) => acc + (Number(curr.quantita) || 0), 0);

                    return (
                      <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col">
                        <div className="flex justify-between items-start w-full">
                          <div>
                            <div className="text-[11px] font-black text-slate-800">{safeFormatDate(ord.dataEsecuzione || ord.data)}</div>
                            {ord.items && ord.items.length > 0 && (
                              <div className="text-[9px] font-bold text-slate-400 mt-0.5">{ord.items.length} voci carrello</div>
                            )}
                          </div>
                          <div className="text-sm font-black text-emerald-600 shrink-0">
                            €{Number(ord.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        {ord.items && ord.items.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-1">
                            {ord.items.map((prod: any, pIdx: number) => {
                              const pQta = Number(prod.quantita) || 0;
                              const pPct = orderTotalUnits > 0 ? Math.round((pQta / orderTotalUnits) * 100) : 0;

                              return (
                                <div key={pIdx} className="flex justify-between items-center bg-slate-50 rounded-lg px-2 py-1 text-[10px]">
                                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                    {prod.categoria && (
                                      <span className="shrink-0 text-[8px] font-black uppercase tracking-wider bg-slate-200/80 text-slate-500 px-1.5 py-0.5 rounded">
                                        {prod.categoria}
                                      </span>
                                    )}
                                    <span className="font-bold text-slate-600 truncate">{prod.descrizione || 'Prodotto Sconosciuto'}</span>
                                  </div>
                                  
                                  <span className={`font-black rounded shrink-0 px-1.5 py-0.5 text-[9px] transition-all duration-150 ${displayMode === 'percent' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/60 text-slate-500'}`}>
                                    {displayMode === 'units' ? `x${pQta}` : `${pPct}%`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
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

export default StoricoTab;
