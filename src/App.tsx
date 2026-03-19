import React, { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Store, AlertCircle, Loader2, ChevronRight, Info, Map as MapIcon, List, Navigation, Clock, Phone, Mail, Globe, ExternalLink, RefreshCw, Copy, Check, Heart, Trash2, Bookmark, BookOpen, ChevronDown, ChevronUp, Download, Save, Calendar, GripVertical, CheckCircle2, X, ClipboardList, Layers, Settings, Upload, Share2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  isSaved: (res: SearchResult) => boolean;
  rubrica: RubricaData;
  enrichedData: Record<string, EnrichedDetails>;
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
  handleStoreUpdate?: (id: string, field: string, value: any) => void;
  dragHandleProps?: any;
}

interface SortableCardProps extends RivenditaCardProps {}

const RivenditaCard: React.FC<RivenditaCardProps> = ({
  res,
  idx,
  isCrmTab = false,
  activeTab,
  expandedCardId,
  isSaved,
  rubrica,
  enrichedData,
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
  handleStoreUpdate,
  dragHandleProps
}) => {
  const id = getRivenditaId(res);
  const isExpanded = expandedCardId === id;
  const isInGiro = isSaved(res);
  const [isCopied, setIsCopied] = useState(false);
  const extra = rubrica[id] || {
    stato: '',
    visitata: '',
    giornoLevata: '',
    riferimento: '',
    telefono: '',
    pIva: '',
    mail: ''
  };

  const street = res['Indirizzo']?.trim() || '';
  const city = res['Comune']?.trim() || '';
  const prov = res['Prov.']?.trim() || '';
  const fullAddress = [street, city, prov].filter(Boolean).join(', ').trim();
  const encodedAddress = encodeURIComponent(fullAddress);

  const handleShare = async () => {
    const enriched = enrichedData[id];
    
    // Funzione dinamica per formattare i dati
    const formatData = (obj: any, title: string) => {
      let text = `--- ${title} ---\n`;
      const skip = ['id', 'location', 'viewport', 'photos', 'exportedAt', 'version', 'isStore', 'storeNumber', 'lastDataVisita', 'lastOraVisita'];
      
      Object.entries(obj).forEach(([key, value]) => {
        if (value && !skip.includes(key) && typeof value !== 'object') {
          text += `${key}: ${value}\n`;
        }
      });
      return text;
    };

    let shareText = `*${res.isStore ? 'STORE' : 'RIVENDITA'} #${res.storeNumber || res['Num. Rivendita']}*\n`;
    shareText += formatData(res, "DATI BASE");
    
    if (extra && Object.keys(extra).length > 0) {
      shareText += "\n" + formatData(extra, "INFO CRM");
    }
    
    if (enriched && Object.keys(enriched).length > 0) {
      shareText += "\n" + formatData(enriched, "INFO EXTRA");
    }

    const finalString = shareText.trim();

    try {
      if (navigator.share) {
        await navigator.share({
          text: finalString
        });
      } else {
        throw new Error('Web Share API not supported');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(finalString);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (clipErr) {
        console.error('Errore durante la copia negli appunti:', clipErr);
      }
    }
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 relative text-left">
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-2">
          {activeTab === 'giro' && (
            <div className="mt-1 text-slate-300 cursor-grab active:cursor-grabbing p-1 -m-1" {...dragHandleProps}>
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider shadow-sm ${
                res.isStore ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'
              }`}>
                {res.isStore ? (
                  <span className="flex items-center gap-1">
                    <Store className="w-3 h-3" />
                    STORE #{res.storeNumber || res['Num. Rivendita']}
                  </span>
                ) : `RIV. ${res['Num. Rivendita']}`}
              </span>
              {res.isStore && res.isChain && (
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Catena ({res.chainCount || 1})
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                res['Stato'] === 'Attiva' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {res['Stato']}
              </span>
              {isCrmTab && extra.stato && (
                <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                  extra.stato === 'Attivata' ? 'bg-emerald-100 text-emerald-700' : 
                  extra.stato === 'Non Attiva' ? 'bg-red-100 text-red-700' :
                  extra.stato === 'RIP' ? 'bg-slate-100 text-slate-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {extra.stato} (CRM)
                </span>
              )}
            </div>
            <h3 className="font-medium text-slate-900 truncate pr-4">
              {res.isStore ? (
                <span className="flex flex-col">
                  <span className="text-sm font-bold text-brand-700">{res.storeName || 'Senza Nome'}</span>
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{res['Comune']} ({res['Prov.']})</span>
                </span>
              ) : (
                `${res['Comune']} (${res['Prov.']})`
              )}
            </h3>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
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
          <span className="leading-snug">{res['Indirizzo']}</span>
        </div>
      </div>

      {(extra.visitata === 'Si' || extra.lastDataVisita) && (
        <div className={`text-xs p-2.5 rounded-xl shadow-sm border-l-4 ${
          extra.visitata === 'Si' 
            ? 'bg-emerald-50 border-emerald-500 text-emerald-900' 
            : 'bg-slate-50 border-slate-300 text-slate-700'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className={`w-3.5 h-3.5 ${extra.visitata === 'Si' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="font-bold uppercase tracking-wider text-[10px]">
                {extra.visitata === 'Si' ? 'Visitata il' : 'Ultima Visita'}
              </span>
            </div>
            <span className="font-bold text-sm">
              {extra.visitata === 'Si' 
                ? (extra.dataVisita ? new Date(extra.dataVisita).toLocaleDateString('it-IT') : '-')
                : (extra.lastDataVisita ? new Date(extra.lastDataVisita).toLocaleDateString('it-IT') : '-')
              }
              {extra.visitata === 'Si' 
                ? (extra.oraVisita ? ` alle ${extra.oraVisita}` : '')
                : (extra.lastOraVisita ? ` alle ${extra.lastOraVisita}` : '')
              }
            </span>
          </div>
        </div>
      )}

      {extra.note && (
        <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-xl text-xs text-slate-600 italic">
          <div className="flex items-center gap-1.5 mb-1 text-amber-700 font-bold uppercase tracking-wider text-[9px]">
            <BookOpen className="w-3 h-3" /> Note
          </div>
          <p className="leading-relaxed">{extra.note}</p>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-50 mt-1">
        <div className="text-xs">
          <span className="text-slate-400 block mb-0.5">Tipo</span>
          <span className="font-medium text-slate-700">{res['Tipo Rivendita']}</span>
        </div>
        <div className="text-xs">
          <span className="text-slate-400 block mb-0.5">Distr. Automatico</span>
          <span className="font-medium text-slate-700">{res['Distr. Automatico']}</span>
        </div>
        {isCrmTab && extra.visitata && (
          <div className="text-xs">
            <span className="text-slate-400 block mb-0.5">Visitata</span>
            <span className="font-medium text-slate-700">{extra.visitata}</span>
          </div>
        )}
        {isCrmTab && extra.dataVisita && (
          <div className="text-xs">
            <span className="text-slate-400 block mb-0.5">Data Visita</span>
            <span className="font-medium text-slate-700">
              {new Date(extra.dataVisita).toLocaleDateString('it-IT')}
              {extra.oraVisita ? ` alle ${extra.oraVisita}` : ''}
            </span>
          </div>
        )}
        {isCrmTab && extra.dataRivisita && (
          <div className="text-xs">
            <span className="text-slate-400 block mb-0.5">Data Rivisita</span>
            <span className="font-medium text-slate-700">
              {new Date(extra.dataRivisita).toLocaleDateString('it-IT')}
              {extra.oraRivisita ? ` alle ${extra.oraRivisita}` : ''}
            </span>
          </div>
        )}
        {isCrmTab && extra.giornoLevata && (
          <div className="text-xs">
            <span className="text-slate-400 block mb-0.5">Giorno Levata</span>
            <span className="font-medium text-slate-700">{extra.giornoLevata}</span>
          </div>
        )}
        {isCrmTab && extra.riferimento && (
          <div className="text-xs">
            <span className="text-slate-400 block mb-0.5">Riferimento</span>
            <span className="font-medium text-slate-700">{extra.riferimento}</span>
          </div>
        )}
        {isCrmTab && extra.telefono && (
          <div className="text-xs">
            <span className="text-slate-400 block mb-0.5">Telefono</span>
            <span className="font-medium text-slate-700">{extra.telefono}</span>
          </div>
        )}
        {isCrmTab && extra.pIva && (
          <div className="text-xs">
            <span className="text-slate-400 block mb-0.5">P. IVA</span>
            <span className="font-medium text-slate-700">{extra.pIva}</span>
          </div>
        )}
        {isCrmTab && extra.mail && (
          <div className="text-xs">
            <span className="text-slate-400 block mb-0.5">Mail</span>
            <span className="font-medium text-slate-700">{extra.mail}</span>
          </div>
        )}
        
        {isCrmTab && extra.richiestaOrdine && (
          <div className="text-xs col-span-2">
            <span className="text-slate-400 block mb-0.5">Richiesta Ordine</span>
            <span className="font-medium text-slate-700">
              {extra.dataOrdine ? `Inserito il ${new Date(extra.dataOrdine).toLocaleDateString('it-IT')} - ` : ''}
              {extra.ordineEvaso ? (
                <span className="text-emerald-600 font-bold">Evaso</span>
              ) : (
                <span className="text-amber-600 font-bold">Da evadere</span>
              )}
            </span>
            {extra.noteOrdine && (
              <div className="mt-1 p-2 bg-slate-100 rounded text-slate-600 italic">
                {extra.noteOrdine}
              </div>
            )}
          </div>
        )}
      </div>

      {enrichedData[id] && (
        <div className="mt-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-brand-600" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Orari di apertura</span>
              <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-line">
                {enrichedData[id].openingHours}
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
                <a href={`tel:${enrichedData[id].phone}`} className="text-brand-600 hover:text-brand-700 font-bold text-sm transition-colors">
                  {enrichedData[id].phone}
                </a>
              </div>
            </div>

            {enrichedData[id].email && enrichedData[id].email !== 'Non disponibile' && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-brand-600" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Email</span>
                  <a href={`mailto:${enrichedData[id].email}`} className="text-brand-600 hover:text-brand-700 font-bold text-sm truncate block transition-colors">
                    {enrichedData[id].email}
                  </a>
                </div>
              </div>
            )}
          </div>

          {enrichedData[id].notes && enrichedData[id].notes !== 'Non disponibile' && (
            <div className="pt-3 border-t border-slate-200/60">
              <div className="flex gap-2 items-start">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500 italic leading-normal">
                  {enrichedData[id].notes}
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
        {( (isCrmTab && extra.richiestaOrdine && !extra.ordineEvaso) || (isCrmTab && extra.dataRivisita) ) && (
          <div className="grid grid-cols-2 gap-2">
            {isCrmTab && extra.richiestaOrdine && !extra.ordineEvaso && (
              <button
                onClick={() => handleRubricaUpdate(id, 'ordineEvaso', true)}
                className={`${extra.dataRivisita ? 'col-span-1' : 'col-span-2'} flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-sm`}
              >
                <Check className="w-3.5 h-3.5" /> Evadi Ordine
              </button>
            )}

            {isCrmTab && extra.dataRivisita && (
              <a
                href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Appuntamento Rivendita ${res['Num. Rivendita']} - ${res['Comune']}`)}&dates=${formatGoogleCalendarDate(extra.dataRivisita, extra.oraRivisita)}&details=${encodeURIComponent(`Indirizzo: ${fullAddress}\nTelefono: ${extra.telefono || 'N/A'}\nRiferimento: ${extra.riferimento || 'N/A'}`)}&location=${encodeURIComponent(fullAddress)}`}
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
            onClick={() => { window.location.href = 'geo:0,0?q=' + encodedAddress; }}
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

        {!enrichedData[id] && (
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
                  {Array.from({ length: (20 - 8) * 4 + 1 }).map((_, i) => {
                    const h = (Math.floor(i / 4) + 8).toString().padStart(2, '0');
                    const m = ((i % 4) * 15).toString().padStart(2, '0');
                    const time = `${h}:${m}`;
                    return <option key={time} value={time}>{time}</option>;
                  })}
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
                addToCrm(res);
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
};

const SortableCard: React.FC<SortableCardProps> = (props) => {
  const id = getRivenditaId(props.res);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <RivenditaCard {...props} dragHandleProps={listeners} />
    </div>
  );
};

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
  const [pendingVisitId, setPendingVisitId] = useState<string | null>(null);
  const [rubricaFilterStato, setRubricaFilterStato] = useState<string>('');
  const [rubricaSort, setRubricaSort] = useState<string>('none');
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [storageSize, setStorageSize] = useState('0 KB');
  const [swActive, setSwActive] = useState(false);

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
      
      // Pulizia
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error('Errore durante l\'esportazione:', err);
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
        
        alert('Backup ripristinato con successo! L\'app verrà ricaricata.');
        window.location.reload();
      } catch (err) {
        console.error('Errore importazione:', err);
        alert('Errore durante l\'importazione del file. Assicurati che sia un file di backup valido.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = () => {
    if (window.confirm('ATTENZIONE: Questa operazione cancellerà DEFINITIVAMENTE tutti i tuoi dati (Giro, Rubrica, Store). Sei sicuro di voler procedere?')) {
      setGiroVisite([]);
      setCrmAnagrafiche([]);
      setStores([]);
      setRubrica({});
      localStorage.clear();
      localStorage.setItem('app_data_version', DATA_VERSION);
      alert('Tutti i dati sono stati cancellati.');
      setShowSettingsModal(false);
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

  const handleEnrich = async (id: string, res: SearchResult) => {
    if (enrichedData[id]) return;
    
    try {
      setEnrichingId(id);
      const details = await enrichRivendita(res);
      setEnrichedData(prev => ({ ...prev, [id]: details }));
    } catch (err) {
      console.error(err);
    } finally {
      setEnrichingId(null);
    }
  };

  const handleCopyAddress = (address: string, id: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const isSaved = (res: SearchResult) => {
    return giroVisite.some(s => 
      s['Num. Rivendita'] === res['Num. Rivendita'] && 
      s['Comune'] === res['Comune'] && 
      s['Prov.'] === res['Prov.']
    );
  };

  const toggleSave = (res: SearchResult) => {
    const id = getRivenditaId(res);
    if (isSaved(res)) {
      setGiroVisite(prev => prev.filter(s => 
        !(s['Num. Rivendita'] === res['Num. Rivendita'] && 
          s['Comune'] === res['Comune'] && 
          s['Prov.'] === res['Prov.'])
      ));
    } else {
      setGiroVisite(prev => [...prev, res]);
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
  };

  const handleRubricaUpdate = (id: string, field: keyof RivenditaExtra, value: string | boolean) => {
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
  };

  const handleRubricaMultiUpdate = (id: string, updates: Partial<RivenditaExtra>) => {
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
  };

  const initiateVisitToggle = (id: string) => {
    setPendingVisitId(id);
    setShowConfirmVisitModal(true);
  };

  const confirmVisit = () => {
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
  };

  const toggleExpandCard = (id: string) => {
    setExpandedCardId(prev => prev === id ? null : id);
  };

  const exportToCSV = () => {
    const rubricaEntries = (Object.entries(rubrica) as [string, RivenditaExtra][])
      .filter(([id, _]) => hasRubricaData(id));
    if (rubricaEntries.length === 0) return;

    const headers = [
      'Provincia', 'Comune', 'Num. Rivendita', 'Indirizzo', 'Tipo', 'Stato Rivendita',
      'Stato Contatto', 'Visitata', 'Data Visita', 'Ora Visita', 'Data Rivisita', 'Ora Rivisita', 'Giorno Levata',
      'Riferimento', 'Telefono', 'P. IVA', 'Mail', 'Richiesta Ordine', 'Note Ordine', 'Data Ordine', 'Ordine Evaso'
    ];

    const rows = rubricaEntries.map(([id, extra]) => {
      const [prov, comune, num] = id.split('_');
      const savedRes = giroVisite.find(r => getRivenditaId(r) === id);
      
      return [
        prov || '',
        comune || '',
        num || '',
        savedRes ? `"${savedRes['Indirizzo'] || ''}"` : '',
        savedRes ? `"${savedRes['Tipo Rivendita'] || ''}"` : '',
        savedRes ? `"${savedRes['Stato'] || ''}"` : '',
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

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rubrica_rivendite_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasRubricaData = (id: string) => {
    const extra = rubrica[id];
    if (!extra) return false;
    if (extra.isSavedToRubrica === undefined) {
      const hasData = Object.entries(extra).some(([key, val]) => key !== 'isSavedToRubrica' && val !== '');
      return hasData;
    }
    return extra.isSavedToRubrica === true;
  };

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

  const removeFromCrm = (res: SearchResult) => {
    const id = getRivenditaId(res);
    if (window.confirm(`Sei sicuro di voler eliminare la rivendita ${res['Num. Rivendita']} dal CRM? Verranno eliminati anche tutti i dati salvati.`)) {
      setCrmAnagrafiche(prev => prev.filter(s => getRivenditaId(s) !== id));
      setRubrica(prev => {
        const newRubrica = { ...prev };
        delete newRubrica[id];
        return newRubrica;
      });
      setGiroVisite(prev => prev.filter(s => getRivenditaId(s) !== id));
    }
  };

  const removeStore = (res: SearchResult) => {
    const id = getRivenditaId(res);
    if (window.confirm(`Sei sicuro di voler eliminare lo store ${res['Num. Rivendita']}? Verranno eliminati anche tutti i dati salvati.`)) {
      setStores(prev => prev.filter(s => getRivenditaId(s) !== id));
      setRubrica(prev => {
        const newRubrica = { ...prev };
        delete newRubrica[id];
        return newRubrica;
      });
      setGiroVisite(prev => prev.filter(s => getRivenditaId(s) !== id));
    }
  };

  const addToCrm = (res: SearchResult) => {
    const id = getRivenditaId(res);
    if (!crmAnagrafiche.some(s => getRivenditaId(s) === id)) {
      setCrmAnagrafiche(prev => [...prev, res]);
    }
    handleRubricaUpdate(id, 'isSavedToRubrica', true);
    // Remove from Giro Visite automatically when saved to CRM
    setGiroVisite(prev => prev.filter(s => getRivenditaId(s) !== id));
  };

  const clearGiro = () => {
    setGiroVisite([]);
    setShowClearGiroConfirmModal(false);
  };

  const giroVisiteList = giroVisite;
  
  const allCrmList = crmAnagrafiche;
  
  const crmList = allCrmList.filter(res => {
    const stato = rubrica[getRivenditaId(res)]?.stato;
    return stato !== 'RIP';
  });

  const ripList = allCrmList.filter(res => {
    return rubrica[getRivenditaId(res)]?.stato === 'RIP';
  });

  const storeList = stores;

  // Province dinamiche dal CRM e dagli Store
  const provincesInCrm = Array.from(new Set([
    ...crmList.map(res => res['Prov.']),
    ...storeList.map(res => res['Prov.'])
  ])).sort();

  const getOrderedTabs = () => {
    const tabs = ['search', 'giro', 'crm', 'store'];
    provincesInCrm.forEach(p => tabs.push(`prov_${p}`));
    tabs.push('rip');
    return tabs;
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    const tabs = getOrderedTabs();
    const currentIndex = tabs.indexOf(activeTab);
    if (direction === 'left' && currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
      setRivenditaFilter('');
      setComuneFilter('');
    } else if (direction === 'right' && currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
      setRivenditaFilter('');
      setComuneFilter('');
    }
  };

  const getUniqueComuniForTab = () => {
    let list: SearchResult[] = [];
    if (activeTab === 'search') return [];
    if (activeTab === 'giro') list = giroVisiteList;
    else if (activeTab === 'crm') list = crmList;
    else if (activeTab === 'store') list = storeList;
    else if (activeTab === 'rip') list = ripList;
    else if (activeTab.startsWith('prov_')) {
      const prov = activeTab.replace('prov_', '');
      list = [...crmList, ...storeList].filter(res => res['Prov.'] === prov);
    }
    
    // Create strings like "Comune (Prov.)"
    const formattedComuni = list.map(res => `${res['Comune']} (${res['Prov.']})`);
    return Array.from(new Set(formattedComuni)).sort();
  };

  const getCurrentList = () => {
    let list: SearchResult[] = [];
    if (activeTab === 'search') return results || [];
    if (activeTab === 'giro') list = giroVisiteList;
    else if (activeTab === 'crm') list = crmList;
    else if (activeTab === 'store') list = storeList;
    else if (activeTab === 'rip') list = ripList;
    else if (activeTab.startsWith('prov_')) {
      const prov = activeTab.replace('prov_', '');
      list = [...crmList, ...storeList].filter(res => res['Prov.'] === prov);
    }

    // Filtro per numero rivendita
    if (rivenditaFilter) {
      list = list.filter(res => res['Num. Rivendita'].toString().includes(rivenditaFilter));
    }

    // Filtro per comune
    if (comuneFilter) {
      list = list.filter(res => `${res['Comune']} (${res['Prov.']})` === comuneFilter);
    }

    return list;
  };

  const getSortedList = () => {
    const list = getCurrentList();
    if (activeTab === 'search') return list;
    
    return [...list].sort((a, b) => {
      if (rubricaSort === 'none') return 0;
      const idA = getRivenditaId(a);
      const idB = getRivenditaId(b);
      const extraA = rubrica[idA];
      const extraB = rubrica[idB];
      
      if (rubricaSort === 'dataVisitaAsc') {
        const dateA = extraA?.dataVisita ? new Date(extraA.dataVisita).getTime() : Infinity;
        const dateB = extraB?.dataVisita ? new Date(extraB.dataVisita).getTime() : Infinity;
        return dateA - dateB;
      }
      if (rubricaSort === 'dataRivisitaAsc') {
        const dateA = extraA?.dataRivisita ? new Date(extraA.dataRivisita).getTime() : Infinity;
        const dateB = extraB?.dataRivisita ? new Date(extraB.dataRivisita).getTime() : Infinity;
        return dateA - dateB;
      }
      return 0;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setGiroVisite((items) => {
        const oldIndex = items.findIndex(item => getRivenditaId(item) === active.id);
        const newIndex = items.findIndex(item => getRivenditaId(item) === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };


  const handleStoreUpdate = (id: string, field: string, value: any) => {
    setStores(prev => prev.map(s => getRivenditaId(s) === id ? { ...s, [field]: value } : s));
  };

  const handleCreateStore = (newStore: Partial<SearchResult>) => {
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
  };

  const cardProps = {
    activeTab,
    expandedCardId,
    isSaved,
    rubrica,
    enrichedData,
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
    removeStore
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 z-30">
        <div className="max-w-md mx-auto px-3 py-3">
          <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden p-1">
            <button
              onClick={() => { setActiveTab('search'); setRivenditaFilter(''); setComuneFilter(''); window.scrollTo(0,0); }}
              className={`flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all ${
                activeTab === 'search' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Search className="w-4 h-4" />
              Cerca
            </button>
            <button
              onClick={() => { setActiveTab('giro'); setRivenditaFilter(''); setComuneFilter(''); window.scrollTo(0,0); }}
              className={`flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all ${
                activeTab === 'giro' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Navigation className="w-4 h-4" />
              Giro ({giroVisiteList.length})
            </button>
            <button
              onClick={() => { setActiveTab('crm'); setRivenditaFilter(''); setComuneFilter(''); window.scrollTo(0,0); }}
              className={`flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all ${
                activeTab === 'crm' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              CRM ({crmList.length})
            </button>
            <button
              onClick={() => { setActiveTab('store'); setRivenditaFilter(''); setComuneFilter(''); window.scrollTo(0,0); }}
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
                onClick={() => { setActiveTab(`prov_${prov}`); setRivenditaFilter(''); setComuneFilter(''); window.scrollTo(0,0); }}
                className={`flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all ${
                  activeTab === `prov_${prov}` ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <MapPin className="w-4 h-4" />
                {prov}
              </button>
            ))}

            <button
              onClick={() => { setActiveTab('rip'); setRivenditaFilter(''); setComuneFilter(''); window.scrollTo(0,0); }}
              className={`flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all ${
                activeTab === 'rip' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              RIP ({ripList.length})
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
            >
              <Settings className="w-4 h-4" />
              Impostazioni
            </button>

            <button
              onClick={handleReset}
              className="flex-none px-5 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Reset
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
                  {results.length > 0 && (
                    <div className="flex bg-slate-200 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                          viewMode === 'list' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        <List className="w-4 h-4" />
                        Lista
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('map')}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                          viewMode === 'map' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        <MapIcon className="w-4 h-4" />
                        Mappa
                      </button>
                    </div>
                  )}
                </div>
                
                {results.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl text-center border border-slate-100 shadow-sm">
                    <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Nessuna rivendita trovata con questi criteri.</p>
                  </div>
                ) : viewMode === 'map' ? (
                  <MapView results={results} />
                ) : (
                  <div className="space-y-3">
                    {results.map((res, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="bg-brand-100 text-brand-700 text-xs font-bold px-2 py-1 rounded-md">
                                Riv. {res['Num. Rivendita']}
                              </span>
                              <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                                res['Stato'] === 'Attiva' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {res['Stato']}
                              </span>
                            </div>
                            <h3 className="font-medium text-slate-900 truncate pr-4">
                              {res['Comune']} ({res['Prov.']})
                            </h3>
                          </div>
                          <button
                            onClick={() => toggleSave(res)}
                            className={`p-2 rounded-xl transition-all ${
                              isSaved(res) 
                                ? 'bg-brand-100 text-brand-600' 
                                : 'bg-slate-50 text-slate-400 hover:text-brand-600 hover:bg-brand-50'
                            }`}
                            title={isSaved(res) ? "Rimuovi dal giro visite" : "Pianifica visita (Giro)"}
                          >
                            <ClipboardList className={`w-5 h-5 ${isSaved(res) ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                        
                        <div className="flex items-start justify-between gap-2 text-sm text-slate-600">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                            <span className="leading-snug">{res['Indirizzo']}</span>
                          </div>
                          <button
                            onClick={() => handleCopyAddress(res['Indirizzo'], getRivenditaId(res))}
                            className={`p-1.5 rounded-lg transition-all shrink-0 ${
                              copiedId === getRivenditaId(res) 
                                ? 'bg-emerald-50 text-emerald-600' 
                                : 'hover:bg-slate-100 text-slate-400 hover:text-brand-600'
                            }`}
                            title="Copia indirizzo"
                          >
                            {copiedId === getRivenditaId(res) ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-50 mt-1">
                          <div className="text-xs">
                            <span className="text-slate-400 block mb-0.5">Tipo</span>
                            <span className="font-medium text-slate-700">{res['Tipo Rivendita']}</span>
                          </div>
                          <div className="text-xs">
                            <span className="text-slate-400 block mb-0.5">Distr. Automatico</span>
                            <span className="font-medium text-slate-700">{res['Distr. Automatico']}</span>
                          </div>
                        </div>

                        {enrichedData[getRivenditaId(res)] && (
                          <div className="mt-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                                <Clock className="w-4 h-4 text-brand-600" />
                              </div>
                              <div className="flex-1">
                                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Orari di apertura</span>
                                <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-line">
                                  {enrichedData[getRivenditaId(res)].openingHours}
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
                                  <a href={`tel:${enrichedData[getRivenditaId(res)].phone}`} className="text-brand-600 hover:text-brand-700 font-bold text-sm transition-colors">
                                    {enrichedData[getRivenditaId(res)].phone}
                                  </a>
                                </div>
                              </div>

                              {enrichedData[getRivenditaId(res)].email && enrichedData[getRivenditaId(res)].email !== 'Non disponibile' && (
                                <div className="flex items-start gap-3">
                                  <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                                    <Mail className="w-4 h-4 text-brand-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Email</span>
                                    <a href={`mailto:${enrichedData[getRivenditaId(res)].email}`} className="text-brand-600 hover:text-brand-700 font-bold text-sm truncate block transition-colors">
                                      {enrichedData[getRivenditaId(res)].email}
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>

                            {enrichedData[getRivenditaId(res)].notes && enrichedData[getRivenditaId(res)].notes !== 'Non disponibile' && (
                              <div className="pt-3 border-t border-slate-200/60">
                                <div className="flex gap-2 items-start">
                                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-slate-500 italic leading-normal">
                                    {enrichedData[getRivenditaId(res)].notes}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-2 pt-4 border-t border-slate-50 flex flex-col gap-2">
                          {!enrichedData[getRivenditaId(res)] && (
                            enrichingId === getRivenditaId(res) ? (
                              <button
                                disabled
                                className="w-full text-center text-sm font-semibold text-slate-400 bg-slate-50 py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                              >
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Caricamento dettagli...
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEnrich(getRivenditaId(res), res)}
                                className="w-full text-center text-sm font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 active:bg-brand-100 py-3 rounded-xl flex items-center justify-center gap-2 transition-all border border-brand-100"
                              >
                                <Clock className="w-4 h-4" />
                                Mostra orari e contatti
                              </button>
                            )
                          )}
                          
                          <button
                            onClick={() => {
                              const addr = [res['Indirizzo'], res['Comune'], res['Prov.']].filter(Boolean).join(', ');
                              window.location.href = 'geo:0,0?q=' + encodeURIComponent(addr);
                            }}
                            className="flex items-center justify-center gap-2 bg-brand-50 hover:bg-brand-100 active:scale-95 text-brand-700 w-full py-3 px-6 rounded-xl text-sm font-bold transition-all no-underline shadow-sm"
                          >
                            <Navigation className="w-4 h-4" />
                            Naviga
                          </button>
                        </div>
                      </div>
                    ))}
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
                   `${activeTab.replace('prov_', '')} (${getCurrentList().length})`}
                </h2>
                {activeTab === 'store' && (
                  <button
                    onClick={() => setShowCreateStoreModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 rounded-xl text-sm font-bold transition-all shadow-md shadow-brand-100"
                  >
                    <Store className="w-4 h-4" />
                    Aggiungi Store
                  </button>
                )}
                {activeTab === 'giro' && giroVisite.length > 0 && (
                  <button
                    onClick={() => setShowClearGiroConfirmModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-xl text-sm font-bold transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Svuota Giro
                  </button>
                )}
                {activeTab !== 'giro' && getCurrentList().length > 0 && (
                  <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-xl text-sm font-bold transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Esporta CSV
                  </button>
                )}
              </div>

              {/* Filtri Comuni */}
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
            </div>

            {getCurrentList().length > 0 && activeTab !== 'giro' && (
              <div className="flex flex-row gap-3 px-1">
                {activeTab === 'crm' && (
                  <div className="flex-1">
                    <label className="text-xs font-medium text-slate-600 block mb-1">Filtra per Stato</label>
                    <select
                      value={rubricaFilterStato}
                      onChange={(e) => setRubricaFilterStato(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                    >
                      <option value="">Tutti</option>
                      <option value="Attivata">Attivata</option>
                      <option value="Non Attiva">Non Attiva</option>
                    </select>
                  </div>
                )}
                <div className="flex-1">
                  <label className="text-xs font-medium text-slate-600 block mb-1">Ordina per</label>
                  <select
                    value={rubricaSort}
                    onChange={(e) => setRubricaSort(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  >
                    <option value="none">Nessun ordine</option>
                    <option value="dataVisitaAsc">Data Ultima Visita (Crescente)</option>
                    <option value="dataRivisitaAsc">Prossimo Appuntamento (Crescente)</option>
                  </select>
                </div>
              </div>
            )}

            {getCurrentList().length === 0 ? (
              <div className="bg-white p-12 rounded-3xl text-center border border-slate-100 shadow-sm space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <BookOpen className="w-10 h-10 text-slate-200" />
                </div>
                <div className="space-y-2">
                  <p className="text-slate-800 font-bold">Nessun dato</p>
                  <p className="text-slate-500 text-sm">Non ci sono elementi che corrispondono ai criteri di ricerca.</p>
                </div>
                {activeTab === 'giro' && (
                  <button
                    onClick={() => setActiveTab('search')}
                    className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl text-sm shadow-md shadow-brand-100 active:scale-95 transition-all"
                  >
                    Vai alla ricerca
                  </button>
                )}
              </div>
            ) : activeTab === 'giro' ? (
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={giroVisite.map(res => getRivenditaId(res))}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {giroVisite.map((res: SearchResult, idx: number) => (
                      <div key={getRivenditaId(res)}>
                        <SortableCard 
                          res={res} 
                          idx={idx} 
                          isCrmTab={activeTab !== 'giro'}
                          {...cardProps}
                        />
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : getSortedList().length === 0 ? (
              <div className="bg-white p-12 rounded-3xl text-center border border-slate-100 shadow-sm space-y-4">
                <p className="text-slate-500 text-sm">Nessuna rivendita trovata con i filtri selezionati.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {getSortedList().map((res: SearchResult, idx: number) => (
                  <div key={getRivenditaId(res)}>
                    <RivenditaCard 
                      res={res}
                      idx={idx}
                      isCrmTab={activeTab !== 'giro'}
                      {...cardProps}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </main>

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
                <h3 className="text-lg font-bold text-slate-800">Programma Rivisita?</h3>
              </div>
              
              <p className="text-sm text-slate-600 leading-relaxed">
                Hai segnato la rivendita come visitata. Vuoi programmare un nuovo appuntamento?
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
                    {Array.from({ length: (20 - 8) * 4 + 1 }).map((_, i) => {
                      const h = (Math.floor(i / 4) + 8).toString().padStart(2, '0');
                      const m = ((i % 4) * 15).toString().padStart(2, '0');
                      const time = `${h}:${m}`;
                      return <option key={time} value={time}>{time}</option>;
                    })}
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Impostazioni & Backup</h3>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Save className="w-4 h-4 text-brand-600" />
                    Sicurezza Dati
                  </h4>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    I tuoi dati sono salvati localmente su questo dispositivo. Per sicurezza, ti consigliamo di scaricare periodicamente un backup.
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
                      className="flex items-center justify-center gap-2 py-3 bg-brand-50 border border-brand-100 text-brand-700 font-bold rounded-xl text-sm hover:bg-brand-100 active:scale-95 transition-all shadow-sm cursor-pointer"
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
                    <p>Versione App: <span className="font-bold">{DATA_VERSION} {swActive ? '(PWA Attiva)' : ''}</span></p>
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

                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-2xl text-sm hover:bg-slate-800 transition-all"
                >
                  Chiudi
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
                  'Prov.': formData.get('prov') as string,
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
    </div>
  );
}
