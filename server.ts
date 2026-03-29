import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import * as cheerio from 'cheerio';
import { GoogleGenAI, Type } from "@google/genai";
import { CohereClientV2 } from 'cohere-ai';
import dotenv from 'dotenv';
dotenv.config(); // Carica la chiave da Render

const app = express();
const PORT = 3000;
const APP_VERSION = Date.now().toString(); // Versione dinamica basata sul timestamp di avvio server

// Verifica variabili d'ambiente all'avvio
if (!process.env.GEMINI_API_KEY) {
  console.warn("ATTENZIONE: GEMINI_API_KEY non configurata nelle variabili d'ambiente.");
}

app.use(express.json());

// Anti-caching middleware for critical files
app.use((req, res, next) => {
  const url = req.url.split('?')[0];
  if (url === '/sw.js' || url === '/index.html' || url === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Route dinamica per il Service Worker con iniezione della versione
app.get('/sw.js', (req, res) => {
  const swPath = path.join(process.cwd(), 'public', 'sw.js');
  try {
    let swContent = fs.readFileSync(swPath, 'utf8');
    // Inietta la versione dinamica nel file
    swContent = swContent.replace('{{VERSION}}', APP_VERSION);
    
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(swContent);
  } catch (err) {
    console.error('Errore nel caricamento del Service Worker:', err);
    res.status(404).send('Service Worker not found');
  }
});

const BASE_URL = 'https://acciseonline8.adm.gov.it/ConsultazioneOnLineTabacchi/ricercaConcessioni/cerca-concessioni.xhtml';

// Helper to extract options from a select HTML string
function extractOptions(htmlString: string) {
  const $ = cheerio.load(htmlString);
  const options: { value: string; label: string }[] = [];
  $('option').each((_, el) => {
    const val = $(el).val();
    const label = $(el).text().trim();
    if (val && val !== '') {
      options.push({ value: val as string, label });
    }
  });
  return options;
}

app.get('/api/init', async (req, res) => {
  try {
    const response = await fetch(BASE_URL);
    const html = await response.text();
    const cookies = response.headers.get('set-cookie');
    
    const $ = cheerio.load(html);
    const viewState = $('input[name="javax.faces.ViewState"]').val();
    
    const regionSelect = $('select[name="j_idt16:regione"]');
    const regions = regionSelect.length ? extractOptions(regionSelect.toString()) : [];
    
    const submitButton = $('input[value="Cerca"]');
    const submitName = submitButton.length ? submitButton.attr('name') : 'j_idt16:j_idt65';

    res.json({ viewState, cookies, regions, submitName });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to initialize session' });
  }
});

app.post('/api/provinces', async (req, res) => {
  const { cookies, viewState, region } = req.body;
  
  const params = new URLSearchParams();
  params.append('javax.faces.partial.ajax', 'true');
  params.append('javax.faces.source', 'j_idt16:regione');
  params.append('javax.faces.partial.execute', 'j_idt16:regione');
  params.append('javax.faces.partial.render', 'j_idt16:regione j_idt16:provincia j_idt16:comune');
  params.append('javax.faces.behavior.event', 'change');
  params.append('javax.faces.partial.event', 'change');
  params.append('j_idt16', 'j_idt16');
  params.append('j_idt16:regione', region);
  params.append('j_idt16:provincia', '');
  params.append('j_idt16:comune', '');
  params.append('j_idt16:numRivendita', '');
  params.append('j_idt16:tipoRiv', '');
  params.append('j_idt16:statoRiv', '');
  params.append('javax.faces.ViewState', viewState || '');

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Faces-Request': 'partial/ajax',
        'Cookie': cookies || ''
      },
      body: params.toString()
    });
    
    const xml = await response.text();
    const viewStateMatch = xml.match(/<update id="javax\.faces\.ViewState"><!\[CDATA\[(.*?)\]\]><\/update>/);
    const newViewState = viewStateMatch ? viewStateMatch[1] : viewState;
    
    const provMatch = xml.match(/<update id="j_idt16:provincia"><!\[CDATA\[(.*?)\]\]><\/update>/s);
    const provinces = provMatch ? extractOptions(provMatch[1]) : [];
    
    res.json({ viewState: newViewState, provinces });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch provinces' });
  }
});

