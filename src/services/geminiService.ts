import { GoogleGenAI, Type } from "@google/genai";

export interface EnrichedDetails {
  openingHours: string;
  phone: string;
  email: string;
  notes: string;
}

export async function enrichRivendita(rivendita: any): Promise<EnrichedDetails> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing");
    return {
      openingHours: "Configurazione mancante",
      phone: "Configurazione mancante",
      email: "Configurazione mancante",
      notes: "Chiave API non configurata correttamente."
    };
  }

  const ai = new GoogleGenAI({ apiKey });
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
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              openingHours: { type: Type.STRING, description: "Orari di apertura settimanali" },
              phone: { type: Type.STRING, description: "Numero di telefono senza spazi" },
              email: { type: Type.STRING, description: "Indirizzo email" },
              notes: { type: Type.STRING, description: "Altre note utili" }
            },
            required: ["openingHours", "phone"]
          }
        }
      });
    } catch (e: any) {
      console.warn("Primary generation failed, trying without tools:", e);
      // Fallback if tools or 500 error occurs
      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt + "\n\nRispondi in formato JSON con i campi: openingHours, phone, email, notes.",
        config: {
          responseMimeType: "application/json"
        }
      });
    }

    let text = response.text || '';
    // Rimuovi eventuali blocchi di codice markdown se presenti
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const data = JSON.parse(text || '{}');
    
    return {
      openingHours: data.openingHours || "Non disponibile",
      phone: (data.phone || "Non disponibile").replace(/\s+/g, ''),
      email: data.email || "Non disponibile",
      notes: data.notes || "Dettagli recuperati con successo."
    };
  } catch (error: any) {
    console.error("Error enriching rivendita:", error);
    
    // Fallback: prova senza schema se l'errore sembra legato alla validazione o al formato
    if (error.message?.includes("schema") || error.message?.includes("JSON")) {
       try {
         const ai = new GoogleGenAI({ apiKey });
         const simpleResponse = await ai.models.generateContent({
           model: "gemini-3-flash-preview",
           contents: prompt + "\n\nRispondi SOLO con un oggetto JSON valido.",
           config: { tools: [{ googleSearch: {} }] }
         });
         let text = simpleResponse.text || '';
         text = text.replace(/```json/g, '').replace(/```/g, '').trim();
         const data = JSON.parse(text);
         return {
           openingHours: data.openingHours || "Non disponibile",
           phone: (data.phone || "Non disponibile").replace(/\s+/g, ''),
           email: data.email || "Non disponibile",
           notes: data.notes || "Recuperato tramite fallback."
         };
       } catch (innerError) {
         console.error("Fallback failed:", innerError);
       }
    }

    return {
      openingHours: "Non disponibile",
      phone: "Non disponibile",
      email: "Non disponibile",
      notes: `Errore: ${error.message || 'Impossibile recuperare i dettagli'}`
    };
  }
}
