import React, { useState } from 'react';
import { 
  Calendar, 
  Download, 
  Activity, 
  Target, 
  ChevronDown, 
  ChevronUp, 
  BarChart3, 
  CheckCircle2, 
  ChevronRight,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  History
} from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';

interface StatsTabProps {
  statsPeriod: string;
  setStatsPeriod: (period: 'oggi' | '7g' | 'mese' | 'mese_prec' | 'all' | 'custom') => void;
  customRange: { start: string; end: string };
  setCustomRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  exportHistoryToExcel: () => void;
  visitStats: any;
  orderStats: any;
  fatturatoPeriodo: number;
  crmStats: any;
  setRivenditaFilter: (filter: string) => void;
  setActiveTab: (tab: string) => void;
}

const StatsTab: React.FC<StatsTabProps> = ({
  statsPeriod,
  setStatsPeriod,
  customRange,
  setCustomRange,
  exportHistoryToExcel,
  visitStats,
  orderStats,
  fatturatoPeriodo,
  crmStats,
  setRivenditaFilter,
  setActiveTab
}) => {
  const [statsRadarOpen, setStatsRadarOpen] = useState(true);
  const [statsTerritorioOpen, setStatsTerritorioOpen] = useState(false);
  // statsOrdiniOpen was defined in App.tsx but not used in the JSX block I moved. 
  // I'll include it here just in case it's needed for future expansions or if I missed something.
  const [statsOrdiniOpen, setStatsOrdiniOpen] = useState(false);
  const [statsBudgetOpen, setStatsBudgetOpen] = useState(true);

  const { budget, calculateBalance, getRollover } = useBudget();
  const balance = calculateBalance();
  const rollover = getRollover();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* 0. TESORETTO AM (NEW) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <button 
          onClick={() => setStatsBudgetOpen(!statsBudgetOpen)}
          className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="font-bold text-slate-800">Tesoretto AM & Rollover</h3>
          </div>
          <div className="flex items-center gap-3">
            {!statsBudgetOpen && (
              <span className={`text-xs font-black ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                €{balance.toLocaleString('it-IT')}
              </span>
            )}
            {statsBudgetOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
        </button>

        {statsBudgetOpen && (
          <div className="p-5 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 rounded-2xl p-4 text-white">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Disponibilità Attuale</p>
                <p className="text-2xl font-black">€{balance.toLocaleString('it-IT')}</p>
              </div>
              <div className="bg-brand-50 rounded-2xl p-4 border border-brand-100">
                <p className="text-[9px] font-black text-brand-400 uppercase tracking-widest mb-1">Rollover Stimato</p>
                <p className="text-2xl font-black text-brand-700">€{rollover.toLocaleString('it-IT')}</p>
              </div>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ultime Transazioni</h4>
              {budget.transazioni.slice().reverse().map(t => (
                <div key={t.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${t.tipo === 'RICARICA' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {t.tipo === 'RICARICA' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-700">{t.descrizione}</p>
                      <p className="text-[9px] text-slate-400">{new Date(t.data).toLocaleDateString('it-IT')}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-black ${t.tipo === 'RICARICA' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {t.tipo === 'RICARICA' ? '+' : '-'}€{t.importo.toLocaleString('it-IT')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
            <BarChart3 className="w-10 h-10 text-slate-300" />
          </div>
          <div>
            <p className="text-slate-800 font-bold">Nessun dato registrato</p>
            <p className="text-xs text-slate-500 mt-1">Non ci sono attività, ordini, o rivendite nel giro in questo momento.</p>
          </div>
        </div>
      ) : (
        <>
          {/* 1. RIEPILOGO ATTIVITÀ */}
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

                {/* LISTA VISITE COMPLETATE */}
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
  );
};

export default StatsTab;
