const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const queryRoutes = require('./routes/queryRoutes');
const initRoutes = require('./routes/initRoutes');
const { connectToDatabase } = require('./services/databaseService');

// Initialize the Express application
const app = express();
const PORT = process.env.PORT || 8082;

// Configure CORS
app.use(cors());

// Configure middleware
app.use(bodyParser.json({ limit: '50mb' })); // Support JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' })); // Support URL-encoded bodies

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/query', queryRoutes);
app.use('/api/init', initRoutes);

// Basic route for API status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Filter Plugin API is running',
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Initialize and start the server
async function startServer() {
  try {
    console.log('Connecting to database...');
    await connectToDatabase();
    
    app.listen(PORT, () => {
      console.log(`Filter Plugin Server is running on port ${PORT}`);
      console.log('Database initialized successfully');
      console.log('Use /api/query/initialize endpoint to initialize a model');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app; // Export app for testing