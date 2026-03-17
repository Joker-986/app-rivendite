import React, { useState, useEffect } from 'react';
import { Search, MapPin, Store, AlertCircle, Loader2, ChevronRight, Info, Map as MapIcon, List, Navigation, Clock, Phone, Mail, Globe, ExternalLink, RefreshCw, Copy, Check, Heart, Trash2, Bookmark, BookOpen, ChevronDown, ChevronUp, Download, Save, Calendar } from 'lucide-react';
import MapView from './components/MapView';
import { enrichRivendita, EnrichedDetails } from './services/geminiService';

interface Option {
  value: string;
  label: string;
}

interface SearchResult {
  [key: string]: any;
}

export interface RivenditaExtra {
  stato: 'Attivata' | 'Non Attiva' | 'Basso Rendente' | 'RIP' | '';
  visitata: 'Si' | 'Da Rivisitare' | 'No' | '';
  dataVisita?: string;
  oraVisita?: string;
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
  const [activeTab, setActiveTab] = useState<'search' | 'saved' | 'crm' | 'crm_br' | 'rip'>('search');
  const [savedRivendite, setSavedRivendite] = useState<SearchResult[]>(() => {
    const saved = localStorage.getItem('savedRivendite');
    return saved ? JSON.parse(saved) : [];
  });
  const [rubrica, setRubrica] = useState<RubricaData>(() => {
    const saved = localStorage.getItem('rubrica');
    return saved ? JSON.parse(saved) : {};
  });
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [rubricaFilterStato, setRubricaFilterStato] = useState<string>('');
  const [rubricaSort, setRubricaSort] = useState<string>('none');
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('savedRivendite', JSON.stringify(savedRivendite));
  }, [savedRivendite]);

  useEffect(() => {
    localStorage.setItem('rubrica', JSON.stringify(rubrica));
  }, [rubrica]);

  useEffect(() => {
    initSession();
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
      setComuni(data.comuni);
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
    return savedRivendite.some(s => 
      s['Num. Rivendita'] === res['Num. Rivendita'] && 
      s['Comune'] === res['Comune'] && 
      s['Prov.'] === res['Prov.']
    );
  };

  const toggleSave = (res: SearchResult) => {
    if (isSaved(res)) {
      setSavedRivendite(prev => prev.filter(s => 
        !(s['Num. Rivendita'] === res['Num. Rivendita'] && 
          s['Comune'] === res['Comune'] && 
          s['Prov.'] === res['Prov.'])
      ));
    } else {
      setSavedRivendite(prev => [...prev, res]);
    }
  };

  const getRivenditaId = (res: SearchResult) => {
    return `${res['Prov.']}_${res['Comune']}_${res['Num. Rivendita']}`;
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
            oraRivisita: ''
          }),
          [field]: value,
          isSavedToRubrica
        }
      };
    });
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
      const savedRes = savedRivendite.find(r => getRivenditaId(r) === id);
      
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

  const salvatiList = savedRivendite.filter(res => !hasRubricaData(getRivenditaId(res)));
  
  const allCrmList = savedRivendite.filter(res => hasRubricaData(getRivenditaId(res)));
  
  const crmList = allCrmList.filter(res => {
    const stato = rubrica[getRivenditaId(res)]?.stato;
    return stato !== 'RIP' && stato !== 'Basso Rendente';
  });

  const crmBrList = allCrmList.filter(res => {
    return rubrica[getRivenditaId(res)]?.stato === 'Basso Rendente';
  });

  const ripList = allCrmList.filter(res => {
    return rubrica[getRivenditaId(res)]?.stato === 'RIP';
  });

  const getCurrentCrmList = () => {
    if (activeTab === 'crm_br') return crmBrList;
    if (activeTab === 'rip') return ripList;
    return crmList;
  };
  
  const filteredAndSortedCrmList = getCurrentCrmList()
    .filter(res => {
      if (activeTab !== 'crm') return true;
      if (!rubricaFilterStato) return true;
      return rubrica[getRivenditaId(res)]?.stato === rubricaFilterStato;
    })
    .sort((a, b) => {
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

  const renderCard = (res: SearchResult, idx: number, isCrmTab: boolean = false) => {
    const id = getRivenditaId(res);
    const isExpanded = expandedCardId === id;
    const extra = rubrica[id] || {
      stato: '',
      visitata: '',
      giornoLevata: '',
      riferimento: '',
      telefono: '',
      pIva: '',
      mail: ''
    };

    return (
      <div key={id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 relative">
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
              {res['Comune']} ({res['Prov.']})
            </h3>
          </div>
          <button
            onClick={() => toggleSave(res)}
            className="p-2 bg-pink-50 text-pink-500 rounded-xl hover:bg-pink-100 transition-all shrink-0"
            title={isCrmTab ? "Rimuovi dalla rubrica e dai salvati" : "Rimuovi dai salvati"}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-start justify-between gap-2 text-sm text-slate-600">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
            <span className="leading-snug">{res['Indirizzo']}</span>
          </div>
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
          {isCrmTab && extra.mail && (
            <div className="text-xs col-span-2">
              <span className="text-slate-400 block mb-0.5">Mail</span>
              <span className="font-medium text-slate-700">{extra.mail}</span>
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
          {!enrichedData[id] && (
            enrichingId === id ? (
              <button
                disabled
                className="w-full text-center text-sm font-semibold text-slate-400 bg-slate-50 py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Caricamento dettagli...
              </button>
            ) : (
              <button
                onClick={() => handleEnrich(id, res)}
                className="w-full text-center text-sm font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 active:bg-brand-100 py-3 rounded-xl flex items-center justify-center gap-2 transition-all border border-brand-100"
              >
                <Clock className="w-4 h-4" />
                Mostra orari e contatti
              </button>
            )
          )}
          {isCrmTab && extra.richiestaOrdine && !extra.ordineEvaso && (
            <button
              onClick={() => handleRubricaUpdate(id, 'ordineEvaso', true)}
              className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 py-3 px-4 rounded-xl text-sm font-bold transition-all shadow-sm"
            >
              <Check className="w-4 h-4" />
              Segna Ordine come Evaso
            </button>
          )}
          {isCrmTab && extra.dataRivisita && (
            <a
              href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Appuntamento Rivendita ${res['Num. Rivendita']} - ${res['Comune']}`)}&dates=${formatGoogleCalendarDate(extra.dataRivisita, extra.oraRivisita)}&details=${encodeURIComponent(`Indirizzo: ${res['Indirizzo']}, ${res['Comune']} (${res['Prov.']})\nTelefono: ${extra.telefono || 'N/A'}\nRiferimento: ${extra.riferimento || 'N/A'}`)}&location=${encodeURIComponent(`${res['Indirizzo']}, ${res['Comune']}, ${res['Prov.']}, Italy`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-brand-50 hover:bg-brand-100 active:scale-95 text-brand-700 py-3 px-4 rounded-xl text-sm font-bold transition-all no-underline shadow-sm"
            >
              <Calendar className="w-4 h-4" />
              Aggiungi a Google Calendar
            </a>
          )}
          <div className="flex gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${res['Indirizzo']}, ${res['Comune']}, ${res['Prov.']}, Italy`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-brand-50 hover:bg-brand-100 active:scale-95 text-brand-700 py-3 px-4 rounded-xl text-sm font-bold transition-all no-underline shadow-sm"
            >
              <Navigation className="w-4 h-4" />
              Naviga
            </a>
            <button
              onClick={() => toggleExpandCard(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all shadow-sm ${
                isExpanded ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {isExpanded ? 'Chiudi Dettagli' : (isCrmTab ? 'Modifica Dettagli' : 'Dettagli CRM')}
            </button>
          </div>
        </div>

        {/* Expandable Form */}
        {isExpanded && (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-brand-600" />
              Informazioni Extra
            </h4>
            
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
                <label className="text-xs font-medium text-slate-600">Visitata</label>
                <select
                  value={extra.visitata}
                  onChange={(e) => handleRubricaUpdate(id, 'visitata', e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                >
                  <option value="">Seleziona</option>
                  <option value="Si">Si</option>
                  <option value="Da Rivisitare">Da Rivisitare</option>
                  <option value="No">No</option>
                </select>
              </div>

              {extra.visitata === 'Si' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Data e Ora Visita</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={extra.dataVisita || ''}
                      onChange={(e) => handleRubricaUpdate(id, 'dataVisita', e.target.value)}
                      className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                    />
                    <select
                      value={extra.oraVisita || ''}
                      onChange={(e) => handleRubricaUpdate(id, 'oraVisita', e.target.value)}
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
              )}

              {extra.visitata === 'Da Rivisitare' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Data e Ora Nuovo Appuntamento</label>
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
              )}

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
                <label className="text-xs font-medium text-slate-600">P. IVA</label>
                <input
                  type="text"
                  value={extra.pIva}
                  onChange={(e) => handleRubricaUpdate(id, 'pIva', e.target.value)}
                  placeholder="Partita IVA"
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
                if (!isCrmTab) {
                  handleRubricaUpdate(id, 'isSavedToRubrica', true);
                }
                setExpandedCardId(null);
              }}
              className="w-full mt-4 py-3 bg-brand-600 text-white font-bold rounded-xl text-sm shadow-md shadow-brand-100 active:scale-95 transition-all"
            >
              {isCrmTab ? 'Salva Modifiche' : 'Salva i dettagli'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      {/* Header */}
      <header className="bg-brand-600 text-white p-4 shadow-md sticky top-0 z-20">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Store className="w-6 h-6" />
              <h1 className="text-xl font-semibold tracking-tight">Trova Rivendite</h1>
            </div>
            <button 
              onClick={handleReset}
              className="p-2 hover:bg-brand-700 active:bg-brand-800 rounded-xl transition-all flex items-center justify-center"
              aria-label="Resetta ricerca"
              title="Resetta ricerca"
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex bg-brand-700/50 p-1 rounded-xl overflow-x-auto [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-none px-4 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
                activeTab === 'search' ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-100 hover:bg-brand-700/50'
              }`}
            >
              <Search className="w-4 h-4" />
              Cerca
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-none px-4 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
                activeTab === 'saved' ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-100 hover:bg-brand-700/50'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              Salvati ({salvatiList.length})
            </button>
            <button
              onClick={() => setActiveTab('crm')}
              className={`flex-none px-4 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
                activeTab === 'crm' ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-100 hover:bg-brand-700/50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              CRM ({crmList.length})
            </button>
            <button
              onClick={() => setActiveTab('crm_br')}
              className={`flex-none px-4 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
                activeTab === 'crm_br' ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-100 hover:bg-brand-700/50'
              }`}
            >
              <Store className="w-4 h-4" />
              CRM BR ({crmBrList.length})
            </button>
            <button
              onClick={() => setActiveTab('rip')}
              className={`flex-none px-4 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
                activeTab === 'rip' ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-100 hover:bg-brand-700/50'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              RIP ({ripList.length})
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
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
              {comuni.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
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
                                ? 'bg-pink-50 text-pink-500' 
                                : 'bg-slate-50 text-slate-400 hover:text-pink-500 hover:bg-pink-50'
                            }`}
                            title={isSaved(res) ? "Rimuovi dai salvati" : "Salva rivendita"}
                          >
                            <Heart className={`w-5 h-5 ${isSaved(res) ? 'fill-current' : ''}`} />
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
                          
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${res['Indirizzo']}, ${res['Comune']}, ${res['Prov.']}, Italy`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 bg-brand-50 hover:bg-brand-100 active:scale-95 text-brand-700 w-full py-3 px-6 rounded-xl text-sm font-bold transition-all no-underline shadow-sm"
                          >
                            <Navigation className="w-4 h-4" />
                            Naviga
                          </a>
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
        ) : activeTab === 'saved' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-semibold text-slate-800">
                Rivendite Salvate ({salvatiList.length})
              </h2>
            </div>

            {salvatiList.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl text-center border border-slate-100 shadow-sm space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <Heart className="w-10 h-10 text-slate-200" />
                </div>
                <div className="space-y-2">
                  <p className="text-slate-800 font-bold">Ancora nulla qui</p>
                  <p className="text-slate-500 text-sm">Salva le rivendite che ti interessano durante la ricerca per ritrovarle qui velocemente.</p>
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
                {salvatiList.map((res, idx) => renderCard(res, idx, false))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-semibold text-slate-800">
                {activeTab === 'crm' ? `CRM (${crmList.length})` : activeTab === 'crm_br' ? `CRM BR (${crmBrList.length})` : `RIP (${ripList.length})`}
              </h2>
              {getCurrentCrmList().length > 0 && (
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-xl text-sm font-bold transition-all"
                >
                  <Download className="w-4 h-4" />
                  Esporta CSV
                </button>
              )}
            </div>

            {getCurrentCrmList().length > 0 && (
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

            {getCurrentCrmList().length === 0 ? (
              <div className="bg-white p-12 rounded-3xl text-center border border-slate-100 shadow-sm space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <BookOpen className="w-10 h-10 text-slate-200" />
                </div>
                <div className="space-y-2">
                  <p className="text-slate-800 font-bold">Nessun dato CRM</p>
                  <p className="text-slate-500 text-sm">Aggiungi dettagli extra alle rivendite salvate per ritrovarle qui.</p>
                </div>
                <button
                  onClick={() => setActiveTab('saved')}
                  className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl text-sm shadow-md shadow-brand-100 active:scale-95 transition-all"
                >
                  Vai ai salvati
                </button>
              </div>
            ) : filteredAndSortedCrmList.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl text-center border border-slate-100 shadow-sm space-y-4">
                <p className="text-slate-500 text-sm">Nessuna rivendita trovata con i filtri selezionati.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAndSortedCrmList.map((res, idx) => renderCard(res, idx, true))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
