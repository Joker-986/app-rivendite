import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, MapPin, Store, AlertCircle, Loader2, ChevronRight, Info, Map as MapIcon, List, Navigation, Clock, Phone, Mail, Globe, ExternalLink, RefreshCw, Copy, Check, Heart, Trash2, Bookmark, BookOpen, ChevronDown, ChevronUp, Download, Save, Calendar, GripVertical, CheckCircle2, X, ClipboardList, Layers, Settings, Upload, Share2, MessageCircle, Layout, Database, Sparkles, Filter, Cloud, Plus, BarChart2, Target, Activity, CalendarClock, User } from 'lucide-react';
import MapView from './components/MapView';
import { enrichRivendita, EnrichedDetails } from './services/geminiService';
import packageVersion from './version.json';

interface Option {
  value: string;
  label: string;
}

interface SearchResult {
  uid?: string;
  'Prov.': string;
  'Comune': string;
  'Num. Rivendita': string;
  'Indirizzo': string;
  'Tipo Rivendita'?: string;
  'Stato'?: string;
  'Distr. Automatico'?: string;
  isStore?: boolean;
  storeName?: string;
  storeNumber?: string;
  isChain?: boolean;
  chainCount?: number;
  [key: string]: any;
}

export interface RivenditaExtra {
  stato: 'Attivata' | 'Non Attiva' | 'Basso Rendente' | 'RIP' | '';
  visitata: 'Si' | 'Da Rivisitare' | 'No' | '';
  dataVisita?: string;
  oraVisita?: string;
  lastDataVisita?: string;
  lastOraVisita?: string;
  dataRivisita?: string;
  oraRivisita?: string;
  giornoLevata: 'Lunedì' | 'Martedì' | 'Mercoledì' | 'Giovedì' | 'Venerdì' | '';
  riferimento: string;
  telefono: string;
  pIva: string;
  mail: string;
  isSavedToRubrica?: boolean;
  richiestaOrdine?: boolean;
  noteOrdine?: string;
  dataOrdine?: string;
  ordineEvaso?: boolean;
  note?: string;
  manualCap?: string;
}

export type RubricaData = Record<string, RivenditaExtra>;

const formatGoogleCalendarDate = (dateString: string, timeString?: string) => {
  const date = new Date(dateString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  
  let timePart = '090000';
  if (timeString) {
    timePart = timeString.replace(':', '') + '00';
  }
  
  const start = `${yyyy}${mm}${dd}T${timePart}`;
  
  let endHour = parseInt(timePart.substring(0, 2)) + 1;
  let endHourStr = String(endHour).padStart(2, '0');
  if (endHour >= 24) {
    endHourStr = '23';
  }
  const end = `${yyyy}${mm}${dd}T${endHourStr}${timePart.substring(2)}`;
  
  return `${start}/${end}`;
};

export const getAvailableTimes = (date: string, currentId: string, rubricaData: RubricaData) => {
  const allTimes = Array.from({ length: (20 - 8) * 4 + 1 }).map((_, i) => {
    const h = (Math.floor(i / 4) + 8).toString().padStart(2, '0');
    const m = ((i % 4) * 15).toString().padStart(2, '0');
    return `${h}:${m}`;
  });
  if (!date) return allTimes;
  
  // Trova tutti gli orari già prenotati in quella data (escludendo la rivendita corrente)
  const bookedTimes = Object.entries(rubricaData)
    .filter(([id, data]) => id !== currentId && data.dataRivisita === date && data.oraRivisita)
    .map(([_, data]) => data.oraRivisita);
    
  return allTimes.filter(t => !bookedTimes.includes(t));
};

export const handleNavigation = (address: string) => {
  const encoded = encodeURIComponent(address);
  // Controllo per verificare se l'utente è su un dispositivo mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Comportamento nativo intatto per Smartphone
    window.location.href = 'geo:0,0?q=' + encoded;
  } else {
    // Fallback sicuro per PC (apre Google Maps in una nuova scheda)
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  }
};

const toTitleCase = (str: string) => { return str ? str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase()) : ''; };

const DATA_VERSION = packageVersion.version;

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return defaultValue;
    return JSON.parse(saved) as T;
  } catch (err) {
    console.error(`Error loading ${key} from storage:`, err);
    return defaultValue;
  }
};

const getRivenditaId = (res: SearchResult) => {
  if (res.uid) return res.uid;
  // Per gli store usiamo il numero store se presente, altrimenti il numero rivendita
  const num = res.isStore ? (res.storeNumber || res['Num. Rivendita']) : res['Num. Rivendita'];
  return `${res['Prov.']}_${res['Comune']}_${num}`;
};

