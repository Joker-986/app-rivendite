import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useModals } from '../contexts/ModalContext';
import QuickEditModal from './QuickEditModal';
import { X, Trash2, AlertCircle, Share2, Copy, MessageCircle, Calendar, Wand2, Search, MapPin, Check, Loader2 } from 'lucide-react';
import { getAvailableTimes, getRivenditaId } from '../utils/helpers';
import { useStrategy } from '../contexts/StrategyContext';
import { RubricaData, SearchResult } from '../types';
import { generateFollowUpMessage } from '../services/geminiService';

const DualShareModal = ({ shareModal, closeShare, showToast }: any) => {
  const [activeTab, setActiveTab] = useState<'COLLEGHI' | 'CLIENTE'>('COLLEGHI');
  const [options, setOptions] = useState({ 
    contatto: true, anagrafica: true, ordini: false, ultimaVisita: false, note: false 
  });
  const [aiOptions, setAiOptions] = useState({ 
    ordini: false, note: true, visite: false, hostess: false 
  });
  const [aiMessage, setAiMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const { res, extra, enrichedDetails } = shareModal;

  const handleShareText = async (text: string) => {
    if (navigator.share) {
      try { 
        await navigator.share({ text }); 
        return; 
      } catch(e: any) {
        if (e.name === 'AbortError') return;
      }
    }
    navigator.clipboard.writeText(text);
    showToast('Copiato negli appunti!', 'success');
  };

  const generateColleghiText = () => {
    const id = res.storeNumber || res['Num. Rivendita'] || '';
    // Intestazione dinamica: SVAPO(ID) o Comune ID
    let text = res.isStore ? `*SVAPO(${id})*\n` : `*${res['Comune'] || ''} ${id}*\n`;
    
    // 1. CONTATTO: Indirizzo, Referente, Telefono
    if (options.contatto) {
      const cap = extra?.manualCap || res['CAP'] || res['Cap'] || '';
      text += `📍 Indirizzo: ${res['Indirizzo']}, ${cap} ${res['Comune']}\n`;
      if (extra?.riferimento) text += `👤 Referente: ${extra.riferimento}\n`;
      const phone = extra?.telefono || enrichedDetails?.phone;
      if (phone) text += `📞 Tel: ${phone}\n`;
    }
    
    // 2. ANAGRAFICA: P.IVA, Mail, PEC, SDI
    if (options.anagrafica) {
      if (extra?.pIva) text += `🏢 P.IVA: ${extra.pIva}\n`;
      const mail = extra?.mail || res?.mail || res?.Mail;
      if (mail) text += `📧 Email: ${mail}\n`;
      const pec = extra?.pec || res?.pec || res?.PEC;
      if (pec) text += `⚖️ PEC: ${pec}\n`;
      if (extra?.codiceUnivoco) text += `✉️ SDI: ${extra.codiceUnivoco}\n`;
    }

    // 3. ORDINI: Ultimo ordine (Bozza o Evaso)
    if (options.ordini) {
      const lastOrder = extra?.history?.find((h: any) => h.tipo === 'ORDINE');
      if (lastOrder) {
        text += `\n📦 --- ORDINE ---\n`;
        text += `Stato: ${lastOrder.isEseguito ? 'Evaso ✅' : 'In Bozza ⏳'}\n`;
        text += `Importo: €${Number(lastOrder.importo || 0).toLocaleString('it-IT')}\n`;
        if (lastOrder.data) text += `Data: ${new Date(lastOrder.data).toLocaleDateString('it-IT')}\n`;
      } else {
        text += `\n📦 Ordini: Nessun ordine in storico.\n`;
      }
    }

    // 4. ULTIMA VISITA
    if (options.ultimaVisita) {
      // Cerca prima la data dell'ultima visita registrata nello storico
      const historyVisita = extra?.history?.find((h: any) => h.tipo === 'VISITA' && h.data)?.data;
      const lastDate = historyVisita || extra?.dataVisita || extra?.lastDataVisita;
      
      if (lastDate) {
        text += `\n📅 --- ULTIMA VISITA ---\n`;
        text += `Effettuata il: ${new Date(lastDate).toLocaleDateString('it-IT')}\n`;
      }
    }

    // 5. NOTE: L'ultima nota inserita
    if (options.note) {
      // Cerca prima la nota più recente nello storico
      const lastHistoryNote = extra?.history?.find((h: any) => h.note?.trim())?.note;
      const notaAgente = (lastHistoryNote || extra?.note)?.trim();
      
      if (notaAgente) {
        text += `\n📝 --- NOTE ---\n${notaAgente}\n`;
      }
    }
    
    return text.trim();
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    setAiMessage('');
    try {
      const historyList = extra?.history || [];
      const latestHistoryNote = historyList.find((h: any) => h.note?.trim())?.note;
      const notaCorretta = latestHistoryNote || extra?.note || '';

      const message = await generateFollowUpMessage(res, extra, notaCorretta.trim(), enrichedDetails, aiOptions);
      if (isMounted.current) setAiMessage(message);
    } catch (error) {
      if (isMounted.current) setAiMessage('⚠️ Errore nella generazione AI. Riprova.');
    } finally {
      if (isMounted.current) setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[260] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl border border-white/20">
        <div className="flex p-2 bg-slate-100">
          <button onClick={() => setActiveTab('COLLEGHI')} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'COLLEGHI' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}>🏢 Colleghi</button>
          <button onClick={() => setActiveTab('CLIENTE')} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'CLIENTE' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500'}`}>🤝 Cliente (AI)</button>
        </div>
        <div className="p-5 min-h-[300px] flex flex-col">
          {activeTab === 'COLLEGHI' ? (
            <div className="space-y-2 flex-1">
              <p className="text-[10px] uppercase font-black text-slate-400 mb-2">Cosa vuoi includere?</p>
              {['contatto', 'anagrafica', 'ordini', 'ultimaVisita', 'note'].map(opt => (
                <label key={opt} className={`flex items-center justify-between p-3 border rounded-xl transition-all ${options[opt as keyof typeof options] ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-100'}`}>
                  <span className="text-xs font-bold capitalize text-slate-700">{opt === 'ultimaVisita' ? 'Ultima Visita' : opt}</span>
                  <input type="checkbox" className="w-4 h-4 rounded-full text-brand-600" checked={(options as any)[opt]} onChange={e => setOptions({...options, [opt]: e.target.checked})} />
                </label>
              ))}
              <button onClick={() => handleShareText(generateColleghiText())} className="w-full mt-4 py-3.5 bg-brand-600 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" /> Genera per Colleghi
              </button>
            </div>
          ) : (
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="mb-4 text-left">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Focus del Messaggio (AI):</label>
                <div className="grid grid-cols-2 gap-2">
                  {['ordini', 'note', 'visite', 'hostess'].map(opt => (
                    <label key={`ai-${opt}`} className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${aiOptions[opt as keyof typeof aiOptions] ? 'bg-purple-50 border-purple-300 shadow-sm' : 'bg-white border-slate-200'}`}>
                      <span className="text-[10px] font-bold capitalize text-slate-700">{opt}</span>
                      <input type="checkbox" className="hidden" checked={(aiOptions as any)[opt]} onChange={e => setAiOptions({...aiOptions, [opt]: e.target.checked})} />
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${aiOptions[opt as keyof typeof aiOptions] ? 'bg-purple-600 border-purple-600' : 'bg-white border-slate-300'}`}>
                        {aiOptions[opt as keyof typeof aiOptions] && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="text-center flex-1 flex flex-col justify-center">
                {!aiMessage ? (
                  <button onClick={handleGenerateAI} disabled={isGenerating} className="w-full py-8 bg-purple-50 border-2 border-purple-200 border-dashed rounded-2xl flex flex-col items-center gap-3 transition-all hover:bg-purple-100">
                    {isGenerating ? <Loader2 className="w-8 h-8 text-purple-500 animate-spin" /> : <Wand2 className="w-8 h-8 text-purple-600" />}
                    <span className="font-bold text-purple-700">{isGenerating ? 'Stesura in corso...' : 'Genera Messaggio Cliente'}</span>
                  </button>
                ) : (
                  <div className="flex flex-col gap-3 animate-in zoom-in-95 duration-200">
                    <div className="p-4 bg-slate-50 text-sm italic border border-slate-200 rounded-2xl text-slate-700 text-left leading-relaxed">"{aiMessage}"</div>
                    <button onClick={() => handleShareText(aiMessage)} className="py-4 bg-[#25D366] text-white font-black rounded-xl shadow-md flex items-center justify-center gap-2">
                      <MessageCircle className="w-5 h-5" /> Invia su WhatsApp
                    </button>
                    <button onClick={() => setAiMessage('')} className="text-xs font-bold text-slate-400 uppercase tracking-widest">Riscrivi</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <button onClick={closeShare} className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100">Annulla</button>
        </div>
      </div>
    </div>
  );
};

const ModalContainer: React.FC<{ 
  rubrica: RubricaData;
  combinedRivendite: SearchResult[]; // Aggiunta questa prop
  onUpdateRubrica: (id: string, field: string, value: any) => void;
  onEditHistory: (id: string, index: number, note: string, importo: number, data?: string, ora?: string, stato?: string, isEseguito?: boolean, dataEsecuzione?: string, items?: any[], dataEvasione?: string, visitaInizio?: string, visitaFine?: string) => void;
  onDeleteHistory: (id: string, index: number) => void;
  showToast: (msg: string, type?: any) => void;
  missions?: any[];
  selectedRivenditaId?: string | null;
  startVisita: (id: string) => void;
  endVisita: (id: string, note: string, tornoPiuTardi: boolean) => void;
  onGoToCalc?: (amount: string) => void;
}> = ({ rubrica, combinedRivendite, onUpdateRubrica, onEditHistory, onDeleteHistory, showToast, missions: propMissions, selectedRivenditaId, startVisita, endVisita, onGoToCalc }) => {
  const { 
    confirmModal, closeConfirm, 
    shareModal, closeShare, 
    dualShareModal, closeDualShare, 
    quickEditModal, closeQuickEdit,
    revisitModalId, closeRevisitModal,
    isKpiAssignOpen, closeKpiAssign
  } = useModals();

  const { missions } = useStrategy();
  
  // Sincronizza le missioni se apriamo da una singola card
  useEffect(() => {
    if (isKpiAssignOpen && selectedRivenditaId) {
      const currentTargets = rubrica[selectedRivenditaId]?.targetIdoneo || [];
      setSelectedMissions(currentTargets);
    } else if (isKpiAssignOpen && !selectedRivenditaId) {
      setSelectedMissions([]);
    }
  }, [isKpiAssignOpen, selectedRivenditaId, rubrica]);
  
  const [selectedMissions, setSelectedMissions] = useState<string[]>([]);
  const [numFilter, setNumFilter] = useState('');
  const [comuneFilter, setComuneFilter] = useState('');
  const [selectedRivendite, setSelectedRivendite] = useState<Set<string>>(new Set());

  const comuniDisponibili = useMemo(() => {
    const list = combinedRivendite.filter(r => rubrica[getRivenditaId(r)]?.stato !== 'RIP');
    const comuni = list.map(r => r['Comune']?.toUpperCase().trim()).filter(Boolean);
    return Array.from(new Set(comuni)).sort();
  }, [combinedRivendite, rubrica]);

  const filteredList = useMemo(() => {
    return combinedRivendite.filter(r => {
      const id = getRivenditaId(r);
      if (rubrica[id]?.stato === 'RIP') return false;
      const num = (r.isStore ? r.storeNumber : r['Num. Rivendita'])?.toString() || '';
      const matchNum = num.includes(numFilter.trim());
      const comune = r['Comune']?.toUpperCase().trim() || '';
      const matchComune = comuneFilter === '' || comune === comuneFilter;
      return matchNum && matchComune;
    });
  }, [combinedRivendite, rubrica, numFilter, comuneFilter]);

  return (
    <>
      {/* 1. CONFIRM MODAL GLOBALE */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className={`w-16 h-16 ${confirmModal.isDestructive ? 'bg-red-100' : 'bg-brand-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                {confirmModal.isDestructive ? <Trash2 className="w-8 h-8 text-red-600" /> : <AlertCircle className="w-8 h-8 text-brand-600" />}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmModal.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button onClick={closeConfirm} className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-sm">Annulla</button>
              <button onClick={() => { confirmModal.onConfirm(); closeConfirm(); }} className={`flex-1 py-3 px-4 ${confirmModal.isDestructive ? 'bg-red-600' : 'bg-brand-600'} text-white font-bold rounded-xl text-sm shadow-lg`}>Conferma</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SHARE MODAL GLOBALE */}
      {shareModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-8 h-8 text-brand-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Condividi</h3>
              <div className="space-y-3">
                <a href={`https://wa.me/?text=${encodeURIComponent(shareModal.text)}`} target="_blank" rel="noopener noreferrer" className="w-full py-4 bg-[#25D366] text-white font-bold rounded-2xl flex items-center justify-center gap-3 shadow-lg">
                  <MessageCircle className="w-5 h-5" /> WhatsApp
                </a>
                <button onClick={() => { navigator.clipboard.writeText(shareModal.text); showToast('Copiato!'); closeShare(); }} className="w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl flex items-center justify-center gap-3">
                  <Copy className="w-5 h-5" /> Copia Testo
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-50"><button onClick={closeShare} className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-sm">Chiudi</button></div>
          </div>
        </div>
      )}

      {/* 2.B DUAL SHARE MODAL (Sviluppo Parallelo) */}
      {dualShareModal.isOpen && dualShareModal.res && (
        <DualShareModal 
          shareModal={dualShareModal} 
          closeShare={closeDualShare} 
          showToast={showToast} 
        />
      )}

      {/* 3. QUICK EDIT MODAL GLOBALE */}
      <QuickEditModal 
        isOpen={quickEditModal.isOpen}
        onClose={closeQuickEdit}
        editType={quickEditModal.editType}
        rivenditaId={quickEditModal.rivenditaId}
        extra={quickEditModal.extra}
        onUpdateRubrica={onUpdateRubrica}
        onEditHistory={onEditHistory}
        onDeleteHistory={onDeleteHistory}
        targetHistoryIndex={quickEditModal.targetIndex}
        onGoToCalc={onGoToCalc}
      />

      {/* 4. REVISIT MODAL GLOBALE */}
      {revisitModalId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
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
                    onChange={(e) => onUpdateRubrica(revisitModalId, 'dataRivisita', e.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ora Appuntamento</label>
                  <select
                    value={rubrica[revisitModalId]?.oraRivisita || ''}
                    onChange={(e) => onUpdateRubrica(revisitModalId, 'oraRivisita', e.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                  >
                    <option value="">Seleziona ora...</option>
                    {getAvailableTimes(rubrica[revisitModalId]?.dataRivisita || '', revisitModalId, rubrica).map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50">
              <button 
                onClick={closeRevisitModal}
                className="w-full py-3.5 bg-brand-600 text-white font-bold rounded-2xl shadow-lg shadow-brand-200 active:scale-95 transition-all"
              >
                Salva Appuntamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODALE ASSEGNAZIONE (SINGOLA O MASSIVA) */}
      {isKpiAssignOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                  <Wand2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">
                    {selectedRivenditaId ? 'Assegnazione Target' : 'Bacchetta Magica'}
                  </h3>
                  <p className="text-xs font-bold text-slate-500 uppercase">
                    {selectedRivenditaId ? `Riv. ${selectedRivenditaId.split('-').pop()}` : 'Gestione Target Dinamica'}
                  </p>
                </div>
              </div>
              <button onClick={closeKpiAssign} className="p-2.5 bg-white hover:bg-slate-100 rounded-full text-slate-400 shadow-sm transition-all"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Scegli Missioni Attive</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {missions.filter(m => m.stato !== 'ARCHIVIATA').map(m => (
                    <label key={m.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${selectedMissions.includes(m.id) ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                      <span className="text-xs font-bold text-slate-700">{m.nome}</span>
                      <input type="checkbox" checked={selectedMissions.includes(m.id)} onChange={e => {
                        if (e.target.checked) setSelectedMissions(prev => [...prev, m.id]);
                        else setSelectedMissions(prev => prev.filter(id => id !== m.id));
                      }} className="w-4 h-4 text-indigo-600 rounded border-slate-300" />
                    </label>
                  ))}
                </div>
              </div>

              {!selectedRivenditaId && (
                <>
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Filtra Anagrafica</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Numero..." value={numFilter} onChange={e => setNumFilter(e.target.value)} className="w-full h-11 pl-9 pr-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select value={comuneFilter} onChange={e => setComuneFilter(e.target.value)} className="w-full h-11 pl-9 pr-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                          <option value="">Tutti i Comuni</option>
                          {comuniDisponibili.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">3. Seleziona ({filteredList.length})</h4>
                      <button onClick={() => {
                        if (selectedRivendite.size === filteredList.length) setSelectedRivendite(new Set());
                        else setSelectedRivendite(new Set(filteredList.map(r => getRivenditaId(r))));
                      }} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">
                        {selectedRivendite.size === filteredList.length ? 'Deseleziona' : 'Seleziona Tutti'}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {filteredList.map(r => {
                        const id = getRivenditaId(r);
                        const isChecked = selectedRivendite.has(id);
                        return (
                          <label key={id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${isChecked ? 'bg-white border-indigo-500 shadow-md' : 'bg-transparent border-slate-100 hover:border-slate-200'}`}>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{r.isStore ? r.storeName : `Riv. ${r['Num. Rivendita']}`}</p>
                              <p className="text-[10px] text-slate-500">{r['Comune']}</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                              {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <input type="checkbox" className="hidden" checked={isChecked} onChange={e => {
                              const next = new Set(selectedRivendite);
                              if (e.target.checked) next.add(id); else next.delete(id);
                              setSelectedRivendite(next);
                            }} />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
              <button 
                onClick={() => {
                  if (selectedMissions.length === 0 && !selectedRivenditaId) {
                    showToast('Seleziona almeno una missione', 'info');
                    return;
                  }
                  
                  if (selectedRivenditaId) {
                    // Caso CRM: Singola Rivendita
                    onUpdateRubrica(selectedRivenditaId, 'targetIdoneo', selectedMissions);
                  } else {
                    // Caso Regia: Massiva
                    selectedRivendite.forEach(id => {
                      const current = rubrica[id]?.targetIdoneo || [];
                      onUpdateRubrica(id, 'targetIdoneo', Array.from(new Set([...current, ...selectedMissions])));
                    });
                  }
                  showToast('Target aggiornati!');
                  closeKpiAssign();
                }}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98]"
              >
                CONFERMA ASSEGNAZIONE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModalContainer;
