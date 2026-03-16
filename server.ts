import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { JSDOM } from 'jsdom';

const app = express();
const PORT = 3000;

app.use(express.json());

const BASE_URL = 'https://acciseonline8.adm.gov.it/ConsultazioneOnLineTabacchi/ricercaConcessioni/cerca-concessioni.xhtml';

// Helper to extract options from a select HTML string
function extractOptions(htmlString: string) {
  const dom = new JSDOM(htmlString);
  const options = Array.from(dom.window.document.querySelectorAll('option')) as HTMLOptionElement[];
  return options
    .map(opt => ({ value: opt.value, label: opt.textContent?.trim() || '' }))
    .filter(opt => opt.value !== '');
}

app.get('/api/init', async (req, res) => {
  try {
    const response = await fetch(BASE_URL);
    const html = await response.text();
    const cookies = response.headers.get('set-cookie');
    
    const dom = new JSDOM(html);
    const viewState = dom.window.document.querySelector('input[name="javax.faces.ViewState"]')?.getAttribute('value');
    
    const regionSelect = dom.window.document.querySelector('select[name="j_idt16:regione"]');
    const regions = regionSelect ? extractOptions(regionSelect.outerHTML) : [];
    
    const submitButton = dom.window.document.querySelector('input[value="Cerca"]');
    const submitName = submitButton ? submitButton.getAttribute('name') : 'j_idt16:j_idt65';

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
  const { cookies, viewState, region, province } = req.body;
  
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
    const comuni = comuneMatch ? extractOptions(comuneMatch[1]) : [];
    
    res.json({ viewState: newViewState, comuni });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch comuni' });
  }
});

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
    const dom = new JSDOM(html);
    
    const newViewState = dom.window.document.querySelector('input[name="javax.faces.ViewState"]')?.getAttribute('value') || viewState;

    // Parse results table
    const results: any[] = [];
    const table = dom.window.document.querySelector('table[role="grid"]');
    let pagination = null;
    let tableId = '';

    if (table) {
      tableId = table.getAttribute('id') || '';
      const headers = Array.from(table.querySelectorAll('thead th')).map((th: any) => th.textContent?.trim() || '');
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      
      for (const row of rows) {
        const cells = Array.from((row as any).querySelectorAll('td')).map((td: any) => td.textContent?.trim() || '');
        if (cells.length <= 1 && cells[0] === 'Nessun record trovato.') continue;
        
        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = cells[index];
        });
        results.push(rowData);
      }

      // Extract pagination info
      const paginator = dom.window.document.querySelector('.ui-paginator');
      if (paginator) {
        const currentText = paginator.querySelector('.ui-paginator-current')?.textContent || '';
        // Format usually: (1 di 10) or similar
        const match = currentText.match(/\((\d+)\s+di\s+(\d+)\)/);
        
        const pages = Array.from(paginator.querySelectorAll('.ui-paginator-page'));
        const activePage = paginator.querySelector('.ui-paginator-page.ui-state-active')?.textContent || '1';
        
        pagination = {
          currentText,
          currentPage: parseInt(activePage),
          totalPages: pages.length,
          tableId
        };
      }
    }
    
    res.json({ results, pagination, viewState: newViewState });
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
    
    const dom = new JSDOM(`<table>${tableHtml}</table>`);
    const results: any[] = [];
    const table = dom.window.document.querySelector('table');
    let pagination = null;

    if (table) {
      const headers = Array.from(table.querySelectorAll('thead th')).map((th: any) => th.textContent?.trim() || '');
      const rowsList = Array.from(table.querySelectorAll('tbody tr'));
      
      for (const row of rowsList) {
        const cells = Array.from((row as any).querySelectorAll('td')).map((td: any) => td.textContent?.trim() || '');
        if (cells.length <= 1 && cells[0] === 'Nessun record trovato.') continue;

        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = cells[index];
        });
        results.push(rowData);
      }

      // Extract pagination info from the updated table HTML
      const paginator = dom.window.document.querySelector('.ui-paginator');
      if (paginator) {
        const currentText = paginator.querySelector('.ui-paginator-current')?.textContent || '';
        const activePage = paginator.querySelector('.ui-paginator-page.ui-state-active')?.textContent || '1';
        const pages = Array.from(paginator.querySelectorAll('.ui-paginator-page'));

        pagination = {
          currentText,
          currentPage: parseInt(activePage),
          totalPages: pages.length,
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
