import React from 'react';

interface TargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  tempTarget: string;
  setTempTarget: (val: string) => void;
  onSaveMensile: (val: number) => void;
  targetFocus: number;
  setTargetFocus: (val: number) => void;
  targetAttivazioni: number;
  setTargetAttivazioni: (val: number) => void;
  onSaveQuorum: () => void;
}

const TargetModal: React.FC<TargetModalProps> = ({
  isOpen,
  onClose,
  tempTarget,
  setTempTarget,
  onSaveMensile,
  targetFocus,
  setTargetFocus,
  targetAttivazioni,
  setTargetAttivazioni,
  onSaveQuorum
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-end justify-center animate-in fade-in duration-300">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
      />
      <div className="bg-white w-full max-w-md rounded-t-[2.5rem] shadow-2xl relative z-[210] p-8 animate-in slide-in-from-bottom-full duration-300">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8" />
        
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-xl font-black text-slate-900">Imposta Obiettivi & Quorum</h3>
            <p className="text-slate-400 text-sm font-medium mt-1">Definisci i traguardi da raggiungere questo mese</p>
          </div>

          {/* Sezione Target Economico */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Target Mensile (€)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">€</span>
              <input
                type="number"
                inputMode="numeric"
                value={tempTarget}
                onChange={(e) => setTempTarget(e.target.value)}
                className="w-full h-20 pl-10 pr-4 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none text-4xl font-black text-brand-700 transition-all text-center"
                autoFocus
              />
            </div>
          </div>

          <div className="h-px bg-slate-100 my-2" />

          {/* Sezione Quorum Operativi */}
          <div className="space-y-4">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1 h-4 bg-brand-500 rounded-full" />
              Quorum Operativi (Numerici)
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Quorum Focus</label>
                <input
                  type="number"
                  value={targetFocus}
                  onChange={(e) => setTargetFocus(parseInt(e.target.value) || 0)}
                  className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand-500 outline-none text-2xl font-black text-slate-700 text-center"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Quorum Attivazioni</label>
                <input
                  type="number"
                  value={targetAttivazioni}
                  onChange={(e) => setTargetAttivazioni(parseInt(e.target.value) || 0)}
                  className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand-500 outline-none text-2xl font-black text-slate-700 text-center"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
            >
              Annulla
            </button>
            <button
              onClick={() => {
                const val = parseFloat(tempTarget);
                if (!isNaN(val) && val > 0) {
                  onSaveMensile(val);
                  onSaveQuorum();
                }
              }}
              className="flex-1 py-4 bg-gradient-to-b from-brand-500 to-brand-600 text-white font-bold rounded-2xl border border-brand-700 border-b-[4px] hover:brightness-110 active:border-b active:translate-y-[3px] transition-all shadow-md"
            >
              Salva Obiettivi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetModal;
