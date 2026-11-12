import React, { useState, useRef, useEffect } from 'react';
import { Search, Sparkles, Loader2, MapPin, Store, History, Trash2, Bot, User, RefreshCw, Download } from 'lucide-react';
import { RubricaData, SearchResult, Product } from '../types';
import { getRivenditaId } from '../utils/helpers';
import { executeOracleQuery, syncSecondBrain } from '../services/oracleService';

interface DataOracleProps {
  rubrica: RubricaData;
  crmAnagrafiche: SearchResult[];
  stores: SearchResult[];
  prodotti: Product[];
}

interface UIMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  results?: SearchResult[] | null;
}

const DataOracle: React.FC<DataOracleProps> = ({ rubrica, crmAnagrafiche, stores, prodotti }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll in fondo alla chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const [syncProgress, setSyncProgress] = useState<number | null>(null);

  const handleSyncKB = async () => {
    if (syncProgress !== null) return;
    setSyncProgress(0);
    try {
      const combined = [...crmAnagrafiche, ...stores];
      await syncSecondBrain(rubrica, combined, prodotti, (p) => setSyncProgress(p));
      await new Promise(r => setTimeout(r, 800)); // Breve pausa visiva a completamento avvenuto
      setSyncProgress(null);
    } catch (err: any) {
      console.error("Errore sincronizzazione KB", err);
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        alert("Spazio di archiviazione esaurito. Libera spazio sul dispositivo o disabilita la navigazione in incognito/privata.");
      } else {
        alert("Errore durante il salvataggio della Knowledge Base su IndexedDB.");
      }
      setSyncProgress(null);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading || syncProgress !== null) return;
    
    const userText = query.trim();
    setQuery('');
    
    const newUserMsg: UIMessage = { id: Date.now().toString(), role: 'user', content: userText };
    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);
    
    try {
      const combined = [...crmAnagrafiche, ...stores];
      const historyForService = messages.map(m => ({ role: m.role, content: m.content }));
      const activeModel = localStorage.getItem('openRouterModel') || '';
      
      const result = await executeOracleQuery(userText, historyForService, combined, activeModel);
      
      const newAiMsg: UIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: result.message,
        results: result.results
      };
      setMessages(prev => [...prev, newAiMsg]);
    } catch (err: any) {
      const errorMsg: UIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `⚠️ Errore: ${err.message || "Interferenza nei flussi dell'Oracolo."}`
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDays = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const days = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 3600 * 24));
    return `${days} gg fa`;
  };

  const clearChat = () => {
    if (window.confirm("Vuoi azzerare la memoria dell'Oracolo e iniziare una nuova sessione?")) {
      setMessages([]);
    }
  };

  const handleExportChat = () => {
    if (messages.length === 0) return;
    
    let chatText = "=== EXPORT CHAT ORACOLO (TgesT) ===\n";
    chatText += `Data: ${new Date().toLocaleString('it-IT')}\n\n`;
    
    messages.forEach(msg => {
      const roleName = msg.role === 'user' ? 'TU' : 'ORACOLO';
      chatText += `[${roleName}]\n${msg.content}\n\n`;
      
      if (msg.results && msg.results.length > 0) {
        chatText += `>> Clienti menzionati/suggeriti:\n`;
        msg.results.forEach(res => {
           const nome = res.isStore ? res.storeName : `Rivendita ${res['Num. Rivendita']}`;
           chatText += `   - ${nome} (${res.Comune})\n`;
        });
        chatText += `\n`;
      }
      chatText += `----------------------------------------\n\n`;
    });

    const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const safeDate = new Date().toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    link.href = url;
    link.download = `tgest_chat_oracolo_${safeDate}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative animate-in fade-in zoom-in-95 duration-300">
      
      {/* HEADER DELLA CHAT E SYNC */}
      <div className="flex flex-col bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
               <Bot className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest truncate">Second Brain</h3>
              <p className="text-[10px] font-bold text-slate-400 truncate">Knowledge Base Locale</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleSyncKB}
              disabled={syncProgress !== null}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncProgress !== null ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncProgress !== null ? 'Sincronizzo...' : 'Aggiorna KB'}</span>
            </button>
            <button
              onClick={handleExportChat}
              disabled={messages.length === 0}
              title="Esporta Chat"
              aria-label="Esporta chat"
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
            </button>
            <button 
              onClick={clearChat}
              disabled={messages.length === 0}
              title="Azzera Chat"
              aria-label="Azzera chat"
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* PROGRESS BAR SINCRONIZZAZIONE */}
        {syncProgress !== null && (
          <div className="w-full h-1 bg-slate-100">
            <div 
              className="h-full bg-indigo-500 transition-all duration-200 ease-out"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* AREA MESSAGGI (STORICO CHAT) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
             <Sparkles className="w-12 h-12 text-slate-300 mb-3" />
             <p className="text-sm font-bold text-center">Inizia una conversazione strategica.<br/><span className="text-xs font-normal">Chiedimi di trovare clienti, analizzare zone<br/>o semplicemente consigli sulle vendite.</span></p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-2 w-full`}>
              
              {/* BOLLA DEL MESSAGGIO TESTUALE */}
              <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                <div className="flex items-center gap-2 mb-1 opacity-70">
                  {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  <span className="text-[9px] font-black uppercase tracking-wider">{msg.role === 'user' ? 'Tu' : 'Oracolo'}</span>
                </div>
                <div className="leading-relaxed whitespace-pre-wrap font-medium">
                  {msg.content.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="font-black">{part}</strong> : part)}
                </div>
              </div>

              {/* RISULTATI DELLA RICERCA (CARD DEI CLIENTI) */}
              {msg.role === 'ai' && msg.results && msg.results.length > 0 && (
                <div className="w-full max-w-[90%] pl-2 space-y-2 mt-1">
                  {msg.results.map((res) => {
                    const id = getRivenditaId(res);
                    const extra = rubrica[id];
                    const nome = res.isStore ? res.storeName : `Rivendita ${res['Num. Rivendita']}`;
                    const ordini = (extra?.history || []).filter((h:any) => h.tipo === 'ORDINE' && h.isEseguito);
                    const lastOrder = ordini.length > 0 ? ordini[0].data : null;

                    return (
                      <div key={id} className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm flex items-center justify-between gap-2 animate-in slide-in-from-left-4 duration-300">
                        <div className="flex flex-col min-w-0">
                          <h4 className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> {nome}
                          </h4>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {res.Comune}
                          </p>
                        </div>
                        
                        <div className="flex flex-col items-end shrink-0 text-right">
                           <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                             <History className="w-3 h-3" /> {lastOrder ? formatDays(lastOrder) : 'Mai'}
                           </span>
                           <span className="text-[9px] font-bold text-slate-400 mt-1">Ultimo Ordine</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
        
        {/* INDICATORE DI CARICAMENTO (TYPING) */}
        {isLoading && (
          <div className="flex items-start w-full gap-2">
            <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
              <span className="text-xs font-bold text-slate-400 animate-pulse">L'Oracolo sta pensando...</span>
            </div>
          </div>
        )}
        
        {/* Ancora invisibile per l'auto-scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* BARRA DI INPUT INFERIORE */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <form onSubmit={handleSearch} className="relative flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chiedi all'Oracolo..."
            className="flex-1 h-12 pl-4 pr-12 bg-slate-100 border-none text-slate-800 placeholder:text-slate-400 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
          />
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="absolute right-1 top-1 h-10 w-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
};

export default DataOracle;
