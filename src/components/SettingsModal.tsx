import React from 'react';
import { 
  X, BookOpen, ChevronRight, Cloud, Upload, Download, 
  Loader2, Save, RefreshCw, AlertCircle, Trash2 
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  setShowGuideModal: (val: boolean) => void;
  generatedSyncCode: string | null;
  handleGenerateSyncCode: () => void;
  isSyncing: boolean;
  syncCodeInput: string;
  setSyncCodeInput: (val: string) => void;
  handleImportFromSyncCode: () => void;
  handleExportData: () => void;
  handleImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  crmCount: number;
  storageSize: string;
  dailyAiCount: number;
  isOnline: boolean;
  dataVersion: string;
  handleClearAllData: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  setShowGuideModal,
  generatedSyncCode,
  handleGenerateSyncCode,
  isSyncing,
  syncCodeInput,
  setSyncCodeInput,
  handleImportFromSyncCode,
  handleExportData,
  handleImportData,
  crmCount,
  storageSize,
  dailyAiCount,
  isOnline,
  dataVersion,
  handleClearAllData
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
        
        {/* Header Fisso del Modal */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="text-xl font-bold text-slate-900">Impostazioni</h3>
          <button 
            onClick={onClose}
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
              <p>Rivendite Salvate: <span className="font-bold">{crmCount}</span></p>
              <p>Spazio Occupato: <span className="font-bold">{storageSize}</span></p>
              
              {/* CONTATORE AI CON FORMATTAZIONE ITALIANA */}
              <div className="py-1 border-y border-amber-200/50 my-1">
                <p>Richieste AI Oggi: <span className={`font-bold ${dailyAiCount >= 1450 ? 'text-red-600' : ''}`}>{dailyAiCount} / 1500</span></p>
                <p className="text-[9px] text-amber-600/70 italic mt-0.5">* Il contatore si azzera alle 09:00 (Ora Italiana)</p>
              </div>

              <p>Stato Rete: <span className={`font-bold ${isOnline ? 'text-emerald-600' : 'text-red-600'}`}>{isOnline ? 'Online' : 'Offline'}</span></p>
              <p>Versione App: <span className="font-bold">{dataVersion}</span></p>
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
  );
};

export default SettingsModal;
