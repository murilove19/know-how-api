const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const SUPABASE_URL = 'https://qwggvbiirxcjucuurwfw.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3Z2d2YmlpcnhjanVjdXVyd2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MjczNDksImV4cCI6MjA5NDIwMzM0OX0.0N4xpnPcBFSrDN4kzb8uag_Sdvr8D-WcGxpnauQtHMo';

app.use(cors());
app.use(express.json());

// ─── Helper Supabase ──────────────────────────────────────────────────────────
async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers,
    },
  });
  const text = await res.text();
  try { return { data: JSON.parse(text), status: res.status }; }
  catch { return { data: text, status: res.status }; }
}

// ─── Gera senha padrão ────────────────────────────────────────────────────────
function senhaPadrao(ra) {
  const ano = new Date().getFullYear();
  return `${ra}${ano}*`;
}

// ── AUTH ──────────────────────────────────────────────────────────────────────

app.post('/api/login', async (req, res) => {
  const { ra, senha } = req.body;
  if (!ra || !senha) return res.status(400).json({ erro: 'RA e senha obrigatórios' });
  const { data } = await sb(`/profiles?ra=eq.${ra}&senha=eq.${encodeURIComponent(senha)}&select=*`);
  if (!data || data.length === 0) return res.status(401).json({ erro: 'RA ou senha incorretos' });
  res.json({ usuario: data[0] });
});

