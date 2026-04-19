export interface EnrichedDetails {
  openingHours: string;
  phone: string;
  zona: string;
  notes: string;
  confidence: number;
  engine?: string;
}

export async function enrichRivendita(rivendita: any): Promise<EnrichedDetails> {
  try {
    const response = await fetch('/api/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rivendita })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        openingHours: "N/D", phone: "N/D", zona: "N/D",
        notes: errorData.notes || "⚠️ Errore di rete (Server locale).",
        confidence: 0
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Error calling /api/enrich:", error);
    return {
      openingHours: "N/D", phone: "N/D", zona: "N/D",
      notes: "⚠️ Impossibile contattare il server.",
      confidence: 0
    };
  }
}

// --- NUOVO MOTORE DUAL MESSAGING (Sviluppo Parallelo) ---
export async function generateFollowUpMessage(rivendita: any, extra: any, noteLibere: string, enrichedDetails: any, aiOptions?: any): Promise<string> {
  try {
    const response = await fetch('/api/followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rivendita, extra, noteLibere, enrichedDetails, aiOptions })
    });

    if (!response.ok) {
      throw new Error('Errore di rete sulla rotta followup');
    }

    const data = await response.json();
    return data.message || "Errore nella generazione del messaggio.";
  } catch (error) {
    console.error("Error calling /api/followup:", error);
    return "⚠️ Impossibile contattare l'Intelligenza Artificiale. Verifica la connessione o riprova più tardi.";
  }
}