interface RivenditaCardProps {
  res: SearchResult;
  idx: number;
  isCrmTab?: boolean;
  activeTab: string;
  expandedCardId: string | null;
  isInGiro: boolean;
  extra: RivenditaExtra;
  enrichedDetails?: EnrichedDetails;
  rubrica?: RubricaData;
  enrichingId: string | null;
  toggleSave: (res: SearchResult) => void;
  removeFromCrm: (res: SearchResult) => void;
  removeStore: (res: SearchResult) => void;
  initiateVisitToggle: (id: string) => void;
  handleRubricaUpdate: (id: string, field: keyof RivenditaExtra, value: string | boolean) => void;
  toggleExpandCard: (id: string) => void;
  handleEnrich: (id: string, res: SearchResult) => void;
  addToCrm: (res: SearchResult) => void;
  setExpandedCardId: (id: string | null) => void;
  setShareModal: (modal: { isOpen: boolean; text: string }) => void;
  handleStoreUpdate?: (id: string, field: string, value: any) => void;
  moveCard?: (index: number, direction: 'up' | 'down') => void;
  openRevisitModal: (id: string) => void;
}

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
  toggleExpandCard,
  handleEnrich,
  addToCrm,
  setExpandedCardId,
  setShareModal,
  handleStoreUpdate,
  moveCard,
  openRevisitModal
}) => {
  const id = getRivenditaId(res);
  const isExpanded = expandedCardId === id;
  const [isCopied, setIsCopied] = useState(false);
  
  // Per disabilitare il bottone down correttamente
  const isLastInGiro = activeTab === 'giro' && idx === (res as any)._giroLength - 1;

  const capToDisplay = extra.manualCap || res['CAP'] || res['Cap'] || '';
  const street = toTitleCase(res['Indirizzo']?.trim() || '');
  const city = (res['Comune']?.trim() || '').toUpperCase();
  const prov = res['Prov.']?.trim() || '';
  const fullAddress = [street, capToDisplay, city, prov].filter(Boolean).join(', ').trim();
  const encodedAddress = encodeURIComponent(fullAddress);
  // Definisce se i dati del CRM devono essere mostrati (vero sia nel CRM che nel Giro)
  const showCrmData = isCrmTab || activeTab === 'giro';

  const shareText = React.useMemo(() => {
    const enriched = enrichedDetails;
    let text = `*${res.isStore ? 'STORE' : 'RIVENDITA'} #${res.storeNumber || res['Num. Rivendita']}*\n`;
    text += `Indirizzo: ${toTitleCase(res['Indirizzo'])}${capToDisplay ? `, ${capToDisplay}` : ''}\n`;
    text += `Comune: ${(res['Comune'] || '').toUpperCase()} (${res['Prov.']})\n`;
    
    if (extra.stato) text += `Stato CRM: ${extra.stato}\n`;
    if (extra.riferimento) text += `Referente: ${extra.riferimento}\n`;
    if (extra.pIva) text += `P. IVA: ${extra.pIva}\n`;
    if (extra.telefono || (enriched && enriched.phone)) text += `Telefono: ${extra.telefono || enriched?.phone}\n`;
    if (extra.mail || (enriched && enriched.email)) text += `Email: ${extra.mail || enriched?.email}\n`;
    if (enriched && enriched.openingHours) text += `Orari: ${enriched.openingHours}\n`;

    // Storico Visite
    if (extra.visitata === 'Si' && extra.dataVisita) {
      text += `Ultima Visita: ${new Date(extra.dataVisita).toLocaleDateString('it-IT')}${extra.oraVisita ? ' alle ' + extra.oraVisita : ''}\n`;
    } else if (extra.lastDataVisita) {
      text += `Ultima Visita: ${new Date(extra.lastDataVisita).toLocaleDateString('it-IT')}${extra.lastOraVisita ? ' alle ' + extra.lastOraVisita : ''}\n`;
    }
    if (extra.dataRivisita) {
      text += `Prossima Visita: ${new Date(extra.dataRivisita).toLocaleDateString('it-IT')}${extra.oraRivisita ? ' alle ' + extra.oraRivisita : ''}\n`;
    }

    // Ordini
    if (extra.richiestaOrdine) {
      text += `\n--- ORDINE ---\n`;
      text += `Stato: ${extra.ordineEvaso ? '✅ Evaso' : '⏳ DA EVADERE'}\n`;
      if (extra.dataOrdine) text += `Inserito il: ${new Date(extra.dataOrdine).toLocaleDateString('it-IT')}\n`;
      if (extra.noteOrdine) text += `Articoli: ${extra.noteOrdine}\n`;
    }

    if (extra.note || (enriched && enriched.notes)) text += `\nNote: ${extra.note || enriched?.notes}\n`;

    return text.trim();
  }, [res, extra, enrichedDetails, id]);

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (navigator.share) {
      navigator.share({
        text: shareText
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          setShareModal({ isOpen: true, text: shareText });
        }
      });
    } else {
      setShareModal({ isOpen: true, text: shareText });
    }
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 relative text-left">
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {activeTab === 'giro' && (
            <div className="flex flex-col gap-1 mr-1 mt-1 shrink-0">
              <button onClick={(e) => { e.stopPropagation(); moveCard?.(idx, 'up'); }} className="p-1 bg-slate-100 text-slate-500 rounded hover:bg-slate-200 active:scale-90 disabled:opacity-30" disabled={idx === 0}>
                <ChevronUp className="w-4 h-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); moveCard?.(idx, 'down'); }} className="p-1 bg-slate-100 text-slate-500 rounded hover:bg-slate-200 active:scale-90 disabled:opacity-30" disabled={isLastInGiro}>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider shadow-sm ${res.isStore ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'}`}>
                {res.isStore ? <span className="flex items-center gap-1"><Store className="w-3 h-3" />STORE #{res.storeNumber || res['Num. Rivendita']}</span> : `RIV. ${res['Num. Rivendita']}`}
              </span>
              {res.isStore && res.isChain && (
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Catena ({res.chainCount || 1})
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${res['Stato'] === 'Attiva' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {res['Stato']}
              </span>
              {showCrmData && extra.stato && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                  extra.stato === 'Attivata' ? 'bg-emerald-100 text-emerald-700' : 
                  extra.stato === 'Non Attiva' ? 'bg-red-100 text-red-700' :
                  extra.stato === 'RIP' ? 'bg-slate-100 text-slate-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {extra.stato} (CRM)
                </span>
              )}
            </div>
            {/* Aggiunto leading-snug e break-words per gestire città con nomi lunghissimi senza spaccare il layout */}
            <h3 className="font-medium text-slate-900 leading-snug break-words pr-2 line-clamp-2">
              {res.isStore ? (
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-brand-700 truncate">{res.storeName || 'Senza Nome'}</span>
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight truncate">
                    {capToDisplay ? `${capToDisplay} ` : ''}{(res['Comune'] || '').toUpperCase()} ({res['Prov.']})
                  </span>
                </span>
              ) : (
                <>
                  {capToDisplay ? `${capToDisplay} ` : ''}{(res['Comune'] || '').toUpperCase()} ({res['Prov.']})
                </>
              )}
            </h3>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={(e) => handleShare(e)}
            className={`p-2 rounded-xl transition-all shrink-0 flex items-center gap-1 ${
              isCopied ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-400 hover:bg-brand-50 hover:text-brand-600'
            }`}
            title="Condividi informazioni"
          >
            {isCopied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
            {isCopied && <span className="text-[10px] font-bold uppercase">Copiato!</span>}
          </button>

          {activeTab === 'search' && (
            <button
              onClick={() => toggleSave(res)}
              className={`p-2 rounded-xl transition-all ${
                isInGiro 
                  ? 'bg-brand-100 text-brand-600' 
                  : 'bg-slate-50 text-slate-400 hover:bg-brand-50 hover:text-brand-600'
              }`}
              title={isInGiro ? "Rimuovi dal giro visite" : "Pianifica visita (Giro)"}
            >
              <ClipboardList className={`w-5 h-5 ${isInGiro ? 'fill-current' : ''}`} />
            </button>
          )}
          
          {(isCrmTab || activeTab === 'rip' || activeTab === 'store') && (
            <>
              <button
                onClick={() => toggleSave(res)}
                className={`p-2 rounded-xl transition-all ${
                  isInGiro 
                    ? 'bg-brand-100 text-brand-600' 
                    : 'bg-slate-50 text-slate-400 hover:bg-brand-50 hover:text-brand-600'
                }`}
                title={isInGiro ? "Rimuovi dal giro visite" : "Pianifica visita (Giro)"}
              >
                <ClipboardList className={`w-5 h-5 ${isInGiro ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={() => res.isStore ? removeStore(res) : removeFromCrm(res)}
                className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all shrink-0"
                title={res.isStore ? "Elimina Store" : "Elimina dal CRM"}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}

          {activeTab === 'giro' && (
            <button
              onClick={() => toggleSave(res)}
              className="p-2 bg-pink-50 text-pink-500 rounded-xl hover:bg-pink-100 transition-all shrink-0"
              title="Rimuovi dal giro visite"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex items-start justify-between gap-2 text-sm text-slate-600">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          <span className="leading-snug line-clamp-2">
            {toTitleCase(res['Indirizzo'])}
            {capToDisplay ? `, ${capToDisplay}` : ''}
          </span>
        </div>
      </div>

      {(extra.visitata === 'Si' || extra.lastDataVisita) && (
        <div className={`text-xs p-2.5 rounded-xl shadow-sm border-l-4 mt-2 ${extra.visitata === 'Si' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-slate-50 border-slate-300 text-slate-700'}`}>
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

      {extra.note && (
        <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-xl text-xs text-slate-600 italic mt-2">
          <div className="flex items-center gap-1.5 mb-1 text-amber-700 font-bold uppercase tracking-wider text-[9px]"><BookOpen className="w-3 h-3" /> Note</div>
          <p className="leading-relaxed">{extra.note}</p>
        </div>
      )}
      
      {/* GRIGLIA PULITA DALLE RIDONDANZE */}
      <div className="grid grid-cols-2 gap-y-3 gap-x-2 pt-3 border-t border-slate-100 mt-2">
        <div className="text-xs">
          <span className="text-slate-400 block mb-0.5 font-medium">Tipo</span>
          <span className="font-bold text-slate-700">{res['Tipo Rivendita']}</span>
        </div>
        <div className="text-xs">
          <span className="text-slate-400 block mb-0.5 font-medium">Distr. Automatico</span>
          <span className="font-bold text-slate-700">{res['Distr. Automatico']}</span>
        </div>
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
        {showCrmData && extra.mail && (
          <div className="text-xs col-span-2">
            <span className="text-slate-400 block mb-0.5 font-medium">Mail</span>
            <span className="font-bold text-slate-700">{extra.mail}</span>
          </div>
        )}
        {showCrmData && extra.richiestaOrdine && (
          <div className="text-xs col-span-2 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
            <span className="text-slate-400 block mb-1 font-bold uppercase tracking-wider text-[9px]">Stato Ordine</span>
            <span className="font-medium text-slate-700 flex items-center gap-1.5">
              {extra.dataOrdine ? `${new Date(extra.dataOrdine).toLocaleDateString('it-IT')} - ` : ''}
              {extra.ordineEvaso ? <span className="text-emerald-600 font-black">Evaso ✓</span> : <span className="text-amber-600 font-black animate-pulse">Da evadere ⏳</span>}
            </span>
            {extra.noteOrdine && <div className="mt-1.5 p-2 bg-white rounded border border-slate-200 text-slate-600 italic leading-snug">{extra.noteOrdine}</div>}
          </div>
        )}
      </div>

      {enrichedDetails && (
        <div className="mt-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-300">
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

            {enrichedDetails.email && enrichedDetails.email !== 'Non disponibile' && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-brand-600" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Email</span>
                  <a href={`mailto:${enrichedDetails.email}`} className="text-brand-600 hover:text-brand-700 font-bold text-sm truncate block transition-colors">
                    {enrichedDetails.email}
                  </a>
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
          <button
            onClick={() => initiateVisitToggle(id)}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all shadow-sm ${
              extra.visitata === 'Si' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100' 
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {extra.visitata === 'Si' ? 'Aggiorna Orario Visita' : 'Rivendita visitata'}
          </button>
        )}

        {/* Azioni Prioritarie: Ordine e Calendar */}
        {( (showCrmData && extra.richiestaOrdine && !extra.ordineEvaso) || (showCrmData && extra.dataRivisita) ) && (
          <div className="grid grid-cols-2 gap-2">
            {showCrmData && extra.richiestaOrdine && !extra.ordineEvaso && (
              <button
                onClick={() => handleRubricaUpdate(id, 'ordineEvaso', true)}
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
            onClick={() => handleNavigation(fullAddress)}
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
              className="w-full text-center text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 py-2 rounded-xl flex items-center justify-center gap-2 transition-all border border-brand-100"
            >
              <Clock className="w-3.5 h-3.5" /> Orari e contatti
            </button>
          )
        )}
      </div>

      {/* Expandable Form */}
      {isExpanded && (
        <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-brand-600" />
            Informazioni Extra
          </h4>

          {res.isStore ? (
            <div className="space-y-4">
              {/* Sezione Identità */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-50">
                  <Store className="w-4 h-4 text-brand-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">Identità Store</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">C.A.P. (Inserimento Manuale)</label>
                    <input
                      type="text"
                      maxLength={5}
                      value={extra.manualCap || ''}
                      onChange={(e) => handleRubricaUpdate(id, 'manualCap', e.target.value.replace(/\D/g, ''))}
                      placeholder="Es. 80100"
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
              <div className="space-y-1 col-span-1 sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">C.A.P. (Inserimento Manuale)</label>
                <input
                  type="text"
                  maxLength={5}
                  value={extra.manualCap || ''}
                  onChange={(e) => handleRubricaUpdate(id, 'manualCap', e.target.value.replace(/\D/g, ''))}
                  placeholder="Es. 80100"
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold text-brand-700"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Distr. Automatico</label>
                <input
                  type="text"
                  value={res['Distr. Automatico'] || ''}
                  onChange={(e) => handleStoreUpdate?.(id, 'Distr. Automatico', e.target.value)}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stato (Attiva/Chiusa)</label>
                <input
                  type="text"
                  value={res['Stato'] || ''}
                  onChange={(e) => handleStoreUpdate?.(id, 'Stato', e.target.value)}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
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
                <option value="Basso Rendente">Basso Rendente</option>
                <option value="RIP">RIP</option>
              </select>
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
              <label className="text-xs font-medium text-slate-600">P. IVA</label>
              <input
                type="text"
                value={extra.pIva}
                onChange={(e) => handleRubricaUpdate(id, 'pIva', e.target.value.replace(/\D/g, ''))}
                placeholder="Partita IVA (solo numeri)"
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              />
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

            <div className="pt-2 border-t border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extra.richiestaOrdine || false}
                  onChange={(e) => handleRubricaUpdate(id, 'richiestaOrdine', e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                />
                <span className="text-sm font-medium text-slate-700">Richiesta d'ordine</span>
              </label>
            </div>

            {extra.richiestaOrdine && (
              <div className="space-y-4 bg-brand-50/50 p-3 rounded-xl border border-brand-100">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Data inserimento ordine</label>
                  <input
                    type="date"
                    value={extra.dataOrdine || ''}
                    onChange={(e) => handleRubricaUpdate(id, 'dataOrdine', e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Note ordine (articoli da ordinare)</label>
                  <textarea
                    value={extra.noteOrdine || ''}
                    onChange={(e) => handleRubricaUpdate(id, 'noteOrdine', e.target.value)}
                    placeholder="Inserisci qui gli articoli da ordinare..."
                    rows={3}
                    className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm resize-none"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extra.ordineEvaso || false}
                    onChange={(e) => handleRubricaUpdate(id, 'ordineEvaso', e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Ordine evaso</span>
                </label>
              </div>
            )}
          </div>
          
          <button
            onClick={() => {
              if (!isCrmTab && activeTab !== 'rip') {
                if (!res.isStore) {
                  addToCrm(res);
                }
              }
              setExpandedCardId(null);
            }}
            className="w-full mt-4 py-3 bg-brand-600 text-white font-bold rounded-xl text-sm shadow-md shadow-brand-100 active:scale-95 transition-all"
          >
            {(isCrmTab || activeTab === 'rip') ? 'Salva Modifiche' : 'Salva nel CRM'}
          </button>
        </div>
      )}
    </div>
  );
});

export default function App() {
  const [session, setSession] = useState<{ viewState: string; cookies: string; submitName: string } | null>(null);
  
  const [regions, setRegions] = useState<Option[]>([]);
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [comuni, setComuni] = useState<Option[]>([]);
  
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedComune, setSelectedComune] = useState('');
  const [numRivendita, setNumRivendita] = useState('');
  const [tipoRiv, setTipoRiv] = useState('');
  const [statoRiv, setStatoRiv] = useState('');
  
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [pagination, setPagination] = useState<{
    currentText: string;
    currentPage: number;
    totalPages: number;
    tableId: string;
  } | null>(null);
  const [enrichedData, setEnrichedData] = useState<Record<string, EnrichedDetails>>({});
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [activeTab, setActiveTab] = useState<string>('search');
  const [statsPeriod, setStatsPeriod] = useState<'oggi' | '7g' | '30g' | 'all' | 'custom'>('oggi');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [radarTab, setRadarTab] = useState<'completate' | 'programmate'>('completate');
  const [statsOrdiniOpen, setStatsOrdiniOpen] = useState(false);
  const [statsTerritorioOpen, setStatsTerritorioOpen] = useState(false);
  const [statsRadarOpen, setStatsRadarOpen] = useState(true);

  const isDateInRange = (dateStr?: string) => {
    if (!dateStr) return statsPeriod === 'all';
    const d = new Date(dateStr); d.setHours(0,0,0,0);
    const now = new Date(); now.setHours(0,0,0,0);
    
    if (statsPeriod === 'all') return true;
    if (statsPeriod === 'oggi') return d.getTime() === now.getTime();
    
    if (statsPeriod === 'custom') {
      if (!customRange.start || !customRange.end) return true;
      return d >= new Date(customRange.start) && d <= new Date(customRange.end);
    }
    
    const diffDays = Math.ceil(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    return statsPeriod === '7g' ? diffDays <= 7 : diffDays <= 30;
  };
  const [rivenditaFilter, setRivenditaFilter] = useState('');
  const [comuneFilter, setComuneFilter] = useState('');
  const [giroVisite, setGiroVisite] = useState<SearchResult[]>(() => loadFromStorage('giroVisite', []));
  const [crmAnagrafiche, setCrmAnagrafiche] = useState<SearchResult[]>(() => loadFromStorage('crmAnagrafiche', []));
  const [stores, setStores] = useState<SearchResult[]>(() => loadFromStorage('stores', []));
  const [rubrica, setRubrica] = useState<RubricaData>(() => loadFromStorage('rubrica', {}));
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [revisitModalId, setRevisitModalId] = useState<string | null>(null);
  const [showConfirmVisitModal, setShowConfirmVisitModal] = useState(false);
  const [showClearGiroConfirmModal, setShowClearGiroConfirmModal] = useState(false);
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [generatedSyncCode, setGeneratedSyncCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  // Stato specifico per il caricamento sync dal FAB per non interferire con quello delle impostazioni
  const [fabSyncLoading, setFabSyncLoading] = useState(false);
  const [pendingVisitId, setPendingVisitId] = useState<string | null>(null);
  const [rubricaFilterStato, setRubricaFilterStato] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [capFilter, setCapFilter] = useState<string>('');
  const [filterVisitata, setFilterVisitata] = useState<string>('');
  const [filterOrdine, setFilterOrdine] = useState<boolean>(false);
  const [rubricaSort, setRubricaSort] = useState<string>('none');
  const [showChangelog, setShowChangelog] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [storageSize, setStorageSize] = useState('0 KB');
  const [swActive, setSwActive] = useState(false);
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false });

  const [shareModal, setShareModal] = useState({ isOpen: false, text: '' });

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'info' });

  useEffect(() => {
    setCrmAnagrafiche(prev => {
      const puliti = prev.filter(res => res.isStore !== true);
      if (puliti.length !== prev.length) {
        console.log("Database ripulito dai cloni fantasma!");
      }
      return puliti;
    });
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  useEffect(() => {
    const seenVersion = localStorage.getItem('seen_changelog_version');
    // Mostra il changelog se è la prima volta o se la versione è cambiata
    if (seenVersion !== DATA_VERSION) {
      setShowChangelog(true);
    }
  }, []);

  const dismissChangelog = () => {
    localStorage.setItem('seen_changelog_version', DATA_VERSION);
    setShowChangelog(false);
  };

  // Gestione PWA e Aggiornamenti (anti-loop iOS)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Registrazione standard senza forzare update rapidi
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          // Controlla aggiornamenti solo all'avvio o ogni tanto, non in loop
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Nuovo aggiornamento disponibile. Mostra un'apposita notifica UI (toast) 
                  // invece di window.location.reload() forzato.
                  // (Se non implementi un toast dedicato, per ora lascia solo il console.log)
                  console.log('Nuovo aggiornamento PWA disponibile. Ricarica l\'app.');
                }
              });
            }
          });
        })
        .catch((err) => console.error('Errore SW:', err));
    }
  }, []);

  useEffect(() => {
    document.body.style.overscrollBehaviorY = 'none';
    return () => {
      document.body.style.overscrollBehaviorY = 'auto';
    };
  }, []);

  useEffect(() => {
    const activeTabElement = document.getElementById(activeTab.startsWith('prov_') ? `tab-${activeTab}` : `tab-${activeTab}`);
    if (activeTabElement) {
      activeTabElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeTab]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      setSwActive(true);
    }

    const calculateStorage = () => {
      try {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            total += (localStorage.getItem(key)?.length || 0) + key.length;
          }
        }
        // UTF-16 characters take 2 bytes
        const bytes = total * 2;
        if (bytes < 1024) setStorageSize(`${bytes} B`);
        else if (bytes < 1024 * 1024) setStorageSize(`${(bytes / 1024).toFixed(2)} KB`);
        else setStorageSize(`${(bytes / (1024 * 1024)).toFixed(2)} MB`);
      } catch (e) {
        setStorageSize('N/D');
      }
    };

    if (showSettingsModal) {
      calculateStorage();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showSettingsModal]);

  useEffect(() => {
    localStorage.setItem('giroVisite', JSON.stringify(giroVisite));
  }, [giroVisite]);

  useEffect(() => {
    localStorage.setItem('crmAnagrafiche', JSON.stringify(crmAnagrafiche));
  }, [crmAnagrafiche]);

  useEffect(() => {
    localStorage.setItem('stores', JSON.stringify(stores));
  }, [stores]);

  useEffect(() => {
    localStorage.setItem('rubrica', JSON.stringify(rubrica));
  }, [rubrica]);

  useEffect(() => {
    // Automatic Data Migration & Persistence Check
    const currentVersion = localStorage.getItem('app_data_version');
    
    if (currentVersion !== DATA_VERSION) {
      console.log(`Auto-migrating data from ${currentVersion || 'legacy'} to ${DATA_VERSION}`);
      
      // Migrate stores to include storeNumber if missing
      setStores(prev => prev.map(s => {
        if (s.isStore && !s.storeNumber) {
          return { ...s, storeNumber: s['Num. Rivendita'] || '' };
        }
        return s;
      }));

      localStorage.setItem('app_data_version', DATA_VERSION);
    }
    
    initSession();
  }, []);

  useEffect(() => {
    let lastHiddenTime = 0;
    const TIMEOUT_MS = 4 * 60 * 1000; // 4 minuti in millisecondi

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenTime = Date.now();
      } else if (document.visibilityState === 'visible') {
        if (lastHiddenTime > 0 && (Date.now() - lastHiddenTime > TIMEOUT_MS)) {
          window.location.reload();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleExportData = () => {
    try {
      const data = {
        giroVisite,
        crmAnagrafiche,
        stores,
        rubrica,
        version: DATA_VERSION,
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Nome file automatico con data YYYYMMDD
      const now = new Date();
      const dateStr = now.getFullYear().toString() + 
                      (now.getMonth() + 1).toString().padStart(2, '0') + 
                      now.getDate().toString().padStart(2, '0');
      a.download = `TgesT_Backup_${dateStr}.json`;
      
      document.body.appendChild(a);
      a.click();
      
      // CRITICO: Ritardo di 1.5 secondi per dare tempo al Download Manager nativo 
      // di Android di intercettare il Blob prima che venga distrutto.
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1500);
    } catch (err) {
      console.error('Errore durante l\'esportazione:', err);
      showToast('Errore durante il salvataggio del backup.', 'error');
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result as string;
        const data = JSON.parse(result);
        
        if (typeof data !== 'object' || data === null) throw new Error('Formato non valido');
        
        // Sovrascrittura Local Storage per persistenza immediata prima del reload
        if (data.giroVisite) localStorage.setItem('giroVisite', JSON.stringify(data.giroVisite));
        if (data.crmAnagrafiche) localStorage.setItem('crmAnagrafiche', JSON.stringify(data.crmAnagrafiche));
        if (data.stores) localStorage.setItem('stores', JSON.stringify(data.stores));
        if (data.rubrica) localStorage.setItem('rubrica', JSON.stringify(data.rubrica));
        if (data.version) localStorage.setItem('app_data_version', data.version);
        
        showToast('Backup ripristinato con successo! L\'app verrà ricaricata.');
        setTimeout(() => window.location.reload(), 2000);
      } catch (err) {
        console.error('Errore importazione:', err);
        showToast('Errore durante l\'importazione del file.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = () => {
    setConfirmModal({
      isOpen: true,
      title: 'CANCELLA TUTTO',
      message: 'ATTENZIONE: Questa operazione cancellerà DEFINITIVAMENTE tutti i tuoi dati (Giro, Rubrica, Store). Sei sicuro di voler procedere?',
      isDestructive: true,
      onConfirm: () => {
        setGiroVisite([]);
        setCrmAnagrafiche([]);
        setStores([]);
        setRubrica({});
        localStorage.clear();
        localStorage.setItem('app_data_version', DATA_VERSION);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        showToast('Tutti i dati sono stati cancellati.');
        setShowSettingsModal(false);
      }
    });
  };

  const handleGenerateSyncCode = async () => {
    try {
      setIsSyncing(true);
      const data = { giroVisite, crmAnagrafiche, stores, rubrica, version: DATA_VERSION };
      
      const res = await fetch('https://bytebin.lucko.me/post', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await res.json();
      
      if (result && result.key) {
        setGeneratedSyncCode(result.key);
        navigator.clipboard.writeText(result.key).catch(() => console.log('Clipboard copy prevented'));
        showToast('Codice generato con successo!');
      } else {
        throw new Error('Impossibile recuperare il codice');
      }
    } catch (err) {
      showToast('Errore durante la generazione del codice', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportFromSyncCode = async () => {
    if (!syncCodeInput.trim()) return;
    try {
      setIsSyncing(true);
      const res = await fetch(`https://bytebin.lucko.me/${syncCodeInput.trim()}`);
      if (!res.ok) throw new Error('Codice non valido o scaduto');
      
      const data = await res.json();
      
      if (data.giroVisite) localStorage.setItem('giroVisite', JSON.stringify(data.giroVisite));
      if (data.crmAnagrafiche) localStorage.setItem('crmAnagrafiche', JSON.stringify(data.crmAnagrafiche));
      if (data.stores) localStorage.setItem('stores', JSON.stringify(data.stores));
      if (data.rubrica) localStorage.setItem('rubrica', JSON.stringify(data.rubrica));
      if (data.version) localStorage.setItem('app_data_version', data.version);
      
      showToast('Dati scaricati con successo! Riavvio in corso...');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      showToast('Codice errato, inesistente o scaduto', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const initSession = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/init');
      if (!res.ok) throw new Error('Failed to initialize');
      const data = await res.json();
      setSession({ viewState: data.viewState, cookies: data.cookies, submitName: data.submitName });
      setRegions(data.regions);
    } catch (err) {
      setError('Errore di connessione al server. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedRegion('');
    setSelectedProvince('');
    setSelectedComune('');
    setNumRivendita('');
    setTipoRiv('');
    setStatoRiv('');
    setResults(null);
    setPagination(null);
    setEnrichedData({});
    setEnrichingId(null);
    setError('');
    initSession();
  };

  const handleRegionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const region = e.target.value;
    setSelectedRegion(region);
    setSelectedProvince('');
    setSelectedComune('');
    setProvinces([]);
    setComuni([]);
    
    if (!region || !session) return;
    
    try {
      setLoadingOptions(true);
      const res = await fetch('/api/provinces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...session, region })
      });
      if (!res.ok) throw new Error('Failed to fetch provinces');
      const data = await res.json();
      setSession(prev => prev ? { ...prev, viewState: data.viewState } : null);
      setProvinces(data.provinces);
    } catch (err) {
      setError('Errore nel caricamento delle province.');
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const province = e.target.value;
    setSelectedProvince(province);
    setSelectedComune('');
    setComuni([]);
    
    if (!province || !session) return;
    
    try {
      setLoadingOptions(true);
      const res = await fetch('/api/comuni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...session, region: selectedRegion, province })
      });
      if (!res.ok) throw new Error('Failed to fetch comuni');
      const data = await res.json();
      setSession(prev => prev ? { ...prev, viewState: data.viewState } : null);
      
      // Trova il nome della provincia selezionata
      const provinceOption = provinces.find(p => p.value === province);
      const provinceLabel = provinceOption?.label || '';
      
      // Cerca il capoluogo nell'elenco dei comuni (solitamente ha lo stesso nome della provincia)
      const capoluogo = data.comuni.find((c: Option) => 
        c.label.toUpperCase() === provinceLabel.toUpperCase()
      );

      if (capoluogo) {
        // Crea l'elenco con il capoluogo in cima, un separatore e poi l'elenco completo
        const modifiedComuni = [
          { value: capoluogo.value, label: capoluogo.label },
          { value: 'separator', label: '──────────' },
          ...data.comuni
        ];
        setComuni(modifiedComuni);
      } else {
        setComuni(data.comuni);
      }
    } catch (err) {
      setError('Errore nel caricamento dei comuni.');
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedRegion || !selectedProvince) {
      setError('Seleziona almeno Regione e Provincia.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setResults(null);
      setEnrichedData({});
      setEnrichingId(null);
      
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...session,
          region: selectedRegion,
          province: selectedProvince,
          comune: selectedComune,
          numRivendita,
          tipoRiv,
          statoRiv
        })
      });
      
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data.results || []);
      setPagination(data.pagination);
      if (data.viewState) {
        setSession(prev => prev ? { ...prev, viewState: data.viewState } : null);
      }
    } catch (err) {
      setError('Errore durante la ricerca.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = async (direction: 'next' | 'prev') => {
    if (!session || !pagination) return;
    
    const newPage = direction === 'next' ? pagination.currentPage + 1 : pagination.currentPage - 1;
    if (newPage < 1 || (pagination.totalPages > 0 && newPage > pagination.totalPages)) return;
    
    const first = (newPage - 1) * 10;
    
    try {
      setLoading(true);
      const res = await fetch('/api/paginate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookies: session.cookies,
          viewState: session.viewState,
          tableId: pagination.tableId,
          first
        })
      });
      
      if (!res.ok) throw new Error('Pagination failed');
      const data = await res.json();
      setResults(data.results || []);
      setPagination(data.pagination);
      if (data.viewState) {
        setSession(prev => prev ? { ...prev, viewState: data.viewState } : null);
      }
      setEnrichedData({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError('Errore durante la navigazione delle pagine.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrich = useCallback(async (id: string, res: SearchResult) => {
    if (enrichedData[id]) return;
    
    try {
      setEnrichingId(id);
      const details = await enrichRivendita(res);
      setEnrichedData(prev => ({ ...prev, [id]: details }));
      showToast('Dati arricchiti con successo!');
    } catch (err) {
      console.error(err);
      showToast('Errore durante l\'arricchimento dati', 'error');
    } finally {
      setEnrichingId(null);
    }
  }, [enrichedData, showToast]);

  const handleCopyAddress = useCallback((address: string, id: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }, []);

  const handleRubricaUpdate = useCallback((id: string, field: keyof RivenditaExtra, value: string | boolean) => {
    setRubrica(prev => {
      const existing = prev[id];
      let isSavedToRubrica = existing?.isSavedToRubrica;
      
      if (isSavedToRubrica === undefined) {
        if (field === 'isSavedToRubrica') {
          isSavedToRubrica = value as boolean;
        } else {
          const hadData = existing ? Object.entries(existing).some(([key, val]) => key !== 'isSavedToRubrica' && val !== '') : false;
          isSavedToRubrica = hadData;
        }
      } else if (field === 'isSavedToRubrica') {
        isSavedToRubrica = value as boolean;
      }

      return {
        ...prev,
        [id]: {
          ...(existing || {
            stato: '',
            visitata: '',
            giornoLevata: '',
            riferimento: '',
            telefono: '',
            pIva: '',
            mail: '',
            richiestaOrdine: false,
            noteOrdine: '',
            dataOrdine: '',
            ordineEvaso: false,
            oraVisita: '',
            oraRivisita: '',
            lastDataVisita: '',
            lastOraVisita: ''
          }),
          [field]: value,
          isSavedToRubrica
        }
      };
    });
  }, []);

  const handleRubricaMultiUpdate = useCallback((id: string, updates: Partial<RivenditaExtra>) => {
    setRubrica(prev => {
      const existing = prev[id];
      let isSavedToRubrica = existing?.isSavedToRubrica;
      
      if (isSavedToRubrica === undefined) {
        if (updates.isSavedToRubrica !== undefined) {
          isSavedToRubrica = updates.isSavedToRubrica as boolean;
        } else {
          const hadData = existing ? Object.entries(existing).some(([key, val]) => key !== 'isSavedToRubrica' && val !== '') : false;
          isSavedToRubrica = hadData;
        }
      } else if (updates.isSavedToRubrica !== undefined) {
        isSavedToRubrica = updates.isSavedToRubrica as boolean;
      }

      return {
        ...prev,
        [id]: {
          ...(existing || {
            stato: '',
            visitata: '',
            giornoLevata: '',
            riferimento: '',
            telefono: '',
            pIva: '',
            mail: '',
            richiestaOrdine: false,
            noteOrdine: '',
            dataOrdine: '',
            ordineEvaso: false,
            oraVisita: '',
            oraRivisita: '',
            lastDataVisita: '',
            lastOraVisita: ''
          }),
          ...updates,
          isSavedToRubrica
        }
      };
    });
  }, []);

  const isSaved = useCallback((res: SearchResult) => {
    return giroVisite.some(s => 
      s['Num. Rivendita'] === res['Num. Rivendita'] && 
      s['Comune'] === res['Comune'] && 
      s['Prov.'] === res['Prov.']
    );
  }, [giroVisite]);

  const toggleSave = useCallback((res: SearchResult) => {
    const id = getRivenditaId(res);
    if (isSaved(res)) {
      setGiroVisite(prev => prev.filter(s => 
        !(s['Num. Rivendita'] === res['Num. Rivendita'] && 
          s['Comune'] === res['Comune'] && 
          s['Prov.'] === res['Prov.'])
      ));
      showToast('Rimossa dal giro visite');
    } else {
      setGiroVisite(prev => [...prev, res]);
      showToast('Aggiunta al giro visite');
      // Reset visit status when re-planned
      const existing = rubrica[id];
      if (existing?.visitata === 'Si') {
        handleRubricaMultiUpdate(id, {
          visitata: 'No',
          lastDataVisita: existing.dataVisita,
          lastOraVisita: existing.oraVisita
        });
      } else {
        handleRubricaUpdate(id, 'visitata', 'No');
      }
    }
  }, [isSaved, rubrica, handleRubricaMultiUpdate, handleRubricaUpdate, showToast]);

  const initiateVisitToggle = useCallback((id: string) => {
    setPendingVisitId(id);
    setShowConfirmVisitModal(true);
  }, []);

  const confirmVisit = useCallback(() => {
    if (!pendingVisitId) return;
    const id = pendingVisitId;
    const existing = rubrica[id];
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    const updates: Partial<RivenditaExtra> = {
      visitata: 'Si',
      dataVisita: dateStr,
      oraVisita: timeStr
    };

    // If there was a previous visit, move it to lastDataVisita
    if (existing?.dataVisita) {
      updates.lastDataVisita = existing.dataVisita;
      updates.lastOraVisita = existing.oraVisita || '';
    }

    handleRubricaMultiUpdate(id, updates);
    setRevisitModalId(id);
    setShowConfirmVisitModal(false);
    setPendingVisitId(null);
  }, [pendingVisitId, rubrica, handleRubricaMultiUpdate]);

  const toggleExpandCard = useCallback((id: string) => {
    setExpandedCardId(prev => prev === id ? null : id);
  }, []);

  const hasRubricaData = useCallback((id: string) => {
    const extra = rubrica[id];
    if (!extra) return false;
    if (extra.isSavedToRubrica === undefined) {
      const hasData = Object.entries(extra).some(([key, val]) => key !== 'isSavedToRubrica' && val !== '');
      return hasData;
    }
    return extra.isSavedToRubrica === true;
  }, [rubrica]);

  useEffect(() => {
    // Migration: if crmAnagrafiche is empty but giroVisite has items with rubrica data,
    // populate crmAnagrafiche. This handles the transition from the old 'savedRivendite' system.
    if (crmAnagrafiche.length === 0 && giroVisite.length > 0) {
      const itemsWithData = giroVisite.filter(res => {
        const id = getRivenditaId(res);
        return rubrica[id]?.isSavedToRubrica === true;
      });
      if (itemsWithData.length > 0) {
        setCrmAnagrafiche(itemsWithData);
      }
    }
  }, []);

  const removeFromCrm = useCallback((res: SearchResult) => {
    const id = getRivenditaId(res);
    setConfirmModal({
      isOpen: true,
      title: 'Elimina dal CRM',
      message: `Sei sicuro di voler eliminare la rivendita ${res['Num. Rivendita']} dal CRM? Verranno eliminati anche tutti i dati salvati.`,
      isDestructive: true,
      onConfirm: () => {
        setCrmAnagrafiche(prev => prev.filter(s => getRivenditaId(s) !== id));
        setRubrica(prev => {
          const newRubrica = { ...prev };
          delete newRubrica[id];
          return newRubrica;
        });
        setGiroVisite(prev => prev.filter(s => getRivenditaId(s) !== id));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        showToast('Rivendita rimossa dal CRM');
      }
    });
  }, []);

  const removeStore = useCallback((res: SearchResult) => {
    const id = getRivenditaId(res);
    setConfirmModal({
      isOpen: true,
      title: 'Elimina Store',
      message: `Sei sicuro di voler eliminare lo store ${res['Num. Rivendita']}? Verranno eliminati anche tutti i dati salvati.`,
      isDestructive: true,
      onConfirm: () => {
        setStores(prev => prev.filter(s => getRivenditaId(s) !== id));
        setRubrica(prev => {
          const newRubrica = { ...prev };
          delete newRubrica[id];
          return newRubrica;
        });
        setGiroVisite(prev => prev.filter(s => getRivenditaId(s) !== id));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        showToast('Store eliminato');
      }
    });
  }, []);

  const addToCrm = useCallback((res: SearchResult) => {
    const id = getRivenditaId(res);
    setCrmAnagrafiche(prev => {
      if (!prev.some(s => getRivenditaId(s) === id)) {
        return [...prev, res];
      }
      return prev;
    });
    handleRubricaUpdate(id, 'isSavedToRubrica', true);
    // Remove from Giro Visite automatically when saved to CRM
    setGiroVisite(prev => prev.filter(s => getRivenditaId(s) !== id));
  }, [handleRubricaUpdate]);

  const clearGiro = useCallback(() => {
    setGiroVisite([]);
    setShowClearGiroConfirmModal(false);
  }, []);

  const exportGiroForMyMaps = useCallback(() => {
    if (giroVisite.length === 0) return;

    // Colonne ottimizzate per l'importazione perfetta su Google My Maps
    const headers = ['Nome Punto Vendita', 'Indirizzo Completo', 'Tipo', 'Stato CRM', 'Referente', 'Telefono', 'Note'];

    const rows = giroVisite.map(res => {
      const id = getRivenditaId(res);
      const extra = rubrica[id] || {};
      const capToDisplay = extra.manualCap || res['CAP'] || res['Cap'] || '';
      
      const nome = res.isStore ? `STORE ${res.storeName || res.storeNumber || ''}` : `RIVENDITA ${res['Num. Rivendita']}`;
      
      // Formattazione rigida per garantire la geolocalizzazione 100% esatta su Maps
      const indirizzoCompleto = `${res['Indirizzo'] || ''}, ${capToDisplay}, ${res['Comune'] || ''}, ${res['Prov.'] || ''}, Italia`;
      
      return [
        `"${nome}"`,
        `"${indirizzoCompleto}"`,
        `"${res['Tipo Rivendita'] || ''}"`,
        `"${extra.stato || ''}"`,
        `"${extra.riferimento || ''}"`,
        `"${extra.telefono || ''}"`,
        `"${(extra.note || '').replace(/"/g, '""')}"` // Escape delle virgolette interne per sicurezza CSV
      ].join(',');
    });

    // Aggiungo il prefisso BOM (\uFEFF) per forzare UTF-8 e preservare le lettere accentate
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `GiroVisite_MyMaps_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    
    // Pulizia
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1500);
  }, [giroVisite, rubrica]);

  const giroVisiteList = useMemo(() => giroVisite, [giroVisite]);
  
  const allCrmList = useMemo(() => crmAnagrafiche, [crmAnagrafiche]);
  
  const crmList = useMemo(() => allCrmList.filter(res => {
    const id = getRivenditaId(res);
    const stato = rubrica[id]?.stato;
    // Mantiene la scheda visibile nel CRM durante la modifica, anche se si seleziona RIP
    if (activeTab === 'crm' && expandedCardId === id) return true;
    return stato !== 'RIP';
  }), [allCrmList, rubrica, activeTab, expandedCardId]);

  const ripList = useMemo(() => allCrmList.filter(res => {
    const id = getRivenditaId(res);
    const stato = rubrica[id]?.stato;
    // Mantiene la scheda visibile nei RIP durante la modifica, anche se si toglie RIP
    if (activeTab === 'rip' && expandedCardId === id) return true;
    return stato === 'RIP';
  }), [allCrmList, rubrica, activeTab, expandedCardId]);

  const storeList = useMemo(() => stores, [stores]);

  // Province dinamiche dal CRM e dagli Store
  const provincesInCrm = useMemo(() => Array.from(new Set([
    ...crmList.map(res => (res['Prov.'] || '').toUpperCase()),
    ...storeList.map(res => (res['Prov.'] || '').toUpperCase())
  ])).sort(), [crmList, storeList]);

  const getOrderedTabs = useCallback(() => {
    const tabs = ['search', 'giro', 'crm', 'store'];
    provincesInCrm.forEach(p => tabs.push(`prov_${p}`));
    tabs.push('rip');
    tabs.push('statistiche');
    return tabs;
  }, [provincesInCrm]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setViewMode('list');
    setRivenditaFilter('');
    setComuneFilter('');
    window.scrollTo(0, 0);
  }, []);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const tabs = getOrderedTabs();
    const currentIndex = tabs.indexOf(activeTab);
    let nextTab = activeTab;
    
    if (direction === 'left') {
      const nextIndex = (currentIndex + 1) % tabs.length;
      nextTab = tabs[nextIndex];
    } else if (direction === 'right') {
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      nextTab = tabs[prevIndex];
    }
    handleTabChange(nextTab);
  }, [activeTab, getOrderedTabs, handleTabChange]);

  const moveCard = useCallback((index: number, direction: 'up' | 'down') => {
    setGiroVisite(prev => {
      const newArray = [...prev];
      if (direction === 'up' && index > 0) {
        [newArray[index - 1], newArray[index]] = [newArray[index], newArray[index - 1]];
      } else if (direction === 'down' && index < newArray.length - 1) {
        [newArray[index + 1], newArray[index]] = [newArray[index], newArray[index + 1]];
      }
      return newArray;
    });
  }, []);

  const getUniqueComuniForTab = useCallback(() => {
    let list: SearchResult[] = [];
    if (activeTab === 'search') return [];
    if (activeTab === 'giro') list = giroVisiteList;
    else if (activeTab === 'crm') list = crmList;
    else if (activeTab === 'store') list = storeList;
    else if (activeTab === 'rip') list = ripList;
    else if (activeTab.startsWith('prov_')) {
      const prov = activeTab.replace('prov_', '');
      list = [...crmList, ...storeList].filter(res => (res['Prov.'] || '').toUpperCase() === prov.toUpperCase());
    }
    
    // Create strings like "Comune (Prov.)"
    const formattedComuni = list.map(res => `${res['Comune']} (${res['Prov.']})`);
    return Array.from(new Set(formattedComuni)).sort();
  }, [activeTab, giroVisiteList, crmList, storeList, ripList]);

  const getBaseListLength = useCallback(() => {
    if (activeTab === 'crm') return crmList.length;
    if (activeTab === 'store') return storeList.length;
    if (activeTab === 'rip') return ripList.length;
    if (activeTab.startsWith('prov_')) {
      const prov = activeTab.replace('prov_', '');
      return [...crmList, ...storeList].filter(res => (res['Prov.'] || '').toUpperCase() === prov.toUpperCase()).length;
    }
    return 0;
  }, [activeTab, crmList, storeList, ripList]);

  const handleFabSyncGenerate = useCallback(async () => {
    try {
      setFabSyncLoading(true);
      setFabMenuOpen(false); // Chiude il menu per feedback visivo
      
      const data = { giroVisite, crmAnagrafiche, stores, rubrica, version: DATA_VERSION };
      const res = await fetch('https://bytebin.lucko.me/post', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await res.json();
      
      if (result && result.key) {
        navigator.clipboard.writeText(result.key).catch(() => console.log('Clipboard copy prevented'));
        showToast('Codice Sync generato!');
        setGeneratedSyncCode(result.key);
        setShowSettingsModal(true);
      } else {
        throw new Error('Errore generazione codice');
      }
    } catch (err) {
      showToast('Errore durante la sincronizzazione rapida', 'error');
    } finally {
      setFabSyncLoading(false);
    }
  }, [giroVisite, crmAnagrafiche, stores, rubrica]);

  const getCurrentList = useMemo(() => {
    let list: SearchResult[] = [];
    if (activeTab === 'search') return results || [];
    if (activeTab === 'giro') list = giroVisiteList;
    else if (activeTab === 'crm') list = crmList;
    else if (activeTab === 'store') list = storeList;
    else if (activeTab === 'rip') list = ripList;
    else if (activeTab.startsWith('prov_')) {
      const prov = activeTab.replace('prov_', '');
      list = [...crmList, ...storeList].filter(res => (res['Prov.'] || '').toUpperCase() === prov.toUpperCase());
    }

    // Filtro Numero Rivendita
    if (rivenditaFilter) {
      list = list.filter(res => {
        const num = res.isStore ? (res.storeNumber || res['Num. Rivendita']) : res['Num. Rivendita'];
        return num?.toString().includes(rivenditaFilter);
      });
    }

    // Filtro Comune
    if (comuneFilter) {
      list = list.filter(res => `${res['Comune']} (${res['Prov.']})` === comuneFilter);
    }

    // Filtro CAP
    if (capFilter) {
      list = list.filter(res => {
        const id = getRivenditaId(res);
        const manualCap = rubrica[id]?.manualCap || '';
        return manualCap.toString().includes(capFilter);
      });
    }

    // Filtro Stato CRM
    if (rubricaFilterStato) {
      list = list.filter(res => rubrica[getRivenditaId(res)]?.stato === rubricaFilterStato);
    }

    // Filtro Visita
    if (filterVisitata) {
      list = list.filter(res => rubrica[getRivenditaId(res)]?.visitata === filterVisitata);
    }

    // Filtro Ordini da Evadere
    if (filterOrdine) {
      list = list.filter(res => {
        const extra = rubrica[getRivenditaId(res)];
        return extra?.richiestaOrdine === true && extra?.ordineEvaso !== true;
      });
    }

    return list;
  }, [activeTab, results, giroVisiteList, crmList, storeList, ripList, rivenditaFilter, comuneFilter, capFilter, rubricaFilterStato, filterVisitata, filterOrdine, rubrica]);

  const getSortedList = useMemo(() => {
    const list = getCurrentList;
    if (activeTab === 'search') return list;
    
    const getDateTime = (dateStr?: string, timeStr?: string) => {
      if (!dateStr) return Infinity;
      const date = new Date(dateStr);
      if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          date.setHours(hours, minutes, 0, 0);
        }
      }
      return date.getTime();
    };

    return [...list].sort((a, b) => {
      if (rubricaSort === 'none') return 0;
      const extraA = rubrica[getRivenditaId(a)];
      const extraB = rubrica[getRivenditaId(b)];
      
      if (rubricaSort === 'dataVisitaAsc') {
        return getDateTime(extraA?.dataVisita, extraA?.oraVisita) - getDateTime(extraB?.dataVisita, extraB?.oraVisita);
      }
      if (rubricaSort === 'dataRivisitaAsc') {
        return getDateTime(extraA?.dataRivisita, extraA?.oraRivisita) - getDateTime(extraB?.dataRivisita, extraB?.oraRivisita);
      }
      return 0;
    });
  }, [getCurrentList, activeTab, rubricaSort, rubrica]);

  const exportToCSV = useCallback(() => {
    const listToExport = getSortedList;
    if (listToExport.length === 0) return;

    const headers = [
      'Provincia', 'Comune', 'Num. Rivendita', 'Indirizzo', 'Tipo', 'Stato Rivendita',
      'Stato Contatto', 'Visitata', 'Data Visita', 'Ora Visita', 'Data Rivisita', 'Ora Rivisita', 'Giorno Levata',
      'Riferimento', 'Telefono', 'P. IVA', 'Mail', 'Richiesta Ordine', 'Note Ordine', 'Data Ordine', 'Ordine Evaso'
    ];

    const rows = listToExport.map((res) => {
      const id = getRivenditaId(res);
      const extra = rubrica[id] || {
        stato: '', visitata: '', giornoLevata: '', riferimento: '', telefono: '', pIva: '', mail: ''
      };
      
      return [
        res['Prov.'] || '',
        res['Comune'] || '',
        res['Num. Rivendita'] || res.storeNumber || '',
        `"${res['Indirizzo'] || ''}"`,
        `"${res['Tipo Rivendita'] || ''}"`,
        `"${res['Stato'] || ''}"`,
        `"${extra.stato || ''}"`,
        `"${extra.visitata || ''}"`,
        `"${extra.dataVisita || ''}"`,
        `"${extra.oraVisita || ''}"`,
        `"${extra.dataRivisita || ''}"`,
        `"${extra.oraRivisita || ''}"`,
        `"${extra.giornoLevata || ''}"`,
        `"${extra.riferimento || ''}"`,
        `"${extra.telefono || ''}"`,
        `"${extra.pIva || ''}"`,
        `"${extra.mail || ''}"`,
        `"${extra.richiestaOrdine ? 'Sì' : 'No'}"`,
        `"${extra.noteOrdine || ''}"`,
        `"${extra.dataOrdine || ''}"`,
        `"${extra.ordineEvaso ? 'Sì' : 'No'}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dataOggi = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `TgesT_Export_${activeTab}_${dataOggi}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [getSortedList, rubrica, activeTab]);

  const handleStoreUpdate = useCallback((id: string, field: string, value: any) => {
    setStores(prev => prev.map(s => getRivenditaId(s) === id ? { ...s, [field]: value } : s));
  }, []);

  const handleCreateStore = useCallback((newStore: Partial<SearchResult>) => {
    // Controllo Anti-Doppione: verifica se esiste già in quel Comune con lo stesso Numero
    const isDuplicate = stores.some(s => 
      s['Comune']?.toUpperCase() === newStore['Comune']?.toUpperCase() && 
      (s.storeNumber === newStore.storeNumber || s['Num. Rivendita'] === newStore['Num. Rivendita'])
    );

    if (isDuplicate) {
      showToast(`Errore: Esiste già uno Store n° ${newStore.storeNumber || newStore['Num. Rivendita']} a ${newStore['Comune']?.toUpperCase()}`, 'error');
      return; // Blocca la creazione
    }

    const storeWithUid: SearchResult = {
      'Prov.': '',
      'Comune': '',
      'Num. Rivendita': '',
      'Indirizzo': '',
      ...newStore,
      uid: `store_${Date.now()}`,
      isStore: true
    } as SearchResult;

    setStores(prev => [...prev, storeWithUid]);
    setShowCreateStoreModal(false);
    showToast('Store creato con successo!', 'success');
  }, [stores, showToast]);

  const orderStats = useMemo(() => {
    const allEntries = Object.entries(rubrica) as [string, RivenditaExtra][];
    const mapEntry = (id: string, data: any) => {
      const riv = [...crmAnagrafiche, ...stores, ...giroVisite].find(r => getRivenditaId(r) === id);
      return { 
        id, 
        nome: riv?.isStore ? (riv.storeName || 'Store') : `Riv. ${riv?.['Num. Rivendita']}`,
        soloNumero: riv?.isStore ? (riv.storeNumber || '') : (riv?.['Num. Rivendita'] || ''),
        comune: riv?.['Comune'] || '',
        dataOrdine: data.dataOrdine,
        note: data.noteOrdine || 'Nessuna nota'
      };
    };

    const daEvadereList = allEntries
      .filter(([_, d]) => d.richiestaOrdine === true && d.ordineEvaso !== true && isDateInRange(d.dataOrdine || d.dataVisita))
      .map(([id, d]) => mapEntry(id, d)).filter(o => o.nome);

    const evasiList = allEntries
      .filter(([_, d]) => d.ordineEvaso === true && isDateInRange(d.dataOrdine || d.dataVisita))
      .map(([id, d]) => mapEntry(id, d)).filter(o => o.nome);

    return { daEvadere: daEvadereList.length, evasi: evasiList.length, listaDaEvadere: daEvadereList, listaEvasi: evasiList };
  }, [rubrica, crmAnagrafiche, stores, giroVisite, statsPeriod, customRange]);

  const crmStats = useMemo(() => {
    let attivate = 0, nonAttive = 0, bassoRendente = 0, rip = 0, daAssegnare = 0;
    const combined = [...crmAnagrafiche, ...stores];
    
    // Filtriamo per conversione nel periodo
    const filtrati = combined.filter(r => {
      const id = getRivenditaId(r);
      const data = rubrica[id];
      if (!data) return false;
      return isDateInRange(data.dataVisita || data.lastDataVisita || data.dataOrdine);
    });

    filtrati.forEach(r => {
      const s = rubrica[getRivenditaId(r)]?.stato;
      if (s === 'Attivata') attivate++;
      else if (s === 'Non Attiva') nonAttive++;
      else if (s === 'Basso Rendente') bassoRendente++;
      else if (s === 'RIP') rip++;
      else daAssegnare++;
    });
    return { total: filtrati.length, attivate, nonAttive, bassoRendente, rip, daAssegnare };
  }, [crmAnagrafiche, stores, rubrica, statsPeriod, customRange]);

  const visitStats = useMemo(() => {
    const combined = [...crmAnagrafiche, ...stores];
    const listaVisitate: any[] = [];
    const prossimi: any[] = [];
    const oggi = new Date(); oggi.setHours(0,0,0,0);

    combined.forEach(r => {
      const id = getRivenditaId(r);
      const d = rubrica[id] as RivenditaExtra;
      const infoBase = {
        id,
        nome: r.isStore ? (r.storeName || 'Store') : `Riv. ${r['Num. Rivendita']}`,
        soloNumero: r.isStore ? (r.storeNumber || '') : (r['Num. Rivendita'] || ''),
        comune: r.Comune
      };
      
      if (d?.dataVisita && isDateInRange(d.dataVisita)) {
        listaVisitate.push({ ...infoBase, data: new Date(d.dataVisita).toLocaleDateString('it-IT').slice(0, 5) });
      }

      if (d?.dataRivisita) {
        const [y, m, day] = d.dataRivisita.split('-').map(Number);
        const dr = new Date(y, m - 1, day);
        if (dr >= oggi || (dr < oggi && d.visitata !== 'Si')) {
          prossimi.push({ ...infoBase, dataRivisita: d.dataRivisita, ora: d.oraRivisita || '', dateObj: dr, isOverdue: dr < oggi });
        }
      }
    });

    return { 
      vPeriodo: listaVisitate.length, 
      listaVisitate, 
      prossimi: prossimi.sort((a,b) => a.dateObj.getTime() - b.dateObj.getTime()).slice(0, 10), 
      rimanentiGiro: giroVisite.filter(r => (rubrica[getRivenditaId(r)] as RivenditaExtra)?.visitata !== 'Si').length 
    };
  }, [rubrica, crmAnagrafiche, stores, giroVisite, statsPeriod, customRange]);

  const sortedList = getSortedList;

  const cardProps = useMemo(() => ({
    activeTab,
    expandedCardId,
    enrichingId,
    toggleSave,
    removeFromCrm,
    initiateVisitToggle,
    handleRubricaUpdate,
    toggleExpandCard,
    handleEnrich,
    addToCrm,
    setExpandedCardId,
    handleStoreUpdate,
    removeStore,
    moveCard,
    setShareModal,
    openRevisitModal: setRevisitModalId
  }), [
    activeTab,
    expandedCardId,
    enrichingId,
    toggleSave,
    removeFromCrm,
    initiateVisitToggle,
    handleRubricaUpdate,
    toggleExpandCard,
    handleEnrich,
    addToCrm,
    handleStoreUpdate,
    removeStore,
    moveCard
  ]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 z-30">
        <div className="max-w-md mx-auto px-3 py-3">
          <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden p-1 scroll-smooth [webkit-overflow-scrolling:touch] [transform:translateZ(0)] [will-change:scroll-position] whitespace-nowrap">
            <button
              id="tab-search"
              onClick={() => handleTabChange('search')}
              className={`flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all ${
                activeTab === 'search' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Search className="w-4 h-4" />
              Cerca
            </button>
            <button
              id="tab-giro"
              onClick={() => handleTabChange('giro')}
              className={`flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all ${
                activeTab === 'giro' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Navigation className="w-4 h-4" />
              Giro ({giroVisiteList.length})
            </button>
            <button
              id="tab-crm"
              onClick={() => handleTabChange('crm')}
              className={`flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all ${
                activeTab === 'crm' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              CRM ({crmList.length})
            </button>
            <button
              id="tab-store"
              onClick={() => handleTabChange('store')}
              className={`flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all ${
                activeTab === 'store' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Store className="w-4 h-4" />
              Store ({storeList.length})
            </button>
            
            {provincesInCrm.map(prov => (
              <button
                key={prov}
                id={`tab-prov_${prov}`}
                onClick={() => handleTabChange(`prov_${prov}`)}
                className={`flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all ${
                  activeTab === `prov_${prov}` ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <MapPin className="w-4 h-4" />
                {prov}
              </button>
            ))}

            <button
              id="tab-rip"
              onClick={() => handleTabChange('rip')}
              className={`flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all ${
                activeTab === 'rip' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              RIP ({ripList.length})
            </button>

            <button
              id="tab-statistiche"
              onClick={() => { setActiveTab('statistiche'); setRivenditaFilter(''); setComuneFilter(''); window.scrollTo(0,0); }}
              className={`flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all ${
                activeTab === 'statistiche' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              Statistiche
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-md mx-auto p-4 space-y-6 overflow-hidden">
        <div 
          className="min-h-[calc(100vh-140px)]"
          onTouchStart={(e) => {
            (window as any).touchStartX = e.touches[0].clientX;
            (window as any).touchStartY = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const deltaX = (window as any).touchStartX - touchEndX;
            const deltaY = (window as any).touchStartY - touchEndY;
            
            // Solo se lo swipe è prevalentemente orizzontale e supera la soglia
            if (Math.abs(deltaX) > Math.abs(deltaY) * 2 && Math.abs(deltaX) > 100) {
              handleSwipe(deltaX > 0 ? 'left' : 'right');
            }
          }}
        >
        {activeTab === 'search' ? (
          <>
            {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
              Regione <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedRegion}
              onChange={handleRegionChange}
              disabled={loading || regions.length === 0}
              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all disabled:opacity-50 text-base"
            >
              <option value="">Seleziona</option>
              {regions.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
              Provincia <span className="text-red-500">*</span>
              {loadingOptions && !selectedProvince && <Loader2 className="w-3 h-3 animate-spin text-brand-500 ml-2" />}
            </label>
            <select
              value={selectedProvince}
              onChange={handleProvinceChange}
              disabled={loading || !selectedRegion || provinces.length === 0}
              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all disabled:opacity-50 text-base"
            >
              <option value="">Seleziona</option>
              {provinces.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
              Comune
              {loadingOptions && selectedProvince && !selectedComune && <Loader2 className="w-3 h-3 animate-spin text-brand-500 ml-2" />}
            </label>
            <select
              value={selectedComune}
              onChange={(e) => setSelectedComune(e.target.value)}
              disabled={loading || !selectedProvince || comuni.length === 0}
              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all disabled:opacity-50 text-base"
            >
              <option value="">Seleziona</option>
              {comuni.map((c, idx) => (
                <option 
                  key={`${c.value}-${idx}`} 
                  value={c.value}
                  disabled={c.value === 'separator'}
                >
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Numero rivendita</label>
            <input
              type="text"
              value={numRivendita}
              onChange={(e) => setNumRivendita(e.target.value)}
              disabled={loading}
              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all disabled:opacity-50 text-base"
              placeholder="Es. 12"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Tipo</label>
              <select
                value={tipoRiv}
                onChange={(e) => setTipoRiv(e.target.value)}
                disabled={loading}
                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all disabled:opacity-50 text-base"
              >
                <option value="">Tutti</option>
                <option value="1">ORDINARIA</option>
                <option value="2">SPECIALE</option>
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Stato</label>
              <select
                value={statoRiv}
                onChange={(e) => setStatoRiv(e.target.value)}
                disabled={loading}
                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all disabled:opacity-50 text-base"
              >
                <option value="">Tutti</option>
                <option value="1">ATTIVA</option>
                <option value="2">SOSPESA DAL SERVIZIO</option>
                <option value="3">CHIUSA</option>
                <option value="5">VACANTE</option>
                <option value="6">IN SOSPENSIONE DEI GENERI</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !selectedRegion || !selectedProvince}
              className="w-full h-14 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-200"
            >
              {loading && !loadingOptions ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              Cerca Rivendite
            </button>
          </div>
          
          <div className="bg-brand-50/50 p-3 rounded-lg flex gap-2 items-start mt-4">
            <Info className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
            <p className="text-xs text-brand-800 leading-relaxed">
              I campi contrassegnati con l'asterisco (*) sono obbligatori.<br/>
              Nota: con la dizione "In sospensione dei generi" si intende la temporanea sospensione della commercializzazione di alcune tipologie e prodotti del tabacco.
            </p>
          </div>
        </form>
            {/* Results */}
            {results !== null && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-lg font-semibold text-slate-800">
                    Risultati ({results.length})
                  </h2>
                </div>
                
                {results.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl text-center border border-slate-100 shadow-sm">
                    <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Nessuna rivendita trovata con questi criteri.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedList.map((res, idx) => {
                      const id = getRivenditaId(res);
                      const extra = rubrica[id] || { stato: '', visitata: '', giornoLevata: '', riferimento: '', telefono: '', pIva: '', mail: '', manualCap: '' };
                      const capToDisplay = extra.manualCap || res['CAP'] || res['Cap'] || '';
                      return (
                        <RivenditaCard
                          key={id}
                          res={res}
                          idx={idx}
                          isInGiro={isSaved(res)}
                          extra={extra}
                          enrichedDetails={enrichedData[id]}
                          rubrica={expandedCardId === id ? rubrica : undefined}
                          {...cardProps}
                        />
                      );
                    })}
                  </div>
                )}

                {pagination && (pagination.totalPages > 1 || pagination.currentText.includes('di')) && (
                  <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mt-6">
                    <button
                      onClick={() => handlePageChange('prev')}
                      disabled={loading || pagination.currentPage <= 1}
                      className="p-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-xl transition-all"
                    >
                      <ChevronRight className="w-6 h-6 rotate-180" />
                    </button>
                    
                    <div className="text-sm font-medium text-slate-600">
                      {pagination.currentText || `Pagina ${pagination.currentPage}`}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange('next')}
                      disabled={loading || (pagination.totalPages > 0 && pagination.currentPage >= pagination.totalPages)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-xl transition-all"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-4 px-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">
                  {activeTab === 'giro' ? `Giro Visite (${giroVisiteList.length})` : 
                   activeTab === 'crm' ? `CRM (${crmList.length})` : 
                   activeTab === 'store' ? `Store (${storeList.length})` :
                   activeTab === 'rip' ? `RIP (${ripList.length})` : 
                   `${activeTab.replace('prov_', '')} (${getCurrentList.length})`}
                </h2>
                {activeTab === 'store' && (
                  <button
                    onClick={() => setShowCreateStoreModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white hover:bg-brand-700 rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-100 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aggiungi Store
                  </button>
                )}
                {activeTab === 'giro' && giroVisite.length > 0 && (
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl shadow-sm border border-slate-200">
                    {/* Toggle Mappa/Lista Unificato */}
                    <button onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')} className={`p-2 rounded-lg transition-all ${viewMode === 'map' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} title={viewMode === 'map' ? 'Torna alla Lista' : 'Vedi Mappa'}>
                      {viewMode === 'map' ? <List className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                    </button>
                    <div className="w-px h-5 bg-slate-300 mx-1"></div>
                    {/* My Maps */}
                    <button onClick={exportGiroForMyMaps} className="p-2 rounded-lg text-emerald-600 hover:bg-white hover:shadow-sm transition-all" title="Esporta per My Maps">
                      <Download className="w-4 h-4" />
                    </button>
                    {/* Svuota Giro */}
                    <button onClick={() => setShowClearGiroConfirmModal(true)} className="p-2 rounded-lg text-red-500 hover:bg-white hover:shadow-sm transition-all" title="Svuota Giro">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {activeTab !== 'giro' && getCurrentList.length > 0 && (
                  null
                )}
              </div>

              {/* Filtri Comuni */}
              {activeTab !== 'statistiche' && (
                <div className="flex flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Num. Riv."
                      value={rivenditaFilter}
                      onChange={(e) => setRivenditaFilter(e.target.value)}
                      className="w-full h-11 pl-9 pr-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm shadow-sm"
                    />
                  </div>

                  <div className="relative flex-[1.5]">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={comuneFilter}
                      onChange={(e) => setComuneFilter(e.target.value)}
                      className="w-full h-11 pl-9 pr-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm shadow-sm appearance-none"
                    >
                      <option value="">Tutti i Comuni</option>
                      {getUniqueComuniForTab().map(comune => (
                        <option key={comune} value={comune}>{comune}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {getBaseListLength() > 0 && activeTab !== 'search' && activeTab !== 'giro' && (
              <div className="mt-2 bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden transition-all shadow-sm mx-1">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="w-full flex items-center justify-between p-3 text-brand-700 font-bold text-xs uppercase tracking-wider hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5" /> Filtri Avanzati
                    {/* Indicatore luminoso se c'è almeno un filtro attivo */}
                    {(rubricaFilterStato || filterVisitata || filterOrdine || capFilter || rubricaSort !== 'none') && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                      </span>
                    )}
                  </div>
                  {showFilters ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                
                {showFilters && (
                  <div className="p-3 pt-0 grid grid-cols-2 gap-3 border-t border-slate-100 mt-1 pt-3 bg-white/50">
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">C.A.P.</label>
                      <input
                        type="text"
                        placeholder="Es. 00100"
                        value={capFilter}
                        onChange={(e) => setCapFilter(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium shadow-sm placeholder:text-slate-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Stato CRM</label>
                      <select
                        value={rubricaFilterStato}
                        onChange={(e) => setRubricaFilterStato(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium shadow-sm"
                      >
                        <option value="">Tutti</option>
                        <option value="Attivata">Attivata</option>
                        <option value="Non Attiva">Non Attiva</option>
                        <option value="Basso Rendente">Basso Rendente</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Visite</label>
                      <select
                        value={filterVisitata}
                        onChange={(e) => setFilterVisitata(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium shadow-sm"
                      >
                        <option value="">Tutte</option>
                        <option value="Si">Visitate</option>
                        <option value="Da Rivisitare">Da Rivisitare</option>
                        <option value="No">Non Visitate</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Ordini</label>
                      <select
                        value={filterOrdine ? 'true' : 'false'}
                        onChange={(e) => setFilterOrdine(e.target.value === 'true')}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium shadow-sm"
                      >
                        <option value="false">Tutti</option>
                        <option value="true">Da Evadere ⏳</option>
                      </select>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Ordina per</label>
                      <select
                        value={rubricaSort}
                        onChange={(e) => setRubricaSort(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium shadow-sm"
                      >
                        <option value="none">Nessun ordine</option>
                        <option value="dataVisitaAsc">Ultima Visita</option>
                        <option value="dataRivisitaAsc">Prossimo Appuntamento</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'statistiche' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-bold text-slate-800 px-1">Le tue Statistiche</h2>

                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 space-y-3">
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    {['oggi', '7g', '30g', 'all', 'custom'].map((p) => (
                      <button key={p} onClick={() => setStatsPeriod(p as any)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg capitalize transition-all ${statsPeriod === p ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                        {p === 'all' ? 'Sempre' : p}
                      </button>
                    ))}
                  </div>
                  
                  {statsPeriod === 'custom' && (
                    <div className="flex gap-2 animate-in fade-in zoom-in-95">
                      <input type="date" value={customRange.start} onChange={(e) => setCustomRange(prev => ({...prev, start: e.target.value}))} className="flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                      <input type="date" value={customRange.end} onChange={(e) => setCustomRange(prev => ({...prev, end: e.target.value}))} className="flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                    </div>
                  )}
                </div>
                
    {/* 1. RIEPILOGO ATTIVITÀ (CON BADGE ESTERNI v2.25) */}
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <button 
        onClick={() => setStatsRadarOpen(!statsRadarOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
            <Activity className="w-4 h-4 text-pink-600" />
          </div>
          <h3 className="font-bold text-slate-800">Riepilogo Attività</h3>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Badge visibili anche quando chiuso */}
          {!statsRadarOpen && (
            <div className="flex gap-1.5 animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg text-[10px] font-black border border-emerald-200">
                {visitStats.vPeriodo}
              </div>
              <div className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-lg text-[10px] font-black border border-orange-200">
                {visitStats.rimanentiGiro}
              </div>
            </div>
          )}
          {statsRadarOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </button>

      {statsRadarOpen && (
        <div className="p-5 pt-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Visite Completate</p>
              <p className="text-2xl font-black text-emerald-900">{visitStats.vPeriodo}</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100">
              <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">Rimanenti nel Giro</p>
              <p className="text-2xl font-black text-orange-900">{visitStats.rimanentiGiro}</p>
            </div>
          </div>

          {/* LISTA VISITE COMPLETATE (RINOMINATA) */}
          {visitStats.listaVisitate.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mt-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Storico Visite</h4>
              {visitStats.listaVisitate.map((v: any) => (
                <div key={v.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{v.nome}</p>
                    <p className="text-[10px] text-slate-500">{v.comune} • {v.data}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <button 
                      onClick={() => { setRivenditaFilter(v.soloNumero); setActiveTab('crm'); }} 
                      className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-400 italic text-center py-4">Nessuna visita salvata.</p>
          )}
        </div>
      )}
    </div>

    {/* 2. AGENDA (FIX EVIDENZIAZIONE OGGI v2.25) */}
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
          <CalendarClock className="w-4 h-4 text-orange-600" />
        </div>
        <h3 className="font-bold text-slate-800">Agenda</h3>
      </div>
      <div className="space-y-3">
        {visitStats.prossimi.length > 0 ? (
          visitStats.prossimi.map((p: any) => {
            // Convertiamo la stringa ISO (YYYY-MM-DD) in un oggetto data
            // Usiamo split e new Date(y, m-1, d) per evitare problemi di fuso orario
            const [year, month, day] = p.dataRivisita.split('-').map(Number);
            const dObj = new Date(year, month - 1, day);
            
            const dataIT = dObj.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const oggiIT = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            const isToday = dataIT === oggiIT;
            const isOverdue = p.isOverdue;

            return (
              <div key={p.id} className={`p-3 rounded-xl border transition-all ${
                isToday ? 'bg-orange-100 border-orange-400 shadow-md ring-1 ring-orange-200' : 
                isOverdue ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-100'
              }`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${isToday ? 'text-orange-900' : isOverdue ? 'text-red-900' : 'text-slate-800'}`}>
                      {p.nome} - {p.comune}
                    </p>
                    <p className={`text-[10px] font-bold flex items-center gap-1 mt-1 ${isToday ? 'text-orange-700' : isOverdue ? 'text-red-600' : 'text-orange-600'}`}>
                      <CalendarClock className="w-3 h-3"/> {dataIT} {p.ora} 
                      {isToday && ' • OGGI'}
                      {isOverdue && ' • DA RECUPERARE'}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={() => {
                      const riv = [...crmAnagrafiche, ...stores].find(r => getRivenditaId(r) === p.id);
                      if (riv && !giroVisite.some(g => getRivenditaId(g) === p.id)) {
                        setGiroVisite(prev => [...prev, riv]);
                        showToast('Aggiunta al giro');
                      }
                    }}
                    className="flex-1 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Giro
                  </button>
                  <button 
                    onClick={() => { setRivenditaFilter(p.soloNumero); setActiveTab('crm'); }} 
                    className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-[10px] text-slate-400 italic text-center py-4">Nessuna rivisita programmata.</p>
        )}
      </div>
    </div>

    {/* 3. RACCOLTA ORDINI (RIPRISTINATA v2.26) */}
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <button onClick={() => setStatsOrdiniOpen(!statsOrdiniOpen)} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><ClipboardList className="w-4 h-4 text-blue-600" /></div>
          <h3 className="font-bold text-slate-800">Raccolta Ordini</h3>
        </div>
        {!statsOrdiniOpen && orderStats.daEvadere > 0 && (
          <div className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg text-[10px] font-black border border-blue-200">{orderStats.daEvadere}</div>
        )}
      </button>
      
      {statsOrdiniOpen && (
        <div className="p-5 pt-0 space-y-6">
          {/* LISTA DA EVADERE */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Da Evadere ({orderStats.daEvadere})</h4>
            {orderStats.listaDaEvadere.length > 0 ? (
              orderStats.listaDaEvadere.map((o: any) => (
                <div key={o.id} className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{o.nome}</p>
                    <button 
                      onClick={() => { setRivenditaFilter(o.soloNumero); setActiveTab('crm'); }} 
                      className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-2">{o.comune}</p>
                  <div className="bg-white/50 p-2 rounded-lg border border-blue-50">
                    <p className="text-[10px] font-medium text-slate-600 italic">Note: {o.note}</p>
                  </div>
                </div>
              ))
            ) : <p className="text-[10px] text-slate-400 italic">Nessun ordine da evadere.</p>}
          </div>

          {/* LISTA EVASI */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Ordini Evasi ({orderStats.evasi})</h4>
            {orderStats.listaEvasi.map((o: any) => (
              <div key={o.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl opacity-75">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{o.nome}</p>
                    <p className="text-[10px] text-slate-500">{o.comune} • {o.note}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <button 
                      onClick={() => { setRivenditaFilter(o.soloNumero); setActiveTab('crm'); }} 
                      className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

                {/* 4. TERMOMETRO DEL TERRITORIO */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                  <button 
                    onClick={() => setStatsTerritorioOpen(!statsTerritorioOpen)}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <Target className="w-4 h-4 text-indigo-600" />
                      </div>
                      <h3 className="font-bold text-slate-800">Termometro Territorio</h3>
                    </div>
                    {statsTerritorioOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </button>

                  {statsTerritorioOpen && (
                    <div className="p-5 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-200">
                      {crmStats.total > 0 ? (
                        <>
                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mt-2">
                            {crmStats.attivate > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(crmStats.attivate / crmStats.total) * 100}%` }}></div>}
                            {crmStats.nonAttive > 0 && <div className="h-full bg-amber-400" style={{ width: `${(crmStats.nonAttive / crmStats.total) * 100}%` }}></div>}
                            {crmStats.bassoRendente > 0 && <div className="h-full bg-orange-500" style={{ width: `${(crmStats.bassoRendente / crmStats.total) * 100}%` }}></div>}
                            {crmStats.rip > 0 && <div className="h-full bg-slate-800" style={{ width: `${(crmStats.rip / crmStats.total) * 100}%` }}></div>}
                            {crmStats.daAssegnare > 0 && <div className="h-full bg-slate-300" style={{ width: `${(crmStats.daAssegnare / crmStats.total) * 100}%` }}></div>}
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span className="text-xs font-bold text-slate-600">Attivate</span></div>
                              <span className="font-black text-slate-800">{crmStats.attivate}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div><span className="text-xs font-bold text-slate-600">Non Attive</span></div>
                              <span className="font-black text-slate-800">{crmStats.nonAttive}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div><span className="text-xs font-bold text-slate-600 truncate max-w-[70px]">Basso Rend.</span></div>
                              <span className="font-black text-slate-800">{crmStats.bassoRendente}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div><span className="text-xs font-bold text-slate-600">RIP</span></div>
                              <span className="font-black text-slate-800">{crmStats.rip}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500 italic text-center py-4">Nessun dato presente nel CRM.</p>
                      )}
                    </div>
                  )}
                </div>

              </div>
            ) : activeTab === 'giro' ? (
              viewMode === 'map' ? (
                <MapView results={getCurrentList} />
              ) : getCurrentList.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl text-center border border-slate-100 shadow-sm space-y-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                    <BookOpen className="w-10 h-10 text-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-800 font-bold">Nessun dato</p>
                    <p className="text-slate-500 text-sm">Non ci sono elementi che corrispondono ai criteri di ricerca.</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl text-sm shadow-md shadow-brand-100 active:scale-95 transition-all"
                  >
                    Vai alla ricerca
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {getCurrentList.map((res: SearchResult) => {
                    const id = getRivenditaId(res);
                    const originalIdx = giroVisite.findIndex(r => getRivenditaId(r) === id);
                    const extra = rubrica[id] || { stato: '', visitata: '', giornoLevata: '', riferimento: '', telefono: '', pIva: '', mail: '', manualCap: '' };
                    return (
                      <div key={id}>
                        <RivenditaCard 
                          res={{...res, _giroLength: giroVisite.length}} 
                          idx={originalIdx} 
                          isCrmTab={false}
                          isInGiro={true}
                          extra={extra}
                          enrichedDetails={enrichedData[id]}
                          rubrica={expandedCardId === id ? rubrica : undefined}
                          {...cardProps}
                        />
                      </div>
                    );
                  })}
                </div>
              )
            ) : getSortedList.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl text-center border border-slate-100 shadow-sm space-y-4">
                <p className="text-slate-500 text-sm">Nessuna rivendita trovata con i filtri selezionati.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {getSortedList.map((res: SearchResult, idx: number) => {
                  const id = getRivenditaId(res);
                  const extra = rubrica[id] || { stato: '', visitata: '', giornoLevata: '', riferimento: '', telefono: '', pIva: '', mail: '', manualCap: '' };
                  return (
                    <div key={id}>
                      <RivenditaCard 
                        res={res}
                        idx={idx}
                        isCrmTab={activeTab !== 'giro'}
                        isInGiro={isSaved(res)}
                        extra={extra}
                        enrichedDetails={enrichedData[id]}
                        rubrica={expandedCardId === id ? rubrica : undefined}
                        {...cardProps}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </main>

      {/* Multi-Function Floating Action Button (FAB) v2.13 */}
      <div className="fixed bottom-6 right-6 z-40 h-16 w-16">
        {/* Overlay scuro sullo sfondo quando il menu è aperto (opzionale, decommenta se desiderato) */}
        {/* fabMenuOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[-1]" onClick={() => setFabMenuOpen(false)}></div> */}

        {/* Contenitore pulsanti satellite - Posizionamento Assoluto rispetto al baricentro */}
        <div className={`absolute bottom-[72px] right-1 flex flex-col-reverse items-center gap-3 transition-all duration-300 origin-bottom ${fabMenuOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'}`}>
          {/* CSV */}
          <button onClick={() => { exportToCSV(); setFabMenuOpen(false); }} disabled={getSortedList.length === 0} className="w-12 h-12 flex items-center justify-center bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50" title="Esporta CSV">
            <Download className="w-5 h-5" />
          </button>
          {/* Reset */}
          <button onClick={() => { handleReset(); setFabMenuOpen(false); }} className="w-12 h-12 flex items-center justify-center bg-slate-700 text-white rounded-full shadow-lg hover:bg-slate-600 active:scale-95 transition-all" title="Reset Ricerca">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {/* Settings */}
          <button onClick={() => { setShowSettingsModal(true); setFabMenuOpen(false); }} className="w-12 h-12 flex items-center justify-center bg-white text-slate-700 border border-slate-200 rounded-full shadow-lg hover:bg-slate-50 active:scale-95 transition-all" title="Impostazioni">
            <Settings className="w-5 h-5" />
          </button>
          {/* Sync */}
          <button onClick={handleFabSyncGenerate} disabled={fabSyncLoading} className="w-12 h-12 flex items-center justify-center bg-brand-600 text-white rounded-full shadow-lg hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50" title="Sync Volante">
            {fabSyncLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
          </button>
        </div>

        {/* Pulsante Trigger Principale (Il baricentro) */}
        <button
          onClick={() => setFabMenuOpen(!fabMenuOpen)}
          className={`absolute bottom-0 right-0 h-14 w-14 flex items-center justify-center p-3.5 bg-slate-800 text-white rounded-full shadow-xl hover:bg-slate-700 transition-all duration-300 ease-in-out ${fabMenuOpen ? 'rotate-45 bg-slate-600 shadow-none' : ''}`}
          title={fabMenuOpen ? "Chiudi Menu" : "Azioni Rapide"}
        >
          {fabMenuOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* Confirm Visit Modal */}
      {showConfirmVisitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Conferma Visita</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Sei sicuro di voler registrare la visita per questa rivendita in questo momento?
              </p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmVisitModal(false);
                  setPendingVisitId(null);
                }}
                className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-100 transition-all"
              >
                Annulla
              </button>
              <button
                onClick={confirmVisit}
                className="flex-1 py-3 px-4 bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-100 active:scale-95 transition-all"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Clear Giro Modal */}
      {showClearGiroConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Svuota Giro Visite</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Sei sicuro di voler svuotare l'intero giro visite? Questa azione non può essere annullata.
              </p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button
                onClick={() => setShowClearGiroConfirmModal(false)}
                className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-100 transition-all"
              >
                Annulla
              </button>
              <button
                onClick={clearGiro}
                className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-red-100 active:scale-95 transition-all"
              >
                Svuota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revisit Modal */}
      {revisitModalId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-brand-600 mb-2">
                <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Programma / Modifica Appuntamento</h3>
              </div>
              
              <p className="text-sm text-slate-600 leading-relaxed">
                Imposta o modifica la data e l'ora del prossimo appuntamento per questa rivendita.
              </p>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data Prossima Visita</label>
                  <input
                    type="date"
                    value={rubrica[revisitModalId]?.dataRivisita || ''}
                    onChange={(e) => handleRubricaUpdate(revisitModalId, 'dataRivisita', e.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ora Appuntamento</label>
                  <select
                    value={rubrica[revisitModalId]?.oraRivisita || ''}
                    onChange={(e) => handleRubricaUpdate(revisitModalId, 'oraRivisita', e.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                  >
                    <option value="">Seleziona Ora</option>
                    {getAvailableTimes(rubrica[revisitModalId]?.dataRivisita || '', revisitModalId, rubrica).map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setRevisitModalId(null)}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-2xl text-sm hover:bg-slate-200 active:scale-95 transition-all"
                >
                  Chiudi
                </button>
                <button
                  onClick={() => setRevisitModalId(null)}
                  className="flex-1 py-3.5 bg-brand-600 text-white font-bold rounded-2xl text-sm shadow-lg shadow-brand-100 hover:bg-brand-700 active:scale-95 transition-all"
                >
                  Salva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings & Backup Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
            
            {/* Header Fisso del Modal */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-slate-900">Impostazioni</h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            {/* Corpo Scorrevole */}
            <div className="p-5 overflow-y-auto space-y-6">
              <button
                onClick={() => setShowGuideModal(true)}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-2xl shadow-md hover:opacity-95 transition-all mb-4"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-6 h-6" />
                  <div className="text-left">
                    <h4 className="font-bold">Manuale d'Uso</h4>
                    <p className="text-xs text-brand-100">Scopri come usare tutte le funzioni</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100">
                <h4 className="text-sm font-bold text-brand-800 mb-2 flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  Sync Volante (PC ↔ Telefono)
                </h4>
                <p className="text-[11px] text-brand-600 mb-4 leading-relaxed">
                  Trasferisci i tuoi dati tra dispositivi in un lampo. Genera un codice su un dispositivo e inseriscilo nell'altro.
                </p>
                
                <div className="space-y-3">
                  {generatedSyncCode ? (
                    <div className="p-3 bg-white border border-brand-200 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Il tuo Codice Cloud</span>
                      <div className="font-mono text-[11px] sm:text-sm font-black text-brand-700 select-all tracking-wider break-all">{generatedSyncCode}</div>
                      <p className="text-[10px] text-brand-500 mt-1">Copiato negli appunti! Incollalo sull'altro dispositivo.</p>
                    </div>
                  ) : (
                    <button
                      onClick={handleGenerateSyncCode}
                      disabled={isSyncing}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white font-bold rounded-xl text-sm hover:bg-brand-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                    >
                      {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Genera Codice di Invio
                    </button>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-brand-100/50">
                    <input
                      type="text"
                      placeholder="Incolla Codice qui..."
                      value={syncCodeInput}
                      onChange={(e) => setSyncCodeInput(e.target.value)}
                      className="flex-1 h-11 px-3 bg-white border border-brand-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-[11px] font-medium placeholder:text-slate-300"
                    />
                    <button
                      onClick={handleImportFromSyncCode}
                      disabled={isSyncing || !syncCodeInput.trim()}
                      className="px-4 bg-white border border-brand-200 text-brand-700 font-bold rounded-xl text-sm hover:bg-brand-50 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                    >
                      {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Ricevi
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <Save className="w-4 h-4 text-brand-600" />
                  Sicurezza Dati
                </h4>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  I tuoi dati sono salvati localmente. Usa questa funzione se preferisci un salvataggio fisico su file.
                </p>
                
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={handleExportData}
                    className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Esporta Backup (.json)
                  </button>
                  
                  <label 
                    htmlFor="import-backup"
                    className="flex items-center justify-center gap-2 py-3 bg-slate-200 border border-slate-300 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-300 active:scale-95 transition-all shadow-sm cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Importa Backup
                  </label>
                  <input 
                    id="import-backup"
                    type="file" 
                    accept=".json,application/json" 
                    onChange={handleImportData} 
                    className="hidden" 
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Info Sistema
                </h4>
                <div className="space-y-1 text-[11px] text-amber-700">
                  <p>Rivendite Salvate: <span className="font-bold">{crmAnagrafiche.length}</span></p>
                  <p>Spazio Occupato: <span className="font-bold">{storageSize}</span></p>
                  <p>Stato Rete: <span className={`font-bold ${isOnline ? 'text-emerald-600' : 'text-red-600'}`}>{isOnline ? 'Online' : 'Offline'}</span></p>
                  <p>Versione App: <span className="font-bold">{DATA_VERSION}</span></p>
                </div>
              </div>

              <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                <h4 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Zona Pericolo
                </h4>
                <p className="text-[10px] text-red-600 mb-3">
                  Questa azione è irreversibile e cancellerà ogni informazione salvata.
                </p>
                <button
                  onClick={handleClearAllData}
                  className="w-full py-2.5 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 active:scale-95 transition-all shadow-sm"
                >
                  Cancella Tutto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Store Modal */}
      {showCreateStoreModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Nuovo Store</h3>
                <button 
                  onClick={() => setShowCreateStoreModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleCreateStore({
                  'Prov.': (formData.get('prov') as string).toUpperCase(),
                  'Comune': formData.get('comune') as string,
                  'Num. Rivendita': formData.get('num') as string,
                  storeNumber: formData.get('num') as string,
                  'Indirizzo': formData.get('indirizzo') as string,
                  'Tipo Rivendita': formData.get('tipo') as string,
                  'Distr. Automatico': formData.get('distr') as string,
                  storeName: formData.get('storeName') as string,
                  isChain: formData.get('isChain') === 'true',
                  chainCount: parseInt(formData.get('chainCount') as string) || 1
                });
              }} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome Store *</label>
                  <input name="storeName" required placeholder="Es. Svapo World" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold text-brand-700" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Numero Store *</label>
                    <input name="num" required placeholder="Es. 101" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo Attività</label>
                    <select name="isChain" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium">
                      <option value="false">Attività Singola</option>
                      <option value="true">Catena</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Provincia *</label>
                    <input name="prov" required placeholder="Es. MI" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comune *</label>
                    <input name="comune" required placeholder="Es. Milano" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Indirizzo *</label>
                  <input name="indirizzo" required placeholder="Via Roma 1" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo Rivendita</label>
                    <input name="tipo" placeholder="Es. SVAPO STORE" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Distr. Automatico</label>
                    <input name="distr" placeholder="SI/NO" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium" />
                  </div>
                </div>
                
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateStoreModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl text-sm hover:bg-slate-200 transition-all"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-brand-600 text-white font-bold rounded-2xl text-sm shadow-xl shadow-brand-100 hover:bg-brand-700 active:scale-95 transition-all"
                  >
                    Crea Store
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Generic Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className={`w-16 h-16 ${confirmModal.isDestructive ? 'bg-red-100' : 'bg-brand-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                {confirmModal.isDestructive ? (
                  <Trash2 className={`w-8 h-8 text-red-600`} />
                ) : (
                  <AlertCircle className={`w-8 h-8 text-brand-600`} />
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmModal.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-100 transition-all"
              >
                Annulla
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`flex-1 py-3 px-4 ${confirmModal.isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'} text-white font-bold rounded-xl text-sm transition-all shadow-lg`}
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Fallback Modal */}
      {shareModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-8 h-8 text-brand-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Condividi</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">
                Scegli come vuoi condividere le informazioni della rivendita.
              </p>
              
              <div className="space-y-3">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareModal.text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-[#25D366] text-white font-bold rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:opacity-90 transition-all"
                >
                  <MessageCircle className="w-5 h-5" />
                  Invia su WhatsApp
                </a>
                
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareModal.text);
                    showToast('Testo copiato negli appunti');
                    setShareModal({ isOpen: false, text: '' });
                  }}
                  className="w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-200 transition-all"
                >
                  <Copy className="w-5 h-5" />
                  Copia Testo
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-50">
              <button
                onClick={() => setShareModal({ isOpen: false, text: '' })}
                className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-100 transition-all"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-bottom-4 duration-300">
          <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border ${
            toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 
            toast.type === 'error' ? 'bg-red-600 border-red-500' : 
            'bg-slate-800 border-slate-700'
          } text-white`}>
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4" />}
            <span className="text-xs font-bold uppercase tracking-wider">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Changelog Modal */}
      {showChangelog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
                  <RefreshCw className="w-6 h-6 text-brand-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Novità dell'App</h3>
                  <span className="text-sm font-medium text-brand-600">Versione {DATA_VERSION}</span>
                </div>
              </div>
              
              <div className="space-y-4 mb-6 text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100 h-80 overflow-y-auto">
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-brand-500"/> Gestione C.A.P. Manuale</h4>
                  <p className="mt-1">Dato che i server esterni non forniscono il CAP, ora puoi inserirlo manualmente nei dettagli della rivendita. Una volta salvato, comparirà ovunque e potrai usarlo per filtrare le zone!</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5"><Filter className="w-4 h-4 text-brand-500"/> Filtri Avanzati a Scomparsa</h4>
                  <p className="mt-1">I filtri nel CRM ora sono racchiusi in un elegante menu a tendina per salvare spazio sullo schermo. Un led luminoso ti avviserà se hai dei filtri attivi dimenticati.</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5"><GripVertical className="w-4 h-4 text-brand-500"/> Nuovo Ordinamento Giro</h4>
                  <p className="mt-1">Abbiamo sostituito il trascinamento (spesso impreciso sui telefoni) con delle precisissime Frecce Su/Giù per riordinare le tue visite in modo infallibile.</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5"><Phone className="w-4 h-4 text-brand-500"/> Chiamate Rapide One-Tap</h4>
                  <p className="mt-1">I numeri di telefono inseriti manualmente nel CRM ora sono link cliccabili. Sfiorali per far partire immediatamente la chiamata senza fare copia e incolla.</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5"><Layout className="w-4 h-4 text-brand-500"/> FAB Multifunzione</h4>
                  <p className="mt-1">Il tasto in basso a destra ora è un menu animato rapido per Reset, Impostazioni e Sync Volante.</p>
                </div>
              </div>

              <button
                onClick={dismissChangelog}
                className="w-full py-3.5 bg-brand-600 text-white font-bold rounded-2xl text-sm shadow-lg shadow-brand-100 hover:bg-brand-700 active:scale-95 transition-all"
              >
                Ho capito, non mostrare più
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-600" />
                <h3 className="text-lg font-bold text-slate-900">Guida all'App</h3>
              </div>
              <button onClick={() => setShowGuideModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-6 text-sm text-slate-600">
              <section>
                <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><Search className="w-4 h-4"/> 1. Ricerca e Aggiunta</h4>
                <p>Usa la scheda <strong>Cerca</strong> selezionando Regione e Provincia. Usa i filtri (Comune, Numero, ecc.) per restringere i risultati. Clicca sull'icona della <strong>Cartellina</strong> per aggiungere una rivendita al tuo Giro Visite quotidiano.</p>
              </section>
              <section>
                <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><Navigation className="w-4 h-4"/> 2. Il Giro Visite</h4>
                <p>È la tua lista di lavoro. Usa le <strong>Frecce Su/Giù</strong> per riordinare le tappe. Clicca "Naviga" per aprire la mappa. Clicca "Rivendita Visitata" per segnare l'orario del passaggio. Usa il tasto <strong>Esporta My Maps</strong> se vuoi caricare il percorso su PC.</p>
              </section>
              <section>
                <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4"/> 3. CRM e Filtri Avanzati</h4>
                <p>Cliccando <strong>Dettagli</strong> puoi compilare la scheda completa (Referente, P.IVA, richieste d'ordine e <strong>C.A.P.</strong>). Cliccando "Salva nel CRM" la rivendita diventerà permanente. Usa la tendina <strong>Filtri Avanzati</strong> per trovare rapidamente rivendite da visitare o ordini in sospeso.</p>
              </section>
              <section>
                <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><Phone className="w-4 h-4"/> 4. Contatti e Chiamate</h4>
                <p>I numeri di telefono che inserisci nella scheda diventano <strong>link cliccabili</strong> per chiamare all'istante. Se non hai i contatti, usa il tasto "Orari e contatti" per farli cercare all'Intelligenza Artificiale su internet.</p>
              </section>
              <section>
                <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><Share2 className="w-4 h-4"/> 5. Condivisione e Report</h4>
                <p>Il tasto <strong>Condividi</strong> genera un resoconto formattato perfetto per WhatsApp, includendo tutto lo storico delle visite, le note, la P.IVA e lo stato degli ordini da evadere.</p>
              </section>
              <section>
                <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><Save className="w-4 h-4"/> 6. Backup e Sicurezza Dati</h4>
                <p>L'app salva tutto localmente sul tuo telefono. Ricordati di usare regolarmente il tasto <strong>Esporta Backup</strong> nelle Impostazioni per scaricare un salvataggio di sicurezza, utilissimo se cambi telefono o svuoti la memoria del browser.</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
