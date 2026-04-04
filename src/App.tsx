import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, MapPin, Store, AlertCircle, Loader2, ChevronRight, Info, Map as MapIcon, List, Navigation, Clock, Phone, Mail, Globe, ExternalLink, RefreshCw, Copy, Check, Heart, Trash2, Bookmark, BookOpen, ChevronDown, ChevronUp, Download, Save, Calendar, GripVertical, CheckCircle2, X, ClipboardList, Layers, Settings, Upload, Share2, MessageCircle, Layout, Database, Sparkles, Filter, Cloud, Plus, BarChart2, BarChart3, Target, Activity, CalendarClock, User, UserCheck, ArrowDownAZ, ArrowUpZA, Edit3, TrendingDown, TrendingUp, History, Package, Wand2, ShoppingBag } from 'lucide-react';
import MapView from './components/MapView';
import RivenditaCard from './components/RivenditaCard';
import QuickEditModal from './components/QuickEditModal';
import GuideModal from './components/GuideModal';
import ChangelogModal from './components/ChangelogModal';
import TargetModal from './components/TargetModal';
import StoreModal from './components/StoreModal';
import AgendaTab from './components/AgendaTab';
import { enrichRivendita, EnrichedDetails } from './services/geminiService';
import { calculateFatturatoPeriodo, calculateBrStats, calculateKpiStats, calculateOrderStats, calculateCrmStats, calculateVisitStats } from './services/statsService';
import packageVersion from './version.json';
import { usePersistence } from './hooks/usePersistence';
import { Option, SearchResult, RivenditaHistoryEntry, RivenditaExtra, ArchiveEntry, RubricaData } from './types';
import { formatGoogleCalendarDate, getAvailableTimes, handleNavigation, toTitleCase, loadFromStorage, getRivenditaId, getGoogleResetDate, calcolaFineTurno, ORARI_INIZIO } from './utils/helpers';

