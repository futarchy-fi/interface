async function fetchTradeHistory() {
  const url = 'https://nvhqdqtlsdboctqjcelq.supabase.co/rest/v1/trade_history?select=*&user_address=eq.0x2403Cc666aFf9EE68467e097bB494ceE8cEEBD9F&order=evt_block_time.desc';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg';

  try {
    const response = await fetch(url, {
      method: 'GET',    
      headers: {
        'apikey': token, // Supabase REST API uses 'apikey' header for the anon key
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();
    console.log('Response data:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error fetching trade history:', error);
  }
}

fetchTradeHistory();