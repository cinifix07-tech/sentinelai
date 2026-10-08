require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const { initSocket } = require('./socket');

const app = express();
const server = http.createServer(app);
const allowedOrigins = process.env.CLIENT_ORIGIN?.split(',') || [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
];
const localDevOrigin = /^http:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}):\d+$/;
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || localDevOrigin.test(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
};

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '16mb' }));
app.use(morgan('dev'));
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'smart-home-security-api',
    health: '/api/health',
    login: '/api/auth/login',
  });
});
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

initSocket(server, corsOptions);

const port = Number(process.env.PORT || 4000);
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`Port ${port} is already in use. The backend is probably already running at http://localhost:${port}.`);
    process.exit(0);
    return;
  }
  throw error;
});

if (require.main === module && !process.env.VERCEL) {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Smart Home Security API listening on http://0.0.0.0:${port}`);
  });
}

module.exports = app;
