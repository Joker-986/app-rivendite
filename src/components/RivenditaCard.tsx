import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  MapPin, Store, Info, Navigation, Clock, Phone, Mail, 
  Copy, Check, Trash2, BookOpen, ChevronDown, ChevronUp, 
  Calendar, CheckCircle2, X, ClipboardList, Database, 
  Target, Activity, CalendarClock, UserCheck, Edit3, 
  TrendingDown, TrendingUp, Package, Share2, Loader2, Zap, ShoppingBag
} from 'lucide-react';
import OrderModule from './OrderModule';
import { SearchResult, RivenditaHistoryEntry, RivenditaExtra, RubricaData, OrderItem } from '../types';
import { useModals } from '../contexts/ModalContext';
import { useStrategy } from '../contexts/StrategyContext';
import { 
  formatGoogleCalendarDate, getAvailableTimes, handleNavigation, 
  toTitleCase, loadFromStorage, getRivenditaId, 
  getGoogleResetDate, calcolaFineTurno, ORARI_INIZIO,
  safeFormatDate, getTodayLocalISO
} from '../utils/helpers';
import { EnrichedDetails } from '../services/geminiService';

export interface RivenditaCardProps {
  res: SearchResult;
  idx: number;
  isCrmTab?: boolean;
  activeTab: string;
  expandedCardId: string | null;
  isInGiro: boolean;
  extra: RivenditaExtra;
  enrichedDetails?: EnrichedDetails;
  rubrica: RubricaData;
  enrichingId: string | null;
  toggleSave: (res: SearchResult) => void;
  removeFromCrm: (res: SearchResult) => void;
  removeStore: (res: SearchResult) => void;
  initiateVisitToggle: (id: string) => void;
  handleRubricaUpdate: (id: string, field: keyof RivenditaExtra, value: any) => void;
  handleActivitySave: (id: string, type: 'VISITA' | 'ORDINE' | 'HOSTESS', notes: string, amount?: number, items?: OrderItem[], dataEvasione?: string, visitaInizio?: string, visitaFine?: string) => void;
  toggleExpandCard: (id: string) => void;
  handleEnrich: (id: string, res: SearchResult) => void;
  addToCrm: (res: SearchResult) => void;
  setExpandedCardId: (id: string | null) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  handleStoreUpdate?: (id: string, field: string, value: any) => void;
  setGiroVisite?: React.Dispatch<React.SetStateAction<SearchResult[]>>;
  moveCard?: (index: number, direction: 'up' | 'down') => void;
  jumpToPosition?: (fromIndex: number, toPosition: string) => void;
  aiLockedUntil: number | null;
  cooldownSeconds: number;
  handleEditHistory: (id: string, index: number, note: string, importo: number, data?: string, ora?: string, stato?: string, isEseguito?: boolean, dataEsecuzione?: string, items?: any[], dataEvasione?: string, visitaInizio?: string, visitaFine?: string) => void;
  handleDeleteHistory: (id: string, index: number) => void;
  startVisita: (id: string) => void;
  endVisita: (id: string, note: string, tornoPiuTardi: boolean) => void;
}

