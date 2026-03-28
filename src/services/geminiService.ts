import { GoogleGenAI, Type } from "@google/genai";

export interface EnrichedDetails {
  openingHours: string;
  phone: string;
  zona: string;
  notes: string;
  confidence: number;
}

export async function enrichRivendita(rivendita: any): Promise<EnrichedDetails> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { openingHours: "N/D", phone: "N/D", zona: "N/D", notes: "Chiave API mancante.", confidence: 0 };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Analizza la seguente rivendita di tabacchi italiana:
  Numero: ${rivendita['Num. Rivendita']}
  Indirizzo: ${rivendita['Indirizzo']}, ${rivendita['CAP'] || ''}
  Comune: ${rivendita['Comune']} (${rivendita['Prov.']})
  
  TROVA TRAMITE GOOGLE SEARCH:
  1. openingHours: Sii ultra-sintetico (es. "Lun-Sab: 08-13 / 15-20. Dom: Chiuso").
  2. phone: Solo cifre, senza spazi.
  3. zona: Quartiere o zona geografica (es. "Vomero", "Centro Storico", "Frazione X").
  4. notes: Avvisa in MAIUSCOLO se risulta CHIUSO DEFINITIVAMENTE. Altrimenti indica se offre servizi come Sisal, Lottomatica, Amazon Hub.
  5. confidence: Valuta severamente da 0 a 100. Dai 90-100 se trovi fonti ufficiali concordanti. Dai 40-60 se le fonti sono vecchie o ambigue. Dai 0-30 se non trovi riscontri chiari.`;

  try {
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              openingHours: { type: Type.STRING },
              phone: { type: Type.STRING },
              zona: { type: Type.STRING },
              notes: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            },
            required: ["openingHours", "phone", "zona", "notes", "confidence"]
          }
        }
      });
    } catch (e) {
      response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt + "\n\nRispondi in JSON: openingHours, phone, zona, notes, confidence.",
        config: { responseMimeType: "application/json" }
      });
    }

    let text = response.text || '';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text || '{}');
    
    return {
      openingHours: data.openingHours || "Non disponibile",
      phone: (data.phone || "Non disponibile").replace(/\s+/g, ''),
      zona: data.zona || "Non disponibile",
      notes: data.notes || "Nessuna nota.",
      confidence: typeof data.confidence === 'number' ? data.confidence : 0
    };
  } catch (error: any) {
    const errorMsg = error?.message || '';
    const isQuotaExceeded = errorMsg.includes('429') || errorMsg.includes('Quota');
    return {
      openingHours: "N/D", phone: "N/D", zona: "N/D",
      notes: isQuotaExceeded ? "⏳ Limite richieste AI superato. Attendi 60 secondi." : "⚠️ Errore di rete.",
      confidence: 0
    };
  }
}
