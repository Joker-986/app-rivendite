import React, { useState, useRef, useEffect } from 'react';
import { Search, Sparkles, Loader2, MapPin, Store, History, Trash2, Bot, User } from 'lucide-react';
import { RubricaData, SearchResult } from '../types';
import { getRivenditaId } from '../utils/helpers';
import { executeOracleQuery } from '../services/oracleService';

interface DataOracleProps {
  rubrica: RubricaData;
  crmAnagrafiche: SearchResult[];
  stores: SearchResult[];
}

interface UIMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  results?: SearchResult[] | null;
}

const DataOracle: React.FC<DataOracleProps> = ({ rubrica, crmAnagrafiche, stores }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll in fondo alla chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    
    const userText = query.trim();
    setQuery(''); // Pulisce l'input
    
    // Aggiunge il messaggio dell'utente alla UI
    const newUserMsg: UIMessage = { id: Date.now().toString(), role: 'user', content: userText };
    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);
    
    try {
      const combined = [...crmAnagrafiche, ...stores];
      // Prepara lo storico per il servizio logico (escludendo i risultati per risparmiare spazio)
      const historyForService = messages.map(m => ({ role: m.role, content: m.content }));
      
      const result = await executeOracleQuery(userText, historyForService, rubrica, combined);
      
      // Aggiunge la risposta dell'AI alla UI
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

  return (
    <div className="flex flex-col h-full bg-slate-50 relative animate-in fade-in zoom-in-95 duration-300">
      
      {/* HEADER DELLA CHAT */}
      <div className="flex items-center justify-between p-3 bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
             <Bot className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Oracolo AI</h3>
            <p className="text-[10px] font-bold text-slate-400">Memoria contestuale attiva</p>
          </div>
        </div>
        <button 
          onClick={clearChat}
          disabled={messages.length === 0}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
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
