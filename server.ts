import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import * as cheerio from 'cheerio';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';
import Database from 'better-sqlite3';

dotenv.config(); // Carica la chiave da Render

const app = express();
const PORT = 3000;
const APP_VERSION = Date.now().toString(); // Versione dinamica basata sul timestamp di avvio server

// Inizializzazione Database SQLite
const dbPath = path.join(process.cwd(), 'tgest.db');
const dbSqlite = new Database(dbPath);

// Aggiunta tabella storico_kpi
dbSqlite.exec(`
  CREATE TABLE IF NOT EXISTS crm_data (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS giro_visite (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS stores (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS rubrica (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS storico_kpi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_rivendita TEXT,
    mese_riferimento TEXT,
    campagna TEXT,
    obiettivo TEXT,
    note_kpi TEXT,
    data_archiviazione DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(express.json({ limit: '10mb' }));

// Endpoint per salvare lo storico KPI prima del reset
app.post('/api/db/archive-kpi', (req, res) => {
  const { entries } = req.body; // Array di {id_rivendita, mese_riferimento, campagna, obiettivo, note_kpi}
  try {
    const insertStmt = dbSqlite.prepare(`
      INSERT INTO storico_kpi (id_rivendita, mese_riferimento, campagna, obiettivo, note_kpi)
      VALUES (?, ?, ?, ?, ?)
    `);
    const transaction = dbSqlite.transaction((items) => {
      for (const item of items) {
        insertStmt.run(item.id_rivendita, item.mese_riferimento, item.campagna, item.obiettivo, item.note_kpi);
      }
    });
    transaction(entries);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Errore archiviazione storico' });
  }
});

// Endpoint per recuperare lo storico di una rivendita
app.get('/api/db/history/:id', (req, res) => {
  try {
    const rows = dbSqlite.prepare('SELECT * FROM storico_kpi WHERE id_rivendita = ? ORDER BY mese_riferimento DESC').all(req.params.id);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Errore recupero storico' });
  }
});

// API per la persistenza dei dati
app.get('/api/db/sync', (req, res) => {
  try {
    const crm = dbSqlite.prepare('SELECT data FROM crm_data').all().map((row: any) => JSON.parse(row.data));
    const giro = dbSqlite.prepare('SELECT data FROM giro_visite').all().map((row: any) => JSON.parse(row.data));
    const stores = dbSqlite.prepare('SELECT data FROM stores').all().map((row: any) => JSON.parse(row.data));
    const rubricaRows = dbSqlite.prepare('SELECT id, data FROM rubrica').all();
    const rubrica: Record<string, any> = {};
    rubricaRows.forEach((row: any) => {
      rubrica[row.id] = JSON.parse(row.data);
    });

    res.json({ crm, giro, stores, rubrica });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data from DB' });
  }
});

app.post('/api/db/save', (req, res) => {
  const { type, data } = req.body;
  try {
    if (type === 'crm') {
      const deleteStmt = dbSqlite.prepare('DELETE FROM crm_data');
      const insertStmt = dbSqlite.prepare('INSERT INTO crm_data (id, data) VALUES (?, ?)');
      const transaction = dbSqlite.transaction((items: any[]) => {
        deleteStmt.run();
        for (const item of items) {
          const id = item.uid || `${item['Comune']}_${item['Num. Rivendita']}`;
          insertStmt.run(id, JSON.stringify(item));
        }
      });
      transaction(data);
    } else if (type === 'giro') {
      const deleteStmt = dbSqlite.prepare('DELETE FROM giro_visite');
      const insertStmt = dbSqlite.prepare('INSERT INTO giro_visite (id, data) VALUES (?, ?)');
      const transaction = dbSqlite.transaction((items: any[]) => {
        deleteStmt.run();
        for (const item of items) {
          const id = item.uid || `${item['Comune']}_${item['Num. Rivendita']}`;
          insertStmt.run(id, JSON.stringify(item));
        }
      });
      transaction(data);
    } else if (type === 'stores') {
      const deleteStmt = dbSqlite.prepare('DELETE FROM stores');
      const insertStmt = dbSqlite.prepare('INSERT INTO stores (id, data) VALUES (?, ?)');
      const transaction = dbSqlite.transaction((items: any[]) => {
        deleteStmt.run();
        for (const item of items) {
          const id = item.uid || `${item['Comune']}_${item['Num. Rivendita']}`;
          insertStmt.run(id, JSON.stringify(item));
        }
      });
      transaction(data);
    } else if (type === 'rubrica') {
      const insertStmt = dbSqlite.prepare('INSERT OR REPLACE INTO rubrica (id, data) VALUES (?, ?)');
      const transaction = dbSqlite.transaction((entries: Record<string, any>) => {
        for (const [id, value] of Object.entries(entries)) {
          insertStmt.run(id, JSON.stringify(value));
        }
      });
      transaction(data);
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save data to DB' });
  }
});

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

// --- ROTTA GEMINI NATIVA (v2.98) ---
app.post('/api/enrich', async (req, res) => {
  const { rivendita } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      openingHours: "N/D", phone: "N/D", zona: "N/D",
      notes: "DEBUG AI: Chiave API Gemini non configurata.", confidence: 0
    });
  }

  const systemPrompt = `Sei un analista dati spietato, preciso e specializzato in geografia italiana. Il tuo compito è estrarre dati reali per le tabaccherie.
DEVI rispettare categoricamente queste REGOLE DI COMPILAZIONE JSON:
1. "zona": DEVI estrarre il QUARTIERE specifico, la micro-zona o la frazione basandoti sull'indirizzo e sul comune (es. se l'indirizzo è 'Via Scarlatti' a 'Napoli', la zona DEVE essere 'Vomero'). NON ripetere MAI semplicemente il nome del comune.
2. "openingHours": Per il campo 'openingHours': Raggruppa in modo intelligente i giorni consecutivi che hanno gli stessi orari per risparmiare spazio visivo. Usa le abbreviazioni di 3 lettere per i giorni (es. Lun, Mar, Mer, Gio, Ven, Sab, Dom). Usa ESCLUSIVAMENTE il carattere speciale di a capo testuale (\\n) per separare un gruppo di giorni dall'altro. NON usare MAI il punto e virgola (;).
   Ecco un esempio esatto del formato compatto che devi generare:
   Lun-Ven: 07:00-13:00, 16:00-20:00\\nSab: 07:00-13:00\\nDom: Chiuso
   Devi essere il più pulito e riassuntivo possibile, eliminando ogni ripetizione inutile. Se NON hai dati certi per QUESTA esatta tabaccheria, DEVI scrivere "Non disponibile". È ASSOLUTAMENTE VIETATO usare orari standard o indovinare.
