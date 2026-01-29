import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4000;

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Routes to explicit pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/a', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/a.html'));
});

app.get('/b', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/b.html'));
});

app.listen(PORT, () => {
  console.log(`Sales Mockups Server running at http://localhost:${PORT}`);
  console.log(`- Landing: http://localhost:${PORT}/`);
  console.log(`- Variant A (OVH): http://localhost:${PORT}/a`);
  console.log(`- Variant B (Apple): http://localhost:${PORT}/b`);
});
