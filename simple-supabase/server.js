const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from current directory
app.use(express.static(__dirname));

// Serve node_modules for client-side libraries
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Simple Supabase Trade History Test Server' 
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📡 Open your browser and navigate to the URL above`);
    console.log(`🔥 Simple Supabase Trade History Test ready!`);
    console.log(`📋 Ethers.js and Supabase.js served from node_modules`);
}); 