import { RubricaData, SearchResult, Product } from '../types';
import { getRivenditaId } from '../utils/helpers';


export const generateMorningBriefing = async (
  rubrica: RubricaData, 
  anagrafiche: SearchResult[],
  catalogProducts?: Product[]
): Promise<{ testo: string, idSuggeriti: string[] }> => {
  // Catalogo magazzino con fallback headless su localStorage
  let warehouseCatalog: Product[] = [];
  if (catalogProducts && catalogProducts.length > 0) {
    warehouseCatalog = catalogProducts;
  } else {
    try {
      const rawCat = localStorage.getItem('tgest_magazzino');
      if (rawCat) warehouseCatalog = JSON.parse(rawCat);
    } catch {
      warehouseCatalog = [];
    }
  }

  // Lookup rapido prodotti da magazzino per codice o descrizione normalizzata
  const productCatalogMap = new Map<string, Product>();
  warehouseCatalog.forEach(p => {
    if (p.codice) productCatalogMap.set(p.codice.trim().toUpperCase(), p);
    if (p.descrizione) productCatalogMap.set(p.descrizione.trim().toUpperCase(), p);
  });

  const getProductInfo = (identifier: string): { unit: string, price: number, cat: string } => {
    const cleanId = (identifier || '').trim().toUpperCase();
    const found = productCatalogMap.get(cleanId);
    if (found) {
      return {
        unit: found.unita === 'Stecche' ? 'ST' : 'PZ',
        price: Number(found.prezzoUnita) || 0,
        cat: (found.categoria || '').trim().toUpperCase()
      };
    }
    return { unit: 'PZ', price: 0, cat: '' };
  };
  
  // 1. ELABORAZIONE CLUSTER SECONDO LA LOGICA MASTER (REALI, MANCANTI, FANTASMI)
  const anagraficheMap = new Map();
  anagrafiche.forEach(a => anagraficheMap.set(String(getRivenditaId(a)), a));

  const realToday = new Date();
  const currentMonth = realToday.getMonth();
  const currentYear = realToday.getFullYear();

  const calcClusterMetrics = (orders: any[]) => {
    if (orders.length === 0) return { stimaMensile: 0, currentMonthTotal: 0, orderedCurrentMonth: false };

    const lastOrderTime = new Date(orders[0].data).getTime();
    const daysSinceLastOrder = Math.max(0, Math.floor((realToday.getTime() - lastOrderTime) / (1000 * 3600 * 24)));

    let stimaMensile = 0;
    if (daysSinceLastOrder <= 45) {
      const cutoff365 = realToday.getTime() - (365 * 24 * 3600 * 1000);
      const annualOrders = orders.filter((o: any) => new Date(o.data).getTime() >= cutoff365);
      const nOrders = annualOrders.length;

      if (nOrders === 1) {
        stimaMensile = parseFloat(String(annualOrders[0].importo)) || 0;
      } else if (nOrders === 2) {
        const o1 = parseFloat(String(annualOrders[0].importo)) || 0;
        const o2 = parseFloat(String(annualOrders[1].importo)) || 0;
        const media = (o1 + o2) / 2;
        const t1 = new Date(annualOrders[0].data).getTime();
        const t2 = new Date(annualOrders[1].data).getTime();
        const distBetweenOrders = Math.max(1, Math.round((t1 - t2) / (1000 * 3600 * 24)));
        const distToToday = Math.max(1, Math.round((realToday.getTime() - t2) / (1000 * 3600 * 24)));
        const ciclo = Math.max(30, distBetweenOrders, distToToday);
        stimaMensile = media * (30 / ciclo);
      } else if (nOrders >= 3) {
        const o1 = parseFloat(String(annualOrders[0].importo)) || 0;
        const o2 = parseFloat(String(annualOrders[1].importo)) || 0;
        const o3 = parseFloat(String(annualOrders[2].importo)) || 0;
        const mediaPonderata = (o1 * 0.50) + (o2 * 0.30) + (o3 * 0.20);
        const t3 = new Date(annualOrders[2].data).getTime();
        const spanFinoAdOggi = Math.max(1, Math.round((realToday.getTime() - t3) / (1000 * 3600 * 24)));
        const cicloRecente = Math.max(7, spanFinoAdOggi / 2);
        stimaMensile = mediaPonderata * (30 / cicloRecente);
      }
    }

    let currentMonthTotal = 0;
    let orderedCurrentMonth = false;
    orders.forEach((o: any) => {
      const orderDate = new Date(o.data);
      if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
        orderedCurrentMonth = true;
        currentMonthTotal += parseFloat(String(o.importo)) || 0;
      }
    });

    return { stimaMensile, currentMonthTotal, orderedCurrentMonth };
  };

  // Lettura blacklist Snooze
  const rawSnooze = localStorage.getItem('tgest_briefing_snooze');
  const snoozedClients = rawSnooze ? JSON.parse(rawSnooze) : {};
  const now = new Date().getTime();

  const processedClients: any[] = [];

  Object.entries(rubrica).forEach(([id, extra]: [string, any]) => {
    // Esclude clienti silenziati
    if (snoozedClients[id] && snoozedClients[id] > now) return;

    const riv = anagraficheMap.get(id);
    if (!riv) return;

    const unifiedOrders = (extra.history || [])
      .filter((h: any) => (h.tipo === 'ORDINE_LOGISTA' || (h.tipo === 'ORDINE' && h.isEseguito)))
      .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());

    if (unifiedOrders.length === 0) return;

    const logistaOrders = unifiedOrders.filter((h: any) => h.tipo === 'ORDINE_LOGISTA');
    const crOrders = unifiedOrders.filter((h: any) => h.tipo === 'ORDINE');

    const logistaMetrics = calcClusterMetrics(logistaOrders);
    const crMetrics = calcClusterMetrics(crOrders);

    const stimaMensile = extra.isExtraPanel ? 0 : (logistaMetrics.stimaMensile + crMetrics.stimaMensile);
    const currentMonthTotal = logistaMetrics.currentMonthTotal + crMetrics.currentMonthTotal;
    const orderedCurrentMonth = logistaMetrics.orderedCurrentMonth || crMetrics.orderedCurrentMonth;

    const totalSpeso = unifiedOrders.reduce((sum: number, h: any) => sum + (parseFloat(String(h.importo)) || 0), 0);
    const count = unifiedOrders.length;
    const lastDate = unifiedOrders[0].data;
    const firstDate = unifiedOrders[count - 1].data;
    const lastOrderTime = new Date(lastDate).getTime();
    const spanDays = Math.max(1, Math.round(Math.abs(lastOrderTime - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24)));
    const daysSinceLastOrder = Math.max(0, Math.floor((realToday.getTime() - lastOrderTime) / (1000 * 3600 * 24)));
    const frequenzaGG = count > 1 ? Math.round(spanDays / (count - 1)) : 0;

    const nome = riv.isStore ? riv.storeName : `${riv.Comune || 'Sconosciuto'} (Riv. ${riv['Num. Rivendita'] || ''})`;

    // ANALISI INTEGRALE PANIERE: Ultimi 3 ordini diretti senza tagli sul numero di referenze
    const ultimi3OrdiniCR = crOrders.slice(0, 3);
    const ultimoOrdineCR = ultimi3OrdiniCR[0] || null;
    const ultimoOrdineCRTime = ultimoOrdineCR ? new Date(ultimoOrdineCR.data).getTime() : 0;

    const skuPaniereMap = new Map<string, {
      desc: string,
      cat: string,
      unit: string,
      price: number,
      presenzeSu3: number,
      qtaTotale3Ordini: number,
      qtaUltimoOrdine: number,
      presenteNellUltimoOrdine: boolean,
      lastDate: number
    }>();

    ultimi3OrdiniCR.forEach((o: any, orderIndex: number) => {
      const orderTime = new Date(o.data).getTime();
      (o.items || []).forEach((i: any) => {
        const descUpper = (i.descrizione || '').toUpperCase();
        // Esclusione righe contabili o amministrative (non sono prodotti di vendita)
        if (
          descUpper.includes('NOTA DI CREDITO') ||
          descUpper.includes('STORNO') ||
          descUpper.includes('ACCREDITO') ||
          descUpper.includes('RESO') ||
          (Number(i.prezzoUnitario) < 0) ||
          (Number(i.quantita) < 0)
        ) {
          return;
        }

        const key = (i.descrizione || i.codice || '').trim();
        if (!key) return;

        const qta = Number(i.quantita) || 1;
        const catalogInfo = getProductInfo(i.codice || i.descrizione);
        const cat = catalogInfo.cat || (i.reparto || i.categoria || i.famiglia || i.tipo || '').toUpperCase();
        const unit = catalogInfo.unit;
        const price = catalogInfo.price || Number(i.prezzoUnitario) || 0;

        if (skuPaniereMap.has(key)) {
          const curr = skuPaniereMap.get(key)!;
          curr.presenzeSu3 += 1;
          curr.qtaTotale3Ordini += qta;
          if (orderIndex === 0) {
            curr.presenteNellUltimoOrdine = true;
            curr.qtaUltimoOrdine = qta;
          }
          if (orderTime > curr.lastDate) curr.lastDate = orderTime;
        } else {
          skuPaniereMap.set(key, {
            desc: i.descrizione || key,
            cat,
            unit,
            price,
            presenzeSu3: 1,
            qtaTotale3Ordini: qta,
            qtaUltimoOrdine: orderIndex === 0 ? qta : 0,
            presenteNellUltimoOrdine: orderIndex === 0,
            lastDate: orderTime
          });
        }
      });
    });

    // Passiamo TUTTI gli SKU distinti degli ultimi 3 ordini senza limitazioni numeriche
    const paniereRecente = Array.from(skuPaniereMap.values())
      .sort((a, b) => b.presenzeSu3 - a.presenzeSu3 || b.qtaTotale3Ordini - a.qtaTotale3Ordini)
      .map(p => {
        const ggDaUltimo = Math.max(0, Math.floor((realToday.getTime() - p.lastDate) / (1000 * 3600 * 24)));
        const catTag = p.cat ? `[${p.cat}] ` : '';
        const mediaCiclo = Math.max(1, Math.round(p.qtaTotale3Ordini / p.presenzeSu3));
        const statoUltimo = p.presenteNellUltimoOrdine 
          ? `Preso ultimo ordine: ${p.qtaUltimoOrdine} ${p.unit} (${ggDaUltimo} gg fa)` 
          : `ASSENTE ultimo ordine (preso ${ggDaUltimo} gg fa -> probabile stock-out)`;
        return `${catTag}${p.desc} -> Freq: ${p.presenzeSu3}/${ultimi3OrdiniCR.length} ordini | Media: ${mediaCiclo} ${p.unit}/ordine | ${statoUltimo}`;
      }).join(' | ');

    // CONTROLLO TAMPONE LOGISTA: verifica ordini extra autonomi rispetto al canale diretto
    let logistaRefillDeducibile = 'Nessun ordine Logista extra rilevato';
    if (logistaOrders.length > 0) {
      const lastLogista = logistaOrders[0];
      const importoLogista = parseFloat(String(lastLogista.importo)) || 0;
      const logistaTime = new Date(lastLogista.data).getTime();
      const ggFaLogista = Math.max(0, Math.floor((realToday.getTime() - logistaTime) / (1000 * 3600 * 24)));

      const isPosterioreADiretto = logistaTime > ultimoOrdineCRTime;
      const timingNota = isPosterioreADiretto 
        ? `Effettuato ${ggFaLogista} gg fa (DOPO l'ultimo ordine diretto)` 
        : `Effettuato ${ggFaLogista} gg fa (precedente all'ultimo ordine diretto)`;

      const deduzioniLogista: string[] = [];
      const abituali = Array.from(skuPaniereMap.values()).filter(p => p.price > 0);

      abituali.forEach(p => {
        const ratio = importoLogista / p.price;
        const roundRatio = Math.round(ratio);
        if (roundRatio >= 1 && Math.abs(ratio - roundRatio) < 0.05) {
          deduzioniLogista.push(`${roundRatio} ${p.unit} di ${p.desc}`);
        }
      });

      const stimaDettaglio = deduzioniLogista.length > 0
        ? `Importo pari al valore esatto di listino per: ${deduzioniLogista.slice(0, 2).join(' oppure ')}.`
        : `Importo tampone non riconducibile a un singolo articolo abituale.`;

      logistaRefillDeducibile = `Ultimo ordine €${importoLogista.toFixed(2)} (${timingNota}). ${stimaDettaglio}`;
    }

    processedClients.push({
      nome,
      referente: extra.riferimento || '',
      zona: extra.zona || '',
      stato: extra.stato || '',
      stimaMensile,
      fattoMeseCorrente: currentMonthTotal,
      giorniDallUltimoOrdine: daysSinceLastOrder,
      frequenzaMediaGiorni: frequenzaGG,
      totaleSpesoStorico: totalSpeso,
      ordinatoQuestoMese: orderedCurrentMonth,
      profiloConsumiStorico: paniereRecente || 'Nessun acquisto diretto registrato',
      ultimoLogistaTampone: logistaRefillDeducibile
    });
  });

  const mancanti = processedClients
    .filter(p => !['RIP', 'Perso', 'Sospeso'].includes(p.stato) && p.giorniDallUltimoOrdine <= 45 && !p.ordinatoQuestoMese)
    .sort((a, b) => b.stimaMensile - a.stimaMensile);

  const reali = processedClients
    .filter(p => !['RIP', 'Perso', 'Sospeso'].includes(p.stato) && p.giorniDallUltimoOrdine <= 45 && p.ordinatoQuestoMese)
    .sort((a, b) => b.fattoMeseCorrente - a.fattoMeseCorrente);

  const fantasmi = processedClients
    .filter(p => ['RIP', 'Perso', 'Sospeso'].includes(p.stato) || p.giorniDallUltimoOrdine > 45)
    .sort((a, b) => b.totaleSpesoStorico - a.totaleSpesoStorico);

  const targetPotenzialeMese = processedClients.reduce((acc, c) => acc + c.stimaMensile, 0);
  const fattoMeseTotale = processedClients.reduce((acc, c) => acc + c.fattoMeseCorrente, 0);
  const potenzialeMancante = mancanti.reduce((acc, c) => acc + c.stimaMensile, 0);

  const topMancanti = mancanti.slice(0, 5);
  const topFantasmiDaRecuperare = fantasmi.slice(0, 1);

  const briefingPayload = {
    quadroGeneraleMese: {
      targetPotenzialeMese,
      fattoMeseTotale,
      potenzialeMancanteDaRecuperare: potenzialeMancante,
      conteggioReali: reali.length,
      conteggioMancanti: mancanti.length,
      conteggioFantasmi: fantasmi.length
    },
    clientiMancantiPrioritari: topMancanti,
    fantasmiAltoValoreDaRecuperare: topFantasmiDaRecuperare
  };

  // Mappatura ID per la tendina Snooze
  const idSuggeriti = [
    ...topMancanti.map(c => {
      const a = anagrafiche.find(a => (a.isStore ? a.storeName : `${a.Comune || 'Sconosciuto'} (Riv. ${a['Num. Rivendita'] || ''})`) === c.nome);
      return a ? String(getRivenditaId(a)) : null;
    }),
    ...topFantasmiDaRecuperare.map(c => {
      const a = anagrafiche.find(a => (a.isStore ? a.storeName : `${a.Comune || 'Sconosciuto'} (Riv. ${a['Num. Rivendita'] || ''})`) === c.nome);
      return a ? String(getRivenditaId(a)) : null;
    })
  ].filter(Boolean) as string[];

  // 2. PROMPT OPERATIVO STRATEGICO (LAYOUT VERTICALE AD ALTA SCANSIONABILITÀ)
  const prompt = `Sei il Direttore Vendite di una rete commerciale B2B. Fornisci un briefing analitico ed esecutivo per l'agente. Tono professionale, asciutto, verticale e schematico.

DATI OPERATIVI (DIRETTO + LOGISTA):
${JSON.stringify(briefingPayload, null, 2)}

REGOLE DI FORMATTAZIONE TASSATIVE:
- Usa il grassetto (**) ESCLUSIVAMENTE per i titoli di sezione e per le insegne dei clienti (es. **NAPOLI (Riv. 153)**).
- NON inserire troppe informazioni sulla stessa riga. Separa sempre il nome del prodotto dalle quantità e dalle motivazioni andando a capo con un rientro (-).
- È VIETATO generare testi virgolettati, simulazioni di saluti o bozze di messaggi chat: solo istruzioni operative per la chiamata vocale.
- Separa SEMPRE ciascun blocco cliente con un doppio a capo per garantire respiro visivo.

Segui rigorosamente questa struttura visuale:

📊 **SITREP VELOCE**
Due frasi secche: fatturato reale vs potenziale mensile e totale valore bloccato nei mancanti.

🎯 **PRIORITÀ D'ATTACCO (Top 5 Mancanti)**

1. **Insegna Cliente**
   Referente: Nome (se noto, altrimenti "Non indicato") | Stima: €X | Fermo da: Y giorni
   Diagnosi: 1 sola frase su ciclo di riordino e se l'ordine Logista ha costituito un tampone recente tra l'ultimo diretto e oggi.
   Paniere di Riassortimento Consigliato:
   CAT_GROUP: NOME MACRO CATEGORIA
   SKU_ROW: Nome Prodotto Completo | X ST (oppure X PZ) | Motivo sintetico
   SKU_ROW: Nome Prodotto Completo | X ST (oppure X PZ) | Motivo sintetico
   CAT_GROUP: SECONDA MACRO CATEGORIA
   SKU_ROW: Nome Prodotto Completo | X ST (oppure X PZ) | Motivo sintetico
   Gancio Telefonico: Una sola frase con l'argomento chiave per proporre a voce il riassortimento completo.

(Ripeti la stessa identica struttura verticale per gli altri 4 clienti mancanti, separando ciascuno con un doppio a capo)

REGOLE TASSATIVE SUL RAGGRUPPAMENTO E SULLE QUANTITÀ:
- Raggruppa SEMPRE gli articoli consigliati sotto la rispettiva macro-categoria usando il prefisso 'CAT_GROUP: ' una sola volta per gruppo.
- Sotto ciascun 'CAT_GROUP:', elenca i singoli prodotti con il prefisso 'SKU_ROW: ' seguito dai 3 campi separati da barra verticale (|): Nome Prodotto (solo gusto/variante, OMETTENDO il nome della categoria già scritta in CAT_GROUP) | Quantità con sigla ST o PZ | Motivo sintetico.
- Usa SOLO le sigle 'ST' (per Stecche) e 'PZ' (per Pezzi), mai le parole per esteso.
- È SEVERAMENTE VIETATO includere 'Note di Credito', storni o importi negativi.
- Usa SOLO quantità realistiche coerenti con la media per ordine del paniere.

REGOLE ANALITICHE SUL PANIERE:
- Analizza liberamente tutto l'elenco di prodotti presenti in 'profiloConsumiStorico' (che riflette gli ultimi 3 ordini reali).
- Proponi tutti gli articoli che ritieni strategicamente rilevanti per comporre un ordine bilanciato (senza limitarti a 2 o 3 gusti se il cliente acquista un assortimento ampio), rispettando sempre le quantità medie del singolo riordino.

👻 **RECUPERO DORMIENTI**

**Insegna Cliente**
Referente: Nome | Spesa Storica: €X | Ultimo Ordine: Y giorni fa
Articolo Storico:
• [CATEGORIA] Nome Prodotto Storico
  - Quantità Consigliata: X stecche / pz
  - Motivo: Prodotto con maggior volume nel suo storico
Gancio Telefonico: Una sola frase con la leva commerciale per riaprire il canale oggi.

⚡ **FOCUS DI OGGI**
Direttiva prioritaria di una sola riga su cosa portare a casa entro stasera.`;

  // 3. CHIAMATA ALLE API DI GEMINI / OPENROUTER
  try {
    const response = await fetch('/api/gemini-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, openRouterModel: localStorage.getItem('openRouterModel') || '' })
    });
    
    const data = await response.json();
    
    if (!response.ok) throw new Error(data.error || 'Errore API Gemini');
    
    return { testo: data.response, idSuggeriti };
  } catch (err) {
    console.error("Errore Generazione Briefing:", err);
    // Fallback Mock per testare l'UI se l'API non è ancora collegata
    const fallbackTesto = `⚠️ **SISTEMA DI BACKUP ATTIVO (API NON COLLEGATA)**\n\nHo identificato **${topMancanti.length} clienti prioritari mancanti** per un potenziale di €${Math.round(potenzialeMancante).toLocaleString('it-IT')}.\n\n🎯 **Bersagli Prioritari:**\n1. **${topMancanti[0]?.nome || 'Nessuno'}** (${topMancanti[0]?.referente || 'Senza referente'}): Stima €${Math.round(topMancanti[0]?.stimaMensile || 0)} (ritardo ${topMancanti[0]?.giorniDallUltimoOrdine || 0} gg).\n\n2. **${topMancanti[1]?.nome || 'N/A'}**: Stima €${Math.round(topMancanti[1]?.stimaMensile || 0)}.\n\n*Connetti l'endpoint API reale per l'analisi LLM avanzata.*`;
    return { testo: fallbackTesto, idSuggeriti };
  }
};
