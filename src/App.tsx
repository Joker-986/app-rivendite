import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, MapPin, Store, AlertCircle, Loader2, ChevronRight, Info, Map as MapIcon, List, Navigation, Clock, Phone, Mail, Globe, ExternalLink, RefreshCw, Copy, Check, Heart, Trash2, Bookmark, BookOpen, ChevronDown, ChevronUp, Download, Save, Calendar, GripVertical, CheckCircle2, X, ClipboardList, Layers, Settings, Upload, Share2, MessageCircle, Layout, Database, Sparkles, Filter, Cloud, Plus, BarChart2, BarChart3, Target, Activity, CalendarClock, User, UserCheck, ArrowDownAZ, ArrowUpZA, Edit3, TrendingDown, TrendingUp, History, Package, Wand2, ShoppingBag } from 'lucide-react';
import MapView from './components/MapView';
import RivenditaCard from './components/RivenditaCard';
import GuideModal from './components/GuideModal';
import ChangelogModal from './components/ChangelogModal';
import StoreModal from './components/StoreModal';
import AgendaTab from './components/AgendaTab';
import StatsTab from './components/StatsTab';
import StrategyDashboard from './components/StrategyDashboard';
import WarehouseTab from './components/WarehouseTab';
import SettingsModal from './components/SettingsModal';
import ModalContainer from './components/ModalContainer';
import { enrichRivendita, EnrichedDetails } from './services/geminiService';
import { calculateFatturatoPeriodo, calculateOrderStats, calculateCrmStats, calculateVisitStats } from './services/statsService';
import packageVersion from './version.json';
import { usePersistence } from './hooks/usePersistence';
import { useModals } from './contexts/ModalContext';
import { useStrategy } from './contexts/StrategyContext';
import { Option, SearchResult, RivenditaHistoryEntry, RivenditaExtra, ArchiveEntry, RubricaData, OrderItem } from './types';
import { formatGoogleCalendarDate, getAvailableTimes, handleNavigation, toTitleCase, loadFromStorage, getRivenditaId, getGoogleResetDate, calcolaFineTurno, ORARI_INIZIO } from './utils/helpers';

// TgesT Enterprise - v3.01
const DATA_VERSION = packageVersion.version;

