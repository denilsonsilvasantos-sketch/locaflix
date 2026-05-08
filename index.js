/**
 * LOCAFLIX — Entry point para Hostinger Node.js
 */
const path = require('path');
const fs = require('fs');

// Carrega .env apenas em dev
if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch (_) {}
}

const express = require('express');

// Importa o app Express do servidor backend
// ⚠️  Ajuste o caminho abaixo para onde está o seu server/index.js ou backend/index.js
let app;
try {
  app = require('./server/index');
  if (!app || typeof app.listen !== 'function') throw new Error('Não é um app express');
  console.log('[LOCAFLIX] Servidor carregado de ./server/index');
} catch (e) {
  try {
    app = require('./backend/index');
    if (!app || typeof app.listen !== 'function') throw new Error('Não é um app express');
    console.log('[LOCAFLIX] Servidor carregado de ./backend/index');
  } catch (e2) {
    console.warn('[LOCAFLIX] Criando app Express mínimo (server não encontrado)');
    app = express();
    app.use(express.json());
  }
}

// Serve o frontend buildado (React/Vite → dist/)
const possibleDist = [
  path.join(__dirname, 'frontend', 'dist'),
  path.join(__dirname, 'client', 'dist'),
  path.join(__dirname, 'dist'),
];

const distPath = possibleDist.find(p => fs.existsSync(p));

if (distPath) {
  console.log(`[LOCAFLIX] Servindo frontend de: ${distPath}`);
  app.use(express.static(distPath));

  // SPA fallback — tudo que não for /api/* serve o index.html do React
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn('[LOCAFLIX] ⚠️  Pasta dist/ não encontrada. Execute: npm run build');
  app.get('/', (req, res) => {
    res.send('LOCAFLIX backend ativo. Frontend não compilado — execute npm run build.');
  });
}

// Porta: Hostinger injeta via process.env.PORT automaticamente
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ LOCAFLIX rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
