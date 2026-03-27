import { GoogleGenAI, Type } from "@google/genai";

export interface EnrichedDetails {
  openingHours: string;
  phone: string;
  email: string;
  notes: string;
  confidence: number;
}

export async function enrichRivendita(rivendita: any): Promise<EnrichedDetails> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing");
    return {
      openingHours: "Configurazione mancante",
      phone: "Configurazione mancante",
      email: "Configurazione mancante",
      notes: "Chiave API non configurata correttamente.",
      confidence: 0
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Agisci come un analista di dati investigativo specializzato nel recupero dati business. 
  Il tuo compito è trovare informazioni precise per la seguente rivendita di tabacchi in Italia:
  Numero Rivendita: ${rivendita['Num. Rivendita']}
  Indirizzo: ${rivendita['Indirizzo']}
  CAP: ${rivendita['CAP'] || rivendita['Cap'] || ''}
  Comune: ${rivendita['Comune']}
  Provincia: ${rivendita['Prov.']}
  
  REGOLE DI ALTA PRECISIONE:
  1. Dai priorità assoluta alla coerenza tra l'indirizzo fornito e i risultati web.
  2. Ignora risultati ambigui o di attività omonime in comuni diversi.
  3. Se i dati sono incerti, riduci drasticamente il punteggio di affidabilità (confidence).
  4. Per gli orari, elenca ogni giorno su una nuova riga (es. "Lunedì: 08:00-13:00, 15:00-20:00").
  5. Per il telefono, usa solo cifre senza spazi.
  6. Restituisci un punteggio di affidabilità (confidence) da 0 a 100 basato sulla certezza della corrispondenza.
  
  Usa Google Search per trovare informazioni reali e aggiornate.`;

  try {
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              openingHours: { type: Type.STRING, description: "Orari di apertura settimanali in italiano" },
              phone: { type: Type.STRING, description: "Numero di telefono senza spazi" },
              email: { type: Type.STRING, description: "Indirizzo email" },
              notes: { type: Type.STRING, description: "Note investigative sull'affidabilità del dato" },
              confidence: { type: Type.NUMBER, description: "Punteggio di affidabilità da 0 a 100" }
            },
            required: ["openingHours", "phone", "confidence"]
          }
        }
      });
    } catch (e: any) {
      console.warn("Primary generation failed, trying without tools:", e);
      response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt + "\n\nRispondi in formato JSON con i campi: openingHours, phone, email, notes, confidence.",
        config: {
          responseMimeType: "application/json"
        }
      });
    }

    let text = response.text || '';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const data = JSON.parse(text || '{}');
    
    return {
      openingHours: data.openingHours || "Non disponibile",
      phone: (data.phone || "Non disponibile").replace(/\s+/g, ''),
      email: data.email || "Non disponibile",
      notes: data.notes || "Analisi completata.",
      confidence: typeof data.confidence === 'number' ? data.confidence : 0
    };
  } catch (error: any) {
    console.error("Error enriching rivendita:", error);
    
    return {
      openingHours: "Non disponibile",
      phone: "Non disponibile",
      email: "Non disponibile",
      notes: `Errore: ${error.message || 'Impossibile recuperare i dettagli'}`,
      confidence: 0
    };
  }
}
