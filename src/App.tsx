import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, MapPin, Store, AlertCircle, Loader2, ChevronRight, Info, Map as MapIcon, List, Navigation, Clock, Phone, Mail, Globe, ExternalLink, RefreshCw, Copy, Check, Heart, Trash2, Bookmark, BookOpen, ChevronDown, ChevronUp, Download, Save, Calendar, GripVertical, CheckCircle2, X, ClipboardList, Layers, Settings, Upload, Share2, MessageCircle, Layout, Database, Sparkles, Filter, Cloud, Plus, BarChart2, Target, Activity, CalendarClock, User, UserCheck, ArrowDownAZ, ArrowUpZA, Edit3 } from 'lucide-react';
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

export interface RivenditaHistoryEntry {
  data: string;
  tipo: 'VISITA' | 'ORDINE' | 'HOSTESS';
  note: string;
  importo: number;
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
  history?: RivenditaHistoryEntry[];
  ultimoOrdine?: string;
  ultimoImporto?: number;
  importoOrdine?: number;
  hostessData?: string;
  hostessInizio?: string;
  hostessFine?: string;
  codiceUnivoco?: string;
  showHostessModule?: boolean;
  ultimaHostessInfo?: string;
}

export type RubricaData = Record<string, RivenditaExtra>;

const formatGoogleCalendarDate = (dateString: string, timeString?: string) => {
  const date = new Date(dateString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  let timePart = '090000';
  if (timeString) timePart = timeString.replace(':', '') + '00';
  const start = `${yyyy}${mm}${dd}T${timePart}`;
  let endHour = parseInt(timePart.substring(0, 2)) + 1;
  let endHourStr = String(endHour).padStart(2, '0');
  if (endHour >= 24) endHourStr = '23';
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
  const bookedTimes = Object.entries(rubricaData)
    .filter(([id, data]) => id !== currentId && data.dataRivisita === date && data.oraRivisita)
    .map(([_, data]) => data.oraRivisita);
  return allTimes.filter(t => !bookedTimes.includes(t));
};

export const handleNavigation = (address: string) => {
  const encoded = encodeURIComponent(address);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = 'geo:0,0?q=' + encoded;
  } else {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  }
};

const toTitleCase = (str: string) => { return str ? str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase()) : ''; };

const DATA_VERSION = "2.56";

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
  const num = res.isStore ? (res.storeNumber || res['Num. Rivendita']) : res['Num. Rivendita'];
  return `${res['Prov.']}_${res['Comune']}_${num}`;
};

