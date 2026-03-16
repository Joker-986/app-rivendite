import { JSDOM } from 'jsdom';

async function test() {
  const url = 'https://acciseonline8.adm.gov.it/ConsultazioneOnLineTabacchi/ricercaConcessioni/cerca-concessioni.xhtml';
  
  // 1. Get initial page to get ViewState and cookies
  const res1 = await fetch(url);
  const html1 = await res1.text();
  const cookies = res1.headers.get('set-cookie');
  
  const dom1 = new JSDOM(html1);
  const viewState = dom1.window.document.querySelector('input[name="javax.faces.ViewState"]')?.getAttribute('value');
  
  // Let's find the submit button name from the initial HTML
  const submitButton = dom1.window.document.querySelector('input[value="Cerca"]');
  const submitName = submitButton ? submitButton.getAttribute('name') : 'j_idt16:j_idt65';

  const params4 = new URLSearchParams();
  params4.append('j_idt16', 'j_idt16');
  params4.append('j_idt16:regione', 'ABRUZZO');
  params4.append('j_idt16:provincia', 'CH');
  params4.append('j_idt16:comune', '13069001'); // ALTINO
  params4.append('j_idt16:numRivendita', '');
  params4.append('j_idt16:tipoRiv', '');
  params4.append('j_idt16:statoRiv', '');
  params4.append(submitName || 'j_idt16:j_idt65', submitName || 'j_idt16:j_idt65');
  params4.append('mode', 'list');
  params4.append('javax.faces.ViewState', viewState || '');

  const res4 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies || ''
    },
    body: params4.toString()
  });
  
  const html4 = await res4.text();
  const dom4 = new JSDOM(html4);
  const resultTable = dom4.window.document.querySelector('table[role="grid"]');
  if (resultTable) {
    console.log("SUCCESS! Table found without intermediate steps.");
  } else {
    console.log('FAILED. No result table found. Intermediate steps are required.');
  }
}

test();
