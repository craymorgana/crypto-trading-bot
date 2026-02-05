const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
    res.send('<h1>Test Dashboard Working</h1>');
});

app.get('/api/test', (req, res) => {
    res.json({ status: 'ok', message: 'API is working' });
});

const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Handle errors
server.on('error', (err) => {
    console.error('Server error:', err);
});
