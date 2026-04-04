import https from 'https';

https.get('https://acciseonline8.adm.gov.it/ConsultazioneOnLineTabacchi/', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data);
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