3. "confidence": NON indovinare questo numero. Usa ESCLUSIVAMENTE questo schema:
   - 90 a 100: Dati trovati su fonte web verificata.
   - 50 a 80: Dati parziali trovati su elenchi online o nel tuo database interno.
   - 0: Nessuna informazione sicura trovata, orari impostati su "Non disponibile".
4. "phone": Solo cifre. "Non disponibile" se non lo sai con certezza.
5. "notes": Per il campo 'notes': Devi agire come un analista di intelligence per un agente di commercio. Non limitarti a scrivere 'Nessuna nota'. Analizza i risultati web ed estrai ogni singolo dettaglio utile per una prima visita. 
   Cerca e riassumi: 
   - Servizi extra offerti (Sisal, Lottomatica, ricariche, pagamento bollette, valori bollati).
   - Hub spedizioni (Amazon Locker, Punto Poste, InPost, BRT).
   - Prodotti extra (articoli da regalo, cartoleria, profumeria, edicola integrata).
   - Se menzionato, il nome della tabaccheria o del titolare.
   - Punti di riferimento geografici (es. 'Situata di fronte alla farmacia' o 'Vicino alla stazione').
   Scrivi un riassunto discorsivo, altamente professionale, compatto e diviso da virgole. Se trovi recensioni rilevanti sull'ampiezza del locale, citalo brevemente.`;

  const userPrompt = `Analizza la seguente tabaccheria:
Indirizzo: ${rivendita['Indirizzo']}
Comune: ${rivendita['Comune']}
Provincia: ${rivendita['Prov.']}

Restituisci ESCLUSIVAMENTE un JSON: {openingHours, phone, zona, notes, confidence}`;

  const ai = new GoogleGenAI({ apiKey });

  // --- CASCATA MULTI-MODELLO (Stringhe Ufficiali Validate Google AI) ---
  const waterfallModels = [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", useSearch: true },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", useSearch: true },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Base)", useSearch: false }
  ];

  let finalJson: any = null;
  let success = false;
  let usedModelName = "";
  let isFallback = false;

  for (let i = 0; i < waterfallModels.length; i++) {
    const currentModel = waterfallModels[i];
    try {
      console.log(`[AI Enrich] Tentativo ${i + 1}/${waterfallModels.length} con: ${currentModel.name}`);
      
      const aiConfig: any = {
        systemInstruction: systemPrompt
      };

      if (currentModel.useSearch) {
        aiConfig.tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent({
        model: currentModel.id,
        contents: userPrompt,
        config: aiConfig
      });

      let responseText = response.text || "{}";
      
      // PULIZIA REGEX CORAZZATA (Cattura il JSON ovunque si trovi nel testo)
      let cleanedText = responseText.trim();
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }

      finalJson = JSON.parse(cleanedText);
      
      success = true;
      usedModelName = currentModel.name;
      isFallback = (i > 0); 
      console.log(`[AI Enrich] Successo con ${currentModel.name}`);
      break; 

    } catch (error: any) {
      console.warn(`[AI Enrich] Errore con ${currentModel.name}:`, error.status || error.message);

      const errorMsg = error.message ? error.message.toLowerCase() : "";
      const isRateLimit = error.status === 429 || errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('too many');
      const isServerError = error.status >= 500 || errorMsg.includes('503') || errorMsg.includes('unavailable');

      if (isRateLimit || isServerError || !error.status) {
        console.log(`[AI Enrich] Limite o server giù. Fallback in corso...`);
        if (i < waterfallModels.length - 1) continue; 
      }
      
      console.error(`[AI Enrich] Errore irreversibile o fine cascata.`);
      break; 
    }
  }

  if (success && finalJson) {
    return res.json({
      openingHours: finalJson.openingHours || "Non disponibile",
      phone: (finalJson.phone || "Non disponibile").toString().replace(/\s+/g, ''),
      zona: finalJson.zona || "Non disponibile",
      notes: finalJson.notes || "",
      confidence: Number(finalJson.confidence) || 0,
      modelUsed: usedModelName,
      fallbackTriggered: isFallback
    });
  } else {
    return res.json({
      openingHours: "Non disponibile",
      phone: "Non disponibile",
      zona: "Non disponibile",
      notes: "⚠️ Impossibile recuperare dati AI dopo vari tentativi.",
      confidence: 0,
      modelUsed: "Nessuno",
      fallbackTriggered: true
    });
  }
});