// TgesT Enterprise - v3.01
const DATA_VERSION = packageVersion.version;

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
  const [dailyAiCount, setDailyAiCount] = useState(() => {
    try {
      const saved = localStorage.getItem('ai_daily_usage');
      if (saved) {
        const { date, count } = JSON.parse(saved);
        const googleToday = getGoogleResetDate();
        if (date === googleToday) return count;
      }
    } catch (e) {
      console.error(e);
    }
    return 0;
  });
  const [aiUsage, setAiUsage] = useState<number[]>([]);
  const [aiLockedUntil, setAiLockedUntil] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (aiLockedUntil) {
      interval = setInterval(() => {
        const remaining = Math.ceil((aiLockedUntil - Date.now()) / 1000);
        if (remaining <= 0) {
          setAiLockedUntil(null);
          setCooldownSeconds(0);
          setAiUsage([]); // Reset dei gettoni
        } else {
          setCooldownSeconds(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [aiLockedUntil]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [activeTab, setActiveTab] = useState<string>('search');
  const [meseSelezionato, setMeseSelezionato] = useState(() => {
    return new Date().toISOString().slice(0, 7); 
  });
  const [statsPeriod, setStatsPeriod] = useState<'oggi' | '7g' | 'mese' | 'mese_prec' | 'all' | 'custom'>('oggi');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [radarTab, setRadarTab] = useState<'completate' | 'programmate'>('completate');
  const [statsOrdiniOpen, setStatsOrdiniOpen] = useState(false);
  const [statsTerritorioOpen, setStatsTerritorioOpen] = useState(false);
  const [statsRadarOpen, setStatsRadarOpen] = useState(true);

  const isDateInRange = (dateStr?: string) => {
    if (!dateStr) return false;
    
    // Se siamo in KPI, usiamo il mese selezionato
    if (activeTab === 'kpi') {
      return dateStr.startsWith(meseSelezionato);
    }
    
    // Altrimenti (Statistiche, ecc.) usiamo i filtri di periodo
    if (statsPeriod === 'all') return true;
    const d = new Date(dateStr);
    const ora = new Date();
    
    if (statsPeriod === 'oggi') {
      return d.toDateString() === ora.toDateString();
    }
    if (statsPeriod === '7g') {
      const weekAgo = new Date();
      weekAgo.setDate(ora.getDate() - 7);
      return d >= weekAgo;
    }
    if (statsPeriod === 'mese') {
      const startOfMonth = new Date(ora.getFullYear(), ora.getMonth(), 1);
      return d >= startOfMonth;
    }
    if (statsPeriod === 'mese_prec') {
      const startOfPrevMonth = new Date(ora.getFullYear(), ora.getMonth() - 1, 1);
      const endOfPrevMonth = new Date(ora.getFullYear(), ora.getMonth(), 0, 23, 59, 59, 999);
      return d >= startOfPrevMonth && d <= endOfPrevMonth;
    }
    if (statsPeriod === 'custom' && customRange.start && customRange.end) {
      const start = new Date(customRange.start);
      const end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
      return d >= start && d <= end;
    }
    return false;
  };
  const [rivenditaFilter, setRivenditaFilter] = useState('');
  const [comuneFilter, setComuneFilter] = useState('');
  const [giroVisite, setGiroVisite] = useState<SearchResult[]>(() => loadFromStorage('giroVisite', []));
  const [crmAnagrafiche, setCrmAnagrafiche] = useState<SearchResult[]>(() => loadFromStorage('crmAnagrafiche', []));
  const [stores, setStores] = useState<SearchResult[]>(() => loadFromStorage('stores', []));
  const [targetStorico, setTargetStorico] = useState<Record<string, { globale: number, br: number }>>(() => {
    const saved = localStorage.getItem('tgest_target_storico');
    if (saved) return JSON.parse(saved);
    // Migrazione vecchi dati per non perdere l'impostazione attuale
    const oldGlobale = Number(localStorage.getItem('tgest_target_mensile')) || 20000;
    const oldBr = Number(localStorage.getItem('tgest_target_br')) || 200;
    const currentMonth = new Date().toISOString().slice(0, 7);
    return { [currentMonth]: { globale: oldGlobale, br: oldBr } };
  });

  const currentTargets = useMemo(() => {
    if (targetStorico[meseSelezionato]) return targetStorico[meseSelezionato];
    // Fallback: cerca il target del mese più recente inserito
    const mesiSalvati = Object.keys(targetStorico).sort().reverse();
    if (mesiSalvati.length > 0) return targetStorico[mesiSalvati[0]];
    return { globale: 20000, br: 200 };
  }, [targetStorico, meseSelezionato]);

  const targetMensile = currentTargets.globale;
  const targetBassoRendente = currentTargets.br;

  const updateTargetMensile = (val: number) => {
    setTargetStorico(prev => {
      const currentBr = prev[meseSelezionato]?.br || targetBassoRendente;
      const newState = { ...prev, [meseSelezionato]: { globale: val, br: currentBr } };
      localStorage.setItem('tgest_target_storico', JSON.stringify(newState));
      return newState;
    });
  };

  const updateTargetBassoRendente = (val: number) => {
    setTargetStorico(prev => {
      const currentGlobale = prev[meseSelezionato]?.globale || targetMensile;
      const newState = { ...prev, [meseSelezionato]: { globale: currentGlobale, br: val } };
      localStorage.setItem('tgest_target_storico', JSON.stringify(newState));
      return newState;
    });
  };

  const [rubrica, setRubrica] = useState<RubricaData>(() => loadFromStorage('rubrica', {}));
  const [archive, setArchive] = useState<any[]>(() => loadFromStorage('tgest_archive', []));


  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        // Controlla se il browser supporta l'API
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('Wake Lock attivato: lo schermo non andrà in standby.');
          
          wakeLock.addEventListener('release', () => {
            console.log('Wake Lock rilasciato dal sistema.');
          });
        }
      } catch (err: any) {
        console.warn(`Errore Wake Lock: ${err.name}, ${err.message}`);
      }
    };

    // Richiede il blocco all'avvio dell'app
    requestWakeLock();

    // Gestisce il caso in cui l'utente cambia app e poi torna sulla nostra
    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock !== null) {
        wakeLock.release().then(() => {
          wakeLock = null;
        });
      }
    };
  }, []);

  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetNumeroFocus, setTargetNumeroFocus] = useState(() => Number(localStorage.getItem('tgest_quorum_focus')) || 10);
  const [targetNumeroAttivazioni, setTargetNumeroAttivazioni] = useState(() => Number(localStorage.getItem('tgest_quorum_attivazioni')) || 25);
  const [showKpiCleanupModal, setShowKpiCleanupModal] = useState(false);
  const [showKpiAssignModal, setShowKpiAssignModal] = useState(false);
  const [assignKpiSelection, setAssignKpiSelection] = useState({ fatturato: false, attivazione: false, prodotto: false, prodottoNome: '' });
  const [assignSearchTerm, setAssignSearchTerm] = useState('');
  const [selectedRivenditeForAssign, setSelectedRivenditeForAssign] = useState<Set<string>>(new Set());
  const [cleanupSelection, setCleanupSelection] = useState({ fatturato: false, attivazione: false, prodotto: false });
  const [tempTarget, setTempTarget] = useState(targetMensile.toString());

  const frasiTarget = {
    bassa: ["🚀 Inizia il viaggio! Ogni ordine conta.", "💪 Riscaldiamo i motori...", "🔭 Obiettivo nel mirino, partiamo!"],
    media: ["⚡️ Metà strada fatta! Continua così.", "🔥 Il ritmo è quello giusto, non mollare.", "📈 Stiamo crescendo, avanti tutta!"],
    alta: ["🏆 Sento odore di successo... Quasi fatta!", "🏁 Manca l'ultimo miglio, stringi i denti!", "✨ Il traguardo è a un passo!"],
    raggiunta: ["🎉 BOOM! Target distrutto! Grande lavoro!", "🏆 OBIETTIVO RAGGIUNTO! Ora festeggiamo!", "😎 Sopra il target! Sei inarrestabile!"]
  };

  const getFraseMotivazionale = (percentuale: number) => {
    let fascia: 'bassa' | 'media' | 'alta' | 'raggiunta' = 'bassa';
    if (percentuale >= 100) fascia = 'raggiunta';
    else if (percentuale >= 65) fascia = 'alta';
    else if (percentuale >= 35) fascia = 'media';
    
    const opzioni = frasiTarget[fascia];
    const index = percentuale % opzioni.length; 
    return opzioni[index];
  };

  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const savedMonth = localStorage.getItem('tgest_current_month');

    if (!savedMonth) {
      localStorage.setItem('tgest_current_month', currentMonth);
    } else if (savedMonth !== currentMonth) {
      const rubricaValues = Object.values(rubrica) as RivenditaExtra[];
      const brTargetizzati = rubricaValues.filter(r => r.hasTarget);
      
      // Calcolo fatto del mese precedente per l'archivio
      const [prevYear, prevMonth] = savedMonth.split('-').map(Number);
      const getFattoMese = (r: RivenditaExtra, month: number, year: number) => {
        return (r.history || []).reduce((acc, curr) => {
          if (curr.tipo === 'ORDINE') {
            const d = new Date(curr.data);
            if (d.getMonth() === (month - 1) && d.getFullYear() === year) {
              return acc + (Number(curr.importo) || 0);
            }
          }
          return acc;
        }, 0);
      };

      const brCompletati = brTargetizzati.filter(r => getFattoMese(r, prevMonth, prevYear) >= targetBassoRendente).length;
      const globalFatto = rubricaValues.reduce((acc, r) => acc + getFattoMese(r, prevMonth, prevYear), 0);

      const newArchiveEntry = { mese: savedMonth, brAssegnati: brTargetizzati.length, brCompletati, targetMensile, globalFatto };
      const currentArchive = loadFromStorage<any[]>('tgest_archive', []);
      const newArchiveList = [newArchiveEntry, ...currentArchive];
      
      localStorage.setItem('tgest_archive', JSON.stringify(newArchiveList));
      setArchive(newArchiveList);

      localStorage.setItem('tgest_current_month', currentMonth);
    }
  }, [rubrica, targetMensile, targetBassoRendente]);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [agendaHostessEdit, setAgendaHostessEdit] = useState<{id: string, extra: any, targetIndex: number} | null>(null);
  const [revisitModalId, setRevisitModalId] = useState<string | null>(null);
  const [showConfirmVisitModal, setShowConfirmVisitModal] = useState(false);
  const [showClearGiroConfirmModal, setShowClearGiroConfirmModal] = useState(false);
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  // Stato specifico per il caricamento sync dal FAB per non interferire con quello delle impostazioni
  const [fabSyncLoading, setFabSyncLoading] = useState(false);
  const [pendingVisitId, setPendingVisitId] = useState<string | null>(null);
  const [rubricaFilterStato, setRubricaFilterStato] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [capFilter, setCapFilter] = useState<string>('');
  const [zonaFilter, setZonaFilter] = useState<string>('');
  const [filterVisitata, setFilterVisitata] = useState<string>('');
  const [filterOrdine, setFilterOrdine] = useState<boolean>(false);
  const [rubricaSort, setRubricaSort] = useState<string>('dataVisitaAsc');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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

  const { 
    handleExportData, handleImportData, handleGenerateSyncCode, 
    handleImportFromSyncCode, exportHistoryToExcel, exportGiroForMyMaps, 
    handleClearAllData, isSyncing, generatedSyncCode, setGeneratedSyncCode, syncCodeInput, setSyncCodeInput 
  } = usePersistence({ 
    giroVisite, crmAnagrafiche, stores, rubrica, 
    setGiroVisite, setCrmAnagrafiche, setStores, setRubrica, 
    showToast, meseSelezionato, isDateInRange, setConfirmModal, setShowSettingsModal 
  });

  const riparaDatiStorici = useCallback(() => {
    setRubrica(prev => {
      const newRubrica = { ...prev };
      let count = 0;

      Object.keys(newRubrica).forEach(id => {
        const oldData = newRubrica[id] as any;
        const exists = [...crmAnagrafiche, ...stores, ...giroVisite].some(r => getRivenditaId(r) === id);
        const hasPendingData = oldData.richiestaOrdine || oldData.hasTarget || oldData.kpiAttivazione || oldData.kpiProdotto;
        
        if (!exists && !hasPendingData) {
          delete newRubrica[id];
          count++;
          return;
        }

        // Creazione nuovo indirizzo di memoria per innescare il re-rendering di React
        const data = { ...oldData, history: [...(oldData.history || [])] };

        // A. GESTIONE ORDINI (MIGRAZIONE)
        if (data.richiestaOrdine === true) {
          data.history.push({
            tipo: 'ORDINE',
            stato: 'DA_EVADERE',
            data: data.dataOrdine || new Date().toISOString(),
            importo: data.importoOrdine || 0,
            note: data.noteOrdine || ''
          });
          data.richiestaOrdine = false;
          data.dataOrdine = '';
          data.importoOrdine = 0;
          data.noteOrdine = '';
          count++;
        }

        // PER GLI ORDINI GIÀ IN HISTORY: Aggiungi stato DA_EVADERE se manca
        data.history = data.history.map((h: any) => {
          if (h.tipo === 'ORDINE' && !h.stato) {
            return { ...h, stato: 'DA_EVADERE' };
          }
          return h;
        });

        // B. GESTIONE HOSTESS (CONSOLIDAMENTO)
        if (data.ultimaHostessData || data.ultimaHostessInfo) {
          let hostessDate = data.ultimaHostessData || new Date().toISOString();
          // Normalizzazione data ISO se in formato IT
          if (hostessDate.includes('/') && !hostessDate.includes('T')) {
            const [d, m, y] = hostessDate.split('/');
            hostessDate = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0).toISOString();
          }

          data.history.push({
            tipo: 'HOSTESS',
            data: hostessDate,
            note: data.ultimaHostessInfo || 'Storico Hostess consolidato',
            importo: 0
          });

          delete data.ultimaHostessData;
          delete data.ultimaHostessInfo;
          delete data.hostessData;
          delete data.hostessInizio;
          delete data.hostessFine;
          count++;
        }

        // Riordina history per data decrescente
        if (data.history.length > 0) {
          data.history.sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
        }

        // Riapplica l'oggetto mutato allo stato
        newRubrica[id] = data;
      });

      if (count > 0) {
        showToast(`Riparati ${count} eventi storici!`);
        // Salvataggio forzato nel localStorage
        localStorage.setItem('rubrica', JSON.stringify(newRubrica));
      }
      return newRubrica;
    });
  }, [crmAnagrafiche, stores, giroVisite]);

  useEffect(() => {
    const seenVersion = localStorage.getItem('seen_changelog_version');
    // Mostra il changelog se è la prima volta o se la versione è cambiata
    if (seenVersion !== DATA_VERSION) {
      setShowChangelog(true);
    }
  }, []);

  useEffect(() => {
    const lastRepair = localStorage.getItem('last_repair_v');
    if (lastRepair !== '3.00') {
      riparaDatiStorici();
      localStorage.setItem('last_repair_v', '3.00');
    }
  }, [riparaDatiStorici]);

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

  const handleKpiCleanup = useCallback(() => {
    setRubrica(prev => {
      const newRubrica = { ...prev };
      Object.keys(newRubrica).forEach(id => {
        const data = newRubrica[id];
        let updated = false;
        const updates: any = {};

        if (cleanupSelection.fatturato && data.hasTarget) { updates.hasTarget = false; updated = true; }
        if (cleanupSelection.attivazione && data.kpiAttivazione) { updates.kpiAttivazione = false; updated = true; }
        if (cleanupSelection.prodotto && data.kpiProdotto) {
          updates.kpiProdotto = false;
          updates.kpiProdottoNome = '';
          updates.kpiProdottoCompletato = false;
          updated = true;
        }

        if (updated) {
          newRubrica[id] = { ...data, ...updates };
        }
      });
      return newRubrica;
    });
    setShowKpiCleanupModal(false);
    setCleanupSelection({ fatturato: false, attivazione: false, prodotto: false });
    showToast('Pulizia KPI completata con successo!', 'success');
  }, [cleanupSelection]);

  const handleKpiMassAssign = useCallback(() => {
    if (selectedRivenditeForAssign.size === 0) {
      showToast('Seleziona almeno una rivendita', 'info');
      return;
    }
    setRubrica(prev => {
      const newRubrica = { ...prev };
      selectedRivenditeForAssign.forEach(id => {
        const data = newRubrica[id] || {};
        const updates: any = {};
        if (assignKpiSelection.fatturato) updates.hasTarget = true;
        if (assignKpiSelection.attivazione) updates.kpiAttivazione = true;
        if (assignKpiSelection.prodotto) {
          updates.kpiProdotto = true;
          if (assignKpiSelection.prodottoNome) updates.kpiProdottoNome = assignKpiSelection.prodottoNome;
        }
        newRubrica[id] = { ...data, ...updates, isSavedToRubrica: true };
      });
      return newRubrica;
    });
    setShowKpiAssignModal(false);
    setAssignKpiSelection({ fatturato: false, attivazione: false, prodotto: false, prodottoNome: '' });
    setSelectedRivenditeForAssign(new Set());
    setAssignSearchTerm('');
    showToast('KPI assegnati con successo!', 'success');
  }, [assignKpiSelection, selectedRivenditeForAssign]);

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

  const handleCopyAddress = useCallback((address: string, id: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }, []);

  const handleRubricaUpdate = useCallback((id: string, field: keyof RivenditaExtra, value: any) => {
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
            ordinante: '',
            kpiAttivazione: false,
            kpiProdotto: false,
            kpiProdottoNome: '',
            kpiProdottoCompletato: false,
            visitata: '',
            giornoLevata: '',
            riferimento: '',
            telefono: '',
            pIva: '',
            mail: '',
            zona: '',
            richiestaOrdine: false,
            noteOrdine: '',
            dataOrdine: '',
            ordineEvaso: false,
            oraVisita: '',
            oraRivisita: '',
            lastDataVisita: '',
            lastOraVisita: '',
            importoOrdine: 0
          }),
          [field]: value,
          isSavedToRubrica
        }
      };
    });
  }, []);

  const handleActivitySave = useCallback((id: string, type: 'VISITA' | 'ORDINE' | 'HOSTESS', notes: string, amount: number = 0) => {
    setRubrica(prev => {
      const current = prev[id] || {};
      const history = [...(current.history || [])];
      
      let eventDate = new Date();
      let finalNotes = notes;

      if (type === 'ORDINE' && current.dataOrdine) {
        const [y, m, d] = current.dataOrdine.split('-');
        eventDate = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
      } else if (type === 'HOSTESS' && current.hostessData) {
        const [y, m, d] = current.hostessData.split('-');
        eventDate = new Date(Number(y), Number(m) - 1, Number(d));
        if (current.hostessInizio) {
          const [hh, mm] = current.hostessInizio.split(':');
          eventDate.setHours(Number(hh), Number(mm), 0, 0);
        } else {
          eventDate.setHours(12, 0, 0, 0);
        }
        if (current.hostessFine && !notes.includes('Fine turno')) {
          finalNotes = notes ? `${notes} (Fine turno: ${current.hostessFine})` : `Fine turno: ${current.hostessFine}`;
        }
      }

      const isoDateStr = eventDate.toISOString();
      const dateOnlyStr = isoDateStr.split('T')[0];

      // Anti-Duplicazione: sovrascrive se esiste già un evento dello stesso tipo in quel giorno
      const existingIndex = history.findIndex(h => h.tipo === type && h.data.startsWith(dateOnlyStr));
      if (existingIndex !== -1) {
        history[existingIndex] = { data: isoDateStr, tipo: type, note: finalNotes, importo: amount };
      } else {
        history.push({ data: isoDateStr, tipo: type, note: finalNotes, importo: amount });
      }

      history.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      const now = new Date();
      const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

      const updates: Partial<RivenditaExtra> = {
        history: history.slice(0, 20),
        richiestaOrdine: type === 'ORDINE' ? false : current.richiestaOrdine,
        ordineEvaso: type === 'ORDINE' ? false : current.ordineEvaso,
        noteOrdine: type === 'ORDINE' ? "" : current.noteOrdine,
        importoOrdine: type === 'ORDINE' ? 0 : current.importoOrdine
      };

      if (type === 'ORDINE' && current.stato !== 'Attivata') {
        updates.stato = 'Attivata';
      }

      if (type === 'HOSTESS' || (current.showHostessModule && current.hostessData && current.hostessInizio)) {
        updates.showHostessModule = false;
        updates.hostessData = "";
        updates.hostessInizio = "";
        updates.hostessFine = "";
        delete updates.ultimaHostessInfo;
      }

      if (type === 'VISITA') {
        updates.visitata = 'Si';
        updates.dataVisita = dateOnlyStr;
        updates.oraVisita = timeStr;
        updates.lastDataVisita = dateOnlyStr;
        updates.lastOraVisita = timeStr;
      }

      return { ...prev, [id]: { ...current, ...updates } };
    });
    
    showToast(type === 'ORDINE' ? 'Ordine evaso con successo!' : 'Attività salvata!', 'success');
  }, []);

  const reconcileHistoryData = React.useCallback((id: string, history: any[]) => {
    const sorted = [...history].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const lastVisita = sorted.find(h => h.tipo === 'VISITA');
    const oggiStr = new Date().toISOString().split('T')[0];
    
    setRubrica(prev => {
      const current = prev[id];
      if (!current) return prev;

      let nuovoStatoVisitata = current.visitata;

      if (lastVisita) {
        const lastDateStr = lastVisita.data.split('T')[0];
        if (lastDateStr === oggiStr) {
          nuovoStatoVisitata = 'Si';
        } else if (current.visitata === 'Si') {
          nuovoStatoVisitata = 'No'; // Annulla solo il giro di oggi, non azzera data/ora
        }
      } else {
        nuovoStatoVisitata = 'No';
      }

      return {
        ...prev,
        [id]: {
          ...current,
          history: sorted,
          visitata: nuovoStatoVisitata
        }
      };
    });
  }, []);

  const handleEditHistory = React.useCallback((id: string, index: number, newNote: string, newImporto: number, newData?: string, newOra?: string) => {
    setRubrica(prev => {
      const current = prev[id];
      if (!current || !current.history) return prev;
      const newHistory = [...current.history];
      
      let finalData = newHistory[index].data;
      if (newData && newOra) {
        finalData = `${newData}T${newOra}:00`;
      }

      newHistory[index] = { 
        ...newHistory[index], 
        note: newNote, 
        importo: newImporto,
        data: finalData
      };
      
      // Chiamata differita alla riconciliazione per pulizia e ordinamento
      setTimeout(() => reconcileHistoryData(id, newHistory), 0);
      
      return { ...prev, [id]: { ...current, history: newHistory } };
    });
  }, [reconcileHistoryData]);

  const handleDeleteHistory = React.useCallback((id: string, index: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Elimina Evento',
      message: 'Sei sicuro di voler eliminare questa voce dalla cronologia?',
      isDestructive: true,
      onConfirm: () => {
        setRubrica(prev => {
          const current = prev[id];
          if (!current || !current.history) return prev;
          const newHistory = [...current.history];
          newHistory.splice(index, 1);
          
          // Chiamata differita alla riconciliazione
          setTimeout(() => reconcileHistoryData(id, newHistory), 0);
          
          return { ...prev, [id]: { ...current, history: newHistory } };
        });
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [reconcileHistoryData]);

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
            ordinante: '',
            kpiAttivazione: false,
            kpiProdotto: false,
            kpiProdottoNome: '',
            kpiProdottoCompletato: false,
            visitata: '',
            giornoLevata: '',
            riferimento: '',
            telefono: '',
            pIva: '',
            mail: '',
            zona: '',
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

  const handleEnrich = useCallback(async (id: string, res: SearchResult) => {
    if (enrichedData[id]) return;
    if (aiLockedUntil) {
      showToast(`Attendi ${cooldownSeconds} secondi prima di un'altra ricerca.`, 'info');
      return;
    }
    
    try {
      setEnrichingId(id);
      const details = await enrichRivendita(res);
      setEnrichedData(prev => ({ ...prev, [id]: details }));
      
      if (details.notes?.includes('DEBUG AI:')) {
        showToast(details.notes, 'error');
        return;
      }

      if (details.zona && details.zona !== 'Non disponibile' && details.zona !== 'N/D') {
        handleRubricaUpdate(id, 'zona', details.zona);
      }
      showToast('Dati recuperati con successo!');

      // AGGIORNA IL CONTATORE GIORNALIERO AI SINCRONIZZATO CON GOOGLE
      const googleTodayStr = getGoogleResetDate();
      setDailyAiCount(prev => {
        const newCount = prev + 1;
        localStorage.setItem('ai_daily_usage', JSON.stringify({ date: googleTodayStr, count: newCount }));
        return newCount;
      });

      // LOGICA RATE LIMITING (Max 2 per minuto)
      const now = Date.now();
      setAiUsage(prev => {
        const newUsage = [...prev, now].filter(t => now - t < 60000);
        if (newUsage.length >= 2) {
          setAiLockedUntil(newUsage[0] + 60000); // Blocca per 60 sec dal PRIMO click
        }
        return newUsage;
      });

    } catch (err) {
      showToast('Errore durante la ricerca AI', 'error');
    } finally {
      setEnrichingId(null);
    }
  }, [enrichedData, handleRubricaUpdate, aiLockedUntil, cooldownSeconds]);

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
    
    handleActivitySave(id, 'VISITA', existing?.note || '');
    
    setRevisitModalId(id);
    setShowConfirmVisitModal(false);
    setPendingVisitId(null);
  }, [pendingVisitId, rubrica, handleActivitySave]);

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

  const giroVisiteList = useMemo(() => giroVisite, [giroVisite]);
  
  const allCrmList = useMemo(() => crmAnagrafiche, [crmAnagrafiche]);
  
  const crmList = useMemo(() => allCrmList.filter(res => {
    const id = getRivenditaId(res);
    const stato = rubrica[id]?.stato;
    // Mantiene la scheda visibile nel CRM durante la modifica, anche se si seleziona RIP
    if (activeTab === 'crm' && expandedCardId === id) return true;
    return stato !== 'RIP';
  }), [allCrmList, rubrica, activeTab, expandedCardId]);

  const filteredAssignList = useMemo(() => {
    if (!showKpiAssignModal) return [];
    const term = assignSearchTerm.trim().toUpperCase();
    return crmList.filter(r => {
       const num = r.isStore ? r.storeNumber : r['Num. Rivendita'];
       const comune = r['Comune'] || '';
       return num?.toString().toUpperCase().includes(term) || comune.toUpperCase().includes(term);
    });
  }, [showKpiAssignModal, crmList, assignSearchTerm]);

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
    const tabs = ['search', 'giro', 'agenda', 'crm', 'store'];
    provincesInCrm.forEach(p => tabs.push(`prov_${p}`));
    tabs.push('rip');
    tabs.push('kpi');
    tabs.push('statistiche');
    return tabs;
  }, [provincesInCrm]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setViewMode('list');
    setRivenditaFilter('');
    setComuneFilter('');
    setZonaFilter('');
    if (tab === 'giro') {
      setRubricaSort('none');
    }
    window.scrollTo(0, 0);
  }, []);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (activeTab === 'giro' && viewMode === 'map') return;
    
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
  }, [activeTab, getOrderedTabs, handleTabChange, viewMode]);

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

  const jumpToPosition = useCallback((fromIndex: number, toPosition: string) => {
    const toIndex = parseInt(toPosition) - 1; // Conversione da base 1 a base 0
    if (isNaN(toIndex) || toIndex < 0 || toIndex >= giroVisite.length || toIndex === fromIndex) return;

    setGiroVisite(prev => {
      const newArray = [...prev];
      const [movedItem] = newArray.splice(fromIndex, 1);
      newArray.splice(toIndex, 0, movedItem);
      return newArray;
    });
    showToast(`Spostato in posizione ${toPosition}`);
  }, [giroVisite.length, showToast]);

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
    
    const formattedComuni = list.map(res => {
      const c = (res['Comune'] || '').toUpperCase().trim();
      const p = (res['Prov.'] || '').toUpperCase().trim();
      return `${c} (${p})`;
    }).filter(val => val !== ' ()');
    return Array.from(new Set(formattedComuni)).sort();
  }, [activeTab, giroVisiteList, crmList, storeList, ripList]);

  const getUniqueZoneForTab = useCallback(() => {
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
    
    const zones = list.map(res => {
      const id = getRivenditaId(res);
      return (rubrica[id]?.zona || '').toUpperCase().trim();
    }).filter(z => z !== '' && z !== 'NON DISPONIBILE' && z !== 'N/D');
    
    return Array.from(new Set(zones)).sort();
  }, [activeTab, giroVisiteList, crmList, storeList, ripList, rubrica]);

  const getBaseListLength = useCallback(() => {
    if (activeTab === 'giro') return giroVisiteList.length;
    if (activeTab === 'crm') return crmList.length;
    if (activeTab === 'store') return storeList.length;
    if (activeTab === 'rip') return ripList.length;
    if (activeTab.startsWith('prov_')) {
      const prov = activeTab.replace('prov_', '');
      return [...crmList, ...storeList].filter(res => (res['Prov.'] || '').toUpperCase() === prov.toUpperCase()).length;
    }
    return 0;
  }, [activeTab, giroVisiteList, crmList, storeList, ripList]);

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
      const searchTarget = rivenditaFilter.trim();
      list = list.filter(res => {
        const num = res.isStore ? (res.storeNumber || res['Num. Rivendita']) : res['Num. Rivendita'];
        
        // Convertiamo entrambi in stringa per un confronto sicuro e preciso
        // Usiamo l'uguaglianza (===) invece di .includes()
        return num?.toString() === searchTarget;
      });
    }

    // Filtro Comune (Case Insensitive)
    if (comuneFilter) {
      list = list.filter(res => {
        const c = (res['Comune'] || '').toUpperCase().trim();
        const p = (res['Prov.'] || '').toUpperCase().trim();
        return `${c} (${p})` === comuneFilter;
      });
    }

    // Filtro CAP
    if (capFilter) {
      list = list.filter(res => {
        const id = getRivenditaId(res);
        const manualCap = rubrica[id]?.manualCap || '';
        return manualCap.toString().includes(capFilter);
      });
    }

    // Filtro Zona (Case Insensitive)
    if (zonaFilter) {
      list = list.filter(res => {
        const id = getRivenditaId(res);
        const z = (rubrica[id]?.zona || '').toUpperCase().trim();
        return z === zonaFilter;
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

    // Filtro Ordini da Evadere (Ottimizzato v2.95)
    if (filterOrdine) {
      list = list.filter(res => {
        const extra = rubrica[getRivenditaId(res)];
        return extra && extra.richiestaOrdine === true && extra.ordineEvaso === false;
      });
    }

    return list;
  }, [activeTab, results, giroVisiteList, crmList, storeList, ripList, rivenditaFilter, comuneFilter, capFilter, zonaFilter, rubricaFilterStato, filterVisitata, filterOrdine, rubrica]);

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
      
      // Funzione per ottenere il valore di confronto
      const getCompareValue = (item: any, extra: any) => {
        if (rubricaSort === 'dataVisitaAsc') {
          return extra?.dataVisita ? getDateTime(extra.dataVisita, extra.oraVisita) : null;
        }
        if (rubricaSort === 'dataRivisitaAsc') {
          return extra?.dataRivisita ? getDateTime(extra.dataRivisita, extra.oraRivisita) : null;
        }
        const val = item[rubricaSort];
        return (val !== undefined && val !== null && val !== '') ? val : null;
      };

      const valA = getCompareValue(a, extraA);
      const valB = getCompareValue(b, extraB);

      // Gestione valori vuoti: sempre in fondo indipendentemente dal verso
      if (valA === null && valB !== null) return 1;
      if (valA !== null && valB === null) return -1;
      if (valA === null && valB === null) return 0;

      let result = 0;
      
      // Se sono numeri (timestamp o altro)
      if (typeof valA === 'number' && typeof valB === 'number') {
        result = valA - valB;
      } else {
        // Gestione ordinamento numerico per stringhe (es. Numero Rivendita)
        const numA = Number(valA);
        const numB = Number(valB);
        
        if (!isNaN(numA) && !isNaN(numB)) {
          result = numA - numB;
        } else {
          const sA = String(valA).toLowerCase();
          const sB = String(valB).toLowerCase();
          if (sA < sB) result = -1;
          else if (sA > sB) result = 1;
        }
      }
      
      return sortOrder === 'asc' ? result : -result;
    });
  }, [getCurrentList, activeTab, rubricaSort, sortOrder, rubrica]);

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

  const allRivendite = useMemo(() => [...crmAnagrafiche, ...stores, ...giroVisite], [crmAnagrafiche, stores, giroVisite]);
  const combinedRivendite = useMemo(() => [...crmAnagrafiche, ...stores], [crmAnagrafiche, stores]);

  const orderStats = useMemo(() => {
    return calculateOrderStats(rubrica, allRivendite, isDateInRange);
  }, [rubrica, crmAnagrafiche, stores, giroVisite, meseSelezionato, statsPeriod, customRange, activeTab]);

  const crmStats = useMemo(() => {
    return calculateCrmStats(rubrica, combinedRivendite, isDateInRange);
  }, [crmAnagrafiche, stores, rubrica, meseSelezionato, statsPeriod, customRange, activeTab]);

  const brStats = useMemo(() => {
    return calculateBrStats(rubrica, targetBassoRendente, meseSelezionato);
  }, [rubrica, targetBassoRendente, meseSelezionato, statsPeriod, customRange, activeTab]);

  const kpiStats = useMemo(() => {
    return calculateKpiStats(rubrica, targetBassoRendente, meseSelezionato, allRivendite);
  }, [rubrica, targetBassoRendente, allRivendite, meseSelezionato, statsPeriod, customRange, activeTab]);

  const visitStats = useMemo(() => {
    return calculateVisitStats(rubrica, combinedRivendite, giroVisite, isDateInRange);
  }, [rubrica, crmAnagrafiche, stores, giroVisite, meseSelezionato, statsPeriod, customRange, activeTab]);

  const fatturatoPeriodo = useMemo(() => {
    return calculateFatturatoPeriodo(rubrica, isDateInRange);
  }, [rubrica, meseSelezionato, statsPeriod, customRange, activeTab]);

  const sortedList = getSortedList;

  const cardProps = useMemo(() => ({
    activeTab,
    expandedCardId,
    enrichingId,
    toggleSave,
    removeFromCrm,
    initiateVisitToggle,
    handleRubricaUpdate,
    handleActivitySave,
    toggleExpandCard,
    handleEnrich,
    addToCrm,
    setExpandedCardId,
    handleStoreUpdate,
    removeStore,
    moveCard,
    jumpToPosition,
    setShareModal,
    showToast,
    setGiroVisite,
    openRevisitModal: setRevisitModalId,
    aiLockedUntil,
    cooldownSeconds,
    handleEditHistory,
    handleDeleteHistory,
    targetBassoRendente,
    targetMensile
  }), [
    activeTab,
    expandedCardId,
    enrichingId,
    toggleSave,
    removeFromCrm,
    initiateVisitToggle,
    handleRubricaUpdate,
    handleActivitySave,
    toggleExpandCard,
    handleEnrich,
    addToCrm,
    handleStoreUpdate,
    removeStore,
    moveCard,
    jumpToPosition,
    setShareModal,
    showToast,
    setGiroVisite,
    setRevisitModalId,
    aiLockedUntil,
    cooldownSeconds,
    handleEditHistory,
    handleDeleteHistory,
    targetBassoRendente,
    targetMensile
  ]);

  // --- GESTIONE TASTO INDIETRO ANDROID (HARDWARE BACK BUTTON) ---
  const uiStateRef = useRef<any>({});
  useEffect(() => {
    // Memorizziamo lo stato attuale della UI senza innescare re-render continui
    uiStateRef.current = {
      expandedCardId, showSettingsModal, showCreateStoreModal, revisitModalId,
      showConfirmVisitModal, showClearGiroConfirmModal, showTargetModal, showKpiCleanupModal, showKpiAssignModal, showGuideModal,
      confirmModalOpen: confirmModal.isOpen, shareModalOpen: shareModal.isOpen,
      showChangelog, fabMenuOpen, activeTab
    };
  });

  const exitPromptRef = useRef(false);

  useEffect(() => {
    // Inizializza la "trappola" nella cronologia del browser
    window.history.pushState({ isApp: true }, '');

    const handlePopState = () => {
      const s = uiStateRef.current;

      // 1. Chiusura Popup e Modali (Priorità Massima)
      if (
        s.expandedCardId || s.showSettingsModal || s.showCreateStoreModal || 
        s.revisitModalId || s.showConfirmVisitModal || s.showClearGiroConfirmModal || 
        s.showTargetModal || s.showKpiCleanupModal || s.showKpiAssignModal || s.showGuideModal || s.confirmModalOpen || 
        s.shareModalOpen || s.showChangelog || s.fabMenuOpen
      ) {
        window.history.pushState({ isApp: true }, ''); // Ripristina la trappola
        setExpandedCardId(null); setShowSettingsModal(false); setShowCreateStoreModal(false);
        setRevisitModalId(null); setShowConfirmVisitModal(false); setShowClearGiroConfirmModal(false);
        setShowTargetModal(false); setShowKpiCleanupModal(false); setShowKpiAssignModal(false); setShowGuideModal(false); 
        setConfirmModal(prev => ({ ...prev, isOpen: false })); setShareModal(prev => ({ ...prev, isOpen: false }));
        setShowChangelog(false); setFabMenuOpen(false);
        return;
      }

      // 2. Ritorno alla Home (Scheda Giro)
      if (s.activeTab !== 'giro') {
        window.history.pushState({ isApp: true }, ''); // Ripristina la trappola
        setActiveTab('giro'); setViewMode('list'); 
        setRivenditaFilter(''); setComuneFilter(''); setZonaFilter(''); setRubricaSort('none'); 
        window.scrollTo(0, 0);
        return;
      }

      // 3. Uscita con doppio tap se siamo già in Home
      if (!exitPromptRef.current) {
        window.history.pushState({ isApp: true }, ''); // Ripristina la trappola per catturare il secondo tap
        exitPromptRef.current = true;
        
        // Utilizza la funzione nativa dell'app che gestisce l'auto-chiusura in sicurezza
        showToast('Premi di nuovo indietro per uscire', 'info');
        
        setTimeout(() => {
          exitPromptRef.current = false;
        }, 2000);
      } else {
        // L'utente ha premuto due volte entro 2 secondi. Uscita dall'app.
        window.history.go(-2);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans" style={{ overscrollBehaviorY: 'contain' }}>
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 z-30">
        <div className="max-w-md mx-auto px-3 py-3">
          <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden p-1 scroll-smooth [webkit-overflow-scrolling:touch] [transform:translateZ(0)] [will-change:scroll-position] whitespace-nowrap">
            <button id="tab-search" onClick={() => handleTabChange('search')} className={`flex-none px-5 py-3 text-sm font-bold rounded-2xl transition-all ${activeTab === 'search' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Cerca</button>
            <button id="tab-giro" onClick={() => handleTabChange('giro')} className={`flex-none px-5 py-3 text-sm font-bold rounded-2xl transition-all ${activeTab === 'giro' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Giro ({giroVisiteList.length})</button>
            <button id="tab-agenda" onClick={() => handleTabChange('agenda')} className={`flex-none px-5 py-3 text-sm font-bold rounded-2xl transition-all ${activeTab === 'agenda' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Agenda</button>
            <button id="tab-crm" onClick={() => handleTabChange('crm')} className={`flex-none px-5 py-3 text-sm font-bold rounded-2xl transition-all ${activeTab === 'crm' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>CRM ({crmList.length})</button>
            <button id="tab-store" onClick={() => handleTabChange('store')} className={`flex-none px-5 py-3 text-sm font-bold rounded-2xl transition-all ${activeTab === 'store' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Store ({storeList.length})</button>
            
            {provincesInCrm.map(prov => (
              <button key={prov} id={`tab-prov_${prov}`} onClick={() => handleTabChange(`prov_${prov}`)} className={`flex-none px-5 py-3 text-sm font-bold rounded-2xl transition-all ${activeTab === `prov_${prov}` ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{prov}</button>
            ))}

            <button id="tab-rip" onClick={() => handleTabChange('rip')} className={`flex-none px-5 py-3 text-sm font-bold rounded-2xl transition-all ${activeTab === 'rip' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>RIP ({ripList.length})</button>
            
            <button id="tab-kpi" onClick={() => { handleTabChange('kpi'); setRivenditaFilter(''); setComuneFilter(''); }} className={`flex-none px-5 py-3 text-sm font-bold rounded-2xl transition-all ${activeTab === 'kpi' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>KPI</button>
            
            <button id="tab-statistiche" onClick={() => { handleTabChange('statistiche'); setRivenditaFilter(''); setComuneFilter(''); }} className={`flex-none px-5 py-3 text-sm font-bold rounded-2xl transition-all ${activeTab === 'statistiche' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Statistiche</button>
          </div>
        </div>
      </nav>

      <main className="max-w-md mx-auto p-4 space-y-6 overflow-hidden" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
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
              className="w-full h-14 bg-gradient-to-b from-brand-500 to-brand-600 text-white font-bold rounded-2xl border border-brand-700 border-b-[4px] hover:brightness-110 active:border-b active:translate-y-[3px] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
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
                          jumpToPosition={jumpToPosition}
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
            {activeTab !== 'kpi' && activeTab !== 'statistiche' && (
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                  {activeTab === 'giro' ? `Giro Visite (${giroVisiteList.length})` : 
                   activeTab === 'crm' ? `CRM (${crmList.length})` : 
                   activeTab === 'store' ? `Store (${storeList.length})` :
                   activeTab === 'rip' ? `RIP (${ripList.length})` : 
                   `${activeTab.replace('prov_', '')} (${getCurrentList.length})`}
                </h2>
                {activeTab === 'store' && (
                  <button
                    onClick={() => setShowCreateStoreModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white hover:bg-brand-700 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    Aggiungi Store
                  </button>
                )}
                {activeTab === 'giro' && giroVisite.length > 0 && (
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-sm">
                    <button onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')} className={`p-2 rounded-lg transition-all ${viewMode === 'map' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`} title={viewMode === 'map' ? 'Torna alla Lista' : 'Vedi Mappa'}>
                      {viewMode === 'map' ? <List className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                    </button>
                    <div className="w-px h-5 bg-slate-300 mx-1"></div>
                    <button onClick={exportGiroForMyMaps} className="p-2 rounded-lg text-emerald-600 hover:bg-white hover:shadow-sm transition-all" title="Esporta per My Maps">
                      <Download className="w-4 h-4" />
                    </button>
                    <div className="w-px h-5 bg-slate-300 mx-1"></div>
                    <button onClick={() => setShowClearGiroConfirmModal(true)} className="p-2 rounded-lg text-red-500 hover:bg-white hover:shadow-sm transition-all" title="Svuota Giro">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

              {/* Filtri Comuni */}
              {activeTab !== 'statistiche' && activeTab !== 'kpi' && (
                <div className="flex flex-row gap-2 items-center">
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

                  {(activeTab === 'crm' || activeTab.startsWith('prov_')) && (
                    <button 
                      onClick={() => setShowKpiAssignModal(true)}
                      className="flex items-center justify-center w-11 h-11 bg-slate-100 text-indigo-600 border border-slate-200/60 rounded-xl hover:bg-white hover:shadow-sm transition-all shrink-0"
                      title="Assegnazione Massiva KPI"
                    >
                      <Wand2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {getBaseListLength() > 0 && activeTab !== 'search' && (
              <div className="mt-2 bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden transition-all shadow-sm mx-1">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="w-full flex items-center justify-between p-3 text-brand-700 font-bold text-xs uppercase tracking-wider hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5" /> Filtri Avanzati
                    {/* Indicatore luminoso se c'è almeno un filtro attivo */}
                    {(rubricaFilterStato || filterVisitata || filterOrdine || capFilter || zonaFilter || rubricaSort !== 'none') && (
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
                    <div className="space-y-1">
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
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Zona / Quartiere</label>
                      <select
                        value={zonaFilter}
                        onChange={(e) => setZonaFilter(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium shadow-sm"
                      >
                        <option value="">Tutte le zone</option>
                        {getUniqueZoneForTab().map(zona => (
                          <option key={zona} value={zona}>{zona}</option>
                        ))}
                      </select>
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
                    <div className="space-y-1 col-span-2">
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
                      <div className="flex items-center gap-2">
                        <select
                          value={rubricaSort}
                          onChange={(e) => setRubricaSort(e.target.value)}
                          className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium shadow-sm"
                        >
                          <option value="none">Nessun ordine</option>
                          <option value="Num. Rivendita">Numero Rivendita</option>
                          <option value="Comune">Comune</option>
                          <option value="dataVisitaAsc">Ultima Visita</option>
                          <option value="dataRivisitaAsc">Prossimo Appuntamento</option>
                        </select>
                        
                        <button
                          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                          className="w-10 h-10 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors shrink-0"
                          title={sortOrder === 'asc' ? "Ordine Crescente (A-Z)" : "Ordine Decrescente (Z-A)"}
                        >
                          {sortOrder === 'asc' ? (
                            <ArrowDownAZ className="w-5 h-5 text-brand-600" />
                          ) : (
                            <ArrowUpZA className="w-5 h-5 text-brand-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'kpi' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between px-1 mb-4">
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight">KPI e Target</h2>
                  
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-sm">
                    <button 
                      onClick={() => setShowKpiCleanupModal(true)}
                      className="p-2 rounded-lg text-amber-500 hover:bg-white hover:shadow-sm transition-all"
                      title="Pulizia Massiva Campagne"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    <div className="w-px h-5 bg-slate-300 mx-1"></div>
                    <div className="relative inline-flex items-center">
                      <input 
                        type="month" 
                        value={meseSelezionato} 
                        onChange={(e) => setMeseSelezionato(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50 m-0 p-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                      <div className="flex items-center gap-1.5 p-2 rounded-lg text-brand-600 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                        <span className="text-xs font-bold capitalize">
                          {new Date(meseSelezionato + '-01').toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}
                        </span>
                        <Calendar className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>

              {kpiStats.lista.length === 0 ? (
                  <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                      <BarChart3 className="w-10 h-10 text-slate-300" />
                    </div>
                    <div>
                      <p className="text-slate-800 font-bold">Nessun dato registrato</p>
                      <p className="text-xs text-slate-500 mt-1">Non ci sono KPI o target per il mese selezionato.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* TARGET MENSILE GLOBALE */}
                    {(() => {
                      const percentuale = targetMensile > 0 ? Math.min(Math.round((fatturatoPeriodo / targetMensile) * 100), 100) : 0;
                      const mancano = Math.max(targetMensile - fatturatoPeriodo, 0);
                      return (
                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm mb-4">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col gap-1 flex-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Obiettivo Globale Mensile</span>
                              <button onClick={() => { setTempTarget(targetMensile.toString()); setShowTargetModal(true); }} className="flex items-center gap-2 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-xl border border-brand-100 transition-colors active:scale-95 w-fit">
                                <span className="text-xs font-black text-brand-700">€{targetMensile.toLocaleString('it-IT')}</span>
                                <Edit3 className="w-3 h-3 text-brand-500" />
                              </button>
                            </div>
                            <div className="text-right"><p className="text-2xl font-black text-brand-600">{percentuale}%</p></div>
                          </div>
                          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner relative">
                            <div className="h-full bg-gradient-to-r from-brand-300 to-brand-600 rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${percentuale}%` }}>
                              <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/20 rounded-full blur-[1px]"></div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center mt-3 px-1">
                            <p className="text-[10px] font-bold text-slate-400 italic">{fatturatoPeriodo >= targetMensile ? "OBIETTIVO RAGGIUNTO! 🏆" : `MANCANO €${mancano.toLocaleString('it-IT')}`}</p>
                            <p className="text-[10px] font-bold text-slate-400">€{fatturatoPeriodo.toLocaleString('it-IT')} / €{targetMensile.toLocaleString('it-IT')}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* RIEPILOGO KPI SECONDARI */}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-indigo-900 text-sm flex items-center gap-2">🎯 KPI Fatturato ({targetBassoRendente}€)</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5">Rivendite che hanno superato la soglia</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-indigo-600">{kpiStats.fatturato.completati}</span>
                          <span className="text-xs font-bold text-slate-400"> / {kpiStats.fatturato.assegnati}</span>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-emerald-900 text-sm flex items-center gap-2">🚀 KPI Attivazioni</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5">Rivendite che hanno fatto il 1° ordine</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-emerald-600">{kpiStats.attivazione.completati}</span>
                          <span className="text-xs font-bold text-slate-400"> / {kpiStats.attivazione.assegnati}</span>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-sm flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-purple-900 text-sm flex items-center gap-2">📦 KPI Prodotti</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5">Prodotti specifici piazzati</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-purple-600">{kpiStats.prodotto.completati}</span>
                          <span className="text-xs font-bold text-slate-400"> / {kpiStats.prodotto.assegnati}</span>
                        </div>
                      </div>
                    </div>

                    {/* LISTA RIVENDITE IN KPI */}
                    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                      <h3 className="font-bold text-slate-800 mb-3 text-sm">Dettaglio Rivendite in KPI</h3>
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {kpiStats.lista.map(k => (
                          <div key={k.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="text-xs font-bold text-slate-800">{k.nome}</p>
                                <p className="text-[10px] text-slate-500">{k.comune}</p>
                              </div>
                              <button onClick={() => { setRivenditaFilter(k.soloNumero); setActiveTab('crm'); }} className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                                <ChevronRight className="w-3 h-3 text-slate-400" />
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {k.hasTarget && (
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${k.fattoMese >= targetBassoRendente ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}>🎯 {k.fattoMese.toFixed(0)}€ / {targetBassoRendente}€</span>
                              )}
                              {k.kpiAttivazione && (
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${k.fattoMese > 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200'}`}>🚀 Attivazione</span>
                              )}
                              {k.kpiProdotto && (
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${k.kpiProdottoCompletato ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-white text-slate-500 border-slate-200'}`}>📦 {k.kpiProdottoNome || 'Prodotto'}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : activeTab === 'agenda' ? (
              <AgendaTab 
                visitStats={visitStats}
                rubrica={rubrica}
                crmAnagrafiche={crmAnagrafiche}
                stores={stores}
                giroVisite={giroVisite}
                setGiroVisite={setGiroVisite}
                setRivenditaFilter={setRivenditaFilter}
                setActiveTab={setActiveTab}
                setAgendaHostessEdit={setAgendaHostessEdit}
                showToast={showToast}
              />
            ) : activeTab === 'statistiche' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between px-1 mb-2">
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight">Le tue Statistiche</h2>
                  <button 
                    onClick={() => setStatsPeriod(statsPeriod === 'custom' ? 'oggi' : 'custom')}
                    className={`p-2.5 rounded-xl border transition-all shadow-sm ${statsPeriod === 'custom' ? 'bg-brand-600 text-white border-brand-700' : 'bg-slate-100 text-brand-600 border-slate-200 hover:bg-white'}`}
                    title="Intervallo personalizzato"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>

                {/* FILTRI PERIODO */}
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 space-y-3">
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    {['oggi', '7g', 'mese', 'mese_prec', 'all'].map((p) => {
                      let label = p;
                      if (p === 'all') label = 'Sempre';
                      if (p === 'mese') label = new Date().toLocaleDateString('it-IT', { month: 'short' });
                      if (p === 'mese_prec') {
                        const prev = new Date();
                        prev.setMonth(prev.getMonth() - 1);
                        label = prev.toLocaleDateString('it-IT', { month: 'short' });
                      }
                      return (
                        <button key={p} onClick={() => setStatsPeriod(p as any)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg capitalize transition-all ${statsPeriod === p ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {statsPeriod === 'custom' && (
                    <div className="flex gap-2 animate-in fade-in zoom-in-95">
                      <input type="date" value={customRange.start} onChange={(e) => setCustomRange(prev => ({...prev, start: e.target.value}))} className="flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                      <input type="date" value={customRange.end} onChange={(e) => setCustomRange(prev => ({...prev, end: e.target.value}))} className="flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                    </div>
                  )}
                </div>

                <div className="px-1">
                  <button
                    onClick={exportHistoryToExcel}
                    className="w-full mt-2 py-4 bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-black rounded-2xl border border-emerald-700 border-b-[4px] hover:brightness-110 active:border-b active:translate-y-[3px] flex items-center justify-center gap-3 transition-all shadow-md mb-6"
                  >
                    <Download className="w-5 h-5" />
                    ESPORTA STORICO EXCEL (.CSV)
                  </button>
                </div>

                {visitStats.vPeriodo === 0 && orderStats.daEvadere === 0 && orderStats.evasi === 0 && fatturatoPeriodo === 0 && visitStats.rimanentiGiro === 0 && visitStats.prossimi.length === 0 ? (
                  <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                      <BarChart3 className="w-10 h-10 text-slate-300" />
                    </div>
                    <div>
                      <p className="text-slate-800 font-bold">Nessun dato registrato</p>
                      <p className="text-xs text-slate-500 mt-1">Non ci sono attività, ordini, o rivendite nel giro in questo momento.</p>
                    </div>
                  </div>
                ) : (
                  <>
                
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
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="bg-emerald-50 p-2.5 rounded-2xl border border-emerald-100">
              <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider leading-tight">Visite<br/>Completate</p>
              <p className="text-xl font-black text-emerald-900">{visitStats.vPeriodo}</p>
            </div>
            <div className="bg-orange-50 p-2.5 rounded-2xl border border-orange-100">
              <p className="text-[9px] font-bold text-orange-700 uppercase tracking-wider leading-tight">Rimanenti<br/>nel Giro</p>
              <p className="text-xl font-black text-orange-900">{visitStats.rimanentiGiro}</p>
            </div>
            <div className="bg-brand-50 p-2.5 rounded-2xl border border-brand-100">
              <p className="text-[9px] font-bold text-brand-600 uppercase tracking-wider leading-tight">Fatturato<br/>Totale</p>
              <p className="text-xl font-black text-brand-900">{fatturatoPeriodo.toLocaleString('it-IT')}€</p>
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

          {/* LISTA RIMANENTI NEL GIRO */}
          {visitStats.listaRimanenti.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mt-4 border-t border-slate-100 pt-4">
              <h4 className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-2">Rimanenti nel Giro</h4>
              {visitStats.listaRimanenti.map((v: any) => (
                <div key={v.id} className="p-3 bg-orange-50/50 border border-orange-100 rounded-xl flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{v.nome}</p>
                    <p className="text-[10px] text-slate-500">{v.comune}</p>
                  </div>
                  <button 
                    onClick={() => { setRivenditaFilter(v.soloNumero); setActiveTab('crm'); }} 
                    className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
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
              </>
            )}
          </div>
        ) : activeTab === 'giro' ? (
              viewMode === 'map' ? (
                <MapView results={getSortedList} />
              ) : getSortedList.length === 0 ? (
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
                  {getSortedList.map((res: SearchResult) => {
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
                          jumpToPosition={jumpToPosition}
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
                        jumpToPosition={jumpToPosition}
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
      <div className="fixed right-6 z-40 h-16 w-16" style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
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

      {agendaHostessEdit && (
        <QuickEditModal
          isOpen={true}
          onClose={() => setAgendaHostessEdit(null)}
          editType={agendaHostessEdit.extra.history[agendaHostessEdit.targetIndex]?.tipo || 'HOSTESS'}
          rivenditaId={agendaHostessEdit.id}
          extra={agendaHostessEdit.extra}
          onUpdateRubrica={handleRubricaUpdate}
          onEditHistory={handleEditHistory}
          targetHistoryIndex={agendaHostessEdit.targetIndex}
        />
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
                    onClick={riparaDatiStorici}
                    className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4 text-brand-600" />
                    Riparazione Dati Storici
                  </button>

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
                  
                  {/* CONTATORE AI CON FORMATTAZIONE ITALIANA */}
                  <div className="py-1 border-y border-amber-200/50 my-1">
                    <p>Richieste AI Oggi: <span className={`font-bold ${dailyAiCount >= 1450 ? 'text-red-600' : ''}`}>{dailyAiCount} / 1500</span></p>
                    <p className="text-[9px] text-amber-600/70 italic mt-0.5">* Il contatore si azzera alle 09:00 (Ora Italiana)</p>
                  </div>

                  {/* TARGET GLOBALE (v2.5) */}
                  <div className="py-2 border-b border-amber-200/50 mb-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs">Target Mensile (€):</span>
                      <input type="number" inputMode="decimal" value={targetMensile} onChange={(e) => updateTargetMensile(parseFloat(e.target.value) || 0)} className="w-24 h-8 px-2 bg-white border border-amber-300 rounded-lg text-right font-black text-brand-700 outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs">Target Focus Mensile (€):</span>
                      <input type="number" inputMode="decimal" value={targetBassoRendente} onChange={(e) => updateTargetBassoRendente(parseFloat(e.target.value) || 0)} className="w-24 h-8 px-2 bg-white border border-amber-300 rounded-lg text-right font-black text-brand-700 outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                  </div>

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
                  className="w-full py-2.5 bg-gradient-to-b from-red-500 to-red-600 text-white font-bold rounded-2xl border border-red-700 border-b-[4px] hover:brightness-110 active:border-b active:translate-y-[3px] text-xs transition-all shadow-md"
                >
                  Cancella Tutto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <StoreModal
        isOpen={showCreateStoreModal}
        onClose={() => setShowCreateStoreModal(false)}
        onCreateStore={handleCreateStore}
      />

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

      {/* KPI Mass Assign Modal */}
      {showKpiAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl relative z-[210] p-5 sm:p-6 flex flex-col h-[85vh] sm:h-[80vh] animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-indigo-600" /> Assegnazione KPI
              </h3>
              <button onClick={() => setShowKpiAssignModal(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="overflow-y-auto pr-1 space-y-5 flex-1 flex flex-col">
              {/* STEP 1: Cosa assegnare */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shrink-0">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">1. Seleziona Obiettivi</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-white cursor-pointer transition-colors">
                    <input type="checkbox" checked={assignKpiSelection.fatturato} onChange={(e) => setAssignKpiSelection(prev => ({...prev, fatturato: e.target.checked}))} className="w-5 h-5 text-brand-600 rounded border-slate-300 focus:ring-brand-500" />
                    <span className="text-sm font-bold text-slate-700">KPI Fatturato (Globale)</span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-white cursor-pointer transition-colors">
                    <input type="checkbox" checked={assignKpiSelection.attivazione} onChange={(e) => setAssignKpiSelection(prev => ({...prev, attivazione: e.target.checked}))} className="w-5 h-5 text-brand-600 rounded border-slate-300 focus:ring-brand-500" />
                    <span className="text-sm font-bold text-slate-700">KPI Attivazione</span>
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-white cursor-pointer transition-colors">
                      <input type="checkbox" checked={assignKpiSelection.prodotto} onChange={(e) => setAssignKpiSelection(prev => ({...prev, prodotto: e.target.checked}))} className="w-5 h-5 text-brand-600 rounded border-slate-300 focus:ring-brand-500" />
                      <span className="text-sm font-bold text-slate-700">KPI Prodotto Specifico</span>
                    </label>
                    {assignKpiSelection.prodotto && (
                      <input 
                        type="text" 
                        placeholder="Nome prodotto (es. Waka Ultra)"
                        value={assignKpiSelection.prodottoNome}
                        onChange={(e) => setAssignKpiSelection(prev => ({...prev, prodottoNome: e.target.value}))}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* STEP 2: A chi assegnare */}
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">2. Seleziona Rivendite</h4>
                  <button 
                    onClick={() => {
                      if (selectedRivenditeForAssign.size === filteredAssignList.length) {
                        setSelectedRivenditeForAssign(new Set());
                      } else {
                        setSelectedRivenditeForAssign(new Set(filteredAssignList.map(r => getRivenditaId(r))));
                      }
                    }}
                    className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-md"
                  >
                    {selectedRivenditeForAssign.size === filteredAssignList.length && filteredAssignList.length > 0 ? 'Deseleziona Tutto' : 'Seleziona Tutto'}
                  </button>
                </div>
                
                <div className="relative mb-3 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Cerca numero o comune..."
                    value={assignSearchTerm}
                    onChange={(e) => setAssignSearchTerm(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                  {filteredAssignList.length === 0 ? (
                    <p className="text-xs text-center text-slate-400 py-4 italic">Nessuna rivendita trovata.</p>
                  ) : (
                    filteredAssignList.map(r => {
                      const id = getRivenditaId(r);
                      const isChecked = selectedRivenditeForAssign.has(id);
                      return (
                        <label key={id} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={(e) => {
                              const newSet = new Set(selectedRivenditeForAssign);
                              if (e.target.checked) newSet.add(id);
                              else newSet.delete(id);
                              setSelectedRivenditeForAssign(newSet);
                            }}
                            className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" 
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{r.isStore ? r.storeName : `Riv. ${r['Num. Rivendita']}`}</p>
                            <p className="text-[10px] text-slate-500 truncate">{r['Comune']}</p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
              <button
                onClick={handleKpiMassAssign}
                disabled={selectedRivenditeForAssign.size === 0 || (!assignKpiSelection.fatturato && !assignKpiSelection.attivazione && !assignKpiSelection.prodotto)}
                className="w-full py-4 bg-gradient-to-b from-brand-500 to-brand-600 text-white font-bold rounded-2xl border border-brand-700 border-b-[4px] hover:brightness-110 active:border-b active:translate-y-[3px] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Wand2 className="w-4 h-4" /> Assegna a {selectedRivenditeForAssign.size} rivendite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cleanup Modal */}
      {showKpiCleanupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl relative z-[210] p-6 animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-brand-600" /> Pulizia Campagne
              </h3>
              <button onClick={() => setShowKpiCleanupModal(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <p className="text-sm text-slate-500 mb-6">
              Seleziona gli obiettivi che desideri rimuovere <b>da tutte le rivendite in rubrica</b> in un colpo solo. Le statistiche mensili non verranno alterate.
            </p>

            <div className="space-y-3 mb-8">
              <label className="flex items-center justify-between p-3 rounded-xl border border-indigo-100 bg-indigo-50/50 cursor-pointer active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={cleanupSelection.fatturato} onChange={(e) => setCleanupSelection(prev => ({...prev, fatturato: e.target.checked}))} className="w-5 h-5 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500" />
                  <span className="text-sm font-bold text-indigo-900">KPI Fatturato</span>
                </div>
                <span className="text-xs font-black text-indigo-500 bg-white px-2 py-1 rounded-md shadow-sm">{kpiStats.fatturato.assegnati} assegnati</span>
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 cursor-pointer active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={cleanupSelection.attivazione} onChange={(e) => setCleanupSelection(prev => ({...prev, attivazione: e.target.checked}))} className="w-5 h-5 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500" />
                  <span className="text-sm font-bold text-emerald-900">KPI Attivazione</span>
                </div>
                <span className="text-xs font-black text-emerald-500 bg-white px-2 py-1 rounded-md shadow-sm">{kpiStats.attivazione.assegnati} assegnati</span>
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-purple-100 bg-purple-50/50 cursor-pointer active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={cleanupSelection.prodotto} onChange={(e) => setCleanupSelection(prev => ({...prev, prodotto: e.target.checked}))} className="w-5 h-5 text-purple-600 rounded border-purple-300 focus:ring-purple-500" />
                  <span className="text-sm font-bold text-purple-900">KPI Prodotto</span>
                </div>
                <span className="text-xs font-black text-purple-500 bg-white px-2 py-1 rounded-md shadow-sm">{kpiStats.prodotto.assegnati} assegnati</span>
              </label>
            </div>

            <button
              onClick={handleKpiCleanup}
              disabled={!cleanupSelection.fatturato && !cleanupSelection.attivazione && !cleanupSelection.prodotto}
              className="w-full py-4 bg-gradient-to-b from-slate-700 to-slate-800 text-white font-bold rounded-2xl border border-slate-900 border-b-[4px] hover:brightness-110 active:border-b active:translate-y-[3px] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Conferma Pulizia
            </button>
          </div>
        </div>
      )}

      {/* Target Modal (Bottom Sheet v2.45) */}
      <TargetModal 
        isOpen={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        tempTarget={tempTarget}
        setTempTarget={setTempTarget}
        onSaveMensile={(val) => { updateTargetMensile(val); setShowTargetModal(false); }}
        targetFocus={targetNumeroFocus}
        setTargetFocus={setTargetNumeroFocus}
        targetAttivazioni={targetNumeroAttivazioni}
        setTargetAttivazioni={setTargetNumeroAttivazioni}
        onSaveQuorum={() => { 
          localStorage.setItem('tgest_quorum_focus', targetNumeroFocus.toString());
          localStorage.setItem('tgest_quorum_attivazioni', targetNumeroAttivazioni.toString());
        }}
      />

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-bottom-4 duration-300 w-[90%] max-w-sm">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border ${
            toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 
            toast.type === 'error' ? 'bg-red-600 border-red-500' : 'bg-slate-800 border-slate-700'
          } text-white`}>
            <div className="flex items-center gap-3 overflow-hidden">
              {toast.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span className="text-[11px] font-bold uppercase truncate">{toast.message}</span>
            </div>
            {toast.type === 'error' && (
              <button onClick={() => { navigator.clipboard.writeText(toast.message); showToast('Copiato!', 'success'); }}
                className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded-lg border border-white/10 shrink-0">
                <span className="text-[9px] font-black">COPIA</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Changelog Modal (Refactored v3.06) */}
      <ChangelogModal 
        isOpen={showChangelog} 
        version={DATA_VERSION} 
        onClose={dismissChangelog} 
      />

      {/* Guide Modal (Refactored v3.06) */}
      <GuideModal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} />
    </div>
  );
}
