import { RubricaData, SearchResult } from '../types';
import { getRivenditaId } from '../utils/helpers';

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

export interface OracleResult {
  message: string;
  results: SearchResult[] | null;
}

export const executeOracleQuery = async (
  query: string,
  history: ChatMessage[],
  rubrica: RubricaData,
  anagrafiche: SearchResult[]
): Promise<OracleResult> => {
  
  // Costruiamo lo storico testuale per il prompt
  const historyText = history.map(msg => `${msg.role === 'user' ? 'Utente' : 'Oracolo'}: ${msg.content}`).join('\n');

  const prompt = `Sei l'"Oracolo", l'assistente AI strategico di TgesT, un'app per venditori B2B.
Il tuo compito è conversare con l'utente e, quando ti chiede di cercare dei clienti, estrarre i parametri matematici/geografici per filtrare il database locale.

STORICO CONVERSAZIONE RECENTE:
${historyText}
Utente: ${query}

REGOLE DI RISPOSTA:
Devi rispondere SEMPRE E SOLO con un oggetto JSON valido, seguendo questa struttura esatta:
{
  "rispostaTestuale": "La tua risposta colloquiale, empatica e strategica all'utente.",
  "filtri": {
    "eseguiRicerca": booleano (true se l'utente ha chiesto di cercare/filtrare clienti, false se è solo conversazione),
    "comune": "Nome del comune se specificato, altrimenti null",
    "ritardoMinimoGiorni": numero (se chiede clienti in ritardo da X giorni), altrimenti null,
    "topOrdinanti": booleano (true se chiede i clienti migliori/altospendenti), altrimenti false
  }
}

Non usare blocchi markdown \`\`\`json. Solo la stringa JSON. Sii conciso e professionale nel testo.`;

  try {
    const response = await fetch('/api/gemini-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const resData = await response.json();
    if (!response.ok) throw new Error(resData.error || 'Errore API Gemini');

    const cleanJson = resData.response.replace(/```json/gi, '').replace(/```/g, '').trim();
    const intent = JSON.parse(cleanJson);

    // Se l'AI decide che non serve cercare (es. l'utente dice solo "Ciao"), restituiamo solo il testo
    if (!intent.filtri || !intent.filtri.eseguiRicerca) {
        return { message: intent.rispostaTestuale || "Ricevuto.", results: null };
    }

    // FASE 2: FILTRAGGIO LOCALE DETERMINISTICO
    let filtered = anagrafiche.filter(a => {
        const id = getRivenditaId(a);
        const data = rubrica[id];
        return data && !['RIP', 'Perso', 'Sospeso'].includes(data.stato || '');
    });

    if (intent.filtri.comune) {
        filtered = filtered.filter(a => a['Comune']?.toLowerCase().includes(intent.filtri.comune.toLowerCase()));
    }

    if (intent.filtri.topOrdinanti) {
        filtered = filtered.filter(a => rubrica[getRivenditaId(a)]?.ordinante === 'alto');
    }

    if (intent.filtri.ritardoMinimoGiorni) {
        const oggi = new Date().getTime();
        filtered = filtered.filter(a => {
            const id = getRivenditaId(a);
            const ordini = (rubrica[id]?.history || []).filter((h:any) => h.tipo === 'ORDINE' && h.isEseguito);
            if (ordini.length === 0) return false;
            
            ordini.sort((x:any, y:any) => new Date(y.data).getTime() - new Date(x.data).getTime());
            const ultimaData = new Date(ordini[0].data).getTime();
            const ritardo = Math.floor((oggi - ultimaData) / (1000 * 3600 * 24));
            
            return ritardo >= intent.filtri.ritardoMinimoGiorni;
        });
    }

    return {
        message: intent.rispostaTestuale || "Ricerca completata.",
        results: filtered.slice(0, 15)
    };

  } catch (err) {
    console.error("Errore Oracolo:", err);
    throw new Error("Errore nell'interpretazione. Riprova con parole diverse.");
  }
};