// --- NUOVA ROTTA OCR MULTIMODALE GEMINI ---
app.post('/api/ocr-scan', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Nessuna immagine fornita' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'API Key mancante' });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `Sei un estrattore dati specializzato in documenti commerciali e fiscali italiani (licenze ADM, scontrini RT, biglietti da visita).
Estrai i dati dall'immagine e restituisci ESCLUSIVAMENTE un JSON valido con questa struttura esatta. Se un dato non è presente, usa una stringa vuota "". Non inventare nulla.
{
  "pIva": "estrai solo i numeri, tipicamente 11 cifre",
  "codiceUnivoco": "estrai il Codice Destinatario / SDI (esattamente 7 caratteri alfanumerici)",
  "titolare": "nome della persona, azienda o insegna",
  "telefoni": ["numero1", "numero2"], // ARRAY DI STRINGHE. Estrai TUTTI i numeri di telefono trovati. Lascia l'array vuoto se non ce ne sono.
  "mail": "solo l'indirizzo email classico (ESCLUDI indirizzi PEC)",
  "pec": "solo l'indirizzo di posta elettronica certificata (PEC)",
  "orari": "orari di apertura se presenti"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [prompt, { inlineData: { data: base64Data, mimeType: "image/jpeg" } }]
    });

    let cleanedText = response.text?.trim() || "{}";
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanedText = jsonMatch[0];

    const extractedData = JSON.parse(cleanedText);

    // Pulizia forzata lato server: pulisce l'array dei telefoni rimuovendo spazi e simboli
    if (extractedData.telefoni && Array.isArray(extractedData.telefoni)) {
      extractedData.telefoni = extractedData.telefoni
        .map((t: string) => t.replace(/\D/g, ''))
        .filter((t: string) => t.length > 0);
    }

    res.json(extractedData);
  } catch (error: any) {
    console.error('Errore OCR:', error);
    res.status(500).json({ error: 'Errore OCR', details: error.message });
  }
});

// --- NUOVA ROTTA DUAL MESSAGING (FOLLOW-UP AI) ---
app.post('/api/followup', async (req, res) => {
  try {
    const { rivendita, extra, noteLibere, enrichedDetails, aiOptions } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY non configurata.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Estrazione dati chiave per il prompt
    const nomeReferente = extra?.riferimento || 'Referente';
    const hasName = nomeReferente.toLowerCase() !== 'referente';

    // 1. COSTRUZIONE MODULARE DEL SYSTEM PROMPT
    let systemInstructions = `Sei un esperto agente commerciale che scrive a un cliente tabaccaio/negoziante su WhatsApp.
    REGOLA 1: Se c'è il nome del referente (${hasName ? nomeReferente : 'NESSUNO'}), inizia con "Ciao ${nomeReferente},". Altrimenti inizia con "Ciao,". Non nominare l'azienda.
    REGOLA 2: NIENTE EMOJI. Zero. Vietate.
    REGOLA 3: Niente elenchi puntati o numerati. Solo paragrafi discorsivi e brevi.
    REGOLA 4: Lunghezza massima 50-60 parole. Vai dritto al punto.
    REGOLA 5: Sii persuasivo ma mai invadente.
    
    L'utente vuole focalizzare il messaggio su questi argomenti specifici (IGNORA IL RESTO):
    `;

    if (aiOptions?.note && noteLibere) {
      systemInstructions += `- NOTA OPERATIVA: Basa il corpo principale del messaggio su questa nota: "${noteLibere}". Fai una domanda aperta o una chiamata all'azione per spingere alla chiusura su questo punto.\n`;
    }
    
    if (aiOptions?.ordini) {
      const lastOrder = extra?.history?.find((h: any) => h.tipo === 'ORDINE');
      if (lastOrder) {
        systemInstructions += `- ORDINI: Ricorda al cliente l'ultimo ordine del ${lastOrder.data} di €${lastOrder.importo} (${lastOrder.isEseguito ? 'Evaso' : 'In lavorazione/Bozza'}).\n`;
      } else {
        systemInstructions += `- ORDINI: Chiedi cortesemente se ha bisogno di un riassortimento dei prodotti mancanti.\n`;
      }
    }

    if (aiOptions?.visite) {
      const lastDate = extra?.dataVisita || extra?.lastDataVisita;
      if (lastDate) {
        systemInstructions += `- VISITE: Cita la visita effettuata il ${lastDate}.\n`;
      }
    }

    if (aiOptions?.hostess) {
      systemInstructions += `- HOSTESS: Chiedi un feedback sull'ultima attività della hostess in store o se serve programmarne una nuova.\n`;
    }

    const finalPrompt = `Scrivi il messaggio WhatsApp seguendo alla lettera le istruzioni di sistema e usando questi dati per il contesto (se richiesti):\nDati Rivendita: ${JSON.stringify(rivendita)}\nNote: ${noteLibere}`;

    // 2. CHIAMATA A GEMINI (3.7 Flash primario, 2.5 Flash fallback resiliente)
    let responseText = '';
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: finalPrompt,
        config: {
          systemInstruction: systemInstructions
        }
      });
      responseText = response.text || '';
    } catch (modelErr: any) {
      console.warn("Fallback /api/followup a gemini-2.5-flash:", modelErr.status || modelErr.message);
      const fallbackResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: finalPrompt,
        config: {
          systemInstruction: systemInstructions
        }
      });
      responseText = fallbackResponse.text || '';
    }

    if (responseText) {
      res.json({ message: responseText });
    } else {
      res.status(500).json({ error: 'Nessuna risposta dal modello AI.' });
    }

  } catch (error: any) {
    console.error('Errore /api/followup:', error);
    res.status(500).json({ error: 'Errore durante la generazione del messaggio AI.', details: error.message });
  }
});

// --- NUOVA ROTTA AI WAR ROOM: BRIEFING, OFFER SNIPER, ORACOLO ---
app.post('/api/gemini-chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt mancante" });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY non configurata." });
    }

    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    let chatResponseText = '';
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
      });
      chatResponseText = response.text || '';
    } catch (chatErr: any) {
      console.warn("Fallback /api/gemini-chat a gemini-2.5-flash:", chatErr.status || chatErr.message);
      const fallbackResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      chatResponseText = fallbackResponse.text || '';
    }

    if (chatResponseText) {
      res.json({ response: chatResponseText });
    } else {
      res.status(500).json({ error: "Nessuna risposta ricevuta dall'AI." });
    }
  } catch (error: any) {
    console.error("Errore /api/gemini-chat:", error);
    res.status(500).json({ error: "Errore durante la generazione dell'AI.", details: error.message });
  }
});

// --- NUOVA ROTTA LOGISTA (Open Data JSON - Infallibile) ---
app.post('/api/logista', async (req, res) => {
  const { comune } = req.body;
  if (!comune) return res.status(400).json({ error: 'Comune mancante' });

  try {
    console.log(`\n[LOGISTA] Ricerca ISTAT Open Data per: ${comune}`);
    const url = 'https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json';
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Errore nel recupero del database comuni Open Data');
    }

    const comuni = await response.json();
    
    // Pulizia e ricerca case-insensitive
    const targetComune = comune.toLowerCase().trim().replace(/[`´’‘]/g, "'");
    const comuneTrovato = comuni.find((c: any) => c.nome.toLowerCase() === targetComune);

    if (comuneTrovato && comuneTrovato.codice) {
      console.log(`[LOGISTA] Trovato codice ISTAT: ${comuneTrovato.codice}`);
      res.json({ results: [{ istat: comuneTrovato.codice, localita: comuneTrovato.nome }] });
    } else {
      console.warn(`[LOGISTA] Codice non trovato per: ${comune}`);
      res.status(404).json({ error: `Codice ISTAT non trovato per: ${comune}` });
    }
  } catch (error: any) {
    console.error('Errore /api/logista Open Data:', error);
    res.status(500).json({ error: 'Errore interno del server durante la ricerca ISTAT' });
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
