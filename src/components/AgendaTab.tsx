import React, { useState, useMemo } from 'react';
import { 
  CalendarClock, UserCheck, ShoppingBag, ChevronRight, Edit3, 
  History, ChevronDown, CheckCircle2, Navigation, Filter, MapPin,
  AlertOctagon, Zap, CalendarDays, Rocket
} from 'lucide-react';
import { SearchResult, RubricaData } from '../types';
import { getRivenditaId, handleNavigation } from '../utils/helpers';
import { useModals } from '../contexts/ModalContext';

interface AgendaTabProps {
  visitStats: any;
  rubrica: RubricaData;
  crmAnagrafiche: SearchResult[];
  stores: SearchResult[];
  giroVisite: SearchResult[];
  setGiroVisite: React.Dispatch<React.SetStateAction<SearchResult[]>>;
  setRivenditaFilter: (filter: string) => void;
  setActiveTab: (tab: string) => void;
  showToast: (message: string, type?: any) => void;
  onEditHistory: (id: string, index: number, note: string, importo: number, data?: string, ora?: string, stato?: string, isEseguito?: boolean, dataEsecuzione?: string, items?: any[]) => void;
}

const AgendaTab: React.FC<AgendaTabProps> = ({
  rubrica, crmAnagrafiche, stores, giroVisite, 
  setRivenditaFilter, setActiveTab, onEditHistory, showToast
}) => {
  const { openQuickEdit, openRevisitModal } = useModals();
  
  const [activeFilters, setActiveFilters] = useState<string[]>(['ORDINI', 'HOSTESS', 'APPUNTAMENTI']);
  const [showArchived, setShowArchived] = useState(false);

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]);
  };

  const processedData = useMemo(() => {
    const allRiv = [...crmAnagrafiche, ...stores, ...giroVisite];
    const todayObj = new Date(); 
    todayObj.setHours(0,0,0,0);
    const todayTime = todayObj.getTime();

    const groups: any[] = [];

    Object.entries(rubrica).forEach(([id, d]: [string, any]) => {
      const riv = allRiv.find(r => getRivenditaId(r) === id);
      if (!riv) return;

      // FIX: Aggiunta dell'originalIndex per il corretto funzionamento del QuickEditModal
      const history = (d.history || []).map((h: any, index: number) => ({ ...h, originalIndex: index }));
      
      const hasRevisit = !!d.dataRivisita;
      const isRevisitOverdue = hasRevisit && new Date(d.dataRivisita).getTime() < todayTime;
      const isRevisitToday = hasRevisit && new Date(d.dataRivisita).getTime() === todayTime;

      // URGENZE
      const pendingOrders = history.filter((h: any) => h.tipo === 'ORDINE' && h.isEseguito !== true).sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime());
      const futureHostess = history.filter((h: any) => h.tipo === 'HOSTESS' && new Date(h.data).getTime() >= todayTime).sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime());
      
      // STORICO
      const completedOrders = history.filter((h: any) => h.tipo === 'ORDINE' && h.isEseguito === true).sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
      const pastHostess = history.filter((h: any) => h.tipo === 'HOSTESS' && new Date(h.data).getTime() < todayTime).sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
      const pastVisits = history.filter((h: any) => h.tipo === 'VISITA').sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());

      let lastHistoryTime = 0;
      if (completedOrders.length > 0) lastHistoryTime = Math.max(lastHistoryTime, new Date(completedOrders[0].data).getTime());
      if (pastHostess.length > 0) lastHistoryTime = Math.max(lastHistoryTime, new Date(pastHostess[0].data).getTime());
      if (pastVisits.length > 0) lastHistoryTime = Math.max(lastHistoryTime, new Date(pastVisits[0].data).getTime());

      groups.push({
        id, riv, data: d,
        pendingOrders, completedOrders,
        futureHostess, pastHostess, pastVisits,
        hasRevisit, isRevisitOverdue, isRevisitToday,
        totalEvents: history.length,
        lastHistoryTime
      });
    });

    return groups;
  }, [rubrica, crmAnagrafiche, stores, giroVisite]);

  const bucketedGroups = useMemo(() => {
    const todayObj = new Date(); 
    todayObj.setHours(0,0,0,0);
    const todayTime = todayObj.getTime();
    const next7DaysTime = todayTime + (7 * 24 * 60 * 60 * 1000);

    const withBuckets = processedData.map(g => {
      const validDates: number[] = [];
      
      if (activeFilters.includes('APPUNTAMENTI') && g.hasRevisit) {
        validDates.push(new Date(g.data.dataRivisita).setHours(0,0,0,0));
      }
      if (activeFilters.includes('ORDINI')) {
        g.pendingOrders.forEach((o: any) => validDates.push(new Date(o.data).setHours(0,0,0,0)));
      }
      if (activeFilters.includes('HOSTESS')) {
        g.futureHostess.forEach((h: any) => validDates.push(new Date(h.data).setHours(0,0,0,0)));
      }

      let bucket = 'ARCHIVIO';
      let refDate = Infinity;

      if (validDates.length > 0) {
        refDate = Math.min(...validDates);
        if (refDate < todayTime) bucket = 'SCADUTI';
        else if (refDate === todayTime) bucket = 'OGGI';
        else if (refDate <= next7DaysTime) bucket = 'SETTIMANA';
        else bucket = 'FUTURO';
      }

      return { ...g, bucket, refDate };
    });

    return withBuckets.filter(g => {
      if (g.bucket !== 'ARCHIVIO') return true;
      if (!showArchived) return false;
      const matchOrd = activeFilters.includes('ORDINI') && g.completedOrders.length > 0;
      const matchHost = activeFilters.includes('HOSTESS') && g.pastHostess.length > 0;
      const matchVis = activeFilters.includes('APPUNTAMENTI') && g.pastVisits.length > 0;
      return matchOrd || matchHost || matchVis;
    });

  }, [processedData, activeFilters, showArchived]);

  // FIX: ORDINAMENTO DEI MACRO-GRUPPI CORRETTO
  // Scaduti: Decrescente (I ritardi di ieri in cima, quelli vecchi in fondo)
  const scaduti = bucketedGroups.filter(g => g.bucket === 'SCADUTI').sort((a, b) => b.refDate - a.refDate);
  // Oggi: Chi ha più eventi
  const oggi = bucketedGroups.filter(g => g.bucket === 'OGGI').sort((a, b) => b.totalEvents - a.totalEvents);
  // Settimana / Futuro: Crescente (Da domani verso il mese prossimo)
  const settimana = bucketedGroups.filter(g => g.bucket === 'SETTIMANA').sort((a, b) => a.refDate - b.refDate);
  const futuro = bucketedGroups.filter(g => g.bucket === 'FUTURO').sort((a, b) => a.refDate - b.refDate);
  // Archivio: Decrescente (Le cose completate poco fa in cima)
  const archivio = bucketedGroups.filter(g => g.bucket === 'ARCHIVIO').sort((a, b) => b.lastHistoryTime - a.lastHistoryTime);

  const renderCard = (group: any) => {
    // FIX: Stili dinamici in base al Macro-Gruppo per evidenziare le sezioni
    const isScaduto = group.bucket === 'SCADUTI';
    const isOggi = group.bucket === 'OGGI';
    
    const cardBgClass = isScaduto 
      ? 'bg-red-50/50 border-red-200' 
      : isOggi 
        ? 'bg-amber-50/30 border-amber-200' 
        : 'bg-white border-slate-200';

    return (
      <div key={group.id} className={`${cardBgClass} rounded-2xl border shadow-sm overflow-hidden p-2.5 mb-3 transition-colors`}>
        <div className="flex justify-between items-center mb-2 gap-2">
          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <h3 className="font-black text-slate-800 text-[13px] truncate">{group.riv.isStore ? group.riv.storeName : `Riv. ${group.riv['Num. Rivendita']}`}</h3>
            <span className="text-[9px] font-bold text-slate-400 uppercase truncate">• {group.riv['Comune']}</span>
          </div>
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200/60 shadow-sm shrink-0 h-fit" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => handleNavigation(group.riv['Indirizzo'] + ', ' + group.riv['Comune'])} className="p-1.5 rounded-lg text-brand-600 hover:bg-slate-50 transition-colors active:scale-95" title="Naviga">
              <Navigation className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-slate-300 mx-1"></div>
            <button onClick={() => { setRivenditaFilter(group.riv.isStore ? group.riv.storeNumber : group.riv['Num. Rivendita']); setActiveTab('crm'); }} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-50 transition-colors" title="Apri nel CRM">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          {activeFilters.includes('APPUNTAMENTI') && group.hasRevisit && (
            <div onClick={() => openRevisitModal(group.id)} className={`flex items-center justify-between p-1.5 rounded-lg border cursor-pointer ${group.isRevisitOverdue ? 'bg-red-50 border-red-200' : group.isRevisitToday ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
               <div className="flex items-center gap-1.5 min-w-0">
                  <CalendarClock className={`w-3.5 h-3.5 shrink-0 ${group.isRevisitOverdue ? 'text-red-500' : group.isRevisitToday ? 'text-amber-500' : 'text-slate-500'}`} />
                  <span className={`text-[10px] font-bold truncate ${group.isRevisitOverdue ? 'text-red-800' : group.isRevisitToday ? 'text-amber-800' : 'text-slate-700'}`}>Appt: {new Date(group.data.dataRivisita).toLocaleDateString('it-IT')} {group.data.oraRivisita}</span>
               </div>
               {group.isRevisitOverdue && <span className="text-[9px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded shrink-0">SCADUTO</span>}
               {group.isRevisitToday && <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">OGGI</span>}
            </div>
          )}

          {/* FIX: La data non sparisce più se l'ordine è scaduto */}
          {activeFilters.includes('ORDINI') && group.pendingOrders.map((ord: any) => {
            const isOverdue = new Date(ord.data).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);
            const isEseguito = ord.isEseguito === true;
            
            return (
            <div key={ord.originalIndex} className={`flex flex-col p-1.5 rounded-lg border ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
               <div onClick={() => openQuickEdit('ORDINE', group.id, group.data, ord.originalIndex)} className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-1.5 min-w-0">
                      <ShoppingBag className={`w-3.5 h-3.5 shrink-0 ${isOverdue ? 'text-red-600' : 'text-blue-600'}`} />
                      <span className={`text-[11px] font-black ${isOverdue ? 'text-red-900' : 'text-blue-900'}`}>€{parseFloat(ord.importo || 0).toLocaleString('it-IT')}</span>
                      <span className={`text-[9px] truncate ml-1 ${isOverdue ? 'text-red-600' : 'text-blue-600'}`}>{ord.note || 'Senza note'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                      {isOverdue && <span className="text-[8px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded">SCADUTO</span>}
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isOverdue ? 'text-red-800 bg-red-100' : 'text-white bg-blue-600'}`}>
                        {new Date(ord.data).toLocaleDateString('it-IT', {day:'2-digit', month:'2-digit', year:'2-digit'})}
                      </span>
                  </div>
               </div>
               
               {!isEseguito && (
                 <div className="mt-1 pt-1 border-t border-blue-100/50 flex justify-end">
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       onEditHistory(group.id, ord.originalIndex, ord.note, ord.importo || 0, undefined, undefined, undefined, true, new Date().toISOString(), ord.items, ord.dataEvasione);
                       showToast("Ordine inviato ai sistemi!", "success");
                     }}
                     className="text-blue-600 font-black text-[10px] uppercase hover:underline ml-auto"
                   >
                     ESEGUI
                   </button>
                 </div>
               )}
            </div>
          )})}

          {activeFilters.includes('HOSTESS') && group.futureHostess.map((h: any) => (
            <div key={h.originalIndex} onClick={() => openQuickEdit('HOSTESS', group.id, group.data, h.originalIndex)} className="flex items-center justify-between p-1.5 rounded-lg bg-purple-50 border border-purple-200 cursor-pointer hover:bg-purple-100">
               <div className="flex items-center gap-1.5 min-w-0">
                  <UserCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span className="text-[10px] font-bold text-purple-900 truncate">Hostess: {new Date(h.data).toLocaleDateString('it-IT')} {new Date(h.data).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}</span>
               </div>
               <Edit3 className="w-3 h-3 text-purple-400 shrink-0" />
            </div>
          ))}
        </div>

        {showArchived && (group.completedOrders.length > 0 || group.pastHostess.length > 0 || group.pastVisits.length > 0) && (
          <details className="mt-2 group border-t border-slate-200/60 pt-1">
            <summary className="flex items-center justify-between p-1.5 cursor-pointer list-none hover:bg-white/50 rounded-lg transition-colors">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><History className="w-3 h-3"/> Storico Evasi</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-300 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="space-y-1 mt-1">
               {activeFilters.includes('ORDINI') && group.completedOrders.map((ord: any) => (
                  <div key={ord.originalIndex} onClick={() => openQuickEdit('ORDINE', group.id, group.data, ord.originalIndex)} className="flex items-center justify-between p-1.5 rounded-md bg-white/80 border border-slate-100 cursor-pointer hover:bg-white">
                     <div className="flex items-center gap-1.5 min-w-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-600">€{parseFloat(ord.importo || 0).toLocaleString('it-IT')}</span>
                        <span className="text-[9px] text-slate-400 truncate ml-1">{ord.note}</span>
                     </div>
                     <span className="text-[9px] font-bold text-slate-400">{new Date(ord.data).toLocaleDateString('it-IT')}</span>
                  </div>
               ))}
               {activeFilters.includes('HOSTESS') && group.pastHostess.map((h: any) => (
                  <div key={h.originalIndex} onClick={() => openQuickEdit('HOSTESS', group.id, group.data, h.originalIndex)} className="flex items-center justify-between p-1.5 rounded-md bg-white/80 border border-slate-100 cursor-pointer hover:bg-white">
                     <div className="flex items-center gap-1.5 min-w-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-600 truncate">Hostess {new Date(h.data).toLocaleDateString('it-IT')}</span>
                     </div>
                  </div>
               ))}
               {activeFilters.includes('APPUNTAMENTI') && group.pastVisits.map((v: any, idx: number) => (
                  <div key={`vis-${idx}`} className="flex items-center justify-between p-1.5 rounded-md bg-white/80 border border-slate-100">
                     <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-600 truncate">Visita {new Date(v.data).toLocaleDateString('it-IT')}</span>
                     </div>
                  </div>
               ))}
            </div>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm py-2 px-1">
        <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden p-1">
          <button onClick={() => toggleFilter('ORDINI')} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-[11px] transition-all border shadow-sm shrink-0 ${activeFilters.includes('ORDINI') ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-500 border-slate-200'}`}>
            <ShoppingBag className="w-3.5 h-3.5" /> Ordini
          </button>
          <button onClick={() => toggleFilter('HOSTESS')} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-[11px] transition-all border shadow-sm shrink-0 ${activeFilters.includes('HOSTESS') ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-slate-500 border-slate-200'}`}>
            <UserCheck className="w-3.5 h-3.5" /> Hostess
          </button>
          <button onClick={() => toggleFilter('APPUNTAMENTI')} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-[11px] transition-all border shadow-sm shrink-0 ${activeFilters.includes('APPUNTAMENTI') ? 'bg-orange-600 text-white border-orange-700' : 'bg-white text-slate-500 border-slate-200'}`}>
            <CalendarClock className="w-3.5 h-3.5" /> Appuntamenti
          </button>
          <div className="w-px h-5 bg-slate-300 mx-0.5 shrink-0"></div>
          <button onClick={() => setShowArchived(!showArchived)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-[11px] transition-all border shadow-sm shrink-0 ${showArchived ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}>
            <History className="w-3.5 h-3.5" /> + Archivio
          </button>
        </div>
      </div>

      <div className="px-1">
        {bucketedGroups.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center space-y-3 mt-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto"><Filter className="w-8 h-8 text-slate-200" /></div>
            <p className="text-slate-500 font-medium text-sm">Nessuna attività per i filtri selezionati.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {scaduti.length > 0 && (
              <div className="relative pt-4">
                <div className="absolute top-0 left-4 right-4 h-px bg-red-200"></div>
                <div className="absolute -top-3 left-6 bg-slate-50 px-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shadow-sm"><AlertOctagon className="w-3.5 h-3.5"/></div>
                  <h3 className="font-black text-[12px] uppercase tracking-widest text-red-600">Da Recuperare</h3>
                </div>
                <div className="mt-2">{scaduti.map(renderCard)}</div>
              </div>
            )}
            
            {oggi.length > 0 && (
              <div className="relative pt-4 mt-8">
                <div className="absolute top-0 left-4 right-4 h-px bg-amber-200"></div>
                <div className="absolute -top-3 left-6 bg-slate-50 px-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm"><Zap className="w-3.5 h-3.5"/></div>
                  <h3 className="font-black text-[12px] uppercase tracking-widest text-amber-600">Oggi</h3>
                </div>
                <div className="mt-2">{oggi.map(renderCard)}</div>
              </div>
            )}

            {settimana.length > 0 && (
              <div className="relative pt-4 mt-8">
                <div className="absolute top-0 left-4 right-4 h-px bg-blue-200"></div>
                <div className="absolute -top-3 left-6 bg-slate-50 px-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm"><CalendarDays className="w-3.5 h-3.5"/></div>
                  <h3 className="font-black text-[12px] uppercase tracking-widest text-blue-600">Prossimi 7 Giorni</h3>
                </div>
                <div className="mt-2">{settimana.map(renderCard)}</div>
              </div>
            )}

            {futuro.length > 0 && (
              <div className="relative pt-4 mt-8">
                <div className="absolute top-0 left-4 right-4 h-px bg-purple-200"></div>
                <div className="absolute -top-3 left-6 bg-slate-50 px-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm"><Rocket className="w-3.5 h-3.5"/></div>
                  <h3 className="font-black text-[12px] uppercase tracking-widest text-purple-600">Futuro</h3>
                </div>
                <div className="mt-2">{futuro.map(renderCard)}</div>
              </div>
            )}

            {archivio.length > 0 && (
              <div className="relative pt-4 mt-8 opacity-75">
                <div className="absolute top-0 left-4 right-4 h-px bg-slate-300"></div>
                <div className="absolute -top-3 left-6 bg-slate-50 px-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shadow-sm"><History className="w-3.5 h-3.5"/></div>
                  <h3 className="font-black text-[12px] uppercase tracking-widest text-slate-500">Solo Archivio</h3>
                </div>
                <div className="mt-2">{archivio.map(renderCard)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgendaTab;
