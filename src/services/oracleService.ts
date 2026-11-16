import { RubricaData, SearchResult, RivenditaHistoryEntry, Product } from '../types';
import { getRivenditaId } from '../utils/helpers';

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

export interface OracleResult {
  message: string;
  results: SearchResult[] | null;
  memoryUpdated?: boolean;
}

interface OracleIntent {
  rispostaTestuale: string;
  idSuggeriti?: string[];
  aggiornamentiMemoria?: Array<{ id: string; nota: string }>;
}

const DB_NAME = 'TgestOracleDB';
const STORE_NAME = 'SecondBrainStore';
let dbInstance: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    request.onerror = () => reject(request.error);
  });
};

const saveToDB = async (key: string, val: any): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const getFromDB = async (key: string): Promise<any> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(tx.error);
  });
};

const yieldToMain = () => ('scheduler' in window && (window as any).scheduler?.yield) ? (window as any).scheduler.yield() : new Promise(res => setTimeout(res, 0));

export const syncSecondBrain = async (
  rubrica: RubricaData,
  anagrafiche: SearchResult[],
  prodotti: Product[],
  onProgress: (percent: number) => void
): Promise<void> => {
  const catalogStr = prodotti.map(p => `[${p.codice}] ${p.descrizione} - €${p.prezzoUnita}`).join(' | ');
  await saveToDB('tgest_catalog', catalogStr);
  
  const dossierMap: Record<string, string> = {};
  const total = anagrafiche.length;
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = anagrafiche.slice(i, i + BATCH_SIZE);
    
    batch.forEach(a => {
      const id = getRivenditaId(a);
      const extra = rubrica[id];
      if (!extra) return;

      const nome = a.isStore ? a.storeName : `${a.Comune.charAt(0).toUpperCase() + a.Comune.slice(1).toLowerCase()} ${a['Num. Rivendita']}`;
      const note = extra.note ? `NOTE: "${extra.note}"` : '';
      
      const safeHistory: RivenditaHistoryEntry[] = Array.isArray(extra.history) ? extra.history : [];
      
      const orders = safeHistory
        .filter(h => h.tipo === 'ORDINE' && h.isEseguito)
        .sort((x, y) => new Date(y.data).getTime() - new Date(x.data).getTime());
        
      const logista = safeHistory
        .filter(h => h.tipo === 'ORDINE_LOGISTA')
        .sort((x, y) => new Date(y.data).getTime() - new Date(x.data).getTime())[0];

      let storicRecente = 'Nessun ordine diretto recente.';
      if (orders.length > 0) {
        const recentOrders = orders.map(o => {
            const dateShort = new Date(o.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
            const itemsArr = (o as any).items;
            const itemsStr = Array.isArray(itemsArr) 
              ? itemsArr.map((i: any) => `${i.quantita}x ${i.descrizione || i.codice}`).join(', ') 
              : '';
            const detail = itemsStr ? ` (${itemsStr})` : '';
            return `[${dateShort}] €${o.importo || 0}${detail}`;
        }).join('; ');
        storicRecente = `Storico CR (${orders.length} ordini): ${recentOrders}`;
      }
      
      let logistaText = '';
      if (logista) {
          const lDate = new Date(logista.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
          logistaText = ` | Ultimo Logista: [${lDate}] €${logista.importo || 0}`;
      }

      dossierMap[id] = `[ID: ${id}] ${nome} | Stato: ${extra.stato || 'Ignoto'}. ${note}. ${storicRecente}${logistaText}`;
    });

    await yieldToMain();
    onProgress(Math.min(100, Math.round(((i + batch.length) / total) * 100)));
  }

  await saveToDB('tgest_kb', dossierMap);
};

export const executeOracleQuery = async (
  query: string,
  history: ChatMessage[],
  anagrafiche: SearchResult[],
  openRouterModel: string,
  rubrica: RubricaData,
  selectedClientId?: string
): Promise<OracleResult> => {
  
  const historyText = history.map(msg => `${msg.role === 'user' ? 'Utente' : 'Oracolo'}: ${msg.content}`).join('\n');
  const kbData: Record<string, string> | undefined = await getFromDB('tgest_kb');
  const catalogContext: string = await getFromDB('tgest_catalog') || 'Nessun catalogo sincronizzato.';
  // Mappa ID tecnico -> Nome display CRM (per far scrivere all'LLM i nomi corretti nel testo)
  const idToDisplayName: Record<string, string> = {};
  if (kbData) {
    for (const [id, dossier] of Object.entries(kbData)) {
      // dossier formato: "[ID: NA_SORRENTO_6] Rivendita 6 (SORRENTO) | Stato: ..."
      const match = dossier.match(/^\[ID: [^\]]+\] ([^|]+)/);
      if (match) idToDisplayName[id] = match[1].trim();
    }
  }

  let kbContext = '';
  if (selectedClientId && selectedClientId !== '') {
    // APPROCCIO FOCALIZZATO: Deep Dossier in tempo reale dal vivo (bypass DB locale)
    const cliente = anagrafiche.find(a => getRivenditaId(a) === selectedClientId);
    const extra = rubrica[selectedClientId];
    if (cliente && extra) {
      const nome = cliente.isStore ? cliente.storeName : `${cliente.Comune} ${cliente['Num. Rivendita']}`;
      let dossier = `[FOCUS CLIENTE SELEZIONATO: ${nome}]\n`;
      dossier += `Indirizzo: ${cliente.Indirizzo} | Zona: ${extra.zona || 'N/D'} | Riferimento: ${extra.riferimento || 'N/D'} | Tel: ${extra.telefono || 'N/D'}\n`;
      dossier += `Stato: ${extra.stato} | Giorno Levata: ${extra.giornoLevata || 'N/D'} | Target Mese: €${extra.targetMese || 0}\n`;
      dossier += `Note Operative: ${extra.note || 'Nessuna'}\n\n`;
      
      dossier += `[STORICO ORDINI DETTAGLIATO]\n`;
      const ordini = (extra.history || []).filter(h => h.tipo === 'ORDINE' && h.isEseguito).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 5);
      if (ordini.length === 0) {
        dossier += `Nessun ordine diretto registrato.\n`;
      } else {
        ordini.forEach(o => {
          dossier += `- Data: ${o.data} | Totale: €${o.importo}\n`;
          if (o.items && o.items.length > 0) {
            o.items.forEach(item => {
               dossier += `   * ${item.quantita}x ${item.descrizione} a €${item.prezzoApplicato}\n`;
            });
          }
        });
      }
      kbContext = dossier;
    } else {
      kbContext = "Dati del cliente selezionato non trovati.";
    }
  } else {
    // APPROCCIO GLOBALE (Default)
    kbContext = kbData 
      ? Object.values(kbData).join('\n') + '\n\n<NOMI_RIVENDITE_CRM>\n' + JSON.stringify(idToDisplayName) + '\n</NOMI_RIVENDITE_CRM>'
      : 'Nessun dato locale sincronizzato.';
  }

  const prompt = `Sei l'"Oracolo", il "Second Brain" strategico di TgesT.
Rispondi alle domande dell'utente analizzando il seguente database locale (Knowledge Base) e il Catalogo Prodotti:

<KNOWLEDGE_BASE>
${kbContext}
</KNOWLEDGE_BASE>

<CATALOGO_MAGAZZINO>
${catalogContext}
</CATALOGO_MAGAZZINO>

STORICO CONVERSAZIONE RECENTE:
${historyText}
Utente: ${query}

REGOLE TASSATIVE:
1. Rispondi SEMPRE E SOLO con un oggetto JSON valido (nessun blocco markdown \`\`\`json attorno).
2. Formato JSON: { "rispostaTestuale": "...", "idSuggeriti": ["id1"], "aggiornamentiMemoria": [{"id": "...", "nota": "..."}] }
3. CONCISEZZA: Rispondi in modo sintetico e diretto. Elenca SOLO le info strettamente necessarie alla domanda. Niente preamboli, riassunti non richiesti o dettagli superflui.
4. FORMATTAZIONE ELENCO ALLINEATO (NO TABELLE MARKDOWN): All'interno di "rispostaTestuale" usa **elenchi con spaziatura fissa** per dati tabellari — l'UI usa \`whitespace-pre-wrap\` e font monospace per colonne allineate:
   - **Intestazioni sezioni**: \`## Titolo\` + riga vuota
   - **Righe dati**: formato \`• **SKU**  Prodotto..................  Q.tà  €U.listino  €Totale\` (spazi per allineare colonne)
   - **Esempio riga**: \`• **RKDEZ214**  DRIP Kit Peach Ice............  2     €12,50     €25,00\`
   - **Totale**: \`• **TOTALE**........................................................  €XXX,XX\`
   - **Elenco puntato semplice** per voci non tabellari (es. componenti bundle)
   - **Grassetto \`**\`** per valori chiave (importi, date, SKU, stati)
   - **Riga vuota (\`\\n\\n\`)** tra sezioni
   - **VIETATO** tabelle markdown (\`| | |\`), VIETATO muro di testo continuo
5. CATALOGO VINCOLANTE (ANTI-HALLUCINAZIONE): **USA ESCLUSIVAMENTE** prodotti, SKU e prezzi presenti in \`<CATALOGO_MAGAZZINO>\`.
   - **VIETATO** inventare SKU, nomi prodotto, prezzi o quantità non presenti nel catalogo.
   - Se un prodotto non è in catalogo, **NON proporlo**.
   - Per proposte strategiche, calcola importi **solo** con prezzi del catalogo.
   - Se il catalogo è vuoto/assente, dichiara: "Catalogo non disponibile, impossibile fare preventivi."
6. ESCAPING JSON OBBLIGATORIO: All'interno di "rispostaTestuale" escape SEMPRE virgolette (\\") e backslash (\\\\) secondo lo standard JSON (es. "Ha detto: \\"Ciao\\"").
7. NOMI DISPLAY: Nel testo "rispostaTestuale" usa **esclusivamente il formato "Comune Numero"** (es. "Napoli 153", "Milano 42"). È VIETATO usare "Rivendita X (Y)" o ID tecnici. Gli ID tecnici vanno SOLO nell'array "idSuggeriti".
8. ID SUGGERITI PERTINENTI: Inserisci in "idSuggeriti" SOLO rivendite strettamente rilevanti per la richiesta dell'utente.
   - UTILE: utente chiede "chi ha comprato DRIP" → idSuggeriti con rivendite che hanno ordinato DRIP.
   - INUTILE: utente chiede "cosa contiene il bundle" / "storico Napoli 153" / "profilo Milano 42" → idSuggeriti VUOTO []. **DEVI lasciare l'array vuoto [] per domande informative su singola rivendita o prodotti.**
9. TOOL CALLING (MEMORIA): Se ti viene chiesto di ricordare/annotare info su un cliente, inseriscile nell'array "aggiornamentiMemoria".`;

  try {
    const response = await fetch('/api/gemini-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, openRouterModel })
    });

    const resData = await response.json();
    if (!response.ok) throw new Error(resData.error || 'Errore API Gemini');

    let intent: OracleIntent;
    try {
      const cleanJson = resData.response.replace(/```json/gi, '').replace(/```/g, '').trim();
      intent = JSON.parse(cleanJson) as OracleIntent;
    } catch (parseError) {
      console.error("JSON parse failed", parseError);
      return { message: "Errore di formattazione nella risposta dell'AI. Riprova.", results: null };
    }

    let memoryUpdated = false;
    if (intent.aggiornamentiMemoria && Array.isArray(intent.aggiornamentiMemoria) && intent.aggiornamentiMemoria.length > 0) {
        const currentKb = await getFromDB('tgest_kb') || {};
        for (const update of intent.aggiornamentiMemoria) {
            if (currentKb[update.id]) {
                currentKb[update.id] += ` [APPUNTI AI: ${update.nota}]`;
                memoryUpdated = true;
            } else {
                console.warn(`[Oracolo] Impossibile aggiornare memoria: ID ${update.id} non trovato.`);
            }
        }
        if (memoryUpdated) await saveToDB('tgest_kb', currentKb);
    }

    let results = null;
    if (intent.idSuggeriti && Array.isArray(intent.idSuggeriti) && intent.idSuggeriti.length > 0) {
        results = anagrafiche.filter(a => intent.idSuggeriti.includes(getRivenditaId(a)));
    } else {
        // Forza array vuoto per non mostrare tile spurie in UI quando idSuggeriti è vuoto
        results = [];
    }

    return {
        message: intent.rispostaTestuale || "Analisi completata.",
        results: results,
        memoryUpdated
    };

  } catch (err) {
    console.error("Errore Oracolo:", err);
    throw new Error("Errore nell'interpretazione del Second Brain. Riprova in modo più specifico.");
  }
};
