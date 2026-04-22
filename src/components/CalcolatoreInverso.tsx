import React, { useState, useMemo } from 'react';
import { Calculator, Receipt, TrendingDown, Package, Euro, Percent, FileText, Tag } from 'lucide-react';

const CalcolatoreInverso: React.FC = () => {
  const [listinoRaw, setListinoRaw] = useState<string>('');
  const [targetRaw, setTargetRaw] = useState<string>('');
  const [mode, setMode] = useState<'by_quantity' | 'by_total'>('by_quantity');
  const [mainValueRaw, setMainValueRaw] = useState<string>('');

  const results = useMemo(() => {
    const listino = parseFloat(listinoRaw) || 0;
    const mainValue = parseFloat(mainValueRaw) || 0;

    let quantita = 0;
    let totaleOrdineImponibile = 0;

    if (mode === 'by_quantity') {
      quantita = Math.max(0, Math.floor(mainValue));
      totaleOrdineImponibile = quantita * listino;
    } else {
      totaleOrdineImponibile = Math.max(0, mainValue);
      quantita = listino > 0 ? Math.floor(totaleOrdineImponibile / listino) : 0;
    }

    let scontoPercentuale = 0;
    if (totaleOrdineImponibile >= 400 && totaleOrdineImponibile < 700) scontoPercentuale = 5;
    else if (totaleOrdineImponibile >= 700 && totaleOrdineImponibile < 1000) scontoPercentuale = 7;
    else if (totaleOrdineImponibile >= 1000) scontoPercentuale = 10;

    const prezzoScontatoImponibile = listino * (1 - scontoPercentuale / 100);
    const prezzoFatturaIvato = prezzoScontatoImponibile * 1.22;
    
    // LOGICA CAMPO VUOTO vs CAMPO 0
    const isTargetEmpty = targetRaw.trim() === '';
    const targetEffettivo = isTargetEmpty ? prezzoFatturaIvato : (parseFloat(targetRaw) || 0);

    const deltaPezzoIvato = Math.max(0, prezzoFatturaIvato - targetEffettivo);

    const totaleRimborsoIvato = deltaPezzoIvato * quantita;
    const totaleRimborsoImponibile = totaleRimborsoIvato / 1.22;

    const totaleFatturaAziendaleIvato = prezzoFatturaIvato * quantita;
    const totaleNettoClienteIvato = targetEffettivo * quantita;

    // Calcolo Sconto Reale Cliente
    const listinoIvato = listino * 1.22;
    const scontoRealeCliente = listinoIvato > 0 ? Math.max(0, ((listinoIvato - targetEffettivo) / listinoIvato) * 100) : 0;

    return {
      quantita,
      scontoRealeCliente,
      totaleOrdineImponibile,
      scontoPercentuale,
      prezzoFatturaIvato,
      deltaPezzoIvato,
      totaleRimborsoIvato,
      totaleRimborsoImponibile,
      totaleFatturaAziendaleIvato,
      totaleNettoClienteIvato,
      isTargetEmpty
    };
  }, [listinoRaw, targetRaw, mode, mainValueRaw]);

  const formatEuro = (value: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      
      {/* Contenitore Base di Inserimento */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Listino (€)</label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="number" step="0.01" 
                value={listinoRaw}
                onChange={(e) => setListinoRaw(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-9 pr-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-brand-500 focus:bg-white transition-all text-right" 
                placeholder="2.41" 
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target (€)</label>
            <div className="relative">
              <TrendingDown className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${results.isTargetEmpty ? 'text-slate-300' : 'text-emerald-500'}`} />
              <input 
                type="number" step="0.01" 
                value={targetRaw}
                onChange={(e) => setTargetRaw(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-9 pr-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-brand-500 focus:bg-white transition-all text-right" 
                placeholder="Opzionale" 
              />
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Motore Inverso */}
        <div className="flex flex-col md:flex-row gap-4 items-end">
          
          <div className="w-full md:w-1/2 space-y-3">
            {/* Pulsanti di Selezione Modalità */}
            <div className="flex gap-2 w-full">
              <button onClick={() => { setMode('by_quantity'); setMainValueRaw(''); }} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all border ${mode === 'by_quantity' ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>Quantità</button>
              <button onClick={() => { setMode('by_total'); setMainValueRaw(''); }} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all border ${mode === 'by_total' ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>Totale</button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest ml-1">
                {mode === 'by_quantity' ? 'Q.tà' : 'Totale (€)'}
              </label>
              <div className="relative">
                {mode === 'by_quantity' ? <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-500" /> : <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-500" />}
                <input 
                  type="number" value={mainValueRaw} 
                  onChange={(e) => setMainValueRaw(e.target.value)} 
                  className="w-full bg-white border border-brand-200 rounded-md pl-9 pr-3 py-1.5 text-sm font-black text-brand-900 outline-none focus:border-brand-500 transition-all shadow-sm text-right" 
                  placeholder="0" 
                />
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/2 bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-black text-slate-400 mb-0.5 tracking-widest">
                {mode === 'by_quantity' ? 'Totale:' : 'Pezzi:'}
              </p>
              <p className="text-lg font-black text-slate-800">
                {mode === 'by_quantity' ? formatEuro(results.totaleOrdineImponibile) : `${results.quantita} pz`}
              </p>
            </div>
            <Calculator className="w-4 h-4 text-slate-300" />
          </div>
        </div>
      </div>

      {/* Riquadri Risultati */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-300 ${results.isTargetEmpty ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
        {/* ONE SHOT */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex flex-col relative">
          <span className="text-[10px] uppercase font-black text-brand-600 tracking-widest mb-1 relative z-10">Buono One Shot (Ivato)</span>
          <div className="flex items-baseline gap-1 relative z-10 text-slate-800">
            <span className="text-xl font-black">{formatEuro(results.totaleRimborsoIvato).split(',')[0]}</span>
            <span className="text-xs font-bold opacity-60">,{formatEuro(results.totaleRimborsoIvato).split(',')[1]}</span>
          </div>
          <span className="text-[9px] uppercase font-bold text-slate-400 mt-1 block relative z-10">IVA Inclusa (22%)</span>
        </div>

        {/* NOTA DI CREDITO */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex flex-col relative">
          <span className="text-[10px] uppercase font-black text-emerald-600 tracking-widest mb-1 relative z-10">Nota di Credito (Imp.)</span>
          <div className="flex items-baseline gap-1 relative z-10 text-slate-800">
            <span className="text-xl font-black">{formatEuro(results.totaleRimborsoImponibile).split(',')[0]}</span>
            <span className="text-xs font-bold opacity-60">,{formatEuro(results.totaleRimborsoImponibile).split(',')[1]}</span>
          </div>
          <span className="text-[9px] uppercase font-bold text-slate-400 mt-1 block relative z-10">Valore Scorporato</span>
        </div>
      </div>

      {/* Riepilogo Compatto (Layout a 2 Righe) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-y divide-slate-100">
          
          {/* Riga 1: Dati Base */}
          <div className="py-3 px-2 flex flex-col justify-center text-center bg-slate-50/50">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Sconto</span>
             <span className="text-sm font-bold text-slate-700">{results.scontoPercentuale}%</span>
          </div>

          <div className="py-3 px-2 flex flex-col justify-center text-center bg-slate-50/50">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Ivato/Pz</span>
             <span className="text-sm font-bold text-slate-700">{formatEuro(results.prezzoFatturaIvato)}</span>
          </div>

          <div className="py-3 px-2 flex flex-col justify-center text-center bg-slate-50/50">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Q.tà</span>
             <span className="text-sm font-bold text-slate-700">{results.quantita}</span>
          </div>

          {/* Riga 2: Totali */}
          <div className="py-3 px-2 flex flex-col justify-center text-center">
             <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-1">Tot. Fattura</span>
             <span className="text-sm font-black text-slate-900">{formatEuro(results.totaleFatturaAziendaleIvato)}</span>
          </div>

          <div className="py-3 px-2 flex flex-col justify-center text-center bg-indigo-50">
             <span className="text-[8px] font-black text-indigo-500 uppercase tracking-tighter mb-1">Tot. Cliente</span>
             <span className="text-sm font-black text-indigo-700 leading-none">{formatEuro(results.totaleNettoClienteIvato)}</span>
          </div>

          <div className="py-3 px-2 flex flex-col justify-center text-center bg-emerald-50">
             <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter mb-1">Sc. Reale</span>
             <span className="text-sm font-black text-emerald-700 leading-none">{results.scontoRealeCliente ? results.scontoRealeCliente.toFixed(1) : '0.0'}%</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CalcolatoreInverso;
