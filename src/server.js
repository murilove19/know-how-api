const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`✅ Know-How API rodando em http://localhost:${env.port}`);
  console.log('☁️  Banco: Supabase (PostgreSQL na nuvem)');
});
