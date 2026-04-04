import React from 'react';
import { CalendarClock, UserCheck, ShoppingBag, Plus, ChevronRight, Edit3 } from 'lucide-react';
import { SearchResult, RubricaData } from '../types';
import { getRivenditaId } from '../utils/helpers';

interface AgendaTabProps {
  visitStats: any;
  rubrica: RubricaData;
  crmAnagrafiche: SearchResult[];
  stores: SearchResult[];
  giroVisite: SearchResult[];
  setGiroVisite: React.Dispatch<React.SetStateAction<SearchResult[]>>;
  setRivenditaFilter: (filter: string) => void;
  setActiveTab: (tab: string) => void;
  setAgendaHostessEdit: (edit: { id: string; extra: any; targetIndex: number } | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AgendaTab: React.FC<AgendaTabProps> = ({
  visitStats,
  rubrica,
  crmAnagrafiche,
  stores,
  giroVisite,
  setGiroVisite,
  setRivenditaFilter,
  setActiveTab,
  setAgendaHostessEdit,
  showToast
}) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between px-1 mb-2">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Agenda Operativa</h2>
      </div>

      {/* 1. APPUNTAMENTI / DA RIVISITARE */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <CalendarClock className="w-4 h-4 text-orange-600" />
            </div>
            <h3 className="font-bold text-slate-800">Appuntamenti / Da Rivisitare</h3>
          </div>
          {visitStats.prossimi.length > 0 && (
            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-lg text-[10px] font-black border border-orange-200">{visitStats.prossimi.length}</span>
          )}
        </div>
        <div className="space-y-3">
          {visitStats.prossimi.length > 0 ? (
            visitStats.prossimi.map((p: any) => {
              const [year, month, day] = p.dataRivisita.split('-').map(Number);
              const dObj = new Date(year, month - 1, day);
              const dataIT = dObj.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
              const oggiIT = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
              const isToday = dataIT === oggiIT;
              const isOverdue = p.isOverdue;

              return (
                <div key={p.id} className={`p-1.5 rounded-xl border transition-all ${
                  isToday ? 'bg-orange-100 border-orange-400 shadow-sm ring-1 ring-orange-200' : 
                  isOverdue ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-100'
                }`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className={`text-[11px] font-bold truncate ${isToday ? 'text-orange-900' : isOverdue ? 'text-red-900' : 'text-slate-800'}`}>
                        {p.nome} - {p.comune}
                      </p>
                      <p className={`text-[10px] font-medium flex items-center gap-1 mt-0.5 ${isToday ? 'text-orange-700' : isOverdue ? 'text-red-600' : 'text-slate-600'}`}>
                        {dataIT} {p.ora} 
                        {isToday && ' • OGGI'}
                        {isOverdue && ' • DA RECUPERARE'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => {
                        const riv = [...crmAnagrafiche, ...stores].find(r => getRivenditaId(r) === p.id);
                        if (riv && !giroVisite.some(g => getRivenditaId(g) === p.id)) {
                          setGiroVisite(prev => [...prev, riv]);
                          showToast('Aggiunta al giro');
                        }
                      }}
                      className="flex-1 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Giro
                    </button>
                    <button 
                      onClick={() => { setRivenditaFilter(p.soloNumero); setActiveTab('crm'); }} 
                      className="px-3 py-1 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
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

      {/* 2. SERVIZI HOSTESS (Raggruppati v3.04) */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-purple-600" />
            </div>
            <h3 className="font-bold text-slate-800">Servizi Hostess</h3>
          </div>
        </div>
        <div className="space-y-3">
          {(() => {
            const allRivendite = [...crmAnagrafiche, ...stores, ...giroVisite];
            const today = new Date(); today.setHours(0,0,0,0);
            const groupedEvents: any[] = [];

            Object.entries(rubrica).forEach(([id, d]) => {
              const riv = allRivendite.find(r => getRivenditaId(r) === id);
              if (!riv) return;

              const history = (d as any).history || [];
              const hostessEntries = history
                .map((h: any, index: number) => ({ ...h, originalIndex: index }))
                .filter((h: any) => h.tipo === 'HOSTESS');

              if (hostessEntries.length > 0) {
                const parsedEvents = hostessEntries.map((h: any) => {
                  const eventDate = new Date(h.data);
                  const isFuture = eventDate >= today;
                  const startTime = eventDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                  const matchFine = (h.note || '').match(/Fine turno: (\d{2}:\d{2})/);
                  const endTime = matchFine ? matchFine[1] : '';
                  const dateStr = eventDate.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  
                  return {
                    originalIndex: h.originalIndex,
                    info: startTime !== '00:00' ? `${dateStr} dalle ${startTime}${endTime ? ' alle ' + endTime : ''}` : dateStr,
                    dateObj: eventDate,
                    isFuture
                  };
                }).sort((a: any, b: any) => b.dateObj.getTime() - a.dateObj.getTime()); // Decrescente dentro la card

                groupedEvents.push({
                  id, extra: d,
                  nome: riv.isStore ? (riv.storeName || 'Store') : `Riv. ${riv['Num. Rivendita']}`,
                  soloNumero: riv.isStore ? (riv.storeNumber || '') : (riv['Num. Rivendita'] || ''),
                  comune: riv['Comune'] || '',
                  events: parsedEvents,
                  latestDate: parsedEvents[0].dateObj.getTime()
                });
              }
            });

            if (groupedEvents.length === 0) {
              return <p className="text-[10px] text-slate-400 italic text-center py-4">Nessun servizio Hostess in cronologia.</p>;
            }

            groupedEvents.sort((a, b) => b.latestDate - a.latestDate); // Ordine dei contenitori

            return groupedEvents.map((group, i) => {
              const hasFuture = group.events.some((e:any) => e.isFuture);
              
              return (
              <div key={`${group.id}-${i}`} className={`p-2.5 border rounded-2xl transition-all ${hasFuture ? 'bg-fuchsia-50/40 border-fuchsia-100 shadow-sm' : 'bg-purple-50/30 border-purple-100'}`}>
                <div className="flex justify-between items-start mb-2.5 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{group.nome}</p>
                    <span className="text-[10px] font-medium text-slate-500 truncate">• {group.comune}</span>
                  </div>
                  <button 
                    onClick={() => { setRivenditaFilter(group.soloNumero); setActiveTab('crm'); }} 
                    className="p-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
                
                <div className="space-y-1.5">
                  {group.events.map((ev: any, idx: number) => (
                    <div 
                      key={idx} 
                      onClick={() => setAgendaHostessEdit({ id: group.id, extra: group.extra, targetIndex: ev.originalIndex })}
                      className={`p-2.5 rounded-xl border cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all flex justify-between items-center ${ev.isFuture ? 'bg-white border-fuchsia-200 shadow-sm' : 'bg-white/60 border-purple-100'}`}
                    >
                      <p className={`text-[11px] font-bold flex items-center gap-1.5 ${ev.isFuture ? 'text-fuchsia-700' : 'text-purple-700'}`}>
                        <CalendarClock className="w-3.5 h-3.5" /> {ev.info}
                      </p>
                      <div className="flex items-center gap-2">
                        {ev.isFuture && <span className="text-[9px] font-black bg-fuchsia-100 text-fuchsia-600 px-1.5 py-0.5 rounded uppercase">In arrivo</span>}
                        <Edit3 className={`w-3.5 h-3.5 ${ev.isFuture ? 'text-fuchsia-400' : 'text-purple-300'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )});
          })()}
        </div>
      </div>

      {/* 3. ORDINI DA EVADERE (Raggruppati v3.05) */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="font-bold text-slate-800">Ordini da Evadere</h3>
          </div>
        </div>
        <div className="space-y-3">
          {(() => {
            const allRivendite = [...crmAnagrafiche, ...stores, ...giroVisite];
            const groupedOrders: any[] = [];

            Object.entries(rubrica).forEach(([id, d]) => {
              const riv = allRivendite.find(r => getRivenditaId(r) === id);
              if (!riv) return;

              const history = (d as any).history || [];
              const pendingOrders = history
                .map((h: any, index: number) => ({ ...h, originalIndex: index }))
                .filter((h: any) => h.tipo === 'ORDINE' && h.stato === 'DA_EVADERE');

              if (pendingOrders.length > 0) {
                groupedOrders.push({
                  id, extra: d,
                  nome: riv.isStore ? (riv.storeName || 'Store') : `Riv. ${riv['Num. Rivendita']}`,
                  soloNumero: riv.isStore ? (riv.storeNumber || '') : (riv['Num. Rivendita'] || ''),
                  comune: riv['Comune'] || '',
                  orders: pendingOrders.sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime())
                });
              }
            });

            if (groupedOrders.length === 0) {
              return <p className="text-[10px] text-slate-400 italic text-center py-4">Nessun ordine in attesa.</p>;
            }

            return groupedOrders.map((group, i) => (
              <div key={`${group.id}-${i}`} className="p-2.5 border border-blue-100 bg-blue-50/30 rounded-2xl transition-all">
                <div className="flex justify-between items-start mb-2 px-1">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{group.nome}</p>
                    <p className="text-[10px] text-slate-500 truncate">{group.comune}</p>
                  </div>
                  <button 
                    onClick={() => { setRivenditaFilter(group.soloNumero); setActiveTab('crm'); }} 
                    className="p-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
                
                <div className="space-y-1.5">
                  {group.orders.map((ord: any, idx: number) => (
                    <div 
                      key={idx} 
                      onClick={() => setAgendaHostessEdit({ id: group.id, extra: group.extra, targetIndex: ord.originalIndex })}
                      className="p-2.5 rounded-xl border border-blue-100 bg-white cursor-pointer hover:border-blue-300 active:scale-[0.98] transition-all flex justify-between items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[11px] font-black text-blue-700">€{parseFloat(ord.importo || 0).toLocaleString('it-IT')}</span>
                          <span className="text-[9px] text-slate-400 font-medium">{new Date(ord.data).toLocaleDateString('it-IT')}</span>
                        </div>
                        {ord.note && <p className="text-[10px] text-slate-500 truncate italic">"{ord.note}"</p>}
                      </div>
                      <Edit3 className="w-3.5 h-3.5 text-blue-300 ml-2 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
};

export default AgendaTab;
