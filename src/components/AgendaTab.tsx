import React, { useState, useMemo } from 'react';
import { 
  CalendarClock, UserCheck, ShoppingBag, ChevronRight, Edit3, 
  History, ChevronDown, CheckCircle2, Navigation, Filter, MapPin,
  AlertOctagon, Zap, CalendarDays, Rocket, Receipt, Ticket, Package
} from 'lucide-react';
import { SearchResult, RubricaData } from '../types';
import { getRivenditaId, handleNavigation, safeFormatDate, getTodayLocalISO } from '../utils/helpers';
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
  onEditHistory: (id: string, index: number, note: string, importo: number, data?: string, ora?: string, stato?: string, isEseguito?: boolean, dataEsecuzione?: string, items?: any[], dataEvasione?: string, visitaInizio?: string, visitaFine?: string, ndcEseguita?: boolean, dataEsecuzioneNdC?: string, paymentMethod?: string) => void;
}

const getLocalMidnightTime = (dateStr: string) => {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  // Imposta a mezzanotte locale per il confronto corretto nell'agenda
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const AgendaTab: React.FC<AgendaTabProps> = ({
  rubrica, crmAnagrafiche, stores, giroVisite, 
  setRivenditaFilter, setActiveTab, onEditHistory, showToast
}) => {
  const { openQuickEdit, openRevisitModal } = useModals();
  
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  
  const { pendingNdc, completedNdc } = useMemo(() => {
    const pNdc: any[] = [];
    const cNdc: any[] = [];
    const allRiv = [...crmAnagrafiche, ...stores, ...giroVisite];
    
    // OTTIMIZZAZIONE O(1): Creazione Dizionario forzando gli ID a stringa (Risolve il bug della lista vuota)
    const rivenditeMap = new Map();
    allRiv.forEach(r => rivenditeMap.set(String(getRivenditaId(r)), r));
    
    Object.entries(rubrica).forEach(([id, d]: [string, any]) => {
      const riv = rivenditeMap.get(String(id));
      if (!riv) return;
      
      const history = (d.history || []).map((h: any, index: number) => ({ ...h, originalIndex: index }));
      
      history.forEach((h: any) => {
        if (h.tipo === 'ORDINE' && h.items && h.items.some((i: any) => i.isCredito)) {
          const creditItems = h.items.filter((i: any) => i.isCredito);
          const isVoucher = creditItems.some((i: any) => i.isVoucher);
          
          // FIX ARITMETICO: Inclusione del moltiplicatore (item.unita)
          const totaleCredito = creditItems.reduce((acc: number, item: any) => {
             const unita = item.unita || 1;
             return acc + (item.prezzoApplicato * item.quantita * unita);
          }, 0);
          
          const isMismatch = h.isEseguito === true;
          const ndcObj = { id, riv, data: d, h, totaleCredito, originalIndex: h.originalIndex, isMismatch, isVoucher };
          
          if (h.ndcEseguita) cNdc.push(ndcObj);
          else pNdc.push(ndcObj);
        }
      });
    });
    
    return { 
       pendingNdc: pNdc.sort((a, b) => new Date(a.h.data).getTime() - new Date(b.h.data).getTime()),
       completedNdc: cNdc.sort((a, b) => new Date(b.h.dataEsecuzioneNdC || b.h.data).getTime() - new Date(a.h.dataEsecuzioneNdC || a.h.data).getTime())
    };
  }, [rubrica, crmAnagrafiche, stores, giroVisite]);
  const [showArchived, setShowArchived] = useState(false);

  const toggleFilter = (filter: string, isolate: boolean = false) => {
    if (isolate) {
      setActiveFilters([filter]); // Se isolo, tengo solo quello
    } else {
      setActiveFilters(prev => prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]);
    }
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
      const pendingOrders = history.filter((h: any) => h.tipo === 'ORDINE' && h.isEseguito !== true).sort((a: any, b: any) => getLocalMidnightTime(a.dataEvasione || a.data) - getLocalMidnightTime(b.dataEvasione || b.data));
      const futureHostess = history.filter((h: any) => h.tipo === 'HOSTESS' && getLocalMidnightTime(h.data) >= todayTime).sort((a: any, b: any) => getLocalMidnightTime(a.dataEsecuzione || a.data) - getLocalMidnightTime(b.dataEsecuzione || b.data));
      
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
        g.pendingOrders.forEach((o: any) => validDates.push(getLocalMidnightTime(o.dataEvasione || o.data)));
      }
      if (activeFilters.includes('HOSTESS')) {
        g.futureHostess.forEach((h: any) => validDates.push(getLocalMidnightTime(h.dataEsecuzione || h.data)));
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
          <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden">
            <h3 className="font-black text-slate-800 text-[13px] truncate">{group.riv.isStore ? group.riv.storeName : `Riv. ${group.riv['Num. Rivendita']}`}</h3>
            <span className="text-[9px] font-bold text-slate-400 uppercase truncate">• {group.riv['Comune']}</span>
            {group.data.codiceLogista && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(group.data.codiceLogista || '');
                  if (typeof showToast === 'function') {
                    showToast('Codice Logista copiato!', 'success');
                  }
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded tracking-widest shadow-sm cursor-pointer hover:bg-slate-700 active:scale-95 transition-all shrink-0"
                title="Clicca per copiare il Codice Logista"
              >
                <Package className="w-2.5 h-2.5 text-blue-400" />
                <span>{group.data.codiceLogista}</span>
              </div>
            )}
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
            const targetDateStr = (ord.dataEvasione || ord.data).split('T')[0];
            const isOverdue = targetDateStr < getTodayLocalISO();
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
                        {safeFormatDate(ord.dataEvasione || ord.data, 'short')}
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
                  <span className="text-[10px] font-bold text-purple-900 truncate">Hostess: {safeFormatDate(h.dataEsecuzione || h.data)} {new Date(h.data).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}</span>
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
                     <span className="text-[9px] font-bold text-slate-400">{safeFormatDate(ord.dataEsecuzione || ord.dataEvasione || ord.data)}</span>
                  </div>
               ))}
               {activeFilters.includes('HOSTESS') && group.pastHostess.map((h: any) => (
                  <div key={h.originalIndex} onClick={() => openQuickEdit('HOSTESS', group.id, group.data, h.originalIndex)} className="flex items-center justify-between p-1.5 rounded-md bg-white/80 border border-slate-100 cursor-pointer hover:bg-white">
                     <div className="flex items-center gap-1.5 min-w-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-600 truncate">Hostess {safeFormatDate(h.dataEsecuzione || h.data)}</span>
                     </div>
                  </div>
               ))}
               {activeFilters.includes('APPUNTAMENTI') && group.pastVisits.map((v: any, idx: number) => (
                  <div key={`vis-${idx}`} className="flex items-center justify-between p-1.5 rounded-md bg-white/80 border border-slate-100">
                     <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-600 truncate">Visita {safeFormatDate(v.visitaInizio || v.data)}</span>
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
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm p-2 shadow-sm border-b border-slate-200/50 flex items-center gap-2">
        
        {/* Segmented Control Ultra-Compatto */}
        <div className="flex bg-slate-200/60 p-1 rounded-xl gap-1 flex-1 border border-slate-200">
          {['ORDINI', 'RIMBORSI', 'HOSTESS', 'APPUNTAMENTI'].map((filter) => {
            const isActive = activeFilters.includes(filter);
            
            let activeClasses = '';
            let Icon = ShoppingBag;
            
            if (filter === 'ORDINI') {
              activeClasses = 'bg-blue-600 text-white shadow-sm';
              Icon = ShoppingBag;
            } else if (filter === 'RIMBORSI') {
              activeClasses = 'bg-emerald-600 text-white shadow-sm';
              Icon = Receipt;
            } else if (filter === 'HOSTESS') {
              activeClasses = 'bg-purple-600 text-white shadow-sm';
              Icon = UserCheck;
            } else if (filter === 'APPUNTAMENTI') {
              activeClasses = 'bg-amber-500 text-white shadow-sm';
              Icon = CalendarClock;
            }

            return (
              <button
                key={filter}
                onClick={() => toggleFilter(filter)}
                onDoubleClick={() => toggleFilter(filter, true)}
                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-1.5 sm:py-2 px-1 text-[9px] sm:text-[10px] font-black rounded-lg transition-all select-none ${
                  isActive 
                    ? activeClasses 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="capitalize">{filter.toLowerCase()}</span>
              </button>
            );
          })}
        </div>
        
        {/* Tasto Archivio Squadrato e Compatto */}
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`flex items-center justify-center w-10 h-10 sm:h-9 rounded-xl border transition-all shrink-0 ${
            showArchived ? 'bg-slate-800 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}
          title="Mostra Archivio Storico"
        >
          <History className="w-4 h-4" />
        </button>
      </div>

      <div className="px-1">
        {(bucketedGroups.length === 0 && (!activeFilters.includes('RIMBORSI') || (pendingNdc.length === 0 && completedNdc.length === 0))) ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center space-y-3 mt-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto"><Filter className="w-8 h-8 text-slate-200" /></div>
            <p className="text-slate-500 font-medium text-sm">Nessuna attività per i filtri selezionati.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeFilters.includes('RIMBORSI') && pendingNdc.length > 0 && (
              <div className="relative pt-4 mb-8">
                <div className="absolute top-0 left-4 right-4 h-px bg-emerald-200"></div>
                <div className="absolute -top-3 left-6 bg-slate-50 px-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm"><Receipt className="w-3.5 h-3.5"/></div>
                  <h3 className="font-black text-[12px] uppercase tracking-widest text-emerald-600">Da Rimborsare (To-Do)</h3>
                </div>
                <div className="mt-2">
                  {pendingNdc.map((ndc, i) => (
                    <div key={`pNdc-${i}`} className={`border rounded-2xl p-2.5 mb-3 shadow-sm transition-all ${ndc.isMismatch ? 'bg-red-50/50 border-red-500 shadow-md shadow-red-100' : ndc.isVoucher ? 'bg-orange-50/30 border-orange-200 shadow-orange-100/50' : 'bg-emerald-50/30 border-emerald-200'}`}>
                      <div className="flex justify-between items-center mb-2 gap-2">
                        <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden">
                          <h3 className="font-black text-slate-800 text-[13px] truncate">{ndc.riv.isStore ? ndc.riv.storeName : `Riv. ${ndc.riv['Num. Rivendita']}`}</h3>
                          <span className="text-[9px] font-bold text-slate-400 uppercase truncate">• {ndc.riv['Comune']}</span>
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
                              <Package className="w-2.5 h-2.5 text-blue-400" />
                              <span>{ndc.data.codiceLogista}</span>
                            </div>
                          )}
                        </div>
                        {ndc.isMismatch && (
                          <span className="bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded-full animate-pulse flex items-center gap-1 shrink-0">
                            <AlertOctagon className="w-3 h-3" /> ⚠️ ORDINE EVASO: RICHIEDI NdC!
                          </span>
                        )}
                      </div>
                      <div className={`flex flex-col p-1.5 rounded-lg border ${ndc.isMismatch ? 'bg-white border-red-200' : ndc.isVoucher ? 'bg-white border-orange-100' : 'bg-white border-emerald-100'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {ndc.isVoucher ? (
                              <Ticket className="w-3.5 h-3.5 shrink-0 text-orange-600" />
                            ) : (
                              <Receipt className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                            )}
                            <span className={`text-[11px] font-black ${ndc.isVoucher ? 'text-orange-900' : 'text-emerald-900'}`}>€{ndc.totaleCredito.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                            <span className={`text-[9px] truncate ml-1 ${ndc.isVoucher ? 'text-orange-600' : 'text-emerald-600'}`}>
                              {ndc.isVoucher ? 'Voucher One Shot' : 'Nota di Credito'} (da Ordine del {safeFormatDate(ndc.h.data, 'short')})
                            </span>
                          </div>
                        </div>
                        <div className={`mt-1 pt-1 border-t ${ndc.isVoucher ? 'border-orange-50' : 'border-emerald-50'} flex justify-end`}>
                          <button 
                            onClick={() => {
                              onEditHistory(ndc.id, ndc.originalIndex, ndc.h.note, ndc.h.importo, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true, getTodayLocalISO());
                              showToast(ndc.isVoucher ? "Voucher archiviato!" : "Nota di Credito archiviata!", "success");
                            }}
                            className={`${ndc.isVoucher ? 'text-orange-600' : 'text-emerald-600'} font-black text-[10px] uppercase hover:underline ml-auto flex items-center gap-1`}
                          >
                            <CheckCircle2 className="w-3 h-3" /> ESEGUI
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {(archivio.length > 0 || (activeFilters.includes('RIMBORSI') && completedNdc.length > 0 && showArchived)) && (
              <div className="relative pt-4 mt-8 opacity-75">
                <div className="absolute top-0 left-4 right-4 h-px bg-slate-300"></div>
                <div className="absolute -top-3 left-6 bg-slate-50 px-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shadow-sm"><History className="w-3.5 h-3.5"/></div>
                  <h3 className="font-black text-[12px] uppercase tracking-widest text-slate-500">Solo Archivio</h3>
                </div>
                <div className="mt-2">
                  {activeFilters.includes('RIMBORSI') && completedNdc.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rimborsi Archiviati</h4>
                      {completedNdc.map((ndc, i) => (
                        <div key={`cNdc-${i}`} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
                       <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-700">{ndc.riv.isStore ? ndc.riv.storeName : `Riv. ${ndc.riv['Num. Rivendita']}`}</span>
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
                                <Package className="w-2.5 h-2.5 text-blue-400" />
                                <span>{ndc.data.codiceLogista}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-0.5">
                                {ndc.isVoucher ? (
                                  <Ticket className="w-3 h-3 text-orange-500 shrink-0" />
                                ) : (
                                  <Receipt className="w-3 h-3 text-emerald-500 shrink-0" />
                                )}
                                <span className={ndc.isVoucher ? 'text-orange-600 font-bold' : ''}>€{ndc.totaleCredito.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                                <span>• {ndc.isVoucher ? 'Voucher' : 'NdC'} • Eseguito il {safeFormatDate(ndc.h.dataEsecuzioneNdC || ndc.h.dataEsecuzione || ndc.h.data)}</span>
                              </div>
                           </div>
                           <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                  {archivio.map(renderCard)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgendaTab;
