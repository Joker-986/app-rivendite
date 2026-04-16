import React, { useState } from 'react';
import { Search, Hash, Loader2, Copy, CheckCircle2, AlertCircle, Box, MapPin } from 'lucide-react';

const PROVINCE_MAP: Record<string, string> = {
  "001": "Torino", "002": "Vercelli", "003": "Novara", "004": "Cuneo", "005": "Asti", "006": "Alessandria", "007": "Aosta",
  "008": "Imperia", "009": "Savona", "010": "Genova", "011": "La Spezia", "012": "Varese", "013": "Como", "014": "Sondrio",
  "015": "Milano", "016": "Bergamo", "017": "Brescia", "018": "Pavia", "019": "Cremona", "020": "Mantova", "021": "Bolzano",
  "022": "Trento", "023": "Verona", "024": "Vicenza", "025": "Belluno", "026": "Treviso", "027": "Venezia", "028": "Padova",
  "029": "Rovigo", "030": "Udine", "031": "Gorizia", "032": "Trieste", "033": "Piacenza", "034": "Parma", "035": "Reggio Emilia",
  "036": "Modena", "037": "Bologna", "038": "Ferrara", "039": "Ravenna", "040": "Forlì-Cesena", "041": "Pesaro e Urbino", "042": "Ancona",
  "043": "Macerata", "044": "Ascoli Piceno", "045": "Massa-Carrara", "046": "Lucca", "047": "Pistoia", "048": "Firenze", "049": "Livorno",
  "050": "Pisa", "051": "Arezzo", "052": "Siena", "053": "Grosseto", "054": "Perugia", "055": "Terni", "056": "Viterbo",
  "057": "Rieti", "058": "Roma", "059": "Latina", "060": "Frosinone", "061": "Caserta", "062": "Benevento", "063": "Napoli",
  "064": "Avellino", "065": "Salerno", "066": "L'Aquila", "067": "Teramo", "068": "Pescara", "069": "Chieti", "070": "Campobasso",
  "071": "Foggia", "072": "Bari", "073": "Taranto", "074": "Brindisi", "075": "Lecce", "076": "Potenza", "077": "Matera",
  "078": "Cosenza", "079": "Catanzaro", "080": "Reggio Calabria", "081": "Trapani", "082": "Palermo", "083": "Messina", "084": "Agrigento",
  "085": "Caltanissetta", "086": "Enna", "087": "Catania", "088": "Ragusa", "089": "Siracusa", "090": "Sassari", "091": "Nuoro",
  "092": "Cagliari", "093": "Pordenone", "094": "Isernia", "095": "Oristano", "096": "Biella", "097": "Lecco", "098": "Lodi",
  "099": "Rimini", "100": "Prato", "101": "Crotone", "102": "Vibo Valentia", "103": "Verbano-Cusio-Ossola", "108": "Monza e della Brianza",
  "109": "Fermo", "110": "Barletta-Andria-Trani", "111": "Sud Sardegna"
};

const CodiceLogistaTab: React.FC = () => {
  const [comune, setComune] = useState('');
  const [numRivendita, setNumRivendita] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [multiResults, setMultiResults] = useState<{istat: string, localita: string}[] | null>(null);
  const [result, setResult] = useState<{ istat: string, logista: string, localita: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const calculateLogista = (istat: string, localita: string) => {
    const shiftedIstat = istat.substring(1) + istat.charAt(0);
    const paddedRivendita = numRivendita.toString().padStart(3, '0');
    setResult({ istat, logista: shiftedIstat + paddedRivendita, localita });
    setMultiResults(null);
  };

  const handleCalcola = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comune || !numRivendita) return setError('Inserisci i dati richiesti.');
    
    setLoading(true); 
    setError(''); 
    setResult(null); 
    setMultiResults(null);
    setCopied(false);

    try {
      const res = await fetch('/api/logista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comune: comune.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.results.length === 1) {
        calculateLogista(data.results[0].istat, data.results[0].localita);
      } else {
        setMultiResults(data.results);
      }
    } catch (err: any) {
      setError(err.message || 'Errore di rete o comune non trovato.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result.logista);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto pt-4">
      <div className="px-1 text-center">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">Codice Logista</h2>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Generatore e Calcolatore ISTAT</p>
      </div>

      <form onSubmit={handleCalcola} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comune</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Es: Napoli"
              value={comune}
              onChange={e => setComune(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Num. Rivendita</label>
          <div className="relative">
            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="number"
              placeholder="Es: 17"
              value={numRivendita}
              onChange={e => setNumRivendita(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full py-4 mt-2 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-sm shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Box className="w-5 h-5" />}
          GENERA CODICE
        </button>
      </form>

      {/* CASO: OMONIMIA (SCELTA COMUNE) */}
      {multiResults && (
        <div className="bg-amber-50 border border-amber-100 p-5 rounded-[2rem] space-y-3 animate-in fade-in zoom-in-95">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest text-center">Trovati più comuni. Scegli quello corretto:</p>
          <div className="grid gap-2">
            {multiResults.map((res, i) => (
              <button 
                key={i}
                onClick={() => calculateLogista(res.istat, res.localita)}
                className="bg-white p-3 rounded-xl border border-amber-200 text-left hover:bg-amber-100 transition-colors flex justify-between items-center"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-800">{res.localita}</span>
                  <span className="text-[10px] text-slate-500 font-bold">Provincia: {PROVINCE_MAP[res.istat.substring(0,3)] || res.istat.substring(0,3)}</span>
                </div>
                <span className="text-xs font-black text-amber-600">{res.istat}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CASO: RISULTATO FINALE (BOX VERDE) */}
      {result && (
        <div className="bg-brand-50 border border-brand-100 p-6 rounded-[2rem] space-y-4 animate-in zoom-in-95">
          <div className="text-center space-y-1 border-b border-brand-200/50 pb-4">
            <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Codice ISTAT Rilevato</p>
            <p className="text-lg font-black text-brand-900">{result.istat}</p>
            <p className="text-[11px] font-bold text-slate-500 mt-2 flex flex-col items-center justify-center gap-0.5">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Località: {result.localita}</span>
              <span className="text-[9px] uppercase tracking-wider opacity-70">Provincia: {PROVINCE_MAP[result.istat.substring(0,3)] || result.istat.substring(0,3)}</span>
            </p>
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Codice Logista Definitivo</p>
            <p className="text-4xl font-black text-brand-900 tracking-tighter">{result.logista}</p>
          </div>

          <button 
            onClick={copyToClipboard}
            className="w-full py-3 bg-white border border-brand-200 hover:bg-brand-100 text-brand-700 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 mt-4 shadow-sm"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'COPIATO NEGLI APPUNTI!' : 'COPIA CODICE'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CodiceLogistaTab;