app.put('/api/trocar-senha', async (req, res) => {
  const { id, novaSenha } = req.body;
  if (!id || !novaSenha) return res.status(400).json({ erro: 'Dados incompletos' });
  const { data } = await sb(`/profiles?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ senha: novaSenha, primeiro_acesso: 0 }),
  });
  if (!data || data.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
  res.json(data[0]);
});

// ── PROFILES ──────────────────────────────────────────────────────────────────

app.get('/api/profiles', async (req, res) => {
  const { role } = req.query;
  const filter = role ? `?role=eq.${role}&select=*` : '?select=*';
  const { data } = await sb(`/profiles${filter}`);
  res.json(data || []);
});

app.get('/api/profiles/:id', async (req, res) => {
  const { data } = await sb(`/profiles?id=eq.${req.params.id}&select=*`);
  if (!data || data.length === 0) return res.status(404).json({ erro: 'Não encontrado' });
  res.json(data[0]);
});

// Admin cria professor
app.post('/api/profiles/professor', async (req, res) => {
  const { nome, email, ra, instituicao_id } = req.body;
  if (!nome || !email || !ra) return res.status(400).json({ erro: 'Dados incompletos' });
  const senha = senhaPadrao(ra);
  const { data, status } = await sb('/profiles', {
    method: 'POST',
    body: JSON.stringify({ nome, email, ra, senha, role: 'professor', instituicao_id: instituicao_id || 1, primeiro_acesso: 1 }),
  });
  if (status >= 400) return res.status(400).json({ erro: 'RA ou email já cadastrado' });
  res.status(201).json({ ...(Array.isArray(data) ? data[0] : data), senha_padrao: senha });
});

// Professor cria aluno
app.post('/api/profiles/aluno', async (req, res) => {
  const { nome, email, ra, turma_id, instituicao_id } = req.body;
  if (!nome || !email || !ra || !turma_id) return res.status(400).json({ erro: 'Dados incompletos' });
  const senha = senhaPadrao(ra);
  const { data, status } = await sb('/profiles', {
    method: 'POST',
    body: JSON.stringify({ nome, email, ra, senha, role: 'aluno', instituicao_id: instituicao_id || 1, primeiro_acesso: 1 }),
  });
  if (status >= 400) return res.status(400).json({ erro: 'RA ou email já cadastrado' });
  const aluno = Array.isArray(data) ? data[0] : data;
  // Matricula automaticamente na turma
  await sb('/matriculas', {
    method: 'POST',
    body: JSON.stringify({ aluno_id: aluno.id, turma_id, ativo: 1 }),
  });
  res.status(201).json({ ...aluno, senha_padrao: senha });
});

// ── TURMAS ────────────────────────────────────────────────────────────────────

app.get('/api/turmas', async (req, res) => {
  const { professor_id } = req.query;
  const filter = professor_id ? `?professor_id=eq.${professor_id}&select=*` : '?select=*';
  const { data } = await sb(`/turmas${filter}`);
  res.json(data || []);
});

app.post('/api/turmas', async (req, res) => {
  const { nome, professor_id, instituicao_id, semestre_id } = req.body;
  if (!nome || !professor_id) return res.status(400).json({ erro: 'Dados incompletos' });
  const { data } = await sb('/turmas', {
    method: 'POST',
    body: JSON.stringify({ nome, professor_id, instituicao_id: instituicao_id || 1 }),
  });
  const turma = Array.isArray(data) ? data[0] : data;
  // Vincula ao semestre se informado
  if (semestre_id) {
    await sb('/turma_semestre', {
      method: 'POST',
      body: JSON.stringify({ turma_id: turma.id, semestre_id, horas_disponiveis: 5, horas_utilizadas: 0 }),
    });
  }
  res.status(201).json(turma);
});

// ── MATRÍCULAS ────────────────────────────────────────────────────────────────

app.get('/api/matriculas', async (req, res) => {
  const { turma_id, aluno_id } = req.query;
  if (turma_id) {
    const { data } = await sb(`/matriculas?turma_id=eq.${turma_id}&select=*,profiles!aluno_id(id,nome,email,ra,primeiro_acesso)`);
    const mapped = (data || []).map(m => ({ ...m, nome: m.profiles?.nome, email: m.profiles?.email, ra: m.profiles?.ra, primeiro_acesso: m.profiles?.primeiro_acesso }));
    return res.json(mapped);
  }
  if (aluno_id) {
    const { data } = await sb(`/matriculas?aluno_id=eq.${aluno_id}&ativo=eq.1&select=*`);
    return res.json(data || []);
  }
  const { data } = await sb('/matriculas?select=*');
  res.json(data || []);
});

app.post('/api/matriculas', async (req, res) => {
  const { ra, turma_id } = req.body;
  if (!ra || !turma_id) return res.status(400).json({ erro: 'Dados incompletos' });
  const { data: alunoData } = await sb(`/profiles?ra=eq.${ra}&role=eq.aluno&select=*`);
  if (!alunoData || alunoData.length === 0) return res.status(404).json({ erro: 'Aluno não encontrado' });
  const aluno = alunoData[0];
  const { status } = await sb('/matriculas', {
    method: 'POST',
    body: JSON.stringify({ aluno_id: aluno.id, turma_id, ativo: 1 }),
  });
  if (status >= 400) return res.status(400).json({ erro: 'Aluno já matriculado' });
  res.status(201).json({ mensagem: 'Matriculado!', aluno });
});

// ── MÓDULOS ───────────────────────────────────────────────────────────────────

app.get('/api/modulos', async (req, res) => {
  const { aluno_id, turma_id } = req.query;
  if (aluno_id) {
    const { data: mats } = await sb(`/matriculas?aluno_id=eq.${aluno_id}&ativo=eq.1&select=turma_id`);
    if (!mats || mats.length === 0) return res.json([]);
    const turmaIds = mats.map(m => m.turma_id).join(',');
    const { data } = await sb(`/modulos?turma_id=in.(${turmaIds})&select=*`);
    return res.json(data || []);
  }
  if (turma_id) {
    const { data } = await sb(`/modulos?turma_id=eq.${turma_id}&select=*`);
    return res.json(data || []);
  }
  const { data } = await sb('/modulos?select=*');
  res.json(data || []);
});

app.post('/api/modulos', async (req, res) => {
  const { titulo, descricao, professor_id, turma_id, nota_minima, gera_horas, horas_maximas, data_inicio, data_fim, cor } = req.body;
  if (!titulo || !professor_id || !turma_id) return res.status(400).json({ erro: 'Dados incompletos' });
  const { data } = await sb('/modulos', {
    method: 'POST',
    body: JSON.stringify({ titulo, descricao, professor_id, turma_id, nota_minima: nota_minima || 7, gera_horas: gera_horas || 1, horas_maximas: horas_maximas || 4, data_inicio, data_fim, cor: cor || '#2563EB' }),
  });
  res.status(201).json(Array.isArray(data) ? data[0] : data);
});

// ── ATIVIDADES ────────────────────────────────────────────────────────────────

app.get('/api/atividades', async (req, res) => {
  const { modulo_id } = req.query;
  const filter = modulo_id ? `?modulo_id=eq.${modulo_id}&select=*` : '?select=*';
  const { data } = await sb(`/atividades${filter}`);
  res.json(data || []);
});

app.post('/api/atividades', async (req, res) => {
  const { modulo_id, professor_id, titulo, descricao, tipo_horas, data_inicio, data_fim, duracao, horas, nota_minima_horas, gera_horas } = req.body;
  if (!modulo_id || !titulo) return res.status(400).json({ erro: 'Dados incompletos' });

  // Verifica saldo de horas da turma no semestre
  if (gera_horas && horas > 0) {
    const { data: modData } = await sb(`/modulos?id=eq.${modulo_id}&select=turma_id`);
    if (modData && modData[0]) {
      const { data: tsData } = await sb(`/turma_semestre?turma_id=eq.${modData[0].turma_id}&select=*`);
      if (tsData && tsData[0]) {
        const saldo = tsData[0].horas_disponiveis - tsData[0].horas_utilizadas;
        if (horas > saldo) return res.status(400).json({ erro: `Saldo insuficiente. Disponível: ${saldo}h` });
        // Atualiza horas utilizadas
        await sb(`/turma_semestre?id=eq.${tsData[0].id}`, {
          method: 'PATCH',
          body: JSON.stringify({ horas_utilizadas: tsData[0].horas_utilizadas + horas }),
        });
      }
    }
  }

  const { data } = await sb('/atividades', {
    method: 'POST',
    body: JSON.stringify({ modulo_id, professor_id, titulo, descricao, tipo_horas: tipo_horas || 'academica', data_inicio, data_fim, duracao: duracao || 300, horas: horas || 0, nota_minima_horas: nota_minima_horas || 6, gera_horas: gera_horas || 0 }),
  });
  res.status(201).json(Array.isArray(data) ? data[0] : data);
});

// ── QUESTÕES ──────────────────────────────────────────────────────────────────

app.get('/api/questoes', async (req, res) => {
  const { atividade_id } = req.query;
  if (!atividade_id) return res.status(400).json({ erro: 'atividade_id obrigatório' });
  const { data } = await sb(`/questoes?atividade_id=eq.${atividade_id}&select=*`);
  const parsed = (data || []).map(q => ({ ...q, alternativas: typeof q.alternativas === 'string' ? JSON.parse(q.alternativas) : q.alternativas }));
  res.json(parsed);
});

app.post('/api/questoes', async (req, res) => {
  const { atividade_id, enunciado, alternativas, resposta_correta } = req.body;
  if (!atividade_id || !enunciado || !alternativas) return res.status(400).json({ erro: 'Dados incompletos' });
  const { data } = await sb('/questoes', {
    method: 'POST',
    body: JSON.stringify({ atividade_id, enunciado, alternativas: JSON.stringify(alternativas), resposta_correta }),
  });
  res.status(201).json(Array.isArray(data) ? data[0] : data);
});

// ── TENTATIVAS ────────────────────────────────────────────────────────────────

app.get('/api/tentativas', async (req, res) => {
  const { aluno_id } = req.query;
  if (!aluno_id) return res.status(400).json({ erro: 'aluno_id obrigatório' });
  const { data } = await sb(`/tentativas?aluno_id=eq.${aluno_id}&order=created_at.desc&select=*`);
  res.json(data || []);
});

app.post('/api/tentativas', async (req, res) => {
  const { aluno_id, atividade_id, respostas, nota } = req.body;
  if (!aluno_id || !atividade_id || respostas === undefined || nota === undefined)
    return res.status(400).json({ erro: 'Dados incompletos' });

  const { data: tentData } = await sb('/tentativas', {
    method: 'POST',
    body: JSON.stringify({ aluno_id, atividade_id, respostas: JSON.stringify(respostas), nota }),
  });

  // Verifica certificado
  const { data: ativData } = await sb(`/atividades?id=eq.${atividade_id}&select=*`);
  let certificado = null;
  if (ativData && ativData[0]) {
    const ativ = ativData[0];
    const notaMinima = ativ.gera_horas ? ativ.nota_minima_horas : 6;
    if (nota >= notaMinima) {
      const { data: modData } = await sb(`/modulos?id=eq.${ativ.modulo_id}&select=*`);
      if (modData && modData[0]) {
        await sb('/certificados', {
          method: 'POST',
          body: JSON.stringify({ aluno_id, modulo_id: modData[0].id }),
          headers: { 'Prefer': 'return=representation,resolution=ignore-duplicates' },
        });
        const { data: certData } = await sb(`/certificados?aluno_id=eq.${aluno_id}&modulo_id=eq.${modData[0].id}&select=*`);
        certificado = certData && certData[0] ? { ...certData[0], horas: ativ.horas, modulo_titulo: modData[0].titulo } : null;
      }
    }
  }

  res.status(201).json({
    tentativa: Array.isArray(tentData) ? tentData[0] : tentData,
    certificado
  });
});

// ── CERTIFICADOS ──────────────────────────────────────────────────────────────

app.get('/api/certificados', async (req, res) => {
  const { aluno_id } = req.query;
  if (!aluno_id) return res.status(400).json({ erro: 'aluno_id obrigatório' });
  const { data } = await sb(`/certificados?aluno_id=eq.${aluno_id}&select=*,modulos!modulo_id(titulo,horas_maximas)`);
  const mapped = (data || []).map(c => ({ ...c, modulo_titulo: c.modulos?.titulo, horas: c.modulos?.horas_maximas }));
  res.json(mapped);
});

// ── SEMESTRES ─────────────────────────────────────────────────────────────────

app.get('/api/semestres', async (req, res) => {
  const { data } = await sb('/semestres?select=*&order=id.desc');
  res.json(data || []);
});

app.post('/api/semestres', async (req, res) => {
  const { nome, data_inicio, data_fim } = req.body;
  if (!nome || !data_inicio || !data_fim) return res.status(400).json({ erro: 'Dados incompletos' });
  // Desativa semestres anteriores
  await sb('/semestres?ativo=eq.1', { method: 'PATCH', body: JSON.stringify({ ativo: 0 }) });
  const { data } = await sb('/semestres', {
    method: 'POST',
    body: JSON.stringify({ nome, data_inicio, data_fim, ativo: 1 }),
  });
  res.status(201).json(Array.isArray(data) ? data[0] : data);
});

// ── TURMA SEMESTRE (saldo de horas) ──────────────────────────────────────────

app.get('/api/turma-semestre', async (req, res) => {
  const { turma_id } = req.query;
  if (!turma_id) return res.status(400).json({ erro: 'turma_id obrigatório' });
  const { data } = await sb(`/turma_semestre?turma_id=eq.${turma_id}&select=*,semestres!semestre_id(nome,ativo)`);
  res.json(data || []);
});

// ── STATS ─────────────────────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  const [alunos, professores, turmas, modulos, atividades, tentativas] = await Promise.all([
    sb('/profiles?role=eq.aluno&select=id'),
    sb('/profiles?role=eq.professor&select=id'),
    sb('/turmas?select=id'),
    sb('/modulos?select=id'),
    sb('/atividades?select=id'),
    sb('/tentativas?select=id'),
  ]);
  res.json({
    alunos: alunos.data?.length || 0,
    professores: professores.data?.length || 0,
    turmas: turmas.data?.length || 0,
    modulos: modulos.data?.length || 0,
    atividades: atividades.data?.length || 0,
    tentativas: tentativas.data?.length || 0,
  });
});

// ── START ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ Know-How API rodando em http://localhost:${PORT}`);
  console.log(`☁️  Banco: Supabase (PostgreSQL na nuvem)`);
});