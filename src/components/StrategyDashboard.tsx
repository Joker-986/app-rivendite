import React, { useState } from 'react';
import { 
  Sparkles, Calendar, BarChart3, Target, TrendingUp, Zap, Rocket, 
  ShoppingBag, History, ChevronRight, Plus, Trash2, AlertCircle, 
  Save, X, Settings2, Info, ArrowRight, Archive, ChevronDown, ChevronUp,
  DollarSign, RefreshCw, Layers, Check, Activity, Clock
} from 'lucide-react';
import { useModals } from '../contexts/ModalContext';
import { useStrategy } from '../contexts/StrategyContext';
import { useBudget } from '../contexts/BudgetContext';
import { RubricaData, Mission, Campaign, CampaignPeriod, RivenditaExtra, SearchResult } from '../types';
import { getRivenditaId } from '../utils/helpers';

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
    salaryConfig, missions, campaigns, 
    addMission, updateMission, deleteMission, 
    addCampaign, updateCampaign, deleteCampaign,
    addCampaignPeriod, closeCampaignPeriod,
    calculateMboBonus, calculateExtraBonus 
  } = useStrategy();
  
  const { budget, calculateBalance, initializeBudget, addTransaction, reconcileBudget } = useBudget();
  const { openConfirm } = useModals();
  const balance = calculateBalance(meseSelezionato);
  
  const [showEditor, setShowEditor] = useState(false);
  const [showArchivedMissions, setShowArchivedMissions] = useState(false);
  const [editingMission, setEditingMission] = useState<Partial<Mission> | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign> | null>(null);
  const [massAssignMission, setMassAssignMission] = useState<Mission | null>(null);
  const [assignSearchTerm, setAssignSearchTerm] = useState('');
  const [budgetAction, setBudgetAction] = useState<'INIT' | 'TOPUP' | 'RECONCILE' | null>(null);
  const [budgetAmount, setBudgetAmount] = useState<string>('');

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
        const orders = extra.history?.filter(h => h.tipo === 'ORDINE') || [];
        if (orders.length > 0) {
          const lastOrder = new Date(orders[0].data);
          const delta = (annoSel - lastOrder.getFullYear()) * 12 + (meseSel - (lastOrder.getMonth() + 1));
          
          const item = { 
            res: r, 
            nome: r.isStore ? `Store ${r.storeNumber}` : `Riv. ${r['Num. Rivendita']}`,
            comune: r['Comune'],
            dataUltimo: orders[0].data 
          };
          
          if (delta >= 5) scadute.push(item);
          else if (delta === 4) inScadenza.push(item);
          else if (delta === 3) aRischio.push(item);
        }
      }
    });
    return { scadute, inScadenza, aRischio };
  }, [rubrica, combinedRivendite, meseSelezionato]);
  
  const [showRadar, setShowRadar] = useState(false);
  
  const monthlyBase = salaryConfig.ralAnnua / 12;
  const maxMboBonus = monthlyBase * (salaryConfig.percentualeBonus / 100);
  
  const activeMissions = missions.filter(m => m.stato !== 'ARCHIVIATA');
  const archivedMissions = missions.filter(m => m.stato === 'ARCHIVIATA');
  
  const totalWeight = activeMissions.reduce((acc, m) => acc + m.pesoPercentuale, 0);
  const isWeightValid = totalWeight === 100;

  // Sinergia Budget Alert
  const showBudgetAlert = balance < 50 && activeMissions.some(m => 
    (m.tipo === 'ATTIVAZIONE' || m.tipo === 'PRODOTTO') && 
    (m.target > 0 ? (m.progressoAttuale / m.target) < 0.8 : true)
  );

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
    if (!editingCampaign?.nome || !editingCampaign?.sku || editingCampaign.valoreBonus === undefined) return;
    
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

  const handleInitializeBudget = () => {
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount)) return;

    if (budgetAction === 'INIT') {
      initializeBudget(amount, meseSelezionato);
    } else if (budgetAction === 'TOPUP') {
      addTransaction({
        data: new Date().toISOString(),
        descrizione: "Ricarica Intramese",
        importo: amount,
        tipo: 'RICARICA'
      });
    } else if (budgetAction === 'RECONCILE') {
      reconcileBudget(amount, meseSelezionato);
    }
    
    setBudgetAction(null);
    setBudgetAmount('');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* HEADER & MESE */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">Camera di Regia</h2>
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

      {/* SIMULATORE STIPENDIO */}
      <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl -ml-12 -mb-12"></div>
        
        <div className="relative z-10 space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Stipendio Stimato (Lordo)</p>
              <h3 className="text-4xl font-black tracking-tighter">€{(monthlyBase + totalBonus).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Bonus Totale</p>
              <p className="text-xl font-black text-brand-400">+€{totalBonus.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
            <div className="text-center">
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Base RAL</p>
              <p className="text-sm font-black">€{monthlyBase.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="text-center border-x border-white/10">
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">MBO Maturato</p>
              <p className="text-sm font-black text-brand-400">€{mboBonus.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Extra Bonus</p>
              <p className="text-sm font-black text-purple-400">€{extraBonus.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* BLOCCO BUDGET AM (v4.0) */}
      <div className="mx-1 bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Budget AM</span>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Saldo Attuale</p>
            <p className={`text-lg font-black ${balance < 50 ? 'text-amber-600' : 'text-brand-600'}`}>€{balance.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => { setBudgetAction('INIT'); setBudgetAmount('500'); }}
            className="flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-slate-800 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> INIZIALIZZA MESE
          </button>
          <button 
            onClick={() => { setBudgetAction('TOPUP'); setBudgetAmount('100'); }}
            className="flex items-center justify-center gap-2 py-2.5 bg-brand-50 text-brand-700 rounded-xl text-[10px] font-black hover:bg-brand-100 transition-all border border-brand-100"
          >
            <Plus className="w-3.5 h-3.5" /> RICARICA INTRAMESE
          </button>
          <button 
            onClick={() => { setBudgetAction('RECONCILE'); setBudgetAmount(balance.toFixed(2)); }}
            className="col-span-2 flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black hover:bg-slate-200 transition-all border border-slate-200"
          >
            <Settings2 className="w-3 h-3" /> RETTIFICA SALDO ATTUALE
          </button>
        </div>

        {budgetAction && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                {budgetAction === 'INIT' ? 'Inizializzazione Mese' : 'Ricarica Intramese'}
              </h4>
              <button onClick={() => setBudgetAction(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="number" 
                  autoFocus
                  value={budgetAmount}
                  onChange={e => setBudgetAmount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  placeholder="Importo €"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">€</span>
              </div>
              <button 
                onClick={handleInitializeBudget}
                className="px-6 bg-brand-600 text-white rounded-xl font-black text-[10px] shadow-lg shadow-brand-100 hover:bg-brand-700 transition-all"
              >
                CONFERMA
              </button>
            </div>
          </div>
        )}

        {showBudgetAlert && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 animate-pulse">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 font-bold leading-tight">
              Budget AM critico (€{balance.toFixed(2)}). Ottimizza gli omaggi per centrare i target MBO!
            </p>
          </div>
        )}
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
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.tipo === 'FATTURATO' ? 'bg-blue-100 text-blue-600' : m.tipo === 'ATTIVAZIONE' ? 'bg-emerald-100 text-emerald-600' : 'bg-purple-100 text-purple-600'}`}>
                      {m.tipo === 'FATTURATO' ? <TrendingUp className="w-4 h-4" /> : m.tipo === 'ATTIVAZIONE' ? <Zap className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{m.nome}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase">{m.pesoPercentuale}% • Target: {m.target}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setMassAssignMission(m)} title="Assegnazione Massiva" className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Layers className="w-4 h-4" /></button>
                    <button onClick={() => setEditingMission(m)} className="p-2 text-slate-400 hover:text-brand-600 transition-colors"><Settings2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteMission(m.id)} title="Archivia" className="p-2 text-slate-400 hover:text-amber-600 transition-colors"><Archive className="w-4 h-4" /></button>
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
              <div className="p-5 bg-slate-900 rounded-3xl text-white space-y-4 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-brand-400">{editingMission.id ? 'Modifica Missione' : 'Nuova Missione'}</h4>
                  <button onClick={() => setEditingMission(null)} className="text-slate-400 hover:text-white p-2"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Nome Missione" 
                    value={editingMission.nome} 
                    onChange={e => setEditingMission({...editingMission, nome: e.target.value})}
                    className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500 transition-all"
                  />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <select 
                      value={editingMission.tipo} 
                      onChange={e => setEditingMission({...editingMission, tipo: e.target.value as any})}
                      className="bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500 transition-all text-white"
                    >
                      <option value="FATTURATO">Fatturato</option>
                      <option value="ATTIVAZIONE">Attivazione</option>
                      <option value="PRODOTTO">Prodotto</option>
                    </select>
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

                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="number" 
                      placeholder={editingMission.tipo === 'FATTURATO' ? "Num. Negozi Obiettivo" : "Target Globale"}
                      value={editingMission.target || ''} 
                      onChange={e => setEditingMission({...editingMission, target: Number(e.target.value)})}
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500 transition-all"
                    />
                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="Soglia Minima € (Opzionale)" 
                        value={editingMission.targetSingolo || ''} 
                        onChange={e => setEditingMission({...editingMission, targetSingolo: Number(e.target.value)})}
                        className="w-full bg-white/10 border border-white/10 rounded-xl pl-4 pr-8 py-3 text-sm outline-none focus:border-brand-500 transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">€</span>
                    </div>
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
              <div className="p-5 bg-slate-900 rounded-3xl text-white space-y-4 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
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
                    <input 
                      type="text" 
                      placeholder="SKU Prodotto" 
                      value={editingCampaign.sku} 
                      onChange={e => setEditingCampaign({...editingCampaign, sku: e.target.value})}
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-all"
                    />
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
            const percentage = mission.target > 0 ? Math.min(100, Math.round((mission.progressoAttuale / mission.target) * 100)) : 0;
            const potentialValue = maxMboBonus * (mission.pesoPercentuale / 100);
            const earnedValue = potentialValue * (percentage / 100);

            return (
              <div key={mission.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mission.tipo === 'FATTURATO' ? 'bg-blue-50 text-blue-600' : mission.tipo === 'ATTIVAZIONE' ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
                      {mission.tipo === 'FATTURATO' ? <TrendingUp className="w-5 h-5" /> : mission.tipo === 'ATTIVAZIONE' ? <Zap className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
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

                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden relative">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${percentage === 100 ? 'bg-emerald-500' : mission.tipo === 'FATTURATO' ? 'bg-blue-500' : mission.tipo === 'ATTIVAZIONE' ? 'bg-amber-500' : 'bg-purple-500'}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-center mt-2">
                  <p className="text-[9px] font-bold text-slate-400 flex items-center gap-2">
                    <span>{mission.progressoAttuale.toLocaleString('it-IT')} / {mission.target.toLocaleString('it-IT')}</span>
                    {mission.valoreGenerato !== undefined && mission.valoreGenerato > 0 && (
                      <span className="text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded font-black">
                        €{mission.valoreGenerato.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </p>
                  {percentage === 100 && (
                    <span className="text-[9px] font-black text-emerald-600 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> COMPLETATA
                    </span>
                  )}
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
            // Calcola bonus specifico per questa campagna
            let campaignEarned = 0;
            Object.values(rubrica as RubricaData).forEach((riv: RivenditaExtra) => {
              riv.history?.forEach(entry => {
                // Filtro temporale iniettato per il rendering visivo
                if (entry.tipo === 'ORDINE' && entry.items && entry.data.startsWith(meseSelezionato)) {
                  entry.items.forEach(item => {
                    if (item.codice === campaign.sku || item.descrizione.toLowerCase().includes(campaign.sku.toLowerCase())) {
                      const orderDate = entry.data;
                      const isValid = campaign.periodi.some(p => {
                        const start = p.dataInizio;
                        const end = p.dataFine;
                        return orderDate >= start && (!end || orderDate <= end);
                      });
                      if (isValid) {
                        campaignEarned += (item.quantita * campaign.valoreBonus);
                      }
                    }
                  });
                }
              });
            });

            return (
              <div key={campaign.id} className="bg-purple-600 rounded-[2rem] p-6 text-white shadow-lg shadow-purple-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner">
                    <ShoppingBag className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black tracking-tight">{campaign.nome}</h3>
                    <p className="text-xs text-purple-100 font-medium">+€{campaign.valoreBonus.toFixed(2)} per {campaign.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black">€{campaignEarned.toLocaleString('it-IT')}</p>
                    <p className="text-[10px] font-bold text-purple-200 uppercase tracking-widest">Maturato</p>
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
                        <p className="text-[9px] text-red-700 font-medium">Ultimo ordine: {new Date(item.dataUltimo).toLocaleDateString('it-IT')}</p>
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
                        <p className="text-[9px] text-amber-700 font-medium">Ultimo ordine: {new Date(item.dataUltimo).toLocaleDateString('it-IT')}</p>
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
                        <p className="text-[9px] text-slate-500 font-medium">Ultimo ordine: {new Date(item.dataUltimo).toLocaleDateString('it-IT')}</p>
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

      {/* STORICO & ARCHIVIO */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Archivio Performance</h4>
            <p className="text-[10px] text-slate-500">Consulta i mesi precedenti</p>
          </div>
        </div>
        <button className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-all">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default StrategyDashboard;
