import React, { useState } from 'react';
import { 
  Sparkles, Calendar, BarChart3, Target, TrendingUp, Zap, Rocket, 
  ShoppingBag, History, ChevronRight, Plus, Trash2, AlertCircle, Calculator,
  Save, X, Settings2, Info, ArrowRight, Archive, ChevronDown, ChevronUp,
  DollarSign, RefreshCw, Layers, Check, Activity, Clock, CheckCircle2
} from 'lucide-react';
import { useModals } from '../contexts/ModalContext';
import { useStrategy } from '../contexts/StrategyContext';
import { useProducts } from '../contexts/ProductContext';
import { RubricaData, Mission, Campaign, CampaignPeriod, RivenditaExtra, SearchResult } from '../types';
import { getRivenditaId } from '../utils/helpers';
import DrillDownModal from './DrillDownModal';

interface StrategyDashboardProps {
  rubrica: RubricaData;
  meseSelezionato: string;
  setMeseSelezionato: (val: string) => void;
  combinedRivendite: SearchResult[];
  handleRubricaUpdate: (id: string, field: string, value: any) => void;
}

const StrategyDashboard: React.FC<StrategyDashboardProps> = ({
  rubrica,
  meseSelezionato,
  setMeseSelezionato,
  combinedRivendite,
  handleRubricaUpdate
}) => {
  const { 
    salaryConfig, missions, campaigns, adjustments,
    addMission, updateMission, deleteMission, 
    addCampaign, updateCampaign, deleteCampaign,
    addCampaignPeriod, closeCampaignPeriod,
    calculateMboBonus, calculateExtraBonus,
    setLogista, setAmCorrection
  } = useStrategy();
  
  const { 
    products, updateProduct 
  } = useProducts();
  
  const { openConfirm } = useModals();
  
  const [showEditor, setShowEditor] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [showArchivedMissions, setShowArchivedMissions] = useState(false);
  const [editingMission, setEditingMission] = useState<Partial<Mission> | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign> | null>(null);
  const [massAssignMission, setMassAssignMission] = useState<Mission | null>(null);
  const [assignSearchTerm, setAssignSearchTerm] = useState('');
  const [drillDownMission, setDrillDownMission] = useState<{nome: string, dettagli: any[]} | null>(null);

  const handleGlobalCleanup = () => {
    openConfirm({
      title: 'RESET ASSEGNAZIONI MENSILI',
      message: 'Questa azione rimuoverà i target attualmente assegnati a tutte le rivendite (svuota la lavagna del mese per preparare la nuova strategia). Lo storico degli ordini e delle visite passate NON verrà toccato. Procedere?',
      isDestructive: true,
      onConfirm: () => {
        combinedRivendite.forEach(r => {
          const id = getRivenditaId(r);
          if (rubrica[id]?.targetIdoneo && rubrica[id].targetIdoneo.length > 0) {
            handleRubricaUpdate(id, 'targetIdoneo', []);
          }
        });
      }
    });
  };

  const mboBonus = calculateMboBonus();
  const extraBonus = calculateExtraBonus(rubrica, meseSelezionato);
  const totalBonus = mboBonus + extraBonus;

  // RADAR SCADENZE ATTIVAZIONI (Logica Delta >= 5)
  const radarScadenze = React.useMemo(() => {
    const scadute: any[] = [];
    const inScadenza: any[] = [];
    const aRischio: any[] = [];
    const [annoSel, meseSel] = meseSelezionato.split('-').map(Number);

    combinedRivendite.forEach(r => {
      const id = getRivenditaId(r);
      const extra = rubrica[id];
      if (extra?.stato === 'Attivata') {
        // 1. Funzione helper per parsare le date in modo sicuro (Italiane DD/MM/YYYY e ISO YYYY-MM-DD)
        const parseSafeDate = (dateStr: string) => {
          if (!dateStr) return new Date(0);
          if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split('/');
            return new Date(`${y}-${m}-${d}`);
          }
          return new Date(dateStr);
        };

        // 2. Accettiamo 'true' (ordini evasi nuovi) e 'undefined' (storico legacy), scartiamo solo 'false' (bozze in corso)
        const validOrders = extra.history?.filter((h: any) => (h.tipo === 'ORDINE' || h.tipo === 'ORDINE_LOGISTA') && h.isEseguito !== false) || [];

        // 3. Ordina dal più recente al più vecchio
        validOrders.sort((a: any, b: any) => {
          const dateA = a.dataEvasione || a.data;
          const dateB = b.dataEvasione || b.data;
          return parseSafeDate(dateB).getTime() - parseSafeDate(dateA).getTime();
        });

        if (validOrders.length > 0) {
          const effectiveDateStr = validOrders[0].dataEvasione || validOrders[0].data;
          const lastOrder = parseSafeDate(effectiveDateStr);

          if (!isNaN(lastOrder.getTime())) {
            const delta = (annoSel - lastOrder.getFullYear()) * 12 + (meseSel - (lastOrder.getMonth() + 1));
            
            const item = { 
              res: r, 
              id: id,
              nome: r.isStore ? `Store ${r.storeNumber}` : `Riv. ${r['Num. Rivendita']}`,
              comune: r['Comune'],
              dataUltimo: effectiveDateStr.includes('/') ? effectiveDateStr : new Date(effectiveDateStr).toLocaleDateString('it-IT'),
              deltaMesi: delta
            };
            
            if (delta >= 5) scadute.push(item);
            else if (delta === 4) inScadenza.push(item);
            else if (delta === 3) aRischio.push(item);
          }
        }
      }
    });
    return { scadute, inScadenza, aRischio };
  }, [rubrica, combinedRivendite, meseSelezionato]);

  
  const [showRadar, setShowRadar] = useState(false);
  
  const monthlyBase = salaryConfig.ralAnnua / 12;
  const maxMboBonus = monthlyBase * (salaryConfig.percentualeBonus / 100);
  
  const activeMissions = missions
    .filter(m => m.stato !== 'ARCHIVIATA')
    .sort((a, b) => a.id === 'm1' ? -1 : b.id === 'm1' ? 1 : 0);
  const archivedMissions = missions.filter(m => m.stato === 'ARCHIVIATA');
  
  const totalWeight = activeMissions.reduce((acc, m) => acc + m.pesoPercentuale, 0);
  const isWeightValid = totalWeight === 100;

  const handleSaveMission = () => {
    if (!editingMission?.nome || !editingMission?.tipo || editingMission.target === undefined || editingMission.pesoPercentuale === undefined) return;
    
    if (editingMission.id) {
      updateMission(editingMission.id, editingMission);
    } else {
      addMission({
        ...editingMission,
        id: Math.random().toString(36).substring(2, 9),
        progressoAttuale: 0,
        stato: 'ATTIVA'
      } as Mission);
    }
    setEditingMission(null);
  };

  const handleSaveCampaign = () => {
    if (!editingCampaign?.nome || !editingCampaign?.sku || editingCampaign.valoreBonus === undefined) {
      alert("Errore: Compila il nome, il bonus e seleziona un Prodotto (SKU) dal menu a tendina.");
      return;
    }
    
    if (editingCampaign.id) {
      updateCampaign(editingCampaign.id, editingCampaign);
    } else {
      const newId = Math.random().toString(36).substring(2, 9);
      addCampaign({
        ...editingCampaign,
        id: newId,
        stato: 'ATTIVA',
        periodi: [{ id: 'p-' + Math.random().toString(36).substring(2, 9), dataInizio: new Date().toISOString().split('T')[0] }]
      } as Campaign);
    }
    setEditingCampaign(null);
  };

  // --- CALCOLO RUN RATE GIORNALIERO ---
  const calculateRunRate = (mission: Mission) => {
    if (!mission || mission.target <= 0) return null;

    const target100 = mission.target;
    const target80 = mission.target * 0.8;
    const current = mission.progressoAttuale;

    const gap100 = Math.max(0, target100 - current);
    const gap80 = Math.max(0, target80 - current);

    // Funzione per calcolare la Pasquetta (Lunedi dell'Angelo) per un dato anno
    const getPasquetta = (year: number) => {
      const a = year % 19;
      const b = Math.floor(year / 100);
      const c = year % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const l = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // Mese 0-based
      const day = ((h + l - 7 * m + 114) % 31) + 1;
      
      const pasqua = new Date(year, month, day);
      const pasquetta = new Date(pasqua);
      pasquetta.setDate(pasqua.getDate() + 1);
      return pasquetta;
    };

    // Festività a data fissa (Mese 0-based: 0=Gennaio, 11=Dicembre)
    const fixedHolidays = [
      { m: 0, d: 1 },   // Capodanno
      { m: 0, d: 6 },   // Epifania
      { m: 3, d: 25 },  // Liberazione (Aprile)
      { m: 4, d: 1 },   // Lavoratori (Maggio)
      { m: 5, d: 2 },   // Repubblica (Giugno)
      { m: 7, d: 15 },  // Ferragosto (Agosto)
      { m: 10, d: 1 },  // Ognissanti (Novembre)
      { m: 11, d: 8 },  // Immacolata
      { m: 11, d: 25 }, // Natale
      { m: 11, d: 26 }  // Santo Stefano
    ];

    const isHoliday = (date: Date) => {
      const day = date.getDate();
      const month = date.getMonth();
      const year = date.getFullYear();

      // Check festività fisse
      for (const h of fixedHolidays) {
        if (h.m === month && h.d === day) return true;
      }

      // Check Pasquetta
      const pasquetta = getPasquetta(year);
      if (pasquetta.getDate() === day && pasquetta.getMonth() === month) return true;

      return false;
    };

    const getRemainingWorkingDays = () => {
      const today = new Date();
      // Usiamo il mese selezionato per determinare il periodo di calcolo
      const [selYear, selMonth] = meseSelezionato.split('-').map(Number);
      
      let startDate = new Date();
      // Se stiamo guardando un mese futuro o passato, il Run Rate si azzera
      if (selYear !== today.getFullYear() || (selMonth - 1) !== today.getMonth()) {
        return 0; // Mostriamo il Run Rate solo per il mese corrente
      }
      // Altrimenti calcoliamo da oggi fino alla fine del mese corrente
      
      const endDate = new Date(selYear, selMonth, 0); // Ultimo giorno del mese

      // Se il mese è già finito, o oggi è l'ultimo giorno lavorativo, gestiamo i casi limite
      if (startDate > endDate) return 0;

      let workingDays = 0;
      let currentDate = new Date(startDate);
      // Impostiamo l'ora a mezzanotte per evitare problemi di fusi orari
      currentDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay(); // 0 = Domenica, 6 = Sabato
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(currentDate)) {
          workingDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return workingDays;
    };

    const workingDaysLeft = getRemainingWorkingDays();

    // Se non ci sono giorni lavorativi o si guarda un altro mese, disabilita il calcolo
    if (workingDaysLeft <= 0) return null;

    const dailyTarget100 = gap100 / workingDaysLeft;
    const dailyTarget80 = gap80 / workingDaysLeft;

    return {
      workingDaysLeft,
      dailyTarget100,
      dailyTarget80,
      is100Reached: current >= target100,
      is80Reached: current >= target80
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* HEADER & MESE */}
      <div className="flex items-center justify-end px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-slate-200/80 rounded-[1.25rem] shadow-sm h-10 overflow-hidden shrink-0">
            <button 
              onClick={handleGlobalCleanup}
              className="px-3 h-full transition-colors flex items-center justify-center text-amber-500 hover:text-amber-600 hover:bg-amber-50 cursor-pointer"
              title="Reset Assegnazioni Mensili"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            
            <div className="w-px h-5 bg-slate-200 shrink-0"></div>

            <button 
              onClick={() => setShowBalance(!showBalance)}
              className={`px-3 h-full transition-colors flex items-center justify-center cursor-pointer ${showBalance ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 hover:text-emerald-600'}`}
              title="Bilancio Magazzino e Logista"
            >
              <Calculator className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-slate-200 shrink-0"></div>
            
            <button 
              onClick={() => setShowEditor(!showEditor)}
              className={`px-3 h-full transition-colors flex items-center justify-center cursor-pointer ${showEditor ? 'bg-brand-50 text-brand-600' : 'text-slate-400 hover:text-brand-600 hover:bg-slate-50'}`}
              title="Impostazioni Regia"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
          
          <label className="relative flex items-center bg-white border border-slate-200/80 rounded-[1.25rem] shadow-sm h-10 px-4 cursor-pointer hover:bg-brand-50 transition-colors group">
            <span className="text-xs font-bold text-brand-600 group-hover:text-brand-700 capitalize mr-1.5 pointer-events-none">
              {new Date(meseSelezionato + '-01').toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }).replace('.', '')}
            </span>
            <Calendar className="w-4 h-4 text-brand-600 group-hover:text-brand-700 pointer-events-none" />
            <input 
              type="month" 
              value={meseSelezionato} 
              onChange={(e) => setMeseSelezionato(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* --- INIZIO PANNELLO AUTO-BILANCIAMENTO --- */}
      {showBalance && (() => {
        const currentAdj = adjustments?.[meseSelezionato] || { logista: 0, amCorrection: 0 };
        let appMagazzinoTotal = 0;
        let appLogistaTotal = 0;
        
        Object.values(rubrica).forEach(riv => {
          riv.history?.forEach(h => {
            if (h.data.startsWith(meseSelezionato)) {
              if (h.tipo === 'ORDINE') appMagazzinoTotal += (h.importo || 0);
              if (h.tipo === 'ORDINE_LOGISTA') appLogistaTotal += (h.importo || 0);
            }
          });
        });

        const logistaDelta = currentAdj.logista || 0;
        const magazzinoDelta = currentAdj.amCorrection || 0;
        const hasAdjustments = logistaDelta !== 0 || magazzinoDelta !== 0;

        return (
          <div className="mx-1 mb-4 p-5 bg-emerald-50/30 border border-emerald-100 rounded-[2rem] animate-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-2 gap-4 items-start">
              
              {/* 1. LOGISTA */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-emerald-700/60 uppercase ml-1 block truncate">Fatturato Logista (AM)</label>
                <input 
                  key={`logista-${meseSelezionato}-${logistaDelta}`}
                  type="number" 
                  defaultValue={appLogistaTotal + logistaDelta > 0 ? Number((appLogistaTotal + logistaDelta).toFixed(2)) : ''}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val)) {
                      setLogista(meseSelezionato, 0);
                    } else {
                      setLogista(meseSelezionato, val - appLogistaTotal);
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  className="w-full h-11 px-4 bg-white border border-emerald-200/50 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
                  placeholder="Digita e Invio..."
                />
              </div>

              {/* 2. MAGAZZINO */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-emerald-700/60 uppercase ml-1 block truncate">Fatturato Magazzino (AM)</label>
                <input 
                  key={`magazzino-${meseSelezionato}-${magazzinoDelta}`}
                  type="number" 
                  defaultValue={appMagazzinoTotal + magazzinoDelta > 0 ? Number((appMagazzinoTotal + magazzinoDelta).toFixed(2)) : ''}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val)) {
                      setAmCorrection(meseSelezionato, 0);
                    } else {
                      setAmCorrection(meseSelezionato, val - appMagazzinoTotal);
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  className="w-full h-11 px-4 bg-white border border-emerald-200/50 rounded-2xl text-sm font-bold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
                  placeholder="Digita e Invio..."
                />
              </div>
              
            </div>
            
            {/* Badge Informativo */}
            {hasAdjustments && (
              <div className="mt-4 pt-3 border-t border-emerald-100/50 flex justify-between items-center">
                <div className="flex flex-col gap-0.5">
                  {magazzinoDelta !== 0 && (
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">
                      Rettifica Magazzino: {magazzinoDelta > 0 ? '+' : ''}{magazzinoDelta.toFixed(2)}€
                    </span>
                  )}
                  {logistaDelta !== 0 && (
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">
                      Rettifica Logista: {logistaDelta > 0 ? '+' : ''}{logistaDelta.toFixed(2)}€
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => {
                    setAmCorrection(meseSelezionato, 0);
                    setLogista(meseSelezionato, 0);
                  }} 
                  className="text-[9px] font-black text-red-500 uppercase underline"
                >
                  Annulla Tutto
                </button>
              </div>
            )}
          </div>
        );
      })()}
      {/* --- FINE PANNELLO AUTO-BILANCIAMENTO --- */}

      {/* SIMULATORE STIPENDIO - APPLE CLEAN (Mobile Perfect) */}
      <div className="bg-white border border-slate-200/80 rounded-[2rem] p-5 sm:p-6 shadow-sm overflow-hidden">
        
        {/* Top: Totali */}
        <div className="flex justify-between items-end pb-5 border-b border-slate-100/80">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Stipendio Stimato (Lordo)</p>
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter leading-none">
              €{(monthlyBase + totalBonus).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Bonus Totale</p>
            <p className="text-xl sm:text-2xl font-black text-[#0ba321] leading-none">+€{totalBonus.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Bottom: Breakdown a 3 colonne */}
        <div className="grid grid-cols-3 pt-4">
          <div className="text-center border-r border-slate-200/60 pr-2">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Base RAL</p>
            <p className="text-sm sm:text-base font-bold text-slate-700">€{monthlyBase.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          
          <div className="text-center border-r border-slate-200/60 px-2">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">MBO Maturato</p>
            <p className="text-sm sm:text-base font-bold text-brand-600">€{mboBonus.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          
          <div className="text-center pl-2">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Extra Bonus</p>
            <p className="text-sm sm:text-base font-bold text-purple-600">€{extraBonus.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

      </div>

      {/* ALERT PESO PERCENTUALE */}
      {!isWeightValid && activeMissions.length > 0 && (
        <div className="mx-1 p-4 bg-red-50 border border-red-200 rounded-[2rem] flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-red-900 uppercase tracking-tight mb-0.5">Configurazione Incompleta</p>
            <p className="text-[11px] text-red-700 font-bold leading-tight">
              La somma dei pesi delle missioni attive è {totalWeight}%. Deve essere esattamente 100%.
            </p>
          </div>
        </div>
      )}

      {/* EDITOR STRATEGIA (MISSIONI & CAMPAGNE) */}
      {showEditor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowEditor(false)}>
          <div className="bg-slate-50 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            
            {/* Header Finestra */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white rounded-t-3xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 tracking-tight">Impostazioni Regia</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Configura Missioni e Campagne</p>
                </div>
              </div>
              <button onClick={() => setShowEditor(false)} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Corpo Scrollabile */}
            <div className="p-6 overflow-y-auto space-y-8">
              {/* EDITOR MISSIONI */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Target className="w-4 h-4 text-brand-600" /> Missioni MBO
              </h3>
              <button onClick={() => setEditingMission({ nome: '', tipo: 'FATTURATO', target: 0, pesoPercentuale: 0 })} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-xl text-[10px] font-black hover:bg-brand-100 transition-all">
                <Plus className="w-3.5 h-3.5" /> AGGIUNGI
              </button>
            </div>

            <div className="space-y-3">
              {activeMissions.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.tipo === 'FATTURATO' ? 'bg-blue-100 text-blue-600' : (m.tipo === 'ATTIVAZIONE' || m.tipo === 'ORDINANTI') ? 'bg-emerald-100 text-emerald-600' : 'bg-purple-100 text-purple-600'}`}>
                      {m.tipo === 'FATTURATO' ? <TrendingUp className="w-4 h-4" /> : m.tipo === 'ATTIVAZIONE' ? <Zap className="w-4 h-4" /> : m.tipo === 'ORDINANTI' ? <RefreshCw className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{m.nome}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase">
                        {m.pesoPercentuale}% • Target: {m.target} {(m.targetCategorie?.length || m.targetSkus?.length) ? `• Focus Multiplo (Soglia: €${m.sogliaFinanziaria || 0})` : m.sku ? `• SKU: ${m.sku}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setMassAssignMission(m)} title="Assegnazione Massiva" className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Layers className="w-4 h-4" /></button>
                    <button onClick={() => setEditingMission(m)} className="p-2 text-slate-400 hover:text-brand-600 transition-colors"><Settings2 className="w-4 h-4" /></button>
                    {m.id !== 'm1' && (
                      <button onClick={() => deleteMission(m.id)} title="Archivia" className="p-2 text-slate-400 hover:text-amber-600 transition-colors"><Archive className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              ))}

              {/* ARCHIVIATE COLLAPSED */}
              {archivedMissions.length > 0 && (
                <div className="pt-2">
                  <button 
                    onClick={() => setShowArchivedMissions(!showArchivedMissions)}
                    className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all"
                  >
                    {showArchivedMissions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Missioni Archiviate ({archivedMissions.length})
                  </button>
                  {showArchivedMissions && (
                    <div className="mt-3 space-y-2 opacity-60 grayscale">
                      {archivedMissions.map(m => (
                        <div key={m.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-600">{m.nome}</span>
                          <button onClick={() => updateMission(m.id, { stato: 'ATTIVA' })} className="text-[9px] font-black text-brand-600 hover:underline">RIPRISTINA</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* EDITOR CAMPAGNE (v4.0) */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Rocket className="w-4 h-4 text-purple-600" /> Campagne Extra
              </h3>
              <button onClick={() => setEditingCampaign({ nome: '', sku: '', valoreBonus: 0 })} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-xl text-[10px] font-black hover:bg-purple-100 transition-all">
                <Plus className="w-3.5 h-3.5" /> NUOVA
              </button>
            </div>

            <div className="space-y-3">
              {campaigns.filter(c => c.stato !== 'ARCHIVIATA').map(c => (
                <div key={c.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{c.nome}</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase">SKU: {c.sku} • Bonus: €{c.valoreBonus}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingCampaign(c)} className="p-2 text-slate-400 hover:text-brand-600 transition-colors"><Settings2 className="w-4 h-4" /></button>
                      <button onClick={() => deleteCampaign(c.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  {/* Periodi */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Finestre Temporali</p>
                    <div className="flex flex-wrap gap-2">
                      {c.periodi.map(p => (
                        <div key={p.id} className="flex items-center gap-2 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-slate-600">
                          <span>{new Date(p.dataInizio).toLocaleDateString('it-IT')}</span>
                          {p.dataFine ? (
                            <>
                              <ArrowRight className="w-2.5 h-2.5 text-slate-300" />
                              <span>{new Date(p.dataFine).toLocaleDateString('it-IT')}</span>
                            </>
                          ) : (
                            <button 
                              onClick={() => closeCampaignPeriod(c.id, p.id)}
                              className="ml-1 text-red-500 hover:text-red-700"
                            >
                              CHIUDI
                            </button>
                          )}
                        </div>
                      ))}
                      {!c.periodi.some(p => !p.dataFine) && (
                        <button 
                          onClick={() => addCampaignPeriod(c.id, { id: 'p-' + Math.random().toString(36).substring(2, 9), dataInizio: new Date().toISOString().split('T')[0] })}
                          className="px-2 py-1 bg-brand-50 text-brand-600 border border-brand-100 rounded-lg text-[9px] font-black"
                        >
                          + NUOVO PERIODO
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MODAL EDITING MISSION */}
          {editingMission && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setEditingMission(null)}>
              <div className="p-5 bg-slate-900 rounded-3xl text-white space-y-4 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-brand-400">{editingMission.id ? 'Modifica Missione' : 'Nuova Missione'}</h4>
                  <button onClick={() => setEditingMission(null)} className="text-slate-400 hover:text-white p-2"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="space-y-3">
                  {editingMission.id === 'm1' || editingMission.tipo === 'PRODOTTO' ? (
                    <div className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-400 font-bold">
                      {editingMission.nome || (editingMission.tipo === 'PRODOTTO' ? 'Nuova Missione Prodotto' : '')}
                    </div>
                  ) : (
                    <input 
                      type="text" 
                      placeholder="Nome Missione" 
                      value={editingMission.nome} 
                      onChange={e => setEditingMission({...editingMission, nome: e.target.value})}
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500 transition-all"
                    />
                  )}
                  
                  <div className="grid grid-cols-2 gap-3">
                    {editingMission.id === 'm1' ? (
                      <div className="bg-slate-800/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-400 flex items-center">
                        Fatturato Globale
                      </div>
                    ) : (
                      <select 
                        value={editingMission.tipo} 
                        onChange={e => setEditingMission({...editingMission, tipo: e.target.value as any})}
                        className="bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500 transition-all text-white"
                      >
                        <option value="FATTURATO">Minimo Fatturato</option>
                        <option value="ATTIVAZIONE">Attivazione</option>
                        <option value="ORDINANTI">Ordinanti</option>
                        <option value="PRODOTTO">Prodotto</option>
                      </select>
                    )}
                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="Peso %" 
                        value={editingMission.pesoPercentuale || ''} 
                        onChange={e => setEditingMission({...editingMission, pesoPercentuale: Number(e.target.value)})}
                        className="w-full bg-white/10 border border-white/10 rounded-xl pl-4 pr-8 py-3 text-sm outline-none focus:border-brand-500 transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">%</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 mt-2">
                    {editingMission.id === 'm1' ? (
                      <div>
                        <label className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1.5 ml-1 block">
                          Obiettivo € Totale
                        </label>
                        <input 
                          type="number" 
                          placeholder="Inserisci valore numerico"
                          value={editingMission.target || ''} 
                          onChange={e => setEditingMission({...editingMission, target: Number(e.target.value)})}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500 transition-all text-white placeholder-white/30"
                        />
                      </div>
                    ) : editingMission.tipo === 'PRODOTTO' ? (
                      <>
                        <div>
                          <label className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1.5 ml-1 block">
                            1. Seleziona Categorie Focus
                          </label>
                          <select 
                            value="" 
                            onChange={e => {
                              const cat = e.target.value;
                              if (!cat) return;
                              const current = editingMission.targetCategorie || [];
                              if (!current.includes(cat)) {
                                const next = [...current, cat];
                                setEditingMission({...editingMission, targetCategorie: next, nome: `Focus ${next.join(', ')}`});
                              }
                            }}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500 transition-all text-white mb-2"
                          >
                            <option value="">+ Aggiungi una categoria...</option>
                            {Array.from(new Set(products.map(p => p.categoria).filter(Boolean))).map(cat => (
                              <option key={cat as string} value={cat as string}>{cat as string}</option>
                            ))}
                          </select>
                          
                          {(editingMission.targetCategorie || []).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2 mb-4">
                              {(editingMission.targetCategorie || []).map(cat => (
                                <div key={cat} className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-500/20 text-brand-300 border border-brand-500/30 rounded-lg text-xs font-bold">
                                  <span>{cat}</span>
                                  <button onClick={() => {
                                    const next = (editingMission.targetCategorie || []).filter(c => c !== cat);
                                    setEditingMission({...editingMission, targetCategorie: next, nome: next.length > 0 ? `Focus ${next.join(', ')}` : editingMission.nome});
                                  }} className="ml-1.5 text-brand-400 hover:text-white transition-colors">&times;</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1.5 ml-1 block">
                            2. Includi SKU Eccezioni / Bundle (Opzionale)
                          </label>
                          <select 
                            value="" 
                            onChange={e => {
                              const sku = e.target.value;
                              if (!sku) return;
                              const current = editingMission.targetSkus || [];
                              if (!current.includes(sku)) {
                                setEditingMission({...editingMission, targetSkus: [...current, sku]});
                              }
                            }}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500 transition-all text-white mb-2"
                          >
                            <option value="">+ Aggiungi uno SKU specifico...</option>
                            {products.map(p => (
                              <option key={p.id} value={p.codice}>{p.codice} - {p.descrizione}</option>
                            ))}
                          </select>
                          
                          {(editingMission.targetSkus || []).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {(editingMission.targetSkus || []).map(sku => (
                                <div key={sku} className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold">
                                  <span>{sku}</span>
                                  <button onClick={() => {
                                    setEditingMission({...editingMission, targetSkus: (editingMission.targetSkus || []).filter(s => s !== sku)});
                                  }} className="ml-1.5 text-purple-400 hover:text-white transition-colors">&times;</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1.5 ml-1 block">
                            Soglia Minima (€)
                          </label>
                          <div className="relative">
                            <input 
                              type="number" 
                              placeholder="Es: 48" 
                              value={editingMission.sogliaFinanziaria || ''} 
                              onChange={e => setEditingMission({...editingMission, sogliaFinanziaria: Number(e.target.value)})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-8 py-3 text-sm outline-none focus:border-brand-500 transition-all text-white placeholder-white/30"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 text-xs font-bold">€</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1.5 ml-1 block">
                            Num. Negozi Target (Globale)
                          </label>
                          <input 
                            type="number" 
                            placeholder="Es: 10"
                            value={editingMission.target || ''} 
                            onChange={e => setEditingMission({...editingMission, target: Number(e.target.value)})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500 transition-all text-white placeholder-white/30"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1.5 ml-1 block">
                            Num. Negozi
                          </label>
                          <input 
                            type="number" 
                            placeholder="Inserisci valore numerico"
                            value={editingMission.target || ''} 
                            onChange={e => setEditingMission({...editingMission, target: Number(e.target.value)})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500 transition-all text-white placeholder-white/30"
                          />
                        </div>
                        
                        {editingMission.tipo === 'FATTURATO' && (
                          <div>
                            <label className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1.5 ml-1 block">
                              Soglia Minima €
                            </label>
                            <div className="relative">
                              <input 
                                type="number" 
                                placeholder="Soglia minima in €" 
                                value={editingMission.targetSingolo || ''} 
                                onChange={e => setEditingMission({...editingMission, targetSingolo: Number(e.target.value)})}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-8 py-3 text-sm outline-none focus:border-brand-500 transition-all text-white placeholder-white/30"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 text-xs font-bold">€</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <button 
                    onClick={handleSaveMission}
                    className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-brand-900/20 transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    <Save className="w-4 h-4" /> SALVA MISSIONE
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL EDITING CAMPAIGN */}
          {editingCampaign && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setEditingCampaign(null)}>
              <div className="p-5 bg-slate-900 rounded-3xl text-white space-y-4 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-purple-400">{editingCampaign.id ? 'Modifica Campagna' : 'Nuova Campagna'}</h4>
                  <button onClick={() => setEditingCampaign(null)} className="text-slate-400 hover:text-white p-2"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Nome Campagna" 
                    value={editingCampaign.nome} 
                    onChange={e => setEditingCampaign({...editingCampaign, nome: e.target.value})}
                    className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-all"
                  />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <select 
                      value={editingCampaign.sku || ''} 
                      onChange={e => setEditingCampaign({...editingCampaign, sku: e.target.value})}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-all text-white"
                    >
                      <option value="">Seleziona SKU...</option>
                      {products.filter(p => p.attivo !== false).map(p => (
                        <option key={p.id} value={p.codice}>{p.codice} - {p.descrizione}</option>
                      ))}
                    </select>
                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="Bonus €" 
                        value={editingCampaign.valoreBonus || ''} 
                        onChange={e => setEditingCampaign({...editingCampaign, valoreBonus: Number(e.target.value)})}
                        className="w-full bg-white/10 border border-white/10 rounded-xl pl-4 pr-8 py-3 text-sm outline-none focus:border-purple-500 transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">€</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveCampaign}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-purple-900/20 transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    <Save className="w-4 h-4" /> SALVA CAMPAGNA
                  </button>
                </div>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      )}

      {/* MODALE ASSEGNAZIONE MASSIVA */}
      {massAssignMission && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMassAssignMission(null)}>
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 tracking-tight">Assegnazione Massiva</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target: {massAssignMission.nome}</p>
                </div>
              </div>
              <button onClick={() => setMassAssignMission(null)} className="p-2 bg-white hover:bg-slate-200 rounded-full transition-colors shadow-sm text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TOOLBAR RAPIDA */}
            <div className="px-4 py-3 bg-white border-b border-slate-100 flex gap-2 shrink-0">
              <button
                onClick={() => {
                  combinedRivendite.filter(r => rubrica[getRivenditaId(r)]?.stato !== 'RIP').forEach(r => {
                    const id = getRivenditaId(r);
                    const current = rubrica[id]?.targetIdoneo || [];
                    if (!current.includes(massAssignMission.id)) {
                      handleRubricaUpdate(id, 'targetIdoneo', [...current, massAssignMission.id]);
                    }
                  });
                }}
                className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors"
              >
                Seleziona Tutti
              </button>
              <button
                onClick={() => {
                  combinedRivendite.filter(r => rubrica[getRivenditaId(r)]?.stato !== 'RIP').forEach(r => {
                    const id = getRivenditaId(r);
                    const current = rubrica[id]?.targetIdoneo || [];
                    if (current.includes(massAssignMission.id)) {
                      handleRubricaUpdate(id, 'targetIdoneo', current.filter((mId: string) => mId !== massAssignMission.id));
                    }
                  });
                }}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors"
              >
                Deseleziona Tutti
              </button>
            </div>

            {/* BARRA DI RICERCA */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 shrink-0">
              <input 
                type="text" 
                placeholder="Cerca per numero o comune..."
                value={assignSearchTerm}
                onChange={(e) => setAssignSearchTerm(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              />
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50 space-y-2">
              {combinedRivendite.filter(r => {
                if (rubrica[getRivenditaId(r)]?.stato === 'RIP') return false;
                const term = assignSearchTerm.trim().toUpperCase();
                if (!term) return true;
                const num = r.isStore ? r.storeNumber : r['Num. Rivendita'];
                const comune = r['Comune'] || '';
                return num?.toString().toUpperCase().includes(term) || comune.toUpperCase().includes(term);
              }).length === 0 ? (
                <p className="text-center text-sm text-slate-500 italic py-10">Nessuna rivendita trovata.</p>
              ) : (
                combinedRivendite.filter(r => {
                  if (rubrica[getRivenditaId(r)]?.stato === 'RIP') return false;
                  const term = assignSearchTerm.trim().toUpperCase();
                  if (!term) return true;
                  const num = r.isStore ? r.storeNumber : r['Num. Rivendita'];
                  const comune = r['Comune'] || '';
                  return num?.toString().toUpperCase().includes(term) || comune.toUpperCase().includes(term);
                }).map(r => {
                  const id = getRivenditaId(r);
                  const extra = rubrica[id] || {};
                  const isAssigned = (extra.targetIdoneo || []).includes(massAssignMission.id);
                  
                  return (
                    <label key={id} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isAssigned ? 'bg-white border-indigo-200 shadow-sm' : 'bg-transparent border-slate-200 hover:bg-white hover:border-slate-300'}`}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {r.isStore ? `Store ${r.storeName || r.storeNumber}` : `Riv. ${r['Num. Rivendita']}`}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">{r['Comune']} ({r['Prov.']})</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ml-3 ${isAssigned ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                        {isAssigned && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <input 
                        type="checkbox"
                        checked={isAssigned}
                        onChange={(e) => {
                          const current = extra.targetIdoneo || [];
                          const next = e.target.checked 
                            ? [...current, massAssignMission.id] 
                            : current.filter((mId: string) => mId !== massAssignMission.id);
                          handleRubricaUpdate(id, 'targetIdoneo', next);
                        }}
                        className="hidden"
                      />
                    </label>
                  );
                })
              )}
            </div>
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
              <button onClick={() => setMassAssignMission(null)} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all">
                Fatto
              </button>
            </div>
          </div>
        </div>
      )}



      {/* MISSIONI MBO (SOLO ATTIVE) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Target className="w-4 h-4" /> Missioni MBO Pesate
          </h3>
          <span className="text-[10px] font-bold text-slate-400 italic">Pool: €{maxMboBonus.toLocaleString('it-IT')}</span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {activeMissions.map(mission => {
            const rawRatio = mission.target > 0 ? (mission.progressoAttuale / mission.target) : 0;
            const percentage = Math.min(100, Math.round(rawRatio * 100)); // Mantiene la barra visiva fluida
            const potentialValue = maxMboBonus * (mission.pesoPercentuale / 100);
            
            let earnedValue = 0;
            if (mission.tipo === 'FATTURATO') {
              if (rawRatio >= 0.99) {
                earnedValue = potentialValue;
              } else if (rawRatio >= 0.80) {
                earnedValue = potentialValue * 0.5;
              } else {
                earnedValue = 0;
              }
            } else {
              if (rawRatio >= 1) {
                earnedValue = potentialValue;
              } else {
                earnedValue = 0;
              }
            }

            return (
              <div 
                key={mission.id} 
                onClick={() => {
                  const enrichedDettagli = (mission.dettagliProgresso || []).map(d => {
                    const r = combinedRivendite.find(cr => getRivenditaId(cr) === d.id);
                    return {
                      ...d,
                      nome: r ? (r.isStore ? `Store ${r.storeNumber || r.storeName || ''}` : `Riv. ${r['Num. Rivendita']}`) : d.nome,
                      comune: r ? (r['Comune'] || '') : d.comune
                    };
                  });
                  setDrillDownMission({ nome: mission.nome, dettagli: enrichedDettagli });
                }}
                className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mission.tipo === 'FATTURATO' ? 'bg-blue-50 text-blue-600' : (mission.tipo === 'ATTIVAZIONE' || mission.tipo === 'ORDINANTI') ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
                      {mission.tipo === 'FATTURATO' ? <TrendingUp className="w-5 h-5" /> : mission.tipo === 'ATTIVAZIONE' ? <Zap className="w-5 h-5" /> : mission.tipo === 'ORDINANTI' ? <RefreshCw className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">{mission.nome}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Peso: {mission.pesoPercentuale}% • Max €{potentialValue.toLocaleString('it-IT')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-slate-800">{percentage}%</p>
                    <p className="text-[10px] font-bold text-brand-600">+€{earnedValue.toLocaleString('it-IT')}</p>
                  </div>
                </div>

                {/* Barra di progresso dinamica (Bicolore per Fatturato) */}
                {mission.tipo === 'FATTURATO' ? (() => {
                  const dProg = mission.dettagliProgresso || [];
                  const tLog = dProg.reduce((acc, d) => {
                    if (d.totaleLogista !== undefined) return acc + d.totaleLogista;
                    if (d.fonte === 'Logista') return acc + (d.valore || 0);
                    return acc;
                  }, 0);
                  const tMag = dProg.reduce((acc, d) => {
                    if (d.totaleMagazzino !== undefined) return acc + d.totaleMagazzino;
                    if (d.fonte === 'Magazzino' || (!d.fonte && d.totaleLogista === undefined)) return acc + (d.valore || 0);
                    return acc;
                  }, 0);
                  
                  const tTot = tLog + tMag;
                  const widthLogista = tTot > 0 ? (tLog / tTot) * percentage : 0;
                  const widthMagazzino = tTot > 0 ? (tMag / tTot) * percentage : 0;

                  return (
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-blue-500 transition-all duration-1000 ease-out" style={{ width: `${widthMagazzino}%` }}></div>
                      <div className="h-full bg-orange-500 transition-all duration-1000 ease-out" style={{ width: `${widthLogista}%` }}></div>
                    </div>
                  );
                })() : (
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden relative">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${percentage === 100 ? 'bg-emerald-500' : (mission.tipo === 'ATTIVAZIONE' || mission.tipo === 'ORDINANTI') ? 'bg-amber-500' : 'bg-purple-500'}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                )}

                {/* Ripartizione Visiva Logista vs Magazzino per Missione Fatturato */}
                {mission.tipo === 'FATTURATO' && mission.dettagliProgresso && mission.dettagliProgresso.length > 0 && (() => {
                  const totLogista = mission.dettagliProgresso.reduce((acc, d) => {
                    if (d.totaleLogista !== undefined) return acc + d.totaleLogista;
                    if (d.fonte === 'Logista') return acc + (d.valore || 0);
                    return acc;
                  }, 0);

                  const totMagazzino = mission.dettagliProgresso.reduce((acc, d) => {
                    if (d.totaleMagazzino !== undefined) return acc + d.totaleMagazzino;
                    if (d.fonte === 'Magazzino' || (!d.fonte && d.totaleLogista === undefined)) return acc + (d.valore || 0);
                    return acc;
                  }, 0);

                  const totaleFatturato = totLogista + totMagazzino;
                  
                  const pctLogista = totaleFatturato > 0 ? Math.round((totLogista / totaleFatturato) * 100) : 0;
                  const pctMagazzino = totaleFatturato > 0 ? (100 - pctLogista) : 0;

                  return (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px] font-bold">
                      <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-2 flex justify-between items-center">
                        <span className="text-blue-700 font-extrabold">Magazzino:</span>
                        <span className="text-slate-700">€{totMagazzino.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({pctMagazzino}%)</span>
                      </div>
                      <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-2 flex justify-between items-center">
                        <span className="text-orange-700 font-extrabold">Logista:</span>
                        <span className="text-slate-700">€{totLogista.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({pctLogista}%)</span>
                      </div>
                    </div>
                  );
                })()}

                {/* WIDGET OBIETTIVO GIORNALIERO INTEGRATO */}
                {(mission.id === 'm1' || mission.tipo === 'ATTIVAZIONE' || mission.tipo === 'ORDINANTI') && (() => {
                  const runRateData = calculateRunRate(mission);
                  if (!runRateData) return null;
                  const isCurrency = mission.tipo === 'FATTURATO';
                  // Se è valuta mostriamo l'euro, se sono pratiche mostriamo un decimale
                  const formatVal = (val: number) => isCurrency 
                    ? `€${val.toLocaleString('it-IT', { maximumFractionDigits: 0 })}` 
                    : val.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                  return (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                     <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> Obiettivo Giornaliero
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                          {runRateData.workingDaysLeft} gg lavorativi rimasti
                        </span>
                     </div>
                     <div className={`grid gap-2 ${isCurrency ? 'grid-cols-2' : 'grid-cols-1'}`}>
                       {isCurrency && (
                         <div className={`px-3 py-2 rounded-xl flex justify-between items-center border ${runRateData.is80Reached ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Per l'80%</span>
                           {runRateData.is80Reached ? (
                             <span className="text-xs font-black text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Fatto</span>
                           ) : (
                             <span className="text-sm font-black text-slate-700">{formatVal(runRateData.dailyTarget80)}<span className="text-[9px] text-slate-400 font-bold ml-0.5">/gg</span></span>
                           )}
                         </div>
                       )}
                       <div className={`px-3 py-2 rounded-xl flex justify-between items-center border ${runRateData.is100Reached ? 'bg-emerald-50 border-emerald-100' : 'bg-brand-50 border-brand-200 shadow-sm'}`}>
                         <span className="text-[9px] font-black text-brand-500 uppercase tracking-widest">Per il 100%</span>
                         {runRateData.is100Reached ? (
                           <span className="text-xs font-black text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Fatto</span>
                         ) : (
                           <span className="text-sm font-black text-brand-700">{formatVal(runRateData.dailyTarget100)}<span className="text-[9px] text-brand-500/70 font-bold ml-0.5">/gg</span></span>
                         )}
                       </div>
                     </div>
                  </div>
                  );
                })()}

                <div className="flex justify-between items-center mt-3">
                  <p className="text-[9px] font-bold text-slate-400 flex items-center gap-2">
                    <span>{mission.progressoAttuale.toLocaleString('it-IT')} / {mission.target.toLocaleString('it-IT')}</span>
                    {mission.valoreGenerato !== undefined && mission.valoreGenerato > 0 && (
                      <span className="text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded font-black">
                        €{mission.valoreGenerato.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </p>
                  
                  {/* Badge Motivazionale / Completamento */}
                  {(() => {
                    if (mission.tipo === 'FATTURATO' && mission.target > 0) {
                      const ratio = mission.progressoAttuale / mission.target;
                      if (ratio >= 0.99) {
                        return (
                          <span className="text-[9px] font-black text-emerald-600 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <Sparkles className="w-3 h-3" /> COMPLETATA
                          </span>
                        );
                      } else if (ratio >= 0.80) {
                        const missing = (mission.target * 0.99) - mission.progressoAttuale;
                        return (
                          <span className="text-[9px] font-bold text-amber-600 flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Target className="w-3 h-3" /> Manca €{missing.toLocaleString('it-IT', { maximumFractionDigits: 0 })} al 100%
                          </span>
                        );
                      } else {
                        const missing = (mission.target * 0.80) - mission.progressoAttuale;
                        return (
                          <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                            <Target className="w-3 h-3" /> Manca €{missing.toLocaleString('it-IT', { maximumFractionDigits: 0 })} al 50%
                          </span>
                        );
                      }
                    } else if (percentage === 100) {
                      return (
                        <span className="text-[9px] font-black text-emerald-600 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded">
                          <Sparkles className="w-3 h-3" /> COMPLETATA
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CAMPAGNE EXTRA ATTIVE (v4.0) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Rocket className="w-4 h-4" /> Campagne Extra Attive
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {campaigns.filter(c => c.stato !== 'ARCHIVIATA').map(campaign => {
            // Simuliamo una rubrica temporanea con solo questa campagna per calcolare il suo bonus specifico tramite il motore centrale
            const singleCampaignContext = { ...rubrica }; // Copia la rubrica
            
            // Creiamo un array temporaneo con solo la campagna corrente per farla calcolare dalla funzione globale
            const tempCampaigns = [campaign];
            
            // Ricalcoliamo il bonus ESCLUSIVAMENTE per questa campagna usando la logica centrale
            let campaignEarned = 0;
            
            Object.values(singleCampaignContext).forEach((riv: RivenditaExtra) => {
              riv.history?.forEach(entry => {
                // IL FIX CRITICO: Scartiamo le BOZZE
                if (entry.tipo === 'ORDINE' && entry.isEseguito !== false && entry.items) {
                   entry.items.forEach(item => {
                      tempCampaigns.forEach(c => {
                          if (item.codice === c.sku || item.descrizione.toLowerCase().includes(c.sku.toLowerCase())) {
                              // Controlliamo il periodo in modo rigoroso
                              const isValid = c.periodi.some(p => {
                                  const orderDate = entry.data.split('T')[0];
                                  const startDate = p.dataInizio.split('T')[0];
                                  const endDate = p.dataFine ? p.dataFine.split('T')[0] : null;
                                  
                                  return orderDate >= startDate && (!endDate || orderDate <= endDate);
                              });
                              if(isValid) {
                                  campaignEarned += (item.quantita * c.valoreBonus);
                              }
                          }
                      });
                   });
                }
              });
            });

            return (
              <div key={campaign.id} className="bg-white border border-purple-100 rounded-[2rem] p-5 shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center border border-purple-100 shrink-0">
                    <ShoppingBag className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-800 tracking-tight truncate">{campaign.nome}</h3>
                    <p className="text-[11px] text-slate-500 font-medium truncate">+€{campaign.valoreBonus.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per {campaign.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-purple-600">€{campaignEarned.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Maturato</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RADAR SCADENZE */}
      <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
        <div 
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => setShowRadar(!showRadar)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 group-hover:bg-slate-100 transition-colors">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-slate-800 text-sm">Radar Scadenze</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {radarScadenze.scadute.length} Scadute • {radarScadenze.inScadenza.length} In Scadenza
              </p>
            </div>
          </div>
          <div className="p-2 text-slate-400 group-hover:text-slate-600">
            {showRadar ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>

        {showRadar && (
          <div className="pt-3 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2">
            {/* SCADUTE */}
            {radarScadenze.scadute.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Da Declassare (≥ 5 Mesi)</h5>
                <div className="grid grid-cols-1 gap-2">
                  {radarScadenze.scadute.map((item, i) => (
                    <div key={`scad-${i}`} className="flex justify-between items-center p-2.5 bg-red-50 border border-red-100 rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-red-900">{item.nome} • {item.comune}</p>
                        <p className="text-[9px] text-red-700 font-medium">Ultimo ordine: {item.dataUltimo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* IN SCADENZA */}
            {radarScadenze.inScadenza.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1"><Clock className="w-3 h-3"/> In Scadenza (Mese 4)</h5>
                <div className="grid grid-cols-1 gap-2">
                  {radarScadenze.inScadenza.map((item, i) => (
                    <div key={`inscad-${i}`} className="flex justify-between items-center p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-amber-900">{item.nome} • {item.comune}</p>
                        <p className="text-[9px] text-amber-700 font-medium">Ultimo ordine: {item.dataUltimo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* A RISCHIO */}
            {radarScadenze.aRischio.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><Info className="w-3 h-3"/> A Rischio (Mese 3)</h5>
                <div className="grid grid-cols-1 gap-2">
                  {radarScadenze.aRischio.map((item, i) => (
                    <div key={`risch-${i}`} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-slate-700">{item.nome} • {item.comune}</p>
                        <p className="text-[9px] text-slate-500 font-medium">Ultimo ordine: {item.dataUltimo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {radarScadenze.scadute.length === 0 && radarScadenze.inScadenza.length === 0 && radarScadenze.aRischio.length === 0 && (
              <p className="text-xs text-slate-500 italic text-center py-4">Nessuna anomalia rilevata nel radar.</p>
            )}
          </div>
        )}
      </div>
      <DrillDownModal 
        isOpen={!!drillDownMission} 
        onClose={() => setDrillDownMission(null)} 
        missionName={drillDownMission?.nome || ''} 
        dettagli={drillDownMission?.dettagli || []} 
      />
    </div>
  );
};

export default StrategyDashboard;
