import 'dotenv/config.js';
import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'asset-management-api' });
});

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});