const LastOrderTile = ({ data, rivenditaId, openQuickEdit }: { data: any; rivenditaId: string; openQuickEdit: any }) => {
  const lastOrderInfo = React.useMemo(() => {
    if (!data?.history || data.history.length === 0) return null;
    const orders = data.history
      .map((h: any, idx: number) => ({ ...h, realIdx: idx }))
      .filter((h: any) => h.tipo === 'ORDINE')
      .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
    return orders[0];
  }, [data?.history]);

  if (!lastOrderInfo) return null;

  const isEvaso = lastOrderInfo.isEseguito === true;

  // Colori dinamici
  const bgClass = isEvaso ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100" : "bg-amber-50 border-amber-200 hover:bg-amber-100";
  const iconColor = isEvaso ? "text-emerald-500" : "text-amber-500";
  const labelColor = isEvaso ? "text-emerald-700" : "text-amber-700";
  const badgeBg = isEvaso ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";
  const importoColor = isEvaso ? "text-emerald-700" : "text-amber-700";

  return (
    <div 
      onClick={() => {
        const idx = data.history.findIndex((h: any) => h.tipo === 'ORDINE');
        openQuickEdit('ORDINE', rivenditaId, data, idx);
      }} 
      className={`mt-1 p-3 border rounded-xl flex items-start gap-2 shadow-inner cursor-pointer transition-colors active:scale-[0.98] ${bgClass}`}
    >
      <div className="flex-shrink-0 mt-0.5"><Package className={`w-3.5 h-3.5 ${iconColor}`} /></div>
      <div className="flex-grow flex items-center justify-between min-w-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[9px] font-black uppercase tracking-wider ${labelColor}`}>
              {isEvaso ? 'Ordine Evaso' : 'Ordine in Bozza'}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeBg}`}>
              {(() => {
                const targetDate = lastOrderInfo.dataEvasione || lastOrderInfo.data;
                if (!targetDate) return '';
                // Se la data contiene trattini (formato YYYY-MM-DD o ISO)
                if (targetDate.includes('-')) {
                  const datePart = targetDate.split('T')[0];
                  const [y, m, d] = datePart.split('-');
                  if (y && m && d) return `${d}/${m}`;
                }
                // Fallback di emergenza
                return new Date(targetDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
              })()}
            </span>
          </div>
          <p className="text-[11px] font-bold text-slate-700 leading-tight truncate pr-2">
            {lastOrderInfo.note || "Nessuna nota"}
          </p>
        </div>
        <div className="text-right flex-shrink-0 flex flex-col items-end">
          <span className={`text-[10px] font-black ${importoColor}`}>€{Number(lastOrderInfo.importo || 0).toLocaleString('it-IT')}</span>
          {!isEvaso && <span className="text-[8px] font-black text-amber-600 animate-pulse mt-0.5">DA EVADERE ⏳</span>}
        </div>
      </div>
    </div>
  );
};

const LastHostessTile = ({ data, rivenditaId, openQuickEdit }: { data: any; rivenditaId: string; openQuickEdit: any }) => {
  const hostessEventInfo = React.useMemo(() => {
    if (!data?.history || data.history.length === 0) return null;
    const events = data.history
      .map((h: any, idx: number) => ({ ...h, realIdx: idx }))
      .filter((h: any) => h.tipo === 'HOSTESS')
      .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
    return events[0];
  }, [data?.history]);

  if (!hostessEventInfo) return null;

  const eventDate = new Date(hostessEventInfo.data);
  const today = new Date();
  eventDate.setHours(0,0,0,0); today.setHours(0,0,0,0);

  let label = "Ultima Hostess";
  let colorClass = "text-purple-400"; let bgClass = "bg-purple-50/50 border-purple-100"; let iconColor = "text-purple-400"; let valueColor = "text-purple-700";

  if (eventDate > today) {
    label = "Prossima Hostess"; colorClass = "text-fuchsia-500"; bgClass = "bg-fuchsia-50 border-fuchsia-200"; iconColor = "text-fuchsia-500"; valueColor = "text-fuchsia-800";
  } else if (eventDate.getTime() === today.getTime()) {
    label = "Hostess Oggi"; colorClass = "text-violet-600"; bgClass = "bg-violet-100 border-violet-300"; iconColor = "text-violet-600"; valueColor = "text-violet-900";
  }

  const d = new Date(hostessEventInfo.data);
  const timeStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const noteMatch = (hostessEventInfo.note || '').match(/Fine turno: (\d{2}:\d{2})/);
  const endTime = noteMatch ? noteMatch[1] : '';
  const dateString = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const displayString = timeStr !== '00:00' ? `${dateString} dalle ${timeStr}${endTime ? ' alle ' + endTime : ''}` : dateString;

  return (
    <div 
      onClick={() => {
        const idx = data.history.findIndex((h: any) => h.tipo === 'HOSTESS');
        openQuickEdit('HOSTESS', rivenditaId, data, idx);
      }} 
      className={`mt-1 p-2 ${bgClass} border rounded-xl flex items-center gap-2 shadow-sm cursor-pointer hover:opacity-80 transition-colors active:scale-[0.98]`}
    >
      <CalendarClock className={`w-3.5 h-3.5 ${iconColor}`} />
      <div className="flex flex-col">
        <span className={`text-[9px] font-black ${colorClass} uppercase tracking-wider`}>{label}:</span>
        <p className={`text-[10px] font-bold ${valueColor} leading-tight`}>{displayString}</p>
      </div>
    </div>
  );
};
;

const TimelineItem: React.FC<{ 
  entry: RivenditaHistoryEntry; 
  index: number; 
  onEdit: (index: number, note: string, importo: number, data: string, ora: string, stato?: string, isEseguito?: boolean, dataEsecuzione?: string, items?: any[], dataEvasione?: string, visitaInizio?: string, visitaFine?: string) => void; 
  showToast: (msg: string, type?: any) => void;
  onOpenModal: () => void;
}> = ({ entry, index, onEdit, showToast, onOpenModal }) => {
  const configs = {
    VISITA: { icon: <CheckCircle2 className="w-3 h-3" />, color: 'bg-emerald-100 text-emerald-600', label: 'Visita' },
    ORDINE: { icon: <ClipboardList className="w-3 h-3" />, color: 'bg-blue-100 text-blue-600', label: 'Ordine' },
    HOSTESS: { icon: <UserCheck className="w-3 h-3" />, color: 'bg-purple-100 text-purple-600', label: 'Hostess' }
  };
  const config = configs[entry.tipo] || configs.VISITA;
  const targetDateStr = entry.tipo === 'ORDINE' ? (entry.dataEsecuzione || entry.dataEvasione || entry.data) : (entry.visitaInizio || entry.data);
  let displayTime = safeFormatDate(targetDateStr);
  if (entry.ora) displayTime += ` • ${entry.ora}`;

  if (entry.tipo === 'VISITA' && entry.visitaInizio && entry.visitaFine) {
    const dInizio = new Date(entry.visitaInizio).getTime();
    const dFine = new Date(entry.visitaFine).getTime();
    const mins = Math.max(1, Math.round((dFine - dInizio) / 60000));
    const dataStr = new Date(entry.visitaInizio).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    displayTime = `${dataStr} • ${mins} min`;
  }

  return (
    <div className="flex gap-3 mb-4 last:mb-0">
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full ${config.color} flex items-center justify-center shadow-sm z-10`}>
          {config.icon}
        </div>
        <div className="w-0.5 h-full bg-slate-100 -mt-1"></div>
      </div>
      
      <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-3 shadow-sm relative group">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{config.label}</span>
            {entry.tipo === 'ORDINE' && (
              entry.isEseguito ? (
                <span className="bg-emerald-50 text-emerald-600 text-[9px] font-bold px-2 py-0.5 rounded">ESEGUITO</span>
              ) : (
                <span className="bg-amber-50 text-amber-600 text-[9px] font-bold px-2 py-0.5 rounded">BOZZA</span>
              )
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenModal}
              className="text-[11px] font-bold text-brand-700 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm hover:bg-brand-50 transition-colors"
            >
              {displayTime}
            </button>
            <button onClick={onOpenModal} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-brand-600 active:scale-95 transition-all shadow-sm"><Edit3 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap mt-2">
          {entry.note}
        </p>

        {entry.tipo === 'ORDINE' && (
          <div className="mt-2 pt-2 border-t border-slate-200/50 flex justify-between items-center">
            <div className="flex flex-col">
              {entry.importo > 0 && (
                <span className="text-xs font-black text-brand-600">Valore: €{entry.importo.toLocaleString('it-IT')}</span>
              )}
              {entry.dataEvasione && (
                <span className="text-[9px] text-slate-400 font-bold uppercase">Consegna: {safeFormatDate(entry.dataEvasione)}</span>
              )}
            </div>
            
            {!entry.isEseguito ? (
              <button 
                onClick={() => {
                  const targetDateStr = entry.dataEvasione || entry.data;
                  const eData = targetDateStr.split('T')[0];
                  const eOra = entry.ora || '12:00';
                  onEdit(index, entry.note, entry.importo || 0, eData, eOra, undefined, true, getTodayLocalISO(), entry.items);
                  showToast("Ordine inviato ai sistemi!", "success");
                }}
                className="text-blue-600 font-black text-[10px] uppercase hover:underline ml-auto"
              >
                ESEGUI
              </button>
            ) : (
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                ESEGUITO IL {new Date(entry.dataEsecuzione || '').toLocaleDateString('it-IT')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const RivenditaCard = React.memo<RivenditaCardProps>(({
  res,
  idx,
  isCrmTab = false,
  activeTab,
  expandedCardId,
  isInGiro,
  extra,
  enrichedDetails,
  rubrica,
  enrichingId,
  toggleSave,
  removeFromCrm,
  removeStore,
  initiateVisitToggle,
  handleRubricaUpdate,
  handleActivitySave,
  toggleExpandCard,
  handleEnrich,
  addToCrm,
  setExpandedCardId,
  showToast,
  handleStoreUpdate,
  setGiroVisite,
  moveCard,
  jumpToPosition,
  aiLockedUntil,
  cooldownSeconds,
  handleEditHistory,
  handleDeleteHistory,
  startVisita,
  endVisita
}) => {
  const { openShare, openDualShare, openQuickEdit, openRevisitModal, openKpiAssign, setSelectedRivenditaId } = useModals();
  const { missions } = useStrategy();
  const id = getRivenditaId(res);

  // Funzione per pulire l'indirizzo prima di inviarlo a Google Maps / Apple Maps
  const cleanStreetForNav = (rawStreet: string) => {
    if (!rawStreet) return '';
    let s = rawStreet;
    // Taglia l'indirizzo alla prima occorrenza di "Ang.", "angolo", o del pallino "•"
    s = s.split(/\s+ang\.?\s+/i)[0]; 
    s = s.split(/\s+angolo\s+/i)[0];
    s = s.split('•')[0];
    // Sistema le virgole errate attaccate ai numeri (es. "Via Villa ,124" -> "Via Villa 124")
    s = s.replace(/\s*,\s*(\d+)/g, ' $1');
    return s.trim();
  };

  const capToDisplay = (extra.manualCap || res['CAP'] || res['Cap'] || '').toString().trim();
  const street = toTitleCase(res['Indirizzo']?.trim() || '');
  const streetForNav = cleanStreetForNav(street); // La via ripulita per il GPS
  const city = (res['Comune']?.trim() || '').toUpperCase();
  const prov = res['Prov.']?.trim() || '';
  
  const fullAddress = [street, capToDisplay, city, prov].filter(Boolean).join(', ').trim();
  const navAddress = [streetForNav, capToDisplay, city, prov].filter(Boolean).join(', ').trim();
  const isExpanded = expandedCardId === id;
  const [isCopied, setIsCopied] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [tornoPiuTardi, setTornoPiuTardi] = useState(false);
  
  // Estrazione sicura dell'ultima nota (Priorità: Ultima in History -> Root extra -> Rubrica)
  const displayNote = React.useMemo(() => {
    const id = getRivenditaId(res);
    const rubricaEntry = rubrica?.[id];
    
    // 1. Cerca PRIMA l'ultima nota disponibile nello storico (invertendo l'array)
    const historyList = extra?.history || rubricaEntry?.history || [];
    const lastHistoryNote = historyList.find(h => h.note?.trim())?.note;
    
    // 2. Seleziona la più recente, altrimenti fallback ai vecchi campi radice
    const foundNote = lastHistoryNote || extra?.note || rubricaEntry?.note;
    
    return foundNote?.trim();
  }, [res, extra, rubrica]);

  // Per disabilitare il bottone down correttamente
  const isLastInGiro = activeTab === 'giro' && idx === (res as any)._giroLength - 1;

  const encodedAddress = encodeURIComponent(fullAddress);
  // Definisce se i dati del CRM devono essere mostrati (vero sia nel CRM che nel Giro)
  const showCrmData = isCrmTab || activeTab === 'giro';

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openDualShare(res, extra, enrichedDetails);
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 relative text-left">
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              
              {activeTab === 'giro' && (
                <div 
                  className="flex items-center bg-slate-100 border border-slate-200 rounded-md overflow-hidden h-6 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 transition-all shrink-0" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-1.5 bg-slate-200/70 text-slate-500 text-[10px] font-black border-r border-slate-200 h-full flex items-center select-none">#</div>
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={idx + 1} key={`pos-${idx}-${idx + 1}`}
                    onBlur={(e) => { const val = e.target.value; if (val && val !== (idx + 1).toString()) jumpToPosition?.(idx, val); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-7 text-center text-[11px] font-black text-slate-700 bg-transparent focus:bg-white focus:text-brand-700 outline-none m-0 p-0 h-full"
                  />
                </div>
              )}

              {res.isStore ? (
                <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-md tracking-wider">
                  SVAPO ({res.storeNumber ? res.storeNumber : 'Da File'})
                </span>
              ) : (
                <span className="px-2 py-1 bg-brand-100 text-brand-800 text-[10px] font-black rounded-md tracking-wider">
                  RIV. {res['Num. Rivendita']}
                </span>
              )}
              {activeTab === 'search' ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm ${res['Stato'] === 'Attiva' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {res['Stato']}
                </span>
              ) : (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm ${
                  extra.stato === 'Attivata' ? 'bg-emerald-100 text-emerald-700' : 
                  extra.stato === 'Non Attiva' ? 'bg-amber-100 text-amber-700' : 
                  extra.stato === 'RIP' ? 'bg-slate-800 text-slate-100' : 
                  'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {extra.stato || 'Da definire'}
                </span>
              )}

              {extra.ordinante === 'alto' && (
                <span className="flex items-center justify-center bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md shadow-sm" title="Alto Ordinante">
                  <TrendingUp className="w-3.5 h-3.5" />
                </span>
              )}
              {extra.ordinante === 'basso' && (
                <span className="flex items-center justify-center bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md shadow-sm" title="Basso Ordinante">
                  <TrendingDown className="w-3.5 h-3.5" />
                </span>
              )}
              {/* BADGES MISSIONI IBRIDE (CALCOLO LOCALE MENSILE) */}
              {extra.targetIdoneo && extra.targetIdoneo.length > 0 && (
                <div 
                  className="flex flex-wrap gap-1.5 mt-1 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRivenditaId(id);
                    openKpiAssign();
                  }}
                >
                  {extra.targetIdoneo.map(missionId => {
                    const mission = missions.find(m => m.id === missionId);
                    if (!mission) return null;

                    // Calcolo Fatturato per il mese corrente (allineato a Strategy)
                    const currentMonthStr = new Date().toISOString().substring(0, 7);
                    const fattoMese = (extra.history || []).reduce((acc: number, curr: any) => {
                      if (curr.tipo === 'ORDINE' && curr.data.startsWith(currentMonthStr)) {
                        return acc + (Number(curr.importo) || 0);
                      }
                      return acc;
                    }, 0);

                    if (mission.tipo === 'FATTURATO' && Number(mission.targetSingolo) > 0) {
                      const sbarramento = Number(mission.targetSingolo);
                      const mancante = Math.max(0, sbarramento - fattoMese);
                      const isCompleted = mancante <= 0;
                      return (
                        <div key={missionId} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-sm border ${isCompleted ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-amber-600 border-amber-300'}`}>
                          <Target className="w-2.5 h-2.5" />
                          {isCompleted ? 'Target OK' : `Manca €${mancante.toLocaleString('it-IT')}`}
                        </div>
                      );
                    }

                    if (mission.tipo === 'ATTIVAZIONE' || (mission.tipo === 'FATTURATO' && Number(mission.targetSingolo) <= 0)) {
                      const isCompleted = fattoMese > 0;
                      const icon = mission.tipo === 'FATTURATO' ? <Target className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />;
                      return (
                        <div key={missionId} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-sm border ${isCompleted ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {icon}
                          {isCompleted ? 'Attivata ✓' : 'Da Attivare'}
                        </div>
                      );
                    }

                    if (mission.tipo === 'PRODOTTO') {
                      // Placeholder visivo in attesa dell'implementazione del POS (Carrello)
                      const isCompleted = extra.kpiProdottoCompletato;
                      return (
                        <div key={missionId} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-sm border ${isCompleted ? 'bg-purple-500 text-white border-purple-600' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          <Package className="w-2.5 h-2.5" />
                          {isCompleted ? 'Piazzato ✓' : (extra.kpiProdottoNome || mission.nome)}
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              )}
            </div>
            
            <h3 className="font-medium text-slate-900 leading-snug break-words pr-2 line-clamp-2">
              {res.isStore ? (
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-brand-700 truncate">{res.storeName || 'Senza Nome'}</span>
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight truncate">
                    {capToDisplay ? `${capToDisplay} ` : ''}{(res['Comune'] || '').toUpperCase()} ({res['Prov.']})
                  </span>
                </span>
              ) : (
                <>{capToDisplay ? `${capToDisplay} ` : ''}{(res['Comune'] || '').toUpperCase()} ({res['Prov.']})</>
              )}
            </h3>
          </div>
        </div>
        
        {/* Pulsanti laterali (Segmented Control UI - Stile Pillola Colorata) */}
        <div className="flex items-center bg-white border border-slate-200/80 rounded-[1.25rem] shadow-sm h-10 overflow-hidden shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* INIZIO BLOCCO MENU FLUTTUANTE BLINDATO */}
          <div className="relative h-full" onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
            <button
              type="button"
              onClick={(e) => { 
                e.stopPropagation(); 
                e.preventDefault(); 
                setSelectedRivenditaId(id);
                openKpiAssign(); 
              }}
              className="px-3 h-full transition-colors flex items-center justify-center text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50"
              title="Assegna Target"
            >
              <Target className="w-4 h-4" />
            </button>
          </div>
          {/* FINE BLOCCO MENU FLUTTUANTE BLINDATO */}
          
          <div className="w-px h-5 bg-slate-200 shrink-0"></div>
          
          <button
            onClick={(e) => handleShare(e)}
            className={`px-3 h-full transition-colors flex items-center justify-center ${isCopied ? 'text-emerald-600 bg-emerald-50' : 'text-sky-500 hover:text-sky-700 hover:bg-sky-50'}`}
            title="Condividi informazioni"
          >
            {isCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          </button>
          
          <div className="w-px h-5 bg-slate-200 shrink-0"></div>
          
          <button
            onClick={() => toggleSave(res)}
            className={`px-3 h-full transition-colors flex items-center justify-center ${isInGiro ? 'text-brand-700 bg-brand-50' : 'text-brand-500 hover:text-brand-700 hover:bg-brand-50'}`}
            title="Aggiungi/Rimuovi dal Giro"
          >
            <ClipboardList className="w-4 h-4" />
          </button>

          {isCrmTab && (
            <>
              <div className="w-px h-5 bg-slate-200 shrink-0"></div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (res.isStore) removeStore(res);
                  else removeFromCrm(res);
                }}
                className="px-3 h-full transition-colors flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50"
                title="Elimina definitivamente"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
      
      <LastOrderTile data={extra} rivenditaId={id} openQuickEdit={openQuickEdit} />
      <LastHostessTile data={extra} rivenditaId={id} openQuickEdit={openQuickEdit} />
      
      <div className="flex items-start justify-between gap-2 text-sm text-slate-600">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          <span className="leading-snug line-clamp-2">
            {toTitleCase(res['Indirizzo'])}
            {capToDisplay ? `, ${capToDisplay}` : ''}
            {extra.zona && <span className="font-black text-brand-600 ml-1.5 tracking-tight">• {extra.zona.toUpperCase()}</span>}
          </span>
        </div>
      </div>

      {(extra.visitata === 'Si' || extra.lastDataVisita) && (
        <div 
          onClick={() => {
            const idx = extra.history?.findIndex((h: any) => h.tipo === 'VISITA');
            openQuickEdit('VISITA', id, extra, idx);
          }}
          className={`text-xs p-2.5 rounded-xl shadow-sm border-l-4 mt-2 cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all ${extra.visitata === 'Si' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-slate-50 border-slate-300 text-slate-700'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className={`w-3.5 h-3.5 ${extra.visitata === 'Si' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="font-bold uppercase tracking-wider text-[10px]">{extra.visitata === 'Si' ? 'Visitata il' : 'Ultima Visita'}</span>
            </div>
            <span className="font-bold text-sm">
              {extra.visitata === 'Si' ? (extra.dataVisita ? new Date(extra.dataVisita).toLocaleDateString('it-IT') : '-') : (extra.lastDataVisita ? new Date(extra.lastDataVisita).toLocaleDateString('it-IT') : '-')}
              {extra.visitata === 'Si' ? (extra.oraVisita ? ` alle ${extra.oraVisita}` : '') : (extra.lastOraVisita ? ` alle ${extra.lastOraVisita}` : '')}
            </span>
          </div>
        </div>
      )}

      {/* BADGE ARANCIONE DATA RIVISITA CLICCABILE */}
      {showCrmData && extra.dataRivisita && (
        <div 
          onClick={() => openRevisitModal(id)}
          title="Modifica Appuntamento"
          className="text-xs p-2.5 rounded-xl shadow-sm border-l-4 mt-2 bg-orange-50 border-orange-500 text-orange-900 cursor-pointer hover:bg-orange-100 active:scale-95 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-orange-600" />
              <span className="font-bold uppercase tracking-wider text-[10px]">Da Rivisitare il</span>
            </div>
            <span className="font-bold text-sm">
              {new Date(extra.dataRivisita).toLocaleDateString('it-IT')}
              {extra.oraRivisita ? ` alle ${extra.oraRivisita}` : ''}
            </span>
          </div>
        </div>
      )}

      {displayNote && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const id = getRivenditaId(res);
            
            // Cerca nell'array history se esiste un evento con questa esatta nota
            const historyList = extra?.history || rubrica?.[id]?.history || [];
            const foundIndex = historyList.findIndex(h => h.note?.trim() === displayNote);
            
            if (foundIndex >= 0) {
              // Nota trovata nello storico: apriamo il modale puntando esattamente a quell'evento
              openQuickEdit(historyList[foundIndex].tipo, id, extra, foundIndex);
            } else {
              // Fallback: è una nota legacy (nella root di extra o rubrica). 
              // Apriamo il modale in modalità 'VISITA' creando un evento temporaneo o passando undefined all'indice se supportato.
              openQuickEdit('VISITA', id, extra); 
            }
          }}
          className="mt-3 bg-amber-50/50 border border-amber-100 rounded-lg p-2.5 shadow-sm cursor-pointer hover:bg-amber-100 transition-all active:scale-[0.98] group"
        >
          <div className="flex items-start gap-2">
            <Edit3 className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0 group-hover:text-amber-600 transition-colors" />
            <p className="text-[11px] font-medium text-amber-800 leading-snug line-clamp-2">
              {displayNote}
            </p>
          </div>
        </div>
      )}
      
      {/* GRIGLIA PULITA DALLE RIDONDANZE */}
      <div className="grid grid-cols-2 gap-y-3 gap-x-2 pt-3 border-t border-slate-100 mt-2">
        {showCrmData && extra.giornoLevata && (
          <div className="text-xs">
            <span className="text-slate-400 block mb-0.5 font-medium">Giorno Levata</span>
            <span className="font-bold text-slate-700">{extra.giornoLevata}</span>
          </div>
        )}
        {showCrmData && extra.riferimento && (
          <div className="text-xs">
            <span className="text-slate-400 block mb-0.5 font-medium">Riferimento</span>
            <span className="font-bold text-slate-700">{extra.riferimento}</span>
          </div>
        )}
        {showCrmData && extra.telefono && (
          <div className="text-xs">
            <span className="text-slate-400 block mb-0.5 font-medium">Telefono</span>
            <a href={`tel:${extra.telefono.replace(/\\s+/g, '')}`} className="font-black text-brand-600 hover:text-brand-700 underline decoration-brand-200 underline-offset-2" onClick={(e) => e.stopPropagation()}>
              {extra.telefono}
            </a>
          </div>
        )}
        {showCrmData && extra.pIva && (
          <div className="text-xs">
            <span className="text-slate-400 block mb-0.5 font-medium">P. IVA</span>
            <span className="font-bold text-slate-700">{extra.pIva}</span>
          </div>
        )}
        {showCrmData && extra.codiceUnivoco && (
          <div className="text-xs">
            <span className="text-slate-400 block mb-0.5 font-medium">Codice SDI</span>
            <span className="font-bold text-slate-700 uppercase">{extra.codiceUnivoco}</span>
          </div>
        )}
        {showCrmData && extra.mail && (
          <div className="text-xs col-span-2">
            <span className="text-slate-400 block mb-0.5 font-medium">Mail</span>
            <span className="font-bold text-slate-700">{extra.mail}</span>
          </div>
        )}
        {showCrmData && (extra.pec || res.pec || res['PEC']) && (
          <div className="text-xs col-span-2">
            <span className="text-slate-400 block mb-0.5 font-medium">PEC</span>
            <span className="font-bold text-slate-700 truncate select-all">{extra.pec || res.pec || res['PEC']}</span>
          </div>
        )}
      </div>

      {enrichedDetails && (
        <div className="mt-4 p-4 bg-slate-50/80 rounded-2xl border border-brand-100 space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-brand-600 uppercase">
                Analisi {enrichedDetails.modelUsed || enrichedDetails.engine || 'AI'}
              </span>
              {enrichedDetails.fallbackTriggered && (
                <span className="bg-amber-100 text-amber-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm ring-1 ring-amber-200/50" title="Rete congestionata, usato modello di backup">
                  Rete Intasata • Base
                </span>
              )}
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
              enrichedDetails.confidence > 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {enrichedDetails.confidence > 0 ? `Affidabilità: ${enrichedDetails.confidence}%` : 'Affidabilità: Nessun dato trovato'}
            </span>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-brand-600" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Orari di apertura</span>
              <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-line">
                {enrichedDetails.openingHours}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-brand-600" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Telefono</span>
                <a href={`tel:${enrichedDetails.phone}`} className="text-brand-600 hover:text-brand-700 font-bold text-sm transition-colors">
                  {enrichedDetails.phone}
                </a>
              </div>
            </div>

            {enrichedDetails.zona && enrichedDetails.zona !== 'Non disponibile' && enrichedDetails.zona !== 'N/D' && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0"><MapPin className="w-4 h-4 text-brand-600" /></div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Zona / Quartiere</span>
                  <span className="text-slate-800 font-bold text-sm block truncate">{enrichedDetails.zona}</span>
                </div>
              </div>
            )}
          </div>

          {enrichedDetails.notes && enrichedDetails.notes !== 'Non disponibile' && (
            <div className="pt-3 border-t border-slate-200/60">
              <div className="flex gap-2 items-start">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500 italic leading-normal">
                  {enrichedDetails.notes}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 pt-4 border-t border-slate-50 flex flex-col gap-2">
        {activeTab === 'giro' && (
          extra.visitaInCorso ? (
            <div className="flex flex-col gap-2.5 w-full animate-in fade-in duration-300">
              <button
                onClick={() => {
                  endVisita(id, extra.note || '', tornoPiuTardi);
                  setTornoPiuTardi(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all shadow-sm bg-amber-600 text-white animate-pulse hover:bg-amber-700 shadow-amber-100"
              >
                Fine Visita
              </button>
              <label className="flex items-center gap-2.5 text-sm text-slate-700 font-medium cursor-pointer bg-white/50 p-2.5 rounded-lg border border-slate-200/70 hover:bg-slate-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={tornoPiuTardi}
                  onChange={(e) => setTornoPiuTardi(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                />
                Torno più tardi (Mantieni nel Giro)
              </label>
            </div>
          ) : (
            <button
              onClick={() => startVisita(id)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all shadow-sm bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100"
            >
              Inizio Visita
            </button>
          )
        )}

        {/* Azioni Prioritarie: Ordine e Calendar */}
        {( (showCrmData && extra.richiestaOrdine && !extra.ordineEvaso) || (showCrmData && extra.dataRivisita) ) && (
          <div className="grid grid-cols-2 gap-2">
            {showCrmData && extra.richiestaOrdine && !extra.ordineEvaso && (
              <button
                onClick={() => handleActivitySave(id, 'ORDINE', extra.noteOrdine || '', extra.importoOrdine || 0)}
                className={`${extra.dataRivisita ? 'col-span-1' : 'col-span-2'} flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-sm`}
              >
                <Check className="w-3.5 h-3.5" /> Evadi Ordine
              </button>
            )}

            {showCrmData && extra.dataRivisita && (
              <a
                href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Appuntamento Rivendita ${res['Num. Rivendita']} - ${res['Comune']}`)}&dates=${formatGoogleCalendarDate(extra.dataRivisita, extra.oraRivisita)}&details=${encodeURIComponent(`Indirizzo: ${fullAddress}\nTelefono: ${extra.telefono || 'N/A'}\nRiferimento: ${extra.riferimento || 'N/A'}`)}&location=${encodedAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${(extra.richiestaOrdine && !extra.ordineEvaso) ? 'col-span-1' : 'col-span-2'} flex items-center justify-center gap-2 bg-brand-50 hover:bg-brand-100 text-brand-700 py-2.5 px-3 rounded-xl text-xs font-bold transition-all no-underline shadow-sm`}
              >
                <Calendar className="w-3.5 h-3.5" /> Aggiungi a Calendar
              </a>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleNavigation(navAddress)}
            className="flex items-center justify-center gap-2 bg-brand-50 hover:bg-brand-100 active:scale-95 text-brand-700 py-2.5 px-3 rounded-xl text-xs font-bold transition-all no-underline shadow-sm"
          >
            <Navigation className="w-3.5 h-3.5" />
            Naviga
          </button>
          <button
            onClick={() => toggleExpandCard(id)}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-sm ${
              isExpanded ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {isExpanded ? 'Chiudi' : 'Dettagli'}
          </button>
        </div>

        {!enrichedDetails && (
          enrichingId === id ? (
            <button disabled className="w-full text-center text-[11px] font-semibold text-slate-400 bg-slate-50 py-2 rounded-xl flex items-center justify-center gap-2 transition-all">
              <Loader2 className="w-3 h-3 animate-spin" /> Caricamento...
            </button>
          ) : (
            <button
              onClick={() => handleEnrich(id, res)}
              disabled={!!aiLockedUntil}
              className={`w-full text-center text-[11px] font-semibold py-2 rounded-xl flex items-center justify-center gap-2 transition-all border ${
                aiLockedUntil 
                  ? 'text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed'
                  : 'text-brand-600 hover:text-brand-700 hover:bg-brand-50 border-brand-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> 
              {aiLockedUntil ? `Attendi ${cooldownSeconds}s per nuova analisi` : 'Orari e contatti'}
            </button>
          )
        )}

        {extra.history && extra.history.length > 0 && (
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="w-full text-center text-[10px] font-bold text-slate-500 hover:text-brand-600 py-1 transition-all flex items-center justify-center gap-1"
          >
            <Activity className="w-3 h-3" />
            {showTimeline ? 'Nascondi Cronologia' : 'Mostra Cronologia'}
          </button>
        )}

        {showTimeline && extra.history && (
          <div className="mt-4 space-y-1 border-t border-slate-100 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="relative">
              {extra.history.slice(0, 10).map((h, i) => (
                <TimelineItem 
                  key={`${id}-history-${i}`} 
                  entry={h} 
                  index={i}
                  onEdit={(idx, note, imp, data, ora, stato, isEseguito, dataEsecuzione, items, dataEvasione, vInizio, vFine) => handleEditHistory(id, idx, note, imp, data, ora, stato, isEseguito, dataEsecuzione, items, dataEvasione, vInizio, vFine)}
                  showToast={showToast}
                  onOpenModal={() => openQuickEdit(h.tipo, id, extra, i)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Expandable Form -> Trasformato in Modal Responsive Centrato */}
      {isExpanded && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setExpandedCardId(null)}>
          <div 
            className="bg-slate-50 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()} // Evita che il click dentro il modale lo chiuda
          >
            
            {/* Modal Header Fisso - Versione Dinamica e Responsive */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white rounded-t-3xl shrink-0">
              <h4 className="font-bold text-slate-800 flex items-center gap-2 min-w-0 flex-1 mr-2">
                <BookOpen className="w-5 h-5 text-brand-600 shrink-0" />
                <span className="truncate text-sm sm:text-base">
                  {res.isStore ? 'Store' : 'Riv.'} #{res.isStore ? (res.storeNumber || res['Num. Rivendita']) : res['Num. Rivendita']} • {city}
                </span>
              </h4>
              <button 
                onClick={() => setExpandedCardId(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors bg-slate-50 shrink-0"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Modal Body Scrollabile */}
            <div className="p-5 overflow-y-auto space-y-5">
              
              {/* DATI UFFICIALI ADM (Nuova Sezione) */}
              {!res.isStore && (
                <details className="bg-slate-100/50 border border-slate-200 rounded-2xl overflow-hidden group">
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100 transition-colors list-none">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
                        <Database className="w-4 h-4 text-slate-600" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Dati Ufficiali ADM</h4>
                        <p className="text-[9px] text-slate-500 font-medium">Informazioni ministeriali registrate</p>
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="p-4 pt-0 grid grid-cols-2 gap-4 border-t border-slate-200/50 bg-white/50">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Tipo Rivendita</span>
                      <span className="text-xs font-black text-slate-700">{res['Tipo Rivendita'] || '-'}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Distr. Automatico</span>
                      <span className="text-xs font-black text-slate-700">{res['Distr. Automatico'] || '-'}</span>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Stato ADM</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${res['Stato'] === 'ATTIVA' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="text-xs font-black text-slate-700">{res['Stato'] || 'NON SPECIFICATO'}</span>
                      </div>
                    </div>
                  </div>
                </details>
              )}
              
              {res.isStore ? (
                <div className="space-y-4">
                  {/* Sezione Identità */}
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-50">
                      <Store className="w-4 h-4 text-brand-600" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">Identità Store</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1 col-span-1 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">C.A.P. Manuale</label>
                        <input
                          type="text"
                          maxLength={5}
                          value={extra.manualCap || ''}
                          onChange={(e) => handleRubricaUpdate(id, 'manualCap', e.target.value.replace(/\D/g, ''))}
                          placeholder="Es. 80100"
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold text-brand-700"
                        />
                      </div>
                      <div className="space-y-1 col-span-1 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Zona / Quartiere</label>
                        <input
                          type="text"
                          value={extra.zona || ''}
                          onChange={(e) => handleRubricaUpdate(id, 'zona', e.target.value)}
                          placeholder="Es. Vomero"
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold text-brand-700"
                        />
                      </div>
                      <div className="space-y-1 col-span-1 sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome Insegna</label>
                        <input
                          type="text"
                          value={res.storeName || ''}
                          onChange={(e) => handleStoreUpdate?.(id, 'storeName', e.target.value)}
                          className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold text-brand-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Numero Identificativo</label>
                        <input
                          type="text"
                          value={res.storeNumber || res['Num. Rivendita'] || ''}
                          onChange={(e) => handleStoreUpdate?.(id, 'storeNumber', e.target.value)}
                          className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">RIV. (Opzionale)</label>
                        <input
                          type="text"
                          value={res.rivenditaUfficiale || ''}
                          onChange={(e) => handleStoreUpdate?.(id, 'rivenditaUfficiale', e.target.value)}
                          placeholder="Codice RIV"
                          className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold text-brand-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipologia</label>
                        <select
                          value={res.isChain ? 'true' : 'false'}
                          onChange={(e) => handleStoreUpdate?.(id, 'isChain', e.target.value === 'true')}
                          className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                        >
                          <option value="false">Punto Vendita Singolo</option>
                          <option value="true">Parte di una Catena</option>
                        </select>
                      </div>
                      {res.isChain && (
                        <div className="space-y-1 col-span-1 sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Numero Totale Punti Vendita</label>
                          <input
                            type="number"
                            value={res.chainCount || 1}
                            onChange={(e) => handleStoreUpdate?.(id, 'chainCount', parseInt(e.target.value) || 1)}
                            className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sezione Localizzazione */}
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-50">
                      <MapPin className="w-4 h-4 text-brand-600" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">Localizzazione</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Provincia</label>
                        <input
                          type="text"
                          value={res['Prov.']}
                          onChange={(e) => handleStoreUpdate?.(id, 'Prov.', e.target.value.toUpperCase())}
                          className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comune</label>
                        <input
                          type="text"
                          value={res['Comune']}
                          onChange={(e) => handleStoreUpdate?.(id, 'Comune', e.target.value)}
                          className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Indirizzo Completo</label>
                        <input
                          type="text"
                          value={res['Indirizzo']}
                          onChange={(e) => handleStoreUpdate?.(id, 'Indirizzo', e.target.value)}
                          className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <div className="space-y-1 col-span-1 sm:col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">C.A.P. Manuale</label>
                    <input
                      type="text"
                      maxLength={5}
                      value={extra.manualCap || ''}
                      onChange={(e) => handleRubricaUpdate(id, 'manualCap', e.target.value.replace(/\D/g, ''))}
                      placeholder="Es. 80100"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold text-brand-700"
                    />
                  </div>
                  <div className="space-y-1 col-span-1 sm:col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Zona / Quartiere</label>
                    <input
                      type="text"
                      value={extra.zona || ''}
                      onChange={(e) => handleRubricaUpdate(id, 'zona', e.target.value)}
                      placeholder="Es. Vomero"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold text-brand-700"
                    />
                  </div>
                </div>
              )}
              
              {(extra.lastDataVisita || (extra.visitata === 'Si' && extra.dataVisita)) && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl mb-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-[10px] uppercase tracking-wider mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    {extra.visitata === 'Si' ? 'VISITATA IL' : 'ULTIMA VISITA'}
                  </div>
                  <p className="text-xs text-emerald-700">
                    Data: <span className="font-bold">
                      {extra.visitata === 'Si' 
                        ? (extra.dataVisita ? new Date(extra.dataVisita).toLocaleDateString('it-IT') : '-')
                        : (extra.lastDataVisita ? new Date(extra.lastDataVisita).toLocaleDateString('it-IT') : '-')
                      }
                    </span> alle <span className="font-bold">
                      {extra.visitata === 'Si' ? extra.oraVisita : extra.lastOraVisita}
                    </span>
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Stato</label>
                  <select
                    value={extra.stato}
                    onChange={(e) => handleRubricaUpdate(id, 'stato', e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  >
                    <option value="">Seleziona</option>
                    <option value="Attivata">Attivata</option>
                    <option value="Non Attiva">Non Attiva</option>
                    <option value="RIP">RIP</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Classificazione Ordini</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRubricaUpdate(id, 'ordinante', extra.ordinante === 'alto' ? '' : 'alto')}
                      className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-bold transition-all ${extra.ordinante === 'alto' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                    >
                      <TrendingUp className={`w-4 h-4 ${extra.ordinante === 'alto' ? 'text-emerald-600' : ''}`} />
                      Alto
                    </button>
                    <button
                      onClick={() => handleRubricaUpdate(id, 'ordinante', extra.ordinante === 'basso' ? '' : 'basso')}
                      className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-bold transition-all ${extra.ordinante === 'basso' ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                    >
                      <TrendingDown className={`w-4 h-4 ${extra.ordinante === 'basso' ? 'text-red-600' : ''}`} />
                      Basso
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Data e Ora Prossima Visita (Programmata)</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={extra.dataRivisita || ''}
                      onChange={(e) => handleRubricaUpdate(id, 'dataRivisita', e.target.value)}
                      className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                    />
                    <select
                      value={extra.oraRivisita || ''}
                      onChange={(e) => handleRubricaUpdate(id, 'oraRivisita', e.target.value)}
                      className="w-24 h-10 px-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                    >
                      <option value="">Ora</option>
                      {getAvailableTimes(extra.dataRivisita || '', id, rubrica || {}).map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Giorno Levata</label>
                  <select
                    value={extra.giornoLevata}
                    onChange={(e) => handleRubricaUpdate(id, 'giornoLevata', e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  >
                    <option value="">Seleziona</option>
                    <option value="Lunedì">Lunedì</option>
                    <option value="Martedì">Martedì</option>
                    <option value="Mercoledì">Mercoledì</option>
                    <option value="Giovedì">Giovedì</option>
                    <option value="Venerdì">Venerdì</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Riferimento (Referente)</label>
                  <input
                    type="text"
                    value={extra.riferimento}
                    onChange={(e) => handleRubricaUpdate(id, 'riferimento', e.target.value)}
                    placeholder="Nome del referente"
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Telefono</label>
                  <input
                    type="tel"
                    value={extra.telefono}
                    onChange={(e) => handleRubricaUpdate(id, 'telefono', e.target.value)}
                    placeholder="Numero di telefono"
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Mail</label>
                    <input
                      type="email"
                      value={extra.mail}
                      onChange={(e) => handleRubricaUpdate(id, 'mail', e.target.value)}
                      placeholder="Indirizzo email"
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">PEC</label>
                    <input 
                      type="email" 
                      placeholder="Indirizzo PEC" 
                      value={extra.pec || res.pec || res['PEC'] || ''} 
                      onChange={(e) => {
                        if (res.isStore) {
                          handleStoreUpdate?.(id, 'pec', e.target.value);
                        } else {
                          handleRubricaUpdate(id, 'pec', e.target.value);
                        }
                      }} 
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none shadow-sm" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">P. IVA</label>
                    <input
                      type="text"
                      value={extra.pIva}
                      onChange={(e) => handleRubricaUpdate(id, 'pIva', e.target.value.replace(/\D/g, ''))}
                      placeholder="11 cifre"
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Codice SDI</label>
                    <input
                      type="text"
                      value={extra.codiceUnivoco || ''}
                      maxLength={7}
                      onChange={(e) => handleRubricaUpdate(id, 'codiceUnivoco', e.target.value.toUpperCase())}
                      placeholder="7 caratteri"
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm uppercase font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Note</label>
                  <textarea
                    value={extra.note || ''}
                    onChange={(e) => handleRubricaUpdate(id, 'note', e.target.value)}
                    placeholder="Inserisci note libere..."
                    className="w-full h-24 p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm resize-none"
                  />
                </div>

                {/* MISSIONI MBO ASSEGNATE (v4.0) */}
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl mt-4">
                  <div className="flex flex-col gap-1 mb-3">
                    <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wider flex items-center gap-1"><Target className="w-3.5 h-3.5"/> Missioni MBO Assegnate</span>
                    <span className="text-[9px] text-indigo-500 font-medium">Seleziona gli obiettivi per questa rivendita</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {missions.map(mission => {
                      const isSelected = (extra.targetIdoneo || []).includes(mission.id);
                      return (
                        <label key={mission.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-white border-brand-200 shadow-sm' : 'bg-transparent border-transparent opacity-60 hover:opacity-100'}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${mission.tipo === 'FATTURATO' ? 'bg-blue-50 text-blue-600' : mission.tipo === 'ATTIVAZIONE' ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
                              {mission.tipo === 'FATTURATO' ? <TrendingUp className="w-3.5 h-3.5" /> : mission.tipo === 'ATTIVAZIONE' ? <Zap className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                            </div>
                            <span className="text-[11px] font-bold text-slate-700">{mission.nome}</span>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={(e) => {
                              const current = extra.targetIdoneo || [];
                              const next = e.target.checked 
                                ? [...current, mission.id]
                                : current.filter(id => id !== mission.id);
                              handleRubricaUpdate(id, 'targetIdoneo', next);
                            }}
                            className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" 
                          />
                        </label>
                      );
                    })}
                    {missions.length === 0 && (
                      <p className="text-[10px] text-slate-400 italic text-center py-2">Nessuna missione configurata nella Regia</p>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRubricaUpdate(id, 'richiestaOrdine', !extra.richiestaOrdine);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                      extra.richiestaOrdine 
                        ? 'bg-brand-100 text-brand-700' 
                        : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-600'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    {extra.richiestaOrdine ? 'Annulla Ordine' : 'Compila Ordine'}
                  </button>
                </div>

                {extra.richiestaOrdine && (
                  <div className="mt-4 animate-in fade-in zoom-in-95 duration-300">
                    <OrderModule 
                      onConfirmOrder={(cart, totaleEuro, note, dataEvasione) => {
                        handleActivitySave(id, 'ORDINE', note, totaleEuro, cart, dataEvasione);
                        handleRubricaUpdate(id, 'richiestaOrdine', false); // Chiude il modulo dopo il salvataggio
                      }}
                      onCancel={() => {
                        handleRubricaUpdate(id, 'richiestaOrdine', false);
                      }}
                    />
                  </div>
                )}

                {/* SEZIONE HOSTESS */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extra.showHostessModule || false}
                      onChange={(e) => handleRubricaUpdate(id, 'showHostessModule', e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                    />
                    <span className="text-sm font-bold text-purple-700">Richiedi Hostess</span>
                  </label>
                </div>

                {extra.showHostessModule && (
                  <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl shadow-sm space-y-3">
                    <div className="flex items-center gap-2 mb-1 pb-2 border-b border-purple-100">
                      <UserCheck className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-bold text-purple-800 uppercase tracking-tight">Dettagli Servizio</span>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">Giorno Servizio</label>
                        <input
                          type="date"
                          value={extra.hostessData || ''}
                          onChange={(e) => handleRubricaUpdate(id, 'hostessData', e.target.value)}
                          className="w-full h-10 px-3 bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">Inizio Turno</label>
                        <select
                          value={extra.hostessInizio || ''}
                          onChange={(e) => {
                            const inizio = e.target.value;
                            const fine = calcolaFineTurno(inizio);
                            handleRubricaUpdate(id, 'hostessInizio', inizio);
                            handleRubricaUpdate(id, 'hostessFine', fine);
                          }}
                          className="w-full h-10 px-3 bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold text-purple-700"
                        >
                          <option value="">Seleziona Orario</option>
                          {ORARI_INIZIO.map(ora => (
                            <option key={ora} value={ora}>{ora}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => {
                          if (extra.hostessData && extra.hostessInizio) {
                            const notes = `${extra.hostessData} - dalle ${extra.hostessInizio} alle ${extra.hostessFine}`;
                            handleActivitySave(id, 'HOSTESS', notes);
                          }
                        }}
                        className="w-full py-2 bg-purple-600 text-white text-xs font-bold rounded-xl shadow-sm active:scale-95 transition-all"
                      >
                        Salva Servizio
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Fisso */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0 rounded-b-3xl flex gap-3">
              {/* 1. Tasto Salva Dinamico (Spostato a sinistra) */}
              <button
                onClick={() => {
                  if (activeTab === 'giro') {
                    // FIX v3.02 (Opzione A): Rimosso handleActivitySave automatico.
                    // L'utente deve aver premuto il tasto verde prima, se vuole registrare l'orario.
                    if (!res.isStore) {
                      addToCrm(res); // addToCrm gestisce già lo spostamento e la rimozione dal giro
                    } else {
                      setGiroVisite?.(prev => prev.filter(g => getRivenditaId(g) !== id));
                    }
                    setExpandedCardId(null);
                    showToast('Scheda archiviata nel CRM', 'success');
                  } else {
                    if (!isCrmTab && activeTab !== 'rip') {
                      if (!res.isStore) {
                        addToCrm(res);
                      }
                    }
                    setExpandedCardId(null);
                    showToast('Modifiche salvate!', 'success');
                  }
                }}
                className="flex-1 py-3.5 bg-gradient-to-b from-brand-500 to-brand-600 text-white font-bold rounded-xl border border-brand-700 border-b-[3px] hover:brightness-110 active:border-b active:translate-y-[2px] text-sm transition-all shadow-md"
              >
                {activeTab === 'giro' ? 'Salva e Chiudi Visita' : res.isStore ? 'Salva in Store' : 'Salva nel CRM'}
              </button>

              {/* 2. Tasto Chiudi (Spostato a destra) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedCardId(null);
                }}
                className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 border-b-[3px] hover:bg-slate-200 active:border-b active:translate-y-[2px] text-sm transition-all shadow-sm"
              >
                Chiudi
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
});

export default RivenditaCard;


