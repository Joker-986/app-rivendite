import fs from 'fs';
import * as cheerio from 'cheerio';

async function run() {
  try {
    const res = await fetch('https://www.paginebianche.it/codice-istat?dv=Calliano', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'it-IT,it;q=0.9'
      }
    });
    const html = await res.text();
    fs.writeFileSync('calliano.html', html);
    
    const $ = cheerio.load(html);
    const results: any[] = [];
    
    $('.box-dis__item').each((i, el) => {
      const istat = $(el).find('span.result-cap').text().trim();
      let localita = "";
      const text = $(el).text();
      if (text.includes('Località:')) {
        localita = text.split('Località:')[1].trim();
      }
      if (istat) {
        results.push({ istat, localita });
      }
    });
    
    console.log(JSON.stringify(results, null, 2));
    
  } catch (e) {
    console.error(e);
  }
}
run();
