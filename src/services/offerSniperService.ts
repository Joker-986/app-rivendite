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

  const allOrders = data.history || [];
  const directOrders = allOrders
    .filter((h: any) => h.tipo === 'ORDINE' && h.isEseguito === true)
    .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
  const logistaOrders = allOrders
    .filter((h: any) => h.tipo === 'ORDINE_LOGISTA')
    .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const ltvDiretto = directOrders.reduce((acc: number, curr: any) => acc + (Number(curr.importo) || 0), 0);
  const ltvLogista = Number(data.importoLogista) || logistaOrders.reduce((acc: number, curr: any) => acc + (Number(curr.importo) || 0), 0);

  const unifiedOrders = [...directOrders, ...logistaOrders]
    .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());

  let lastOrderDays = -1;
  if (unifiedOrders.length > 0) {
    const lastDate = new Date(unifiedOrders[0].data).getTime();
    lastOrderDays = Math.max(0, Math.floor((new Date().getTime() - lastDate) / (1000 * 3600 * 24)));
  }

  // Controllo incrociato ordini diretti: aggregazione acquisti per SKU/prodotto
  const productConsumptionMap = new Map<string, { nome: string; quantitaTotale: number; ordiniCount: number; ultimaData: string }>();

  directOrders.forEach((order: any) => {
    (order.items || []).forEach((item: any) => {
      const key = (item.descrizione || item.codice || '').trim();
      if (!key) return;

      const current = productConsumptionMap.get(key) || {
        nome: item.descrizione || item.codice,
        quantitaTotale: 0,
        ordiniCount: 0,
        ultimaData: order.data
      };

      current.quantitaTotale += Number(item.quantita) || 1;
      current.ordiniCount += 1;
      if (new Date(order.data).getTime() > new Date(current.ultimaData).getTime()) {
        current.ultimaData = order.data;
      }
      productConsumptionMap.set(key, current);
    });
  });

  const oggi = new Date().getTime();
  const prodottiAnalizzati = Array.from(productConsumptionMap.values()).map(p => {
    const giorniDaUltimoAcquisto = Math.max(0, Math.floor((oggi - new Date(p.ultimaData).getTime()) / (1000 * 3600 * 24)));
    const probabilitaEsaurito = lastOrderDays > 20 || giorniDaUltimoAcquisto > 25;
    return {
      prodotto: p.nome,
      pezziTotaliStorici: p.quantitaTotale,
      frequenzaAcquisto: `${p.ordiniCount} ordini`,
      ultimoAcquisto: `${p.ultimaData} (${giorniDaUltimoAcquisto} gg fa)`,
      statoScortePresunto: probabilitaEsaurito ? 'IN ESAURIMENTO / SCORTE CRITICHE' : 'REGOLARE'
    };
  });

  const storicoArticoliRecenti = directOrders.slice(0, 3).map((o: any) => {
    const carrello = (o.items || []).map((i: any) => `${i.quantita}x ${i.descrizione || i.codice}`).join(', ');
    return `[${o.data} - €${o.importo}] ${carrello || o.note || 'Ordine registrato'}`;
  }).join(' | ');

  const storicoLogista = logistaOrders.slice(0, 3).map((o: any) => `[${o.data} - €${o.importo}]`).join(' | ');

  const payload = {
    insegna: nome,
    referente: data.riferimento || '',
    zona: data.zona || '',
    giorniDallUltimoOrdineGlobale: lastOrderDays,
    spesaTotaleDiretta: ltvDiretto,
    spesaTotaleLogista: ltvLogista,
    analisiConsumiEStimaEsaurimento: prodottiAnalizzati.slice(0, 5),
    ultimiOrdiniDirettiDettagliati: storicoArticoliRecenti || 'Nessun ordine diretto recente',
    ultimiOrdiniLogista: storicoLogista || 'Nessun ordine Logista recente'
  };

  // 2. FASE DI PROMPT ENGINEERING ORIENTATO AL REASONING
  const prompt = `Sei un consulente commerciale senior B2B esperto nel mercato tabaccherie.
Analizza con attenzione l'incrocio tra storico ordini diretti, volumi Logista e i consumi per prodotto del cliente:
${JSON.stringify(payload, null, 2)}

OBIETTIVO:
Genera 3 messaggi WhatsApp personalizzati, altamente professionali, naturali e privi di formule burocratiche o forzate. Massimo 3-4 righe per messaggio.

GUIDA DI GENERAZIONE:
- Se 'referente' è presente, inizia salutando la persona per nome in modo naturale (es. "Ciao Marco,"). Non menzionare il nome della concessionaria o formule come "Gentile Cliente".
- Variante 1 "Riassortimento Diretto": Fai leva esplicita sul prodotto indicato come 'IN ESAURIMENTO' o più acquistato in 'analisiConsumiEStimaEsaurimento', chiedendo se le scorte sono terminate.
- Variante 2 "Cross-Selling": Valorizza il profilo del punto vendita (considerando anche i volumi Logista) proponendo un prodotto complementare coerente o un riordino di fascia alta.
- Variante 3 "Relazionale": Tono cordiale e collaborativo, offrendo supporto diretto per una verifica rapida di persona o telefonica.

Devi restituire ESCLUSIVAMENTE un array JSON valido in questo formato esatto, senza blocchi markdown \`\`\`json:
[
  { "tipo": "Riassortimento Diretto", "testo": "..." },
  { "tipo": "Cross-Selling", "testo": "..." },
  { "tipo": "Relazionale", "testo": "..." }
]`;

  // 3. CHIAMATA ALLE API DI GEMINI / OPENROUTER
  try {
    const response = await fetch('/api/gemini-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, openRouterModel: localStorage.getItem('openRouterModel') || '' })
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
