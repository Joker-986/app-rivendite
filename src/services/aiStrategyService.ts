import { RubricaData, SearchResult } from '../types';
import { getRivenditaId } from '../utils/helpers';

// Interfaccia del payload compresso
interface MinifiedClient {
  n: string; // Nome (compattato per salvare token)
  r: number; // Ritardo in giorni
  f: number; // Frequenza media in giorni
  v: number; // Valore (LTV)
}

export const generateMorningBriefing = async (
  rubrica: RubricaData, 
  anagrafiche: SearchResult[]
): Promise<string> => {
  
  // 1. FASE DI MINIFICATION (Il Tritacarne dei Dati in Locale)
  const anagraficheMap = new Map();
  anagrafiche.forEach(a => anagraficheMap.set(String(getRivenditaId(a)), a));

  const atRisk: MinifiedClient[] = [];
  const oggi = new Date().getTime();

  Object.entries(rubrica).forEach(([id, data]) => {
    // Escludiamo i clienti già persi o non attivi
    if (['Perso', 'RIP', 'Sospeso', 'Non Attiva'].includes(data.stato || '')) return;

    const validOrders = (data.history || [])
      .filter((h: any) => h.tipo === 'ORDINE' && h.isEseguito === true)
      .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());

    if (validOrders.length < 2) return;

    const count = validOrders.length;
    const ltv = validOrders.reduce((acc: number, curr: any) => acc + (Number(curr.importo) || 0), 0);
    
    const firstOrderDate = new Date(validOrders[count - 1].data).getTime();
    const lastOrderDate = new Date(validOrders[0].data).getTime();
    
    const daysSinceLastOrder = Math.floor((oggi - lastOrderDate) / (1000 * 3600 * 24));
    const spanDays = (lastOrderDate - firstOrderDate) / (1000 * 3600 * 24);
    const frequenzaGG = Math.round(spanDays / (count - 1));

    // Isoliamo SOLO i clienti che hanno superato il loro ciclo medio di riordino
    if (frequenzaGG > 0 && daysSinceLastOrder > frequenzaGG) {
        const riv = anagraficheMap.get(id);
        if (!riv) return;
        
        const nome = riv.isStore ? riv.storeName : `${riv.Comune} (Riv. ${riv['Num. Rivendita']})`;
        
        atRisk.push({
            n: nome || 'Sconosciuto',
            r: daysSinceLastOrder,
            f: frequenzaGG,
            v: ltv
        });
    }
  });

  // Ordiniamo per livello di criticità (Ritardo vs Frequenza) e prendiamo i peggiori 10
  const topRisk = atRisk
    .sort((a, b) => (b.r / b.f) - (a.r / a.f))
    .slice(0, 10);

  if (topRisk.length === 0) {
    return "🚀 **Situazione Ottimale:** Tutti i clienti attivi stanno ordinando regolarmente all'interno del loro ciclo previsto. Nessun intervento di emergenza richiesto oggi.";
  }

  // 2. FASE DI PROMPT ENGINEERING
  const prompt = `Agisci come un Direttore Vendite Spietato ed Esperto B2B. Oggi è il ${new Date().toLocaleDateString('it-IT')}.
Ti passo i dati dei 10 clienti in ritardo critico. Le chiavi del JSON sono: n=Nome, r=Giorni di latenza dall'ultimo ordine, f=Frequenza media d'acquisto in giorni, v=Fatturato storico.

DATI CLIENTI:
${JSON.stringify(topRisk)}

Genera un "Briefing Mattutino" in 3 sezioni chiare (usa il markdown, grassetti e icone emoji per renderlo leggibile su app mobile):
1. **SITREP (Situazione)**: Riassumi quanti clienti sono in zona rossa e qual è il fatturato storico totale a rischio.
2. **OBIETTIVI PRIORITARI**: Seleziona i 3 clienti più critici (quelli col gap maggiore tra ritardo e frequenza, unito al valore). Per ognuno scrivi UNA riga di consiglio tattico su come approcciarli al telefono.
3. **DIRETTIVA**: Una frase motivazionale di chiusura per spingere l'operatore a chiudere i contratti.

Sii conciso, professionale, in italiano. Non spiegare come hai fatto i calcoli, dammi solo l'output tattico.`;

  // 3. CHIAMATA ALLE API DI GEMINI
  try {
    const response = await fetch('/api/gemini-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    const data = await response.json();
    
    if (!response.ok) throw new Error(data.error || 'Errore API Gemini');
    
    return data.response;
  } catch (err) {
    console.error("Errore Generazione Briefing:", err);
    // Fallback Mock per testare l'UI se l'API non è ancora collegata
    return `⚠️ **SISTEMA DI BACKUP ATTIVO (API NON COLLEGATA)**\n\nHo identificato **${topRisk.length} clienti in zona rossa** nei tuoi archivi locali.\n\n🎯 **Bersagli Prioritari Simulati:**\n1. **${topRisk[0]?.n}**: In ritardo di ${topRisk[0]?.r} giorni (solitamente ordina ogni ${topRisk[0]?.f}). Chiamare urgentemente.\n2. **${topRisk[1]?.n || 'N/A'}**: Controllare scorte.\n\n*Connetti l'endpoint API reale per l'analisi LLM avanzata.*`;
  }
};
