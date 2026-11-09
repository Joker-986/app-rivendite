import { RubricaData, SearchResult } from '../types';
import { getRivenditaId } from '../utils/helpers';


export const generateMorningBriefing = async (
  rubrica: RubricaData, 
  anagrafiche: SearchResult[]
): Promise<string> => {
  
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

  const processedClients: any[] = [];

  Object.entries(rubrica).forEach(([id, extra]: [string, any]) => {
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

    const directWithItems = crOrders.slice(0, 2).map((o: any) => {
      const items = (o.items || []).map((i: any) => `${i.quantita}x ${i.descrizione || i.codice}`).join(', ');
      return items ? `${o.data}: ${items}` : '';
    }).filter(Boolean).join(' | ');

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
      ultimiArticoliDiretti: directWithItems || 'N/D'
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

  const topMancanti = mancanti.slice(0, 10);
  const topFantasmiDaRecuperare = fantasmi.slice(0, 5);

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

  // 2. PROMPT ESCLUSIVAMENTE DIRETTO ED ESECUTIVO (NO TESTI MACCHINOSI)
  const prompt = `Sei il Direttore Vendite di una rete commerciale B2B. Parla direttamente all'agente in modo energico, asciutto e concreto. Zero formalismi, niente frasi ovvie o robotiche.

QUADRO MASTER CONSOLIDATO (DIRETTO + LOGISTA):
${JSON.stringify(briefingPayload, null, 2)}

Scrivi il Briefing Mattutino usando questo schema compatto:

📊 **SITREP VELOCE**
In 2 frasi: fatturato reale vs obiettivo potenziale del mese e quanto cassetto economico è bloccato nei clienti mancanti.

🎯 **PRIORITÀ D'ATTACCO (Top 3 Mancanti)**
Per ciascuno dei 3 clienti con stima più alta non ancora ordinati:
- **Insegna** (Referente se noto): Stima €X, ferma da Y giorni.
- *Azione immediata*: Cosa proporgli al telefono (cita gli ultimi prodotti acquistati o la leva Logista).

👻 **RECUPERO DORMIENTI**
1 solo cliente dal gruppo Fantasmi con spesa storica rilevante: una mossa secca per riaprire il contatto oggi.

⚡ **FOCUS DI OGGI**
Un ordine di servizio netto di una sola riga su cosa fare entro stasera.`;

  // 3. CHIAMATA ALLE API DI GEMINI / OPENROUTER
  try {
    const response = await fetch('/api/gemini-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, openRouterModel: localStorage.getItem('openRouterModel') || '' })
    });
    
    const data = await response.json();
    
    if (!response.ok) throw new Error(data.error || 'Errore API Gemini');
    
    return data.response;
  } catch (err) {
    console.error("Errore Generazione Briefing:", err);
    // Fallback Mock per testare l'UI se l'API non è ancora collegata
    return `⚠️ **SISTEMA DI BACKUP ATTIVO (API NON COLLEGATA)**\n\nHo identificato **${topMancanti.length} clienti prioritari mancanti** per un potenziale di €${Math.round(potenzialeMancante).toLocaleString('it-IT')}.\n\n🎯 **Bersagli Prioritari:**\n1. **${topMancanti[0]?.nome || 'Nessuno'}** (${topMancanti[0]?.referente || 'Senza referente'}): Stima €${Math.round(topMancanti[0]?.stimaMensile || 0)} (ritardo ${topMancanti[0]?.giorniDallUltimoOrdine || 0} gg).\n2. **${topMancanti[1]?.nome || 'N/A'}**: Stima €${Math.round(topMancanti[1]?.stimaMensile || 0)}.\n\n*Connetti l'endpoint API reale per l'analisi LLM avanzata.*`;
  }
};
