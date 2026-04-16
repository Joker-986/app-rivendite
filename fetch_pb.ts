import fs from 'fs';

async function run() {
  try {
    const res = await fetch('https://www.paginebianche.it/codice-istat?dv=Napoli', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    fs.writeFileSync('pb2.html', text);
    console.log('Saved to pb2.html. Length:', text.length);
  } catch (e) {
    console.error(e);
  }
}
run();
