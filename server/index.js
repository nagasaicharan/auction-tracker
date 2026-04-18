import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import purchasesRouter from './routes/purchases.js';
import syncRouter from './routes/sync.js';
import returnsRouter from './routes/returns.js';
import authRouter from './routes/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/purchases', purchasesRouter);
app.use('/api/sync', syncRouter);
app.use('/api/returns', returnsRouter);
app.use('/api/auth', authRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
