import { RubricaData, SearchResult } from '../types';
import { getRivenditaId } from '../utils/helpers';

export interface GeneratedOffer {
  tipo: string;
  testo: string;
}

export const generateTailoredOffers = async (
  clientId: string,
  rubrica: RubricaData,
  anagrafiche: SearchResult[]
): Promise<GeneratedOffer[]> => {
  
  // 1. FASE DI MINIFICATION (Estrazione Dati Mirata)
  const rivendita = anagrafiche.find(a => getRivenditaId(a) === clientId);
  const data = rubrica[clientId];

  if (!rivendita || !data) {
    throw new Error("Dati cliente non trovati nel database locale.");
  }

  const nome = rivendita.isStore ? rivendita.storeName : `Rivendita ${rivendita['Num. Rivendita']} (${rivendita.Comune})`;

  const validOrders = (data.history || [])
    .filter((h: any) => h.tipo === 'ORDINE' && h.isEseguito === true)
    .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());

  let ltv = 0;
  let lastOrderDays = -1;
  let noteOrdiniPrecedenti = "Nessuno storico dettagliato";

  if (validOrders.length > 0) {
    ltv = validOrders.reduce((acc: number, curr: any) => acc + (Number(curr.importo) || 0), 0);
    const lastOrderDate = new Date(validOrders[0].data).getTime();
    lastOrderDays = Math.floor((new Date().getTime() - lastOrderDate) / (1000 * 3600 * 24));
    noteOrdiniPrecedenti = validOrders.slice(0, 3).map((o: any) => o.note || '').join(" | ");
  }

  // Comprimiamo le informazioni per risparmiare token
  const minifiedData = {
    n: nome,
    z: data.zona || '',
    r: lastOrderDays, // giorni dall'ultimo ordine
    v: ltv, // fatturato totale
    storico: noteOrdiniPrecedenti.substring(0, 300) // max 300 char
  };

  // 2. FASE DI PROMPT ENGINEERING (Il Sarto)
  const prompt = `Sei un venditore B2B spietato ma empatico. Il tuo obiettivo è far riordinare il cliente tramite un messaggio WhatsApp.
Ecco i dati compressi del cliente: ${JSON.stringify(minifiedData)} 
Legenda: n=Nome, z=Zona, r=Giorni da ultimo ordine, v=Spesa totale storica, storico=Note degli ultimi 3 ordini.

Scrivi 3 proposte di messaggi WhatsApp.
Regole TASSATIVE:
- I messaggi devono essere persuasivi, brevi (max 3-4 righe) e includere emoji.
- Usa un tono colloquiale ma professionale ("Ciao Marco", "Buongiorno"). Usa il nome del cliente se presente o riferimenti alla zona.
- Variante 1: "Riassortimento Diretto" (Punta al fatto che è passato del tempo dall'ultimo ordine).
- Variante 2: "Cross-Selling" (Proponi una novità o un prodotto affine basandoti sullo storico se c'è, altrimenti inventa un "nuovo arrivo imperdibile").
- Variante 3: "Relazionale" (Tono amichevole, scusa per passare a salutarlo e offrigli un supporto dedicato).

Devi restituire ESATTAMENTE E SOLO un array JSON valido in questo formato, senza formattazione markdown (niente \`\`\`json):
[
  { "tipo": "Riassortimento Diretto", "testo": "..." },
  { "tipo": "Cross-Selling", "testo": "..." },
  { "tipo": "Relazionale", "testo": "..." }
]`;

  // 3. CHIAMATA ALLE API DI GEMINI
  try {
    const response = await fetch('/api/gemini-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const resData = await response.json();
    if (!response.ok) throw new Error(resData.error || 'Errore API Gemini');

    // Pulizia robusta nel caso Gemini inserisca i backtick del markdown
    const cleanJson = resData.response.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error("Errore Offer Sniper:", err);
    throw new Error("Impossibile generare le offerte. Riprova tra poco.");
  }
};
