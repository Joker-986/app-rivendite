import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "AIzaSyD1iorlgieAkG3ONBdSpcfeAwUAO6bgRxE" });

export interface EnrichedDetails {
  openingHours: string;
  phone: string;
  email: string;
  notes: string;
}

export async function enrichRivendita(rivendita: any): Promise<EnrichedDetails> {
  const prompt = `Trova gli orari di apertura e le informazioni di contatto per la seguente rivendita di tabacchi in Italia:
  Numero Rivendita: ${rivendita['Num. Rivendita']}
  Indirizzo: ${rivendita['Indirizzo']}
  Comune: ${rivendita['Comune']}
  Provincia: ${rivendita['Prov.']}
  
  REGOLE IMPORTANTI:
  1. Per gli orari di apertura, sii estremamente accurato. Se trovi orari diversi per giorni diversi, elencali uno per riga (es. "Lunedì: 08:00-13:00, 15:00-20:00\\nMartedì: ...").
  2. Per il numero di telefono, restituisci solo cifre (es. 0612345678), senza spazi.
  3. Non includere il sito web.
  
  Usa Google Search per trovare informazioni reali e aggiornate.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            openingHours: { type: Type.STRING, description: "Orari di apertura settimanali, usa \\n per andare a capo tra i giorni" },
            phone: { type: Type.STRING, description: "Numero di telefono senza spazi" },
            email: { type: Type.STRING, description: "Indirizzo email" },
            notes: { type: Type.STRING, description: "Altre note utili (es. chiusura per ferie, servizi extra)" }
          },
          required: ["openingHours", "phone"]
        }
      }
    });

    const data = JSON.parse(response.text || '{}');
    
    // Ulteriore pulizia del numero di telefono per sicurezza
    if (data.phone) {
      data.phone = data.phone.replace(/\s+/g, '');
    }

    return data;
  } catch (error) {
    console.error("Error enriching rivendita:", error);
    return {
      openingHours: "Non disponibile",
      phone: "Non disponibile",
      email: "Non disponibile",
      notes: "Impossibile recuperare i dettagli al momento."
    };
  }
}