app.post('/api/comuni', async (req, res) => {
  const { cookies, viewState, region, province, provinceLabel } = req.body;
  
  const params = new URLSearchParams();
  params.append('javax.faces.partial.ajax', 'true');
  params.append('javax.faces.source', 'j_idt16:provincia');
  params.append('javax.faces.partial.execute', 'j_idt16:provincia');
  params.append('javax.faces.partial.render', 'j_idt16:provincia j_idt16:comune');
  params.append('javax.faces.behavior.event', 'change');
  params.append('javax.faces.partial.event', 'change');
  params.append('j_idt16', 'j_idt16');
  params.append('j_idt16:regione', region);
  params.append('j_idt16:provincia', province);
  params.append('j_idt16:comune', '');
  params.append('j_idt16:numRivendita', '');
  params.append('j_idt16:tipoRiv', '');
  params.append('j_idt16:statoRiv', '');
  params.append('javax.faces.ViewState', viewState || '');

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Faces-Request': 'partial/ajax',
        'Cookie': cookies || ''
      },
      body: params.toString()
    });
    
    const xml = await response.text();
    const viewStateMatch = xml.match(/<update id="javax\.faces\.ViewState"><!\[CDATA\[(.*?)\]\]><\/update>/);
    const newViewState = viewStateMatch ? viewStateMatch[1] : viewState;
    
    const comuneMatch = xml.match(/<update id="j_idt16:comune"><!\[CDATA\[(.*?)\]\]><\/update>/s);
    let comuni = comuneMatch ? extractOptions(comuneMatch[1]) : [];
    
    if (provinceLabel) {
      const provUpper = provinceLabel.toUpperCase();
      // Sort alphabetically
      comuni.sort((a, b) => a.label.localeCompare(b.label));
      
      // Find the province name in the list
      const provIndex = comuni.findIndex(c => c.label.toUpperCase() === provUpper);
      if (provIndex !== -1) {
        const provOption = comuni.splice(provIndex, 1)[0];
        comuni.unshift(provOption);
      }
    }
    
    res.json({ viewState: newViewState, comuni });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch comuni' });
  }
});

async function fetchPage(cookies: string, viewState: string, tableId: string, first: number, rows: number = 10) {
  const params = new URLSearchParams();
  params.append('javax.faces.partial.ajax', 'true');
  params.append('javax.faces.source', tableId);
  params.append('javax.faces.partial.execute', tableId);
  params.append('javax.faces.partial.render', tableId);
  params.append(tableId, tableId);
  params.append(`${tableId}_pagination`, 'true');
  params.append(`${tableId}_first`, first.toString());
  params.append(`${tableId}_rows`, rows.toString());
  params.append(`${tableId}_encodeFeature`, 'true');
  params.append('javax.faces.ViewState', viewState || '');

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Faces-Request': 'partial/ajax',
      'Cookie': cookies || ''
    },
    body: params.toString()
  });
  
  const xml = await response.text();
  const viewStateMatch = xml.match(/<update id="javax\.faces\.ViewState"><!\[CDATA\[(.*?)\]\]><\/update>/);
  const newViewState = viewStateMatch ? viewStateMatch[1] : viewState;
  
  const tableMatch = xml.match(new RegExp(`<update id="${tableId}"><!\\[CDATA\\[(.*?)\\]\\]><\\/update>`, 's'));
  const tableHtml = tableMatch ? tableMatch[1] : '';
  
  const $ = cheerio.load(`<table>${tableHtml}</table>`);
  const results: any[] = [];
  const table = $('table');

  if (table.length) {
    const headers = table.find('thead th').map((_, th) => $(th).text().trim()).get();
    const rowsList = table.find('tbody tr');
    
    rowsList.each((_, row) => {
      const cells = $(row).find('td').map((_, td) => $(td).text().trim()).get();
      if (cells.length <= 1 && cells[0] === 'Nessun record trovato.') return;
      
      const rowData: any = {};
      headers.forEach((header, index) => {
        rowData[header] = cells[index];
      });
      results.push(rowData);
    });
  }
  return { results, viewState: newViewState };
}

app.post('/api/search', async (req, res) => {
  const { cookies, viewState, region, province, comune, numRivendita, tipoRiv, statoRiv, submitName } = req.body;
  
  const params = new URLSearchParams();
  params.append('j_idt16', 'j_idt16');
  params.append('j_idt16:regione', region || '');
  params.append('j_idt16:provincia', province || '');
  params.append('j_idt16:comune', comune || '');
  params.append('j_idt16:numRivendita', numRivendita || '');
  params.append('j_idt16:tipoRiv', tipoRiv || '');
  params.append('j_idt16:statoRiv', statoRiv || '');
  params.append(submitName || 'j_idt16:j_idt65', submitName || 'j_idt16:j_idt65');
  params.append('mode', 'list');
  params.append('javax.faces.ViewState', viewState || '');

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies || ''
      },
      body: params.toString()
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    let currentViewState = $('input[name="javax.faces.ViewState"]').val() as string || viewState;

    const results: any[] = [];
    const table = $('table[role="grid"]');
    let totalPages = 1;
    let tableId = '';

    if (table.length) {
      tableId = table.attr('id') || '';
      const headers = table.find('thead th').map((_, th) => $(th).text().trim()).get();
      const rowsList = table.find('tbody tr');
      
      rowsList.each((_, row) => {
        const cells = $(row).find('td').map((_, td) => $(td).text().trim()).get();
        if (cells.length <= 1 && cells[0] === 'Nessun record trovato.') return;
        
        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = cells[index];
        });
        results.push(rowData);
      });

      const paginator = $('.ui-paginator');
      if (paginator.length) {
        const currentText = paginator.find('.ui-paginator-current').text() || '';
        const match = currentText.match(/\((\d+)\s+di\s+(\d+)\)/) || currentText.match(/Pagina\s+(\d+)\s+di\s+(\d+)/i);
        totalPages = match ? parseInt(match[2]) : 1;
      }
      
      // Scrape all other pages
      if (totalPages > 1) {
        for (let i = 1; i < totalPages; i++) {
          const pageData = await fetchPage(cookies, currentViewState, tableId, i * 10);
          results.push(...pageData.results);
          currentViewState = pageData.viewState;
        }
      }
    }
    
    res.json({ results, viewState: currentViewState });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

app.post('/api/paginate', async (req, res) => {
  const { cookies, viewState, tableId, first, rows = 10 } = req.body;
  
  const params = new URLSearchParams();
  params.append('javax.faces.partial.ajax', 'true');
  params.append('javax.faces.source', tableId);
  params.append('javax.faces.partial.execute', tableId);
  params.append('javax.faces.partial.render', tableId);
  params.append(tableId, tableId);
  params.append(`${tableId}_pagination`, 'true');
  params.append(`${tableId}_first`, first.toString());
  params.append(`${tableId}_rows`, rows.toString());
  params.append(`${tableId}_encodeFeature`, 'true');
  params.append('javax.faces.ViewState', viewState || '');

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Faces-Request': 'partial/ajax',
        'Cookie': cookies || ''
      },
      body: params.toString()
    });
    
    const xml = await response.text();
    const viewStateMatch = xml.match(/<update id="javax\.faces\.ViewState"><!\[CDATA\[(.*?)\]\]><\/update>/);
    const newViewState = viewStateMatch ? viewStateMatch[1] : viewState;
    
    const tableMatch = xml.match(new RegExp(`<update id="${tableId}"><!\\[CDATA\\[(.*?)\\]\\]><\\/update>`, 's'));
    const tableHtml = tableMatch ? tableMatch[1] : '';
    
    const $ = cheerio.load(`<table>${tableHtml}</table>`);
    const results: any[] = [];
    const table = $('table');
    let pagination = null;

    if (table.length) {
      const headers = table.find('thead th').map((_, th) => $(th).text().trim()).get();
      const rowsList = table.find('tbody tr');
      
      rowsList.each((_, row) => {
        const cells = $(row).find('td').map((_, td) => $(td).text().trim()).get();
        if (cells.length <= 1 && cells[0] === 'Nessun record trovato.') return;

        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = cells[index];
        });
        results.push(rowData);
      });

      const paginator = $('.ui-paginator');
      if (paginator.length) {
        const currentText = paginator.find('.ui-paginator-current').text() || '';
        const match = currentText.match(/\((\d+)\s+di\s+(\d+)\)/) || currentText.match(/Pagina\s+(\d+)\s+di\s+(\d+)/i);
        const activePage = paginator.find('.ui-paginator-page.ui-state-active').text() || '1';

        pagination = {
          currentText,
          currentPage: parseInt(activePage),
          totalPages: match ? parseInt(match[2]) : 1,
          tableId
        };
      }
    }
    
    res.json({ results, pagination, viewState: newViewState });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to paginate' });
  }
});

// --- NUOVA ROTTA GEOCODING PER LA MAPPA ---
app.post('/api/geocode', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'Indirizzo mancante' });
  }

  try {
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&email=tgest.app@gmail.com`;
    
    const response = await fetch(geocodeUrl, {
      headers: {
        'Accept-Language': 'it',
        'User-Agent': 'TgesT_Backend_Server/1.0' 
      }
    });

    if (!response.ok) {
      throw new Error('Errore di rete da Nominatim');
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Errore Geocoding sul server:", error);
    res.status(500).json({ error: 'Geocoding fallito' });
  }
});

// --- ROTTA GEMINI CON FALLBACK SU COHERE (VERSIONE DEFINITIVA) ---
app.post('/api/enrich', async (req, res) => {
  const { rivendita } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  const cohereApiKey = process.env.COHERE_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY mancante nel server");
    return res.status(500).json({
      openingHours: "N/D", phone: "N/D", zona: "N/D",
      notes: "DEBUG AI: Chiave API Gemini non configurata.", confidence: 0
    });
  }

  // --- Prompt Base da usare per ENTRAMBI i motori ---
  const systemPrompt = `Sei un analista dati spietato, preciso e specializzato in geografia italiana. Il tuo compito è estrarre dati reali per le tabaccherie.
DEVI rispettare categoricamente queste REGOLE DI COMPILAZIONE JSON:

1. "zona": DEVI estrarre il QUARTIERE specifico, la micro-zona o la frazione basandoti sull'indirizzo e sul comune (es. se l'indirizzo è 'Via Scarlatti' a 'Napoli', la zona DEVE essere 'Vomero'). NON ripetere MAI semplicemente il nome del comune. Se il comune è molto piccolo (< 10.000 abitanti), indica se è "Centro Storico", "Zona Periferica" o "Strada Statale".
2. "openingHours": Cerca l'indirizzo esatto. Se NON trovi una pagina web reale (Google Maps, PagineGialle, ecc.) che riporta esplicitamente gli orari per QUESTA esatta tabaccheria, DEVI scrivere "Non disponibile". È ASSOLUTAMENTE VIETATO usare orari standard (es. 08:00-13:00 / 16:00-19:30) se non hai una fonte certa.
3. "confidence": NON indovinare questo numero. Usa ESCLUSIVAMENTE questo schema di punteggio matematico:
   - 90 a 100: Hai trovato gli orari su una fonte web verificata (Google Maps, sito web).
   - 50 a 80: Hai trovato il numero di telefono o la tabaccheria su un elenco online, ma gli orari non sono chiari o sono assenti.
   - 0: Non hai trovato nessuna informazione su internet e hai scritto "Non disponibile" negli orari.
4. "phone": Solo cifre, nessuna spaziatura. "Non disponibile" se non lo trovi online.
5. "notes": Indica esplicitamente la fonte dei dati se li hai trovati (es. "Fonte: Google Maps"), oppure scrivi "Dati online non reperibili".
6. "engine": (Questo campo deve essere popolato dal codice backend, non dall'IA).`;

  const userPrompt = `Analizza la seguente tabaccheria usando strumenti di ricerca web (se disponibili) o le tue conoscenze geografiche.
Indirizzo: ${rivendita['Indirizzo']}
Comune: ${rivendita['Comune']}
Provincia: ${rivendita['Prov.']}

Restituisci ESCLUSIVAMENTE un JSON valido con le chiavi: openingHours, phone, zona, notes, confidence.`;

  try {
    // --- TENTATIVO 1: GEMINI ---
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
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

    let text = response.text || '{}';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const geminiData = JSON.parse(text || '{}');
    
    return res.json({
      openingHours: geminiData.openingHours || "Non disponibile",
      phone: (geminiData.phone || "Non disponibile").toString().replace(/\s+/g, ''),
      zona: geminiData.zona || "Non disponibile",
      notes: geminiData.notes || "",
      confidence: Number(geminiData.confidence) || 0,
      engine: "Gemini 3 Flash"
    });

  } catch (geminiError: any) {
    console.warn("Gemini fallito, attivo Cohere v2...", geminiError.message);
    
    // --- TENTATIVO 2: COHERE (IL PARACADUTE CON WEB SEARCH) ---
    if (!cohereApiKey) {
      return res.status(500).json({ 
        openingHours: "Non disponibile", phone: "Non disponibile", zona: "Non disponibile", 
        notes: `DEBUG AI: Gemini fallito (${geminiError.message}) e Cohere non configurato.`, 
        confidence: 0 
      });
    }

    const cohere = new CohereClientV2({ token: cohereApiKey });

    try {
      const response = await cohere.chat({
        model: "command-r-08-2024", // Versione stabile live
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        responseFormat: { type: "json_object" }
      });

      // Estrazione testo secondo standard API v2
      const contentItem = response.message?.content?.[0];
      const rawText = (contentItem?.type === 'text' ? contentItem.text : '') || '{}';
      const cohereData = JSON.parse(rawText);

      return res.json({
        openingHours: cohereData.openingHours || "Non disponibile",
        phone: (cohereData.phone || "Non disponibile").toString().replace(/\s+/g, ''),
        zona: cohereData.zona || "Non disponibile",
        notes: cohereData.notes || "",
        confidence: Number(cohereData.confidence) || 0,
        engine: "Cohere Command R"
      });

    } catch (cohereError: any) {
      console.error("Fallimento totale:", cohereError.message);
      return res.status(500).json({ 
        notes: `Tutti i motori falliti. (Cohere: ${cohereError.message})` 
      });
    }
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