export default function App() {
  const { 
    openConfirm, closeConfirm, confirmModal,
    openShare, closeShare, shareModal,
    openQuickEdit,
    revisitModalId, openRevisitModal, closeRevisitModal,
    openKpiAssign,
    selectedRivenditaId
  } = useModals();
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

  const isDateInRange = (dateStr?: string) => {
    if (!dateStr) return false;
    
    // Se siamo in Regia, usiamo il mese selezionato
    if (activeTab === 'regia') {
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

  const [rubrica, setRubrica] = useState<RubricaData>(() => loadFromStorage('rubrica', {}));
  const [archive, setArchive] = useState<any[]>(() => loadFromStorage('tgest_archive', []));

  const { syncProgress, missions } = useStrategy();

  // DEBOUNCE: Evita il ricalcolo globale ad ogni singolo tasto premuto negli input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      syncProgress(rubrica, meseSelezionato);
    }, 800); // Ritardo di 800ms
    
    return () => clearTimeout(timeoutId);
  }, [rubrica, meseSelezionato, syncProgress]);


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

  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
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
    showToast, meseSelezionato, isDateInRange, setShowSettingsModal 
  });

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
            importoOrdine: 0,
            targetIdoneo: []
          }),
          [field]: value,
          isSavedToRubrica
        }
      };
    });
  }, []);

  const handleActivitySave = useCallback((id: string, type: 'VISITA' | 'ORDINE' | 'HOSTESS', notes: string, amount: number = 0, items?: OrderItem[], dataEvasione?: string, visitaInizio?: string, visitaFine?: string) => {
    setRubrica(prev => {
      const current = prev[id] || {};
      const history = [...(current.history || [])];
      
      let eventDate = new Date();
      let finalNotes = notes;

      if (type === 'ORDINE' && dataEvasione) {
        // Splittiamo la stringa "YYYY-MM-DD" e creiamo la data usando i componenti locali
        const [year, month, day] = dataEvasione.split('-').map(Number);
        eventDate = new Date(year, month - 1, day);
        // Manteniamo ore e minuti attuali per l'ordinamento in timeline, ma il giorno è bloccato
        eventDate.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
      } else if (type === 'ORDINE' && current.dataOrdine) {
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
      
      let budgetScalato = 0;
      if (type === 'ORDINE' && items) {
        budgetScalato = items.reduce((acc, item) => (item.isOmaggio || item.isCredito) ? acc + (item.quantita * item.prezzoApplicato) : acc, 0);
      }

      // FIX BUG: Creiamo sempre un nuovo record per mantenere lo storico completo
      const newEntry: RivenditaHistoryEntry = { 
        data: isoDateStr, 
        tipo: type, 
        note: finalNotes, 
        importo: amount, 
        items: items,
        budgetAmScalato: budgetScalato > 0 ? budgetScalato : undefined,
        dataEvasione: dataEvasione,
        isEseguito: type === 'ORDINE' ? false : undefined,
        visitaInizio: visitaInizio,
        visitaFine: visitaFine
      };

      history.push(newEntry);
      history.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      const now = new Date();
      const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      const dateOnlyStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;

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
  const oggi = new Date();
  const oggiStr = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`;
  
  setRubrica(prev => {
    const current = prev[id];
    if (!current) return prev;

    let nuovoStatoVisitata = current.visitata;
    let newDataVisita = current.dataVisita || '';
    let newOraVisita = current.oraVisita || '';
    let newLastDataVisita = current.lastDataVisita || '';
    let newLastOraVisita = current.lastOraVisita || '';

    if (lastVisita) {
      const lastDateObj = new Date(lastVisita.data);
      const lastDateStr = `${lastDateObj.getFullYear()}-${String(lastDateObj.getMonth() + 1).padStart(2, '0')}-${String(lastDateObj.getDate()).padStart(2, '0')}`;
      const lastTimeStr = lastDateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

      newLastDataVisita = lastDateStr;
      newLastOraVisita = lastTimeStr;

      if (lastDateStr === oggiStr) {
        nuovoStatoVisitata = current.visitata === 'Da Rivisitare' ? 'Da Rivisitare' : 'Si';
        newDataVisita = lastDateStr;
        newOraVisita = lastTimeStr;
      } else {
        nuovoStatoVisitata = 'No'; 
        newDataVisita = '';
        newOraVisita = '';
      }
    } else {
      nuovoStatoVisitata = 'No';
      newDataVisita = '';
      newOraVisita = '';
      newLastDataVisita = '';
      newLastOraVisita = '';
    }

    return {
      ...prev,
      [id]: {
        ...current,
        history: sorted,
        visitata: nuovoStatoVisitata,
        dataVisita: newDataVisita,
        oraVisita: newOraVisita,
        lastDataVisita: newLastDataVisita,
        lastOraVisita: newLastOraVisita
      }
    };
  });
}, []);

  const handleEditHistory = React.useCallback((id: string, index: number, newNote: string, newImporto: number, newData?: string, newOra?: string, newStato?: string, isEseguito?: boolean, dataEsecuzione?: string, newItems?: any[], newDataEvasione?: string, visitaInizio?: string, visitaFine?: string) => {
    setRubrica(prev => {
      const current = prev[id];
      if (!current || !current.history) return prev;
      const newHistory = [...current.history];
      
      let finalData = newHistory[index].data;
      if (newData && newOra) {
        // Splittiamo la stringa "YYYY-MM-DD" e creiamo la data usando i componenti locali
        const [year, month, day] = newData.split('-').map(Number);
        const [hour, minute] = newOra.split(':').map(Number);
        const localDateTime = new Date(year, month - 1, day, hour, minute, 0);
        
        if (!isNaN(localDateTime.getTime())) {
          finalData = localDateTime.toISOString();
        } else {
          finalData = `${newData}T${newOra}:00`; // Fallback in caso di browser obsoleti
        }
      }

      newHistory[index] = { 
        ...newHistory[index], 
        note: newNote, 
        importo: newImporto,
        data: finalData,
        ...(newStato ? { stato: newStato } : {}),
        ...(isEseguito !== undefined ? { isEseguito } : {}),
        ...(isEseguito === false ? { dataEsecuzione: undefined } : dataEsecuzione ? { dataEsecuzione } : {}),
        ...(newItems ? { items: newItems } : {}),
        ...(newDataEvasione ? { dataEvasione: newDataEvasione } : {}),
        ...(visitaInizio ? { visitaInizio } : {}),
        ...(visitaFine ? { visitaFine } : {})
      };
      
      setTimeout(() => reconcileHistoryData(id, newHistory), 0);
      return { ...prev, [id]: { ...current, history: newHistory } };
    });
  }, [reconcileHistoryData]);

  const handleDeleteHistory = React.useCallback((id: string, index: number) => {
    setRubrica(prev => {
      const current = prev[id];
      if (!current || !current.history) return prev;
      const newHistory = [...current.history];
      newHistory.splice(index, 1);
      
      // Chiamata differita alla riconciliazione
      setTimeout(() => reconcileHistoryData(id, newHistory), 0);
      
      return { ...prev, [id]: { ...current, history: newHistory } };
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

  const confirmVisit = useCallback((id: string) => {
    // Passiamo stringa vuota per creare un nuovo record pulito nello storico
    handleActivitySave(id, 'VISITA', '');
    openRevisitModal(id);
    setPendingVisitId(null);
    showToast('Nuovo passaggio registrato con successo!');
  }, [handleActivitySave, showToast, openRevisitModal]);

  const initiateVisitToggle = useCallback((id: string) => {
    setPendingVisitId(id); // Mantenuto per sicurezza di stato
    const isGiaVisitata = rubrica[id]?.visitata === 'Si';

    openConfirm({
      title: isGiaVisitata ? 'Nuovo Passaggio' : 'Conferma Visita',
      message: isGiaVisitata 
        ? "Stai registrando un NUOVO passaggio in questa rivendita oggi. Lo storico precedente rimarrà intatto. Vuoi procedere?" 
        : 'Vuoi segnare questa rivendita come visitata ora?',
      onConfirm: () => confirmVisit(id) // Passiamo l'id direttamente bypassando lo state
    });
  }, [confirmVisit, openConfirm, rubrica]);

  const startVisita = useCallback((id: string) => {
    setRubrica(prev => ({
      ...prev,
      [id]: { ...prev[id], visitaInCorso: new Date().toISOString() }
    }));
  }, []);

  const endVisita = useCallback((id: string, note: string, tornoPiuTardi: boolean) => {
    const existing = rubrica[id];
    const startTimeIso = existing?.visitaInCorso || new Date().toISOString();
    const endTimeIso = new Date().toISOString();

    // Salvataggio pulito senza hack testuali. Passiamo i timestamp.
    handleActivitySave(id, 'VISITA', note.trim(), 0, undefined, undefined, startTimeIso, endTimeIso);

    setRubrica(prev => ({
      ...prev,
      [id]: { ...prev[id], visitaInCorso: undefined, visitata: tornoPiuTardi ? 'Da Rivisitare' : 'Si', note: '' }
    }));

    if (!tornoPiuTardi) {
      openRevisitModal(id);
    }
    showToast(tornoPiuTardi ? 'Visita in sospeso salvata.' : 'Visita completata!');
  }, [rubrica, handleActivitySave, openRevisitModal, showToast]);

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
    openConfirm({
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
        showToast('Rivendita rimossa dal CRM');
      }
    });
  }, [openConfirm, showToast]);

  const removeStore = useCallback((res: SearchResult) => {
    const id = getRivenditaId(res);
    openConfirm({
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
        showToast('Store eliminato');
      }
    });
  }, [openConfirm, showToast]);

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
    showToast('Giro visite svuotato');
  }, [showToast]);

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
    const tabs = ['search', 'giro', 'agenda', 'crm', 'store', 'magazzino'];
    provincesInCrm.forEach(p => tabs.push(`prov_${p}`));
    tabs.push('rip');
    tabs.push('regia');
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
    showToast,
    aiLockedUntil,
    cooldownSeconds,
    handleEditHistory,
    handleDeleteHistory,
    startVisita,
    endVisita
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
    showToast,
    aiLockedUntil,
    cooldownSeconds,
    handleEditHistory,
    handleDeleteHistory,
    startVisita,
    endVisita
  ]);

  // --- GESTIONE TASTO INDIETRO ANDROID (HARDWARE BACK BUTTON) ---
  const uiStateRef = useRef<any>({});
  useEffect(() => {
    // Memorizziamo lo stato attuale della UI senza innescare re-render continui
    uiStateRef.current = {
      expandedCardId, showSettingsModal, showCreateStoreModal, revisitModalId,
      showGuideModal,
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
        s.revisitModalId || 
        s.showGuideModal || s.confirmModalOpen || 
        s.shareModalOpen || s.showChangelog || s.fabMenuOpen
      ) {
        window.history.pushState({ isApp: true }, ''); // Ripristina la trappola
        setExpandedCardId(null); setShowSettingsModal(false); setShowCreateStoreModal(false);
        closeRevisitModal(); 
        setShowGuideModal(false); 
        closeConfirm(); closeShare();
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
            <button id="tab-magazzino" onClick={() => { handleTabChange('magazzino'); setRivenditaFilter(''); setComuneFilter(''); }} className={`flex-none px-5 py-3 text-sm font-bold rounded-2xl transition-all ${activeTab === 'magazzino' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Magazzino</button>
            
            {provincesInCrm.map(prov => (
              <button key={prov} id={`tab-prov_${prov}`} onClick={() => handleTabChange(`prov_${prov}`)} className={`flex-none px-5 py-3 text-sm font-bold rounded-2xl transition-all ${activeTab === `prov_${prov}` ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{prov}</button>
            ))}

            <button id="tab-rip" onClick={() => handleTabChange('rip')} className={`flex-none px-5 py-3 text-sm font-bold rounded-2xl transition-all ${activeTab === 'rip' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>RIP ({ripList.length})</button>
            
            <button id="tab-regia" onClick={() => { handleTabChange('regia'); setRivenditaFilter(''); setComuneFilter(''); }} className={`flex-none px-5 py-3 text-sm font-bold rounded-2xl transition-all ${activeTab === 'regia' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Regia</button>
            
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
            {activeTab !== 'regia' && activeTab !== 'statistiche' && activeTab !== 'agenda' && (
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                  {activeTab === 'giro' ? `Giro Visite (${giroVisiteList.length})` : 
                   activeTab === 'crm' ? `CRM (${crmList.length})` : 
                   activeTab === 'store' ? `Store (${storeList.length})` :
                   activeTab === 'rip' ? `RIP (${ripList.length})` : 
                   `${activeTab.replace('prov_', '')} (${getCurrentList.length})`}
                </h2>
                {activeTab === 'store' && (
                  <div className="flex items-center bg-white border border-slate-200/80 rounded-[1.25rem] shadow-sm h-10 overflow-hidden shrink-0">
                    <button
                      onClick={() => setShowCreateStoreModal(true)}
                      className="px-4 h-full transition-colors flex items-center justify-center gap-1.5 text-brand-600 hover:text-brand-700 hover:bg-brand-50 font-bold text-xs"
                    >
                      <Plus className="w-4 h-4" />
                      Aggiungi Store
                    </button>
                  </div>
                )}
                {activeTab === 'crm' && (
                  <div className="flex items-center bg-white border border-slate-200/80 rounded-[1.25rem] shadow-sm h-10 overflow-hidden shrink-0">
                    <button
                      onClick={openKpiAssign}
                      className="px-4 h-full transition-colors flex items-center justify-center gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold text-xs"
                      title="Bacchetta Magica - Target Dinamici"
                    >
                      <Wand2 className="w-4 h-4" />
                      Bacchetta Magica
                    </button>
                  </div>
                )}
                {activeTab === 'giro' && giroVisite.length > 0 && (
                  <div className="flex items-center bg-white border border-slate-200/80 rounded-[1.25rem] shadow-sm h-10 overflow-hidden shrink-0">
                    <button onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')} className={`px-3 h-full transition-colors flex items-center justify-center ${viewMode === 'map' ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:text-brand-600 hover:bg-slate-50'}`} title={viewMode === 'map' ? 'Torna alla Lista' : 'Vedi Mappa'}>
                      {viewMode === 'map' ? <List className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                    </button>
                    <div className="w-px h-5 bg-slate-200 shrink-0"></div>
                    <button onClick={exportGiroForMyMaps} className="px-3 h-full transition-colors flex items-center justify-center text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" title="Esporta per My Maps">
                      <Download className="w-4 h-4" />
                    </button>
                    <div className="w-px h-5 bg-slate-200 shrink-0"></div>
                    <button onClick={() => openConfirm({
                      title: 'Svuota Giro',
                      message: 'Sei sicuro di voler svuotare il giro visite?',
                      isDestructive: true,
                      onConfirm: clearGiro
                    })} className="px-3 h-full transition-colors flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50" title="Svuota Giro">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

              {/* Filtri Comuni */}
              {activeTab !== 'statistiche' && activeTab !== 'regia' && activeTab !== 'agenda' && (
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

            {activeTab === 'regia' ? (
              <StrategyDashboard 
                rubrica={rubrica}
                meseSelezionato={meseSelezionato}
                setMeseSelezionato={setMeseSelezionato}
                combinedRivendite={combinedRivendite}
                handleRubricaUpdate={handleRubricaUpdate}
              />
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
                showToast={showToast}
                onEditHistory={handleEditHistory}
              />
            ) : activeTab === 'statistiche' ? (
              <StatsTab 
                statsPeriod={statsPeriod}
                setStatsPeriod={setStatsPeriod}
                customRange={customRange}
                setCustomRange={setCustomRange}
                exportHistoryToExcel={exportHistoryToExcel}
                visitStats={visitStats}
                orderStats={orderStats}
                fatturatoPeriodo={fatturatoPeriodo}
                crmStats={crmStats}
                setRivenditaFilter={setRivenditaFilter}
                setActiveTab={setActiveTab}
              />
            ) : activeTab === 'magazzino' ? (
              <WarehouseTab />
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

      {/* Settings & Backup Modal */}
      <SettingsModal 
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        setShowGuideModal={setShowGuideModal}
        generatedSyncCode={generatedSyncCode}
        handleGenerateSyncCode={handleGenerateSyncCode}
        isSyncing={isSyncing}
        syncCodeInput={syncCodeInput}
        setSyncCodeInput={setSyncCodeInput}
        handleImportFromSyncCode={handleImportFromSyncCode}
        handleExportData={handleExportData}
        handleImportData={handleImportData}
        crmCount={crmAnagrafiche.length}
        storageSize={storageSize}
        dailyAiCount={dailyAiCount}
        isOnline={isOnline}
        dataVersion={DATA_VERSION}
        handleClearAllData={handleClearAllData}
      />

      <StoreModal
        isOpen={showCreateStoreModal}
        onClose={() => setShowCreateStoreModal(false)}
        onCreateStore={handleCreateStore}
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

      <ModalContainer 
        rubrica={rubrica}
        combinedRivendite={combinedRivendite}
        onUpdateRubrica={handleRubricaUpdate} 
        onEditHistory={handleEditHistory} 
        onDeleteHistory={handleDeleteHistory}
        showToast={showToast} 
        missions={missions}
        selectedRivenditaId={selectedRivenditaId}
        startVisita={startVisita}
        endVisita={endVisita}
      />
    </div>
  );
}

