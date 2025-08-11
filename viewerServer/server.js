const express = require('express');
const { PORT, FRONTEND_PATH } = require('./config.js');
const path = require('path');
const cors = require('cors');


let app = express();

// Allow all origins (useful in dev)
app.use(cors());

app.use(express.static(FRONTEND_PATH));


// Make sure this middleware is added BEFORE your routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(require('./routes/auth.js'));
app.use(require('./routes/models.js'));
app.listen(PORT, function () { console.log(`Server listening on port ${PORT}...`); });