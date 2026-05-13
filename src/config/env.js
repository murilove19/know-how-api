const DEFAULT_SUPABASE_URL = 'https://qwggvbiirxcjucuurwfw.supabase.co/rest/v1';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3Z2d2YmlpcnhjanVjdXVyd2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MjczNDksImV4cCI6MjA5NDIwMzM0OX0.0N4xpnPcBFSrDN4kzb8uag_Sdvr8D-WcGxpnauQtHMo';

const env = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'know-how-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  supabaseUrl: process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY || DEFAULT_SUPABASE_KEY,
  n8nGenerateQuestionsUrl: process.env.N8N_GENERATE_QUESTIONS_URL || 'https://muriloterra19.app.n8n.cloud/webhook-test/gerar-questoes',
};

module.exports = env;
