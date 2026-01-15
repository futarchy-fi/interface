const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes and all origins with full access
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Parse JSON bodies
app.use(express.json());

// Serve static files (like index.html)
app.use(express.static(__dirname));

// Function to get the latest futarchy-pool-setup JSON file
function getLatestFutarchyFile() {
  try {
    const files = fs.readdirSync(__dirname)
      .filter(file => file.startsWith('futarchy-pool-setup-') && file.endsWith('.json'))
      .map(file => ({
        name: file,
        time: fs.statSync(path.join(__dirname, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    
    return files.length > 0 ? files[0].name : null;
  } catch (error) {
    console.error('Error getting latest futarchy file:', error);
    return null;
  }
}

// GET endpoint to run futarchy command and return latest JSON
app.get('/api/futarchy', (req, res) => {
  console.log('\n🚀 ===== STARTING FUTARCHY COMMAND =====');
  console.log('⏳ Running: npm run futarchy:auto:config');
  console.log('📍 Directory:', __dirname);
  console.log('==========================================\n');
  
  // Use spawn for real-time output streaming
  const child = spawn('npm', ['run', 'futarchy:auto:config'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });

  let outputBuffer = '';
  let errorBuffer = '';

  // Stream stdout in real-time
  child.stdout.on('data', (data) => {
    const output = data.toString();
    outputBuffer += output;
    console.log('📋 STDOUT:', output.trim());
  });

  // Stream stderr in real-time
  child.stderr.on('data', (data) => {
    const error = data.toString();
    errorBuffer += error;
    console.log('⚠️  STDERR:', error.trim());
  });

  // Handle command completion
  child.on('close', (code) => {
    console.log('\n==========================================');
    console.log(`🏁 COMMAND FINISHED with exit code: ${code}`);
    console.log('==========================================\n');

    if (code !== 0) {
      console.error('❌ Command failed with exit code:', code);
      console.error('Error output:', errorBuffer);
      return res.status(500).json({ 
        error: 'Failed to run futarchy command', 
        details: `Exit code: ${code}`,
        stdout: outputBuffer,
        stderr: errorBuffer
      });
    }

    // Get the latest JSON file
    const latestFile = getLatestFutarchyFile();
    
    if (!latestFile) {
      console.log('❌ No futarchy-pool-setup JSON file found');
      return res.status(404).json({ 
        error: 'No futarchy-pool-setup JSON file found',
        stdout: outputBuffer,
        stderr: errorBuffer
      });
    }

    try {
      // Read and return the JSON content
      const filePath = path.join(__dirname, latestFile);
      const jsonContent = fs.readFileSync(filePath, 'utf8');
      const parsedContent = JSON.parse(jsonContent);
      
      console.log('✅ Successfully read latest file:', latestFile);
      
      res.json({
        success: true,
        filename: latestFile,
        timestamp: new Date().toISOString(),
        data: parsedContent,
        logs: {
          stdout: outputBuffer,
          stderr: errorBuffer
        }
      });
    } catch (error) {
      console.error('❌ Error reading JSON file:', error);
      res.status(500).json({ 
        error: 'Failed to read JSON file', 
        details: error.message,
        stdout: outputBuffer,
        stderr: errorBuffer
      });
    }
  });

  // Handle command error
  child.on('error', (error) => {
    console.error('❌ Failed to start command:', error);
    res.status(500).json({ 
      error: 'Failed to start futarchy command', 
      details: error.message 
    });
  });
});

// GET endpoint to just return the latest JSON without running the command
app.get('/api/latest', (req, res) => {
  const latestFile = getLatestFutarchyFile();
  
  if (!latestFile) {
    return res.status(404).json({ 
      error: 'No futarchy-pool-setup JSON file found' 
    });
  }

  try {
    const filePath = path.join(__dirname, latestFile);
    const jsonContent = fs.readFileSync(filePath, 'utf8');
    const parsedContent = JSON.parse(jsonContent);
    
    res.json({
      success: true,
      filename: latestFile,
      timestamp: new Date().toISOString(),
      data: parsedContent
    });
  } catch (error) {
    console.error('Error reading JSON file:', error);
    res.status(500).json({ 
      error: 'Failed to read JSON file', 
      details: error.message 
    });
  }
});

// POST endpoint to run futarchy with custom config
app.post('/api/futarchy/auto', (req, res) => {
  const config = req.body;
  
  console.log('\n🔵 ===== RECEIVED CUSTOM CONFIG FROM POST REQUEST =====');
  console.log('📋 Request Body:', JSON.stringify(config, null, 2));
  console.log('===================================================\n');
  
  // Validate required fields
  const requiredFields = ['marketName', 'company', 'companyToken', 'currencyToken', 'endTime', 'spotPrice', 'eventProbability', 'initialImpact'];
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    console.log('❌ Validation failed - Missing required fields:', missingFields);
    return res.status(400).json({
      error: 'Missing required fields',
      missingFields
    });
  }

  console.log('✅ All required fields present in request');

  // Create config object in the format expected by futarchy-config.json
  const futarchyConfig = {
    marketName: config.marketName,
    openingTime: Math.floor(Date.now() / 1000), // Current timestamp
    spotPrice: config.spotPrice,
    eventProbability: config.eventProbability / 100, // Convert percentage to decimal
    impact: config.initialImpact,
    liquidityDefault: 0.0000001,
    adapterAddress: "0x7495a583ba85875d59407781b4958ED6e0E1228f"
  };

  console.log('\n🔄 Converting request config to futarchy format:');
  console.log('📋 Original eventProbability:', config.eventProbability, '%');
  console.log('📋 Converted eventProbability:', futarchyConfig.eventProbability);
  console.log('📋 Using current timestamp as openingTime:', futarchyConfig.openingTime);

  // Write the config to futarchy-config.json
  try {
    console.log('\n💾 Writing configuration to futarchy-config.json...');
    fs.writeFileSync(
      path.join(__dirname, 'futarchy-config.json'),
      JSON.stringify(futarchyConfig, null, 2)
    );
    console.log('✅ Configuration file written successfully');
  } catch (error) {
    console.error('❌ Error writing config file:', error);
    return res.status(500).json({
      error: 'Failed to write configuration file',
      details: error.message
    });
  }

  console.log('\n🚀 ===== STARTING FUTARCHY AUTOMATION WITH CUSTOM CONFIG =====');
  console.log('⏳ Running: npm run futarchy:auto:config');
  console.log('📍 Directory:', __dirname);
  console.log('📋 Using config:', JSON.stringify(futarchyConfig, null, 2));
  console.log('==========================================\n');
  
  // Use spawn for real-time output streaming
  const child = spawn('npm', ['run', 'futarchy:auto:config'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });

  let outputBuffer = '';
  let errorBuffer = '';

  // Stream stdout in real-time
  child.stdout.on('data', (data) => {
    const output = data.toString();
    outputBuffer += output;
    console.log('📋 STDOUT:', output.trim());
  });

  // Stream stderr in real-time
  child.stderr.on('data', (data) => {
    const error = data.toString();
    errorBuffer += error;
    console.log('⚠️  STDERR:', error.trim());
  });

  // Handle command completion
  child.on('close', (code) => {
    console.log('\n==========================================');
    console.log(`🏁 FUTARCHY AUTOMATION FINISHED with exit code: ${code}`);
    console.log('==========================================\n');

    if (code !== 0) {
      console.error('❌ Command failed with exit code:', code);
      console.error('Error output:', errorBuffer);
      return res.status(500).json({ 
        error: 'Failed to run futarchy command', 
        details: `Exit code: ${code}`,
        stdout: outputBuffer,
        stderr: errorBuffer
      });
    }

    // Get the latest JSON file
    const latestFile = getLatestFutarchyFile();
    
    if (!latestFile) {
      console.log('❌ No futarchy-pool-setup JSON file found');
      return res.status(404).json({ 
        error: 'No futarchy-pool-setup JSON file found',
        stdout: outputBuffer,
        stderr: errorBuffer
      });
    }

    try {
      // Read and return the JSON content
      const filePath = path.join(__dirname, latestFile);
      const jsonContent = fs.readFileSync(filePath, 'utf8');
      const parsedContent = JSON.parse(jsonContent);
      
      console.log('✅ Successfully read latest file:', latestFile);
      console.log('📋 Generated file contents:', JSON.stringify(parsedContent, null, 2));
      
      res.json({
        success: true,
        filename: latestFile,
        timestamp: new Date().toISOString(),
        config: futarchyConfig,
        data: parsedContent,
        logs: {
          stdout: outputBuffer,
          stderr: errorBuffer
        }
      });
    } catch (error) {
      console.error('❌ Error reading JSON file:', error);
      res.status(500).json({ 
        error: 'Failed to read JSON file', 
        details: error.message,
        stdout: outputBuffer,
        stderr: errorBuffer
      });
    }
  });

  // Handle command error
  child.on('error', (error) => {
    console.error('❌ Failed to start command:', error);
    res.status(500).json({ 
      error: 'Failed to start futarchy command', 
      details: error.message 
    });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Futarchy API Server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET /api/futarchy - Run futarchy:auto:config and return latest JSON`);
  console.log(`   POST /api/futarchy/auto - Run futarchy with custom config from request body`);
  console.log(`   GET /api/latest - Return latest JSON without running command`);
  console.log(`   GET / - Serve index.html`);
}); 