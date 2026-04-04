import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Edit3, Package, UserCheck, CheckCircle2 } from 'lucide-react';
import { ORARI_INIZIO, calcolaFineTurno } from '../utils/helpers';

interface QuickEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editType: 'VISITA' | 'ORDINE' | 'HOSTESS' | null;
  rivenditaId: string;
  extra: any;
  onUpdateRubrica: (id: string, field: string, value: any) => void;
  onEditHistory: (id: string, index: number, note: string, importo: number, data: string, ora: string) => void;
  targetHistoryIndex?: number;
}

const QuickEditModal: React.FC<QuickEditModalProps> = ({
  isOpen,
  onClose,
  editType,
  rivenditaId,
  extra,
  onUpdateRubrica,
  onEditHistory,
  targetHistoryIndex
}) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [note, setNote] = useState('');
  const [importo, setImporto] = useState(0);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  // Per Hostess futura
  const [hostessInizio, setHostessInizio] = useState('');
  const [hostessFine, setHostessFine] = useState('');

  useEffect(() => {
    if (!isOpen || !editType) return;

    const history = extra.history || [];
    
    if (editType === 'VISITA') {
      const idx = history.map((h: any, i: number) => ({...h, i})).filter((h: any) => h.tipo === 'VISITA').sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime())[0]?.i;
      if (idx !== undefined) {
        const entry = history[idx];
        const d = new Date(entry.data);
        setHistoryIndex(idx);
        setNote(entry.note || '');
        setImporto(entry.importo || 0);
        setDate(d.toISOString().split('T')[0]);
        setTime(d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
      } else {
        setHistoryIndex(null);
      }
    }

    if (editType === 'HOSTESS') {
      if (targetHistoryIndex !== undefined) {
        setActiveTab('HISTORY');
        const entry = history[targetHistoryIndex];
        if (entry) {
          setHistoryIndex(targetHistoryIndex);
          const d = new Date(entry.data);
          setDate(d.toISOString().split('T')[0]);
          setTime(d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
          const noteStr = entry.note || '';
          let extractedFine = '';
          const matchFine = noteStr.match(/Fine turno: (\d{2}:\d{2})/);
          const matchOld = noteStr.match(/dalle \d{2}:\d{2} alle (\d{2}:\d{2})/);
          
          if (matchFine) extractedFine = matchFine[1];
          else if (matchOld) extractedFine = matchOld[1];
          
          setHostessFine(extractedFine);
          
          let cleanNote = noteStr
            .replace(/\s*\(?Fine turno: \d{2}:\d{2}\)?\s*/g, '')
            .replace(/\d{2}\/\d{2}\/\d{4}\s*-\s*dalle\s*\d{2}:\d{2}\s*alle\s*\d{2}:\d{2}\s*/g, '')
            .trim();
          setNote(cleanNote);
        }
      } else {
        const isFuture = extra.showHostessModule || extra.hostessData;
        const historyEntries = history.map((h: any, i: number) => ({...h, i})).filter((h: any) => h.tipo === 'HOSTESS').sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
        const hasHistory = historyEntries.length > 0;

        if (isFuture) {
          setActiveTab('PENDING');
          setDate(extra.hostessData || '');
          setHostessInizio(extra.hostessInizio || '');
          setHostessFine(extra.hostessFine || '');
        } else if (hasHistory) {
          setActiveTab('HISTORY');
          const entry = historyEntries[0];
          setHistoryIndex(entry.i);
          const d = new Date(entry.data);
          setDate(d.toISOString().split('T')[0]);
          setTime(d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
          const noteStr = entry.note || '';
          let extractedFine = '';
          const matchFine = noteStr.match(/Fine turno: (\d{2}:\d{2})/);
          const matchOld = noteStr.match(/dalle \d{2}:\d{2} alle (\d{2}:\d{2})/);
          
          if (matchFine) extractedFine = matchFine[1];
          else if (matchOld) extractedFine = matchOld[1];
          
          setHostessFine(extractedFine);
          
          let cleanNote = noteStr
            .replace(/\s*\(?Fine turno: \d{2}:\d{2}\)?\s*/g, '')
            .replace(/\d{2}\/\d{2}\/\d{4}\s*-\s*dalle\s*\d{2}:\d{2}\s*alle\s*\d{2}:\d{2}\s*/g, '')
            .trim();
          setNote(cleanNote);
        } else {
          setHistoryIndex(null);
        }
      }
    }

    if (editType === 'ORDINE') {
      const hasPending = extra.richiestaOrdine && !extra.ordineEvaso;
      const historyOrders = history.map((h: any, i: number) => ({...h, i})).filter((h: any) => h.tipo === 'ORDINE').sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
      const hasHistory = historyOrders.length > 0;

      if (hasPending && hasHistory) {
        setActiveTab('PENDING');
      } else if (hasPending) {
        setActiveTab('PENDING');
      } else if (hasHistory) {
        setActiveTab('HISTORY');
      }

      // Pre-carica dati pending
      if (hasPending) {
        setDate(extra.dataOrdine || '');
        setNote(extra.noteOrdine || '');
        setImporto(extra.importoOrdine || 0);
      }
      
      // Pre-carica dati history (se selezionato o come fallback)
      if (hasHistory) {
        const entry = historyOrders[0];
        const d = new Date(entry.data);
        if (!hasPending) {
          setHistoryIndex(entry.i);
          setNote(entry.note || '');
          setImporto(entry.importo || 0);
          setDate(d.toISOString().split('T')[0]);
          setTime(d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
        }
      }
    }
  }, [isOpen, editType, extra]);

  const handleSwitchTab = (tab: 'PENDING' | 'HISTORY') => {
    setActiveTab(tab);
    const history = extra.history || [];
    if (tab === 'HISTORY') {
      const historyEntries = history.map((h: any, i: number) => ({...h, i})).filter((h: any) => h.tipo === editType).sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
      if (historyEntries.length > 0) {
        const entry = historyEntries[0];
        setHistoryIndex(entry.i);
        setNote(entry.note || '');
        setImporto(entry.importo || 0);

        if (editType === 'HOSTESS') {
          const d = new Date(entry.data);
          setDate(d.toISOString().split('T')[0]);
          setTime(d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
          
          // Estrai fine turno dalle note
          const noteStr = entry.note || '';
          let extractedFine = '';
          const matchFine = noteStr.match(/Fine turno: (\d{2}:\d{2})/);
          const matchOld = noteStr.match(/dalle \d{2}:\d{2} alle (\d{2}:\d{2})/);
          
          if (matchFine) extractedFine = matchFine[1];
          else if (matchOld) extractedFine = matchOld[1];
          
          setHostessFine(extractedFine);
          
          let cleanNote = noteStr
            .replace(/\s*\(?Fine turno: \d{2}:\d{2}\)?\s*/g, '')
            .replace(/\d{2}\/\d{2}\/\d{4}\s*-\s*dalle\s*\d{2}:\d{2}\s*alle\s*\d{2}:\d{2}\s*/g, '')
            .trim();
          setNote(cleanNote);
        } else {
          const d = new Date(entry.data);
          setDate(d.toISOString().split('T')[0]);
          setTime(d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
        }
      }
    } else {
      if (editType === 'ORDINE') {
        setDate(extra.dataOrdine || '');
        setNote(extra.noteOrdine || '');
        setImporto(extra.importoOrdine || 0);
      } else if (editType === 'HOSTESS') {
        setDate(extra.hostessData || '');
        setHostessInizio(extra.hostessInizio || '');
        setHostessFine(extra.hostessFine || '');
      }
    }
  };

  const handleSave = () => {
    if (editType === 'VISITA' && historyIndex !== null) {
      onEditHistory(rivenditaId, historyIndex, note, 0, date, time);
    } else if (editType === 'HOSTESS') {
      if (activeTab === 'PENDING') {
        onUpdateRubrica(rivenditaId, 'hostessData', date);
        onUpdateRubrica(rivenditaId, 'hostessInizio', hostessInizio);
        onUpdateRubrica(rivenditaId, 'hostessFine', hostessFine);
      } else if (historyIndex !== null) {
        const finalNote = hostessFine && !note.includes('Fine turno') ? (note ? `${note} (Fine turno: ${hostessFine})` : `Fine turno: ${hostessFine}`) : note;
        onEditHistory(rivenditaId, historyIndex, finalNote, 0, date, time);
      }
    } else if (editType === 'ORDINE') {
      if (activeTab === 'PENDING') {
        onUpdateRubrica(rivenditaId, 'dataOrdine', date);
        onUpdateRubrica(rivenditaId, 'noteOrdine', note);
        onUpdateRubrica(rivenditaId, 'importoOrdine', importo);
      } else if (historyIndex !== null) {
        onEditHistory(rivenditaId, historyIndex, note, importo, date, time);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  const renderContent = () => {
    const hasPending = editType === 'ORDINE' ? (extra.richiestaOrdine && !extra.ordineEvaso) : (editType === 'HOSTESS' ? (extra.showHostessModule || extra.hostessData) : false);
    const historyEntries = (extra.history || []).filter((h: any) => h.tipo === editType);
    const hasHistory = historyEntries.length > 0;

    if (editType === 'VISITA' && !hasHistory) {
      return <p className="text-center text-slate-500 py-8 font-medium">Nessuna visita trovata nella cronologia.</p>;
    }
    if (editType === 'ORDINE' && !hasPending && !hasHistory) {
      return <p className="text-center text-slate-500 py-8 font-medium">Nessun ordine (pendente o storico) trovato.</p>;
    }
    if (editType === 'HOSTESS' && !hasPending && !hasHistory) {
      return <p className="text-center text-slate-500 py-8 font-medium">Nessuna hostess (programmata o storica) trovata.</p>;
    }

    return (
      <div className="space-y-4">
        {editType === 'ORDINE' && hasPending && hasHistory && (
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button 
              onClick={() => handleSwitchTab('PENDING')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'PENDING' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Richiesta Pendente
            </button>
            <button 
              onClick={() => handleSwitchTab('HISTORY')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'HISTORY' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Ordine Storico
            </button>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 truncate">
                <Calendar className="w-3 h-3 shrink-0" /> Data
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm px-2.5 py-3 sm:p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none bg-white transition-all"
              />
            </div>
            
            {(activeTab === 'HISTORY' || editType === 'VISITA') && editType !== 'HOSTESS' && (
              <div className="flex-1 min-w-0 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 truncate">
                  <Clock className="w-3 h-3 shrink-0" /> Ora
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full text-sm px-2.5 py-3 sm:p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none bg-white transition-all"
                />
              </div>
            )}
          </div>

          {editType === 'HOSTESS' ? (
            <div className="flex gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider truncate block">Inizio Turno</label>
                <select
                  value={activeTab === 'HISTORY' ? time : hostessInizio}
                  onChange={(e) => {
                    const inizio = e.target.value;
                    const fine = calcolaFineTurno(inizio);
                    if (activeTab === 'HISTORY') {
                      setTime(inizio);
                    } else {
                      setHostessInizio(inizio);
                    }
                    setHostessFine(fine);
                  }}
                  className="w-full text-sm px-2.5 py-3 sm:p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none bg-white transition-all font-bold text-brand-700 appearance-none"
                >
                  <option value="">Seleziona</option>
                  {ORARI_INIZIO.map(ora => (
                    <option key={ora} value={ora}>{ora}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-0 space-y-1 opacity-70">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider truncate block">Fine (Auto)</label>
                <input
                  type="time"
                  value={hostessFine}
                  readOnly
                  className="w-full text-sm px-2.5 py-3 sm:p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none font-bold text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Edit3 className="w-3 h-3" /> Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none bg-white transition-all min-h-[100px] resize-none"
              placeholder="Inserisci note..."
            />
          </div>

          {(editType === 'ORDINE') && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                Valore (€)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={importo || ''}
                onChange={(e) => setImporto(Number(e.target.value))}
                className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none bg-white transition-all font-bold text-brand-600"
                placeholder="0.00"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const getTitle = () => {
    switch (editType) {
      case 'VISITA': return { label: 'Modifica Visita', icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" /> };
      case 'ORDINE': return { label: 'Modifica Ordine', icon: <Package className="w-5 h-5 text-blue-500" /> };
      case 'HOSTESS': return { label: 'Modifica Hostess', icon: <UserCheck className="w-5 h-5 text-purple-500" /> };
      default: return { label: 'Modifica Rapida', icon: <Edit3 className="w-5 h-5 text-brand-500" /> };
    }
  };

  const title = getTitle();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white w-[92%] sm:w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            {title.icon}
            <h4 className="font-bold text-slate-800">{title.label}</h4>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {renderContent()}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="flex-1 py-3 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-all text-sm"
          >
            Annulla
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-100 hover:bg-brand-700 transition-all text-sm"
          >
            Salva Modifiche
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickEditModal;
