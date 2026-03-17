export interface EnrichedDetails {
  openingHours: string;
  phone: string;
  email: string;
  notes: string;
}

export async function enrichRivendita(rivendita: any): Promise<EnrichedDetails> {
  try {
    // Ora l'app chiede i dati in modo sicuro al TUO server!
    const response = await fetch('/api/enrich', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rivendita })
    });

    if (!response.ok) {
      throw new Error(`Errore di rete: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Errore durante la richiesta al server:", error);
    return {
      openingHours: "Non disponibile",
      phone: "Non disponibile",
      email: "Non disponibile",
      notes: `Impossibile recuperare i dettagli al momento. Errore: ${error.message}`
    };
  }
}