const TimelineItem: React.FC<{ entry: RivenditaHistoryEntry }> = ({ entry }) => {
  const configs = {
    VISITA: { icon: <CheckCircle2 className="w-3 h-3" />, color: 'bg-emerald-100 text-emerald-600', label: 'Visita' },
    ORDINE: { icon: <ClipboardList className="w-3 h-3" />, color: 'bg-blue-100 text-blue-600', label: 'Ordine' },
    HOSTESS: { icon: <UserCheck className="w-3 h-3" />, color: 'bg-purple-100 text-purple-600', label: 'Hostess' }
  };
  const config = configs[entry.tipo] || configs.VISITA;
  const dataOra = new Date(entry.data);
  return (
    <div className="flex gap-3 mb-4 last:mb-0">
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full ${config.color} flex items-center justify-center shadow-sm z-10`}>
          {config.icon}
        </div>
        <div className="w-0.5 h-full bg-slate-100 -mt-1"></div>
      </div>
      <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-3 shadow-sm">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{config.label}</span>
          <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-100">
            {dataOra.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} • {dataOra.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{entry.note}</p>
        {entry.importo > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-200/50">
            <span className="text-xs font-black text-brand-600">Valore: €{entry.importo.toLocaleString('it-IT')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// --- RIVENDITA CARD PROPS ---
interface RivenditaCardProps {
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
  handleActivitySave: (id: string, type: 'VISITA' | 'ORDINE' | 'HOSTESS', notes: string, amount?: number) => void;
  toggleExpandCard: (id: string) => void;
  handleEnrich: (id: string, res: SearchResult) => void;
  addToCrm: (res: SearchResult) => void;
  setExpandedCardId: (id: string | null) => void;
  setShareModal: (modal: { isOpen: boolean; text: string }) => void;
  handleStoreUpdate?: (id: string, field: string, value: any) => void;
  jumpToPosition?: (fromIndex: number, toPosition: string) => void;
  openRevisitModal: (id: string) => void;
}

const RivenditaCard = React.memo<RivenditaCardProps>(({
  res, idx, isCrmTab = false, activeTab, expandedCardId, isInGiro, extra, enrichedDetails, rubrica, enrichingId, toggleSave, removeFromCrm, removeStore, initiateVisitToggle, handleRubricaUpdate, handleActivitySave, toggleExpandCard, handleEnrich, addToCrm, setExpandedCardId, setShareModal, handleStoreUpdate, jumpToPosition, openRevisitModal
}) => {
  const id = getRivenditaId(res);
  const isExpanded = expandedCardId === id;
  const [showTimeline, setShowTimeline] = useState(false);
  const capToDisplay = extra.manualCap || res['CAP'] || res['Cap'] || '';
  const fullAddress = `${toTitleCase(res['Indirizzo'] || '')}, ${capToDisplay}, ${(res['Comune'] || '').toUpperCase()}, ${res['Prov.'] || ''}`.trim();

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 relative text-left">
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {activeTab === 'giro' && (
            <div className="flex items-center justify-center mr-3 shrink-0">
              <div className="relative group">
                <input
                  type="number"
                  inputMode="numeric"
                  value={idx + 1}
                  onChange={(e) => jumpToPosition?.(idx, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-10 h-10 bg-slate-100 border-2 border-slate-200 rounded-full text-center text-sm font-black text-slate-700 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 outline-none transition-all appearance-none"
                />
                <span className="absolute -top-2 -left-1 text-[8px] font-black text-slate-400 uppercase bg-white px-1">Pos.</span>
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${res.isStore ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'}`}>
                {res.isStore ? `STORE #${res.storeNumber || res['Num. Rivendita']}` : `RIV. ${res['Num. Rivendita']}`}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${res['Stato'] === 'Attiva' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {res['Stato']}
              </span>
            </div>
            <h3 className="font-medium text-slate-900 leading-snug break-words">
              {res.isStore ? res.storeName : `${(res['Comune'] || '').toUpperCase()} (${res['Prov.']})`}
            </h3>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => toggleSave(res)} className={`p-2 rounded-xl ${isInGiro ? 'bg-brand-100 text-brand-600' : 'bg-slate-50 text-slate-400'}`}>
             <ClipboardList className="w-5 h-5" />
           </button>
        </div>
      </div>

      <div className="flex items-start gap-2 text-sm text-slate-600">
        <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
        <span className="leading-snug">{toTitleCase(res['Indirizzo'])}{capToDisplay ? `, ${capToDisplay}` : ''}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
        <button onClick={() => handleNavigation(fullAddress)} className="flex items-center justify-center gap-2 bg-brand-50 text-brand-700 py-2.5 rounded-xl text-xs font-bold active:scale-95">
          <Navigation className="w-3.5 h-3.5" /> Naviga
        </button>
        <button onClick={() => toggleExpandCard(id)} className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-xs font-bold">
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Dettagli
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 p-4 bg-slate-50 rounded-xl border space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Referente</label>
            <input type="text" value={extra.riferimento} onChange={(e) => handleRubricaUpdate(id, 'riferimento', e.target.value)} className="w-full h-10 px-3 bg-white border rounded-lg text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Note</label>
            <textarea value={extra.note || ''} onChange={(e) => handleRubricaUpdate(id, 'note', e.target.value)} className="w-full h-24 p-3 bg-white border rounded-lg text-sm resize-none" />
          </div>
          <button onClick={() => addToCrm(res)} className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl text-sm">Salva nel CRM</button>
        </div>
      )}
    </div>
  );
});

export default function App() {
  const [activeTab, setActiveTab] = useState('search');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [giroVisite, setGiroVisite] = useState<SearchResult[]>(() => loadFromStorage('giroVisite', []));
  const [crmAnagrafiche, setCrmAnagrafiche] = useState<SearchResult[]>(() => loadFromStorage('crmAnagrafiche', []));
  const [stores, setStores] = useState<SearchResult[]>(() => loadFromStorage('stores', []));
  const [rubrica, setRubrica] = useState<RubricaData>(() => loadFromStorage('rubrica', {}));
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [mensileTarget, setMensileTarget] = useState(() => Number(localStorage.getItem('tgest_target')) || 10000);
  const [statsPeriod, setStatsPeriod] = useState('oggi');

  useEffect(() => {
    document.body.style.overscrollBehaviorY = 'contain';
    return () => { document.body.style.overscrollBehaviorY = 'auto'; };
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    window.scrollTo(0, 0);
  }, []);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    // DISABILITA SWIPE SE MAPPA ATTIVA
    if (activeTab === 'giro' && viewMode === 'map') return;
    
    const tabs = ['search', 'giro', 'crm', 'store', 'statistiche'];
    const currentIndex = tabs.indexOf(activeTab);
    if (direction === 'left' && currentIndex < tabs.length - 1) handleTabChange(tabs[currentIndex + 1]);
    if (direction === 'right' && currentIndex > 0) handleTabChange(tabs[currentIndex - 1]);
  }, [activeTab, viewMode, handleTabChange]);

  const jumpToPosition = useCallback((fromIndex: number, newValue: string) => {
    const toIndex = parseInt(newValue) - 1;
    if (isNaN(toIndex) || toIndex < 0 || toIndex >= giroVisite.length || toIndex === fromIndex) return;
    setGiroVisite(prev => {
      const newArray = [...prev];
      const [movedItem] = newArray.splice(fromIndex, 1);
      newArray.splice(toIndex, 0, movedItem);
      return newArray;
    });
  }, [giroVisite.length]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans" style={{ overscrollBehaviorY: 'contain' }}>
      <nav className="sticky top-0 bg-white border-b z-30">
        <div className="max-w-md mx-auto px-3 py-3 flex gap-2 overflow-x-auto">
          {['search', 'giro', 'crm', 'store', 'statistiche'].map(tab => (
            <button key={tab} onClick={() => handleTabChange(tab)} className={`px-5 py-3 text-sm font-bold rounded-2xl capitalize ${activeTab === tab ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <main 
        className="max-w-md mx-auto p-4"
        onTouchStart={(e) => { (window as any).touchStartX = e.touches[0].clientX; (window as any).touchStartY = e.touches[0].clientY; }}
        onTouchEnd={(e) => {
          const deltaX = (window as any).touchStartX - e.changedTouches[0].clientX;
          const deltaY = (window as any).touchStartY - e.changedTouches[0].clientY;
          if (Math.abs(deltaX) > Math.abs(deltaY) * 2 && Math.abs(deltaX) > 100) handleSwipe(deltaX > 0 ? 'left' : 'right');
        }}
      >
        {activeTab === 'giro' && viewMode === 'map' ? (
          <MapView results={giroVisite} />
        ) : (
          <div className="space-y-3">
            {(activeTab === 'giro' ? giroVisite : activeTab === 'crm' ? crmAnagrafiche : stores).map((res, idx) => (
              <RivenditaCard
                key={getRivenditaId(res)}
                res={res} idx={idx} activeTab={activeTab} expandedCardId={expandedCardId}
                isInGiro={giroVisite.some(g => getRivenditaId(g) === getRivenditaId(res))}
                extra={rubrica[getRivenditaId(res)] || { stato: '', visitata: '', giornoLevata: '', riferimento: '', telefono: '', pIva: '', mail: '' }}
                rubrica={rubrica}
                toggleSave={(r) => setGiroVisite(prev => prev.some(g => getRivenditaId(g) === getRivenditaId(r)) ? prev.filter(g => getRivenditaId(g) !== getRivenditaId(r)) : [...prev, r])}
                toggleExpandCard={(id) => setExpandedCardId(expandedCardId === id ? null : id)}
                jumpToPosition={jumpToPosition}
                addToCrm={(r) => setCrmAnagrafiche(prev => [...prev, r])}
                // Placeholder functions for missing props
                removeFromCrm={() => {}}
                removeStore={() => {}}
                initiateVisitToggle={() => {}}
                handleRubricaUpdate={() => {}}
                handleActivitySave={() => {}}
                handleEnrich={() => {}}
                setExpandedCardId={setExpandedCardId}
                setShareModal={() => {}}
                openRevisitModal={() => {}}
                enrichingId={null}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
