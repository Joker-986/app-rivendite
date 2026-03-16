import { JSDOM } from 'jsdom';

async function test() {
  const url = 'https://acciseonline8.adm.gov.it/ConsultazioneOnLineTabacchi/ricercaConcessioni/cerca-concessioni.xhtml';
  
  // 1. Get initial page to get ViewState and cookies
  const res1 = await fetch(url);
  const html1 = await res1.text();
  const cookies = res1.headers.get('set-cookie');
  
  const dom1 = new JSDOM(html1);
  const viewState = dom1.window.document.querySelector('input[name="javax.faces.ViewState"]')?.getAttribute('value');
  
  // 2. Select Region (e.g. ABRUZZO) to get Provinces
  const params = new URLSearchParams();
  params.append('javax.faces.partial.ajax', 'true');
  params.append('javax.faces.source', 'j_idt16:regione');
  params.append('javax.faces.partial.execute', 'j_idt16:regione');
  params.append('javax.faces.partial.render', 'j_idt16:regione j_idt16:provincia j_idt16:comune');
  params.append('javax.faces.behavior.event', 'change');
  params.append('javax.faces.partial.event', 'change');
  params.append('j_idt16', 'j_idt16');
  params.append('j_idt16:regione', 'ABRUZZO');
  params.append('j_idt16:provincia', '');
  params.append('j_idt16:comune', '');
  params.append('j_idt16:numRivendita', '');
  params.append('j_idt16:tipoRiv', '');
  params.append('j_idt16:statoRiv', '');
  params.append('javax.faces.ViewState', viewState || '');

  const res2 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Faces-Request': 'partial/ajax',
      'Cookie': cookies || ''
    },
    body: params.toString()
  });
  
  const xml2 = await res2.text();
  const viewState2Match = xml2.match(/<update id="javax\.faces\.ViewState"><!\[CDATA\[(.*?)\]\]><\/update>/);
  const viewState2 = viewState2Match ? viewState2Match[1] : viewState;

  // 3. Select Province (e.g. CH) to get Comuni
  const params3 = new URLSearchParams();
  params3.append('javax.faces.partial.ajax', 'true');
  params3.append('javax.faces.source', 'j_idt16:provincia');
  params3.append('javax.faces.partial.execute', 'j_idt16:provincia');
  params3.append('javax.faces.partial.render', 'j_idt16:provincia j_idt16:comune');
  params3.append('javax.faces.behavior.event', 'change');
  params3.append('javax.faces.partial.event', 'change');
  params3.append('j_idt16', 'j_idt16');
  params3.append('j_idt16:regione', 'ABRUZZO');
  params3.append('j_idt16:provincia', 'CH');
  params3.append('j_idt16:comune', '');
  params3.append('j_idt16:numRivendita', '');
  params3.append('j_idt16:tipoRiv', '');
  params3.append('j_idt16:statoRiv', '');
  params3.append('javax.faces.ViewState', viewState2 || '');

  const res3 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Faces-Request': 'partial/ajax',
      'Cookie': cookies || ''
    },
    body: params3.toString()
  });
  
  const xml3 = await res3.text();
  const viewState3Match = xml3.match(/<update id="javax\.faces\.ViewState"><!\[CDATA\[(.*?)\]\]><\/update>/);
  const viewState3 = viewState3Match ? viewState3Match[1] : viewState2;

  // 4. Submit the form
  const params4 = new URLSearchParams();
  params4.append('j_idt16', 'j_idt16');
  params4.append('j_idt16:regione', 'ABRUZZO');
  params4.append('j_idt16:provincia', 'CH');
  params4.append('j_idt16:comune', '13069001'); // ALTINO
  params4.append('j_idt16:numRivendita', '');
  params4.append('j_idt16:tipoRiv', '');
  params4.append('j_idt16:statoRiv', '');
  params4.append('j_idt16:j_idt38', 'Ricerca'); // The submit button name might be j_idt38, let's check the HTML. Wait, I didn't see the submit button in the grep output. Let's just try to submit without it or with a generic one.
  params4.append('javax.faces.ViewState', viewState3 || '');

  const res4 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies || ''
    },
    body: params4.toString()
  });
  
  const html4 = await res4.text();
  console.log('Response 4 length:', html4.length);
  // Let's print a snippet of the result table if found
  const dom4 = new JSDOM(html4);
  const table = dom4.window.document.querySelector('table');
  if (table) {
    console.log('Table found!');
    console.log(table.textContent?.substring(0, 500));
  } else {
    console.log('No table found. Maybe submit button name is required.');
    console.log(html4.substring(html4.indexOf('<form'), html4.indexOf('</form>') + 7));
  }
}

test();
