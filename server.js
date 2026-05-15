const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const SUPABASE_URL = 'https://qwggvbiirxcjucuurwfw.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3Z2d2YmlpcnhjanVjdXVyd2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MjczNDksImV4cCI6MjA5NDIwMzM0OX0.0N4xpnPcBFSrDN4kzb8uag_Sdvr8D-WcGxpnauQtHMo';

app.use(cors());
app.use(express.json());

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

function senhaPadrao(ra) {
  return `${ra}${new Date().getFullYear()}*`;
}

// ── AUTH ──────────────────────────────────────────────────────────────────────

app.post('/api/login', async (req, res) => {
  const { login, senha } = req.body;
  if (!login || !senha) return res.status(400).json({ erro: 'Login e senha obrigatórios' });

  // Detecta se é email (admin/super admin) ou RA (professor/aluno)
  const isEmail = login.includes('@');
  const campo = isEmail ? 'email' : 'ra';
  const { data } = await sb(`/profiles?${campo}=eq.${encodeURIComponent(login)}&senha=eq.${encodeURIComponent(senha)}&select=*`);
  if (!data || data.length === 0) return res.status(401).json({ erro: 'Login ou senha incorretos' });
  res.json({ usuario: data[0] });
});

app.put('/api/trocar-senha', async (req, res) => {
  const { id, senhaAtual, novaSenha } = req.body;
  if (!id || !novaSenha) return res.status(400).json({ erro: 'Dados incompletos' });

  // Se senhaAtual informada, valida antes de trocar
  if (senhaAtual) {
    const { data } = await sb(`/profiles?id=eq.${id}&senha=eq.${encodeURIComponent(senhaAtual)}&select=id`);
    if (!data || data.length === 0) return res.status(401).json({ erro: 'Senha atual incorreta' });
  }

  const { data } = await sb(`/profiles?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ senha: novaSenha, primeiro_acesso: 0 }),
  });
  if (!data || data.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
  res.json(data[0]);
});

// ── PROFILES ──────────────────────────────────────────────────────────────────

app.get('/api/profiles', async (req, res) => {
  const { role, curso_id } = req.query;
  let filter = '?select=*';
  if (role) filter += `&role=eq.${role}`;
  if (curso_id) filter += `&curso_id=eq.${curso_id}`;
  const { data } = await sb(`/profiles${filter}`);
  res.json(data || []);
});

app.get('/api/profiles/:id', async (req, res) => {
  const { data } = await sb(`/profiles?id=eq.${req.params.id}&select=*`);
  if (!data || data.length === 0) return res.status(404).json({ erro: 'Não encontrado' });
  res.json(data[0]);
});

// Super Admin cria Admin de curso
app.post('/api/profiles/admin', async (req, res) => {
  const { nome, email, senha, curso_id } = req.body;
  if (!nome || !email || !senha || !curso_id) return res.status(400).json({ erro: 'Dados incompletos' });
  const { data, status } = await sb('/profiles', {
    method: 'POST',
    body: JSON.stringify({ nome, email, senha, role: 'admin', curso_id, instituicao_id: 1, primeiro_acesso: 0, is_super_admin: 0 }),
  });
  if (status >= 400) return res.status(400).json({ erro: 'Email já cadastrado' });
  res.status(201).json(Array.isArray(data) ? data[0] : data);
});

// Admin de curso cria Professor
app.post('/api/profiles/professor', async (req, res) => {
  const { nome, email, ra, curso_id, instituicao_id } = req.body;
  if (!nome || !email || !ra) return res.status(400).json({ erro: 'Dados incompletos' });
  const senha = senhaPadrao(ra);
  const { data, status } = await sb('/profiles', {
    method: 'POST',
    body: JSON.stringify({ nome, email, ra, senha, role: 'professor', curso_id: curso_id || null, instituicao_id: instituicao_id || 1, primeiro_acesso: 1 }),
  });
  if (status >= 400) return res.status(400).json({ erro: 'RA ou email já cadastrado' });
  res.status(201).json({ ...(Array.isArray(data) ? data[0] : data), senha_padrao: senha });
});

// Professor cria Aluno
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
  await sb('/matriculas', { method: 'POST', body: JSON.stringify({ aluno_id: aluno.id, turma_id, ativo: 1 }) });
  res.status(201).json({ ...aluno, senha_padrao: senha });
});

// ── CURSOS ────────────────────────────────────────────────────────────────────

app.get('/api/cursos', async (req, res) => {
  const { data } = await sb('/cursos?select=*&order=nome.asc');
  res.json(data || []);
});

app.post('/api/cursos', async (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
  const { data } = await sb('/cursos', { method: 'POST', body: JSON.stringify({ nome, descricao }) });
  res.status(201).json(Array.isArray(data) ? data[0] : data);
});

// ── TURMAS ────────────────────────────────────────────────────────────────────

app.get('/api/turmas', async (req, res) => {
  const { professor_id, curso_id } = req.query;
  let filter = '?select=*';
  if (professor_id) filter += `&professor_id=eq.${professor_id}`;
  if (curso_id) {
    // Turmas dos professores desse curso
    const { data: profs } = await sb(`/profiles?role=eq.professor&curso_id=eq.${curso_id}&select=id`);
    if (!profs || profs.length === 0) return res.json([]);
    const ids = profs.map(p => p.id).join(',');
    const { data } = await sb(`/turmas?professor_id=in.(${ids})&select=*`);
    return res.json(data || []);
  }
  const { data } = await sb(`/turmas${filter}`);
  res.json(data || []);
});

app.post('/api/turmas', async (req, res) => {
  const { nome, professor_id, instituicao_id, semestre_id } = req.body;
  if (!nome || !professor_id) return res.status(400).json({ erro: 'Dados incompletos' });
  const { data } = await sb('/turmas', { method: 'POST', body: JSON.stringify({ nome, professor_id, instituicao_id: instituicao_id || 1 }) });
  const turma = Array.isArray(data) ? data[0] : data;
  if (semestre_id) {
    await sb('/turma_semestre', { method: 'POST', body: JSON.stringify({ turma_id: turma.id, semestre_id, horas_disponiveis: 5, horas_utilizadas: 0 }) });
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
  const { status } = await sb('/matriculas', { method: 'POST', body: JSON.stringify({ aluno_id: aluno.id, turma_id, ativo: 1 }) });
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
  const { data } = await sb('/modulos', { method: 'POST', body: JSON.stringify({ titulo, descricao, professor_id, turma_id, nota_minima: nota_minima || 7, gera_horas: gera_horas || 1, horas_maximas: horas_maximas || 4, data_inicio, data_fim, cor: cor || '#2563EB' }) });
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

  if (gera_horas && horas > 0) {
    const { data: modData } = await sb(`/modulos?id=eq.${modulo_id}&select=turma_id`);
    if (modData && modData[0]) {
      const { data: tsData } = await sb(`/turma_semestre?turma_id=eq.${modData[0].turma_id}&select=*`);
      if (tsData && tsData[0]) {
        const saldo = tsData[0].horas_disponiveis - tsData[0].horas_utilizadas;
        if (horas > saldo) return res.status(400).json({ erro: `Saldo insuficiente. Disponível: ${saldo}h` });
        await sb(`/turma_semestre?id=eq.${tsData[0].id}`, { method: 'PATCH', body: JSON.stringify({ horas_utilizadas: tsData[0].horas_utilizadas + horas }) });
      }
    }
  }

  const { data } = await sb('/atividades', { method: 'POST', body: JSON.stringify({ modulo_id, professor_id, titulo, descricao, tipo_horas: tipo_horas || 'academica', data_inicio, data_fim, duracao: duracao || 300, horas: horas || 0, nota_minima_horas: nota_minima_horas || 6, gera_horas: gera_horas || 0 }) });
  res.status(201).json(Array.isArray(data) ? data[0] : data);
});

// ── ATIVIDADE POR ID ─────────────────────────────────────────────────────────

app.get('/api/atividades-by-id/:id', async (req, res) => {
  const { data } = await sb(`/atividades?id=eq.${req.params.id}&select=*`);
  res.json(data && data[0] ? data[0] : null);
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
  const { data } = await sb('/questoes', { method: 'POST', body: JSON.stringify({ atividade_id, enunciado, alternativas: JSON.stringify(alternativas), resposta_correta }) });
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

  const { data: tentData } = await sb('/tentativas', { method: 'POST', body: JSON.stringify({ aluno_id, atividade_id, respostas: JSON.stringify(respostas), nota }) });

  const { data: ativData } = await sb(`/atividades?id=eq.${atividade_id}&select=*`);
  let certificado = null;
  if (ativData && ativData[0]) {
    const ativ = ativData[0];
    const notaMinima = ativ.gera_horas ? ativ.nota_minima_horas : 6;
    if (nota >= notaMinima) {
      const { data: modData } = await sb(`/modulos?id=eq.${ativ.modulo_id}&select=*`);
      if (modData && modData[0]) {
        await sb('/certificados', { method: 'POST', body: JSON.stringify({ aluno_id, modulo_id: modData[0].id }), headers: { 'Prefer': 'return=representation,resolution=ignore-duplicates' } });
        const { data: certData } = await sb(`/certificados?aluno_id=eq.${aluno_id}&modulo_id=eq.${modData[0].id}&select=*`);
        certificado = certData && certData[0] ? { ...certData[0], horas: ativ.horas, modulo_titulo: modData[0].titulo } : null;
      }
    }
  }

  res.status(201).json({ tentativa: Array.isArray(tentData) ? tentData[0] : tentData, certificado });
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
  await sb('/semestres?ativo=eq.1', { method: 'PATCH', body: JSON.stringify({ ativo: 0 }) });
  const { data } = await sb('/semestres', { method: 'POST', body: JSON.stringify({ nome, data_inicio, data_fim, ativo: 1 }) });
  res.status(201).json(Array.isArray(data) ? data[0] : data);
});

// ── TURMA SEMESTRE ────────────────────────────────────────────────────────────

app.get('/api/turma-semestre', async (req, res) => {
  const { turma_id } = req.query;
  if (!turma_id) return res.status(400).json({ erro: 'turma_id obrigatório' });
  const { data } = await sb(`/turma_semestre?turma_id=eq.${turma_id}&select=*,semestres!semestre_id(nome,ativo)`);
  res.json(data || []);
});

// ── STATS ─────────────────────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  const { curso_id } = req.query;
  if (curso_id) {
    // Stats filtradas por curso
    const { data: profs } = await sb(`/profiles?role=eq.professor&curso_id=eq.${curso_id}&select=id`);
    const profIds = (profs || []).map(p => p.id);
    const turmasCount = profIds.length > 0 ? (await sb(`/turmas?professor_id=in.(${profIds.join(',')})&select=id`)).data?.length || 0 : 0;
    return res.json({
      professores: profIds.length,
      turmas: turmasCount,
      alunos: 0,
    });
  }
  const [alunos, professores, admins, turmas, modulos, atividades, tentativas] = await Promise.all([
    sb('/profiles?role=eq.aluno&select=id'),
    sb('/profiles?role=eq.professor&select=id'),
    sb('/profiles?role=eq.admin&select=id'),
    sb('/turmas?select=id'),
    sb('/modulos?select=id'),
    sb('/atividades?select=id'),
    sb('/tentativas?select=id'),
  ]);
  res.json({
    alunos: alunos.data?.length || 0,
    professores: professores.data?.length || 0,
    admins: admins.data?.length || 0,
    turmas: turmas.data?.length || 0,
    modulos: modulos.data?.length || 0,
    atividades: atividades.data?.length || 0,
    tentativas: tentativas.data?.length || 0,
  });
});

// ── RELATÓRIOS ────────────────────────────────────────────────────────────────

app.get('/api/relatorios/turma/:turma_id', async (req, res) => {
  const { turma_id } = req.params;

  // Alunos da turma
  const { data: mats } = await sb(`/matriculas?turma_id=eq.${turma_id}&select=*,profiles!aluno_id(id,nome,ra)`);
  const alunos = (mats || []).map(m => ({ id: m.profiles?.id, nome: m.profiles?.nome, ra: m.profiles?.ra }));

  // Módulos e atividades da turma
  const { data: modulos } = await sb(`/modulos?turma_id=eq.${turma_id}&select=*`);
  const modIds = (modulos || []).map(m => m.id);
  let atividades = [];
  if (modIds.length > 0) {
    const { data: ativs } = await sb(`/atividades?modulo_id=in.(${modIds.join(',')})&select=*`);
    atividades = ativs || [];
  }

  // Tentativas de todos os alunos da turma
  const alunoIds = alunos.map(a => a.id);
  let tentativas = [];
  if (alunoIds.length > 0) {
    const { data: tents } = await sb(`/tentativas?aluno_id=in.(${alunoIds.join(',')})&select=*`);
    tentativas = tents || [];
  }

  // Stats por aluno
  const statsPorAluno = alunos.map(aluno => {
    const tentsAluno = tentativas.filter(t => t.aluno_id === aluno.id);
    const notas = tentsAluno.map(t => t.nota);
    const media = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : null;
    const aprovadas = tentsAluno.filter(t => t.nota >= 6).length;
    const horas = aprovadas * 2;
    return { ...aluno, totalAtividades: tentsAluno.length, media, aprovadas, horas };
  });

  // Stats por atividade
  const statsPorAtividade = atividades.map(ativ => {
    const tentsAtiv = tentativas.filter(t => t.atividade_id === ativ.id);
    const notas = tentsAtiv.map(t => t.nota);
    const media = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : null;
    const aprovados = tentsAtiv.filter(t => t.nota >= 6).length;
    const taxa = tentsAtiv.length ? Math.round((aprovados / tentsAtiv.length) * 100) : 0;
    return { ...ativ, totalRespostas: tentsAtiv.length, media, aprovados, taxa };
  });

  res.json({ alunos: statsPorAluno, atividades: statsPorAtividade, tentativas });
});

// ── SUPER ADMIN — STATS COMPLETO ─────────────────────────────────────────────

app.get('/api/stats-superadmin', async (req, res) => {
  const [alunos, professores, admins, turmas, atividades, certs] = await Promise.all([
    sb('/profiles?role=eq.aluno&select=id'),
    sb('/profiles?role=eq.professor&select=id'),
    sb('/profiles?role=eq.admin&select=id'),
    sb('/turmas?select=id'),
    sb('/atividades?select=id'),
    sb('/certificados?select=horas'),
  ]);
  const horas = (certs.data || []).reduce((s, c) => s + (parseFloat(c.horas) || 0), 0);
  res.json({
    alunos: alunos.data?.length || 0,
    professores: professores.data?.length || 0,
    admins: admins.data?.length || 0,
    turmas: turmas.data?.length || 0,
    atividades: atividades.data?.length || 0,
    horas: horas.toFixed(1),
  });
});

// ── SUPER ADMIN — DETALHE POR TIPO ───────────────────────────────────────────

app.get('/api/superadmin/detalhe/:tipo', async (req, res) => {
  const { tipo } = req.params;

  if (tipo === 'admins') {
    const { data: admins } = await sb('/profiles?role=eq.admin&is_super_admin=eq.0&select=*');
    const { data: cursos } = await sb('/cursos?select=*');
    const result = (admins || []).map(a => ({
      nome: a.nome, email: a.email,
      curso: (cursos || []).find(c => c.id === a.curso_id)?.nome || null
    }));
    return res.json(result);
  }

  if (tipo === 'professores') {
    const { data: profs } = await sb('/profiles?role=eq.professor&select=*');
    const { data: cursos } = await sb('/cursos?select=*');
    const { data: turmas } = await sb('/turmas?select=*');
    const result = await Promise.all((profs || []).map(async p => {
      const turmasProf = (turmas || []).filter(t => t.professor_id === p.id).map(t => t.nome);
      return { nome: p.nome, curso: (cursos || []).find(c => c.id === p.curso_id)?.nome || null, turmas: turmasProf };
    }));
    return res.json(result);
  }

  if (tipo === 'alunos') {
    const { data: alunos } = await sb('/profiles?role=eq.aluno&select=*');
    const { data: mats } = await sb('/matriculas?select=*');
    const { data: modulos } = await sb('/modulos?select=*');
    const result = (alunos || []).map(a => {
      const turmaIds = (mats || []).filter(m => m.aluno_id === a.id).map(m => m.turma_id);
      const modsAluno = (modulos || []).filter(m => turmaIds.includes(m.turma_id)).map(m => m.titulo);
      return { nome: a.nome, ra: a.ra, modulos: modsAluno };
    });
    return res.json(result);
  }

  if (tipo === 'turmas') {
    const { data: turmas } = await sb('/turmas?select=*');
    const { data: profs } = await sb('/profiles?role=eq.professor&select=id,nome');
    const { data: mats } = await sb('/matriculas?select=turma_id');
    const result = (turmas || []).map(t => ({
      nome: t.nome,
      professor: (profs || []).find(p => p.id === t.professor_id)?.nome || '—',
      alunos: (mats || []).filter(m => m.turma_id === t.id).length
    }));
    return res.json(result);
  }

  if (tipo === 'atividades') {
    const { data: ativs } = await sb('/atividades?select=*');
    const { data: mods } = await sb('/modulos?select=*');
    const { data: profs } = await sb('/profiles?role=eq.professor&select=id,nome');
    const result = (ativs || []).map(a => {
      const mod = (mods || []).find(m => m.id === a.modulo_id);
      return {
        titulo: a.titulo,
        modulo: mod?.titulo || '—',
        professor: (profs || []).find(p => p.id === mod?.professor_id)?.nome || '—'
      };
    });
    return res.json(result);
  }

  if (tipo === 'horas') {
    const { data: certs } = await sb('/certificados?select=*');
    const { data: alunos } = await sb('/profiles?role=eq.aluno&select=id,nome,ra');
    const { data: mats } = await sb('/matriculas?select=*');
    const { data: turmas } = await sb('/turmas?select=id,nome');
    const result = (alunos || []).map(a => {
      const horas = (certs || []).filter(c => c.aluno_id === a.id).reduce((s, c) => s + (parseFloat(c.horas) || 0), 0);
      const turmaId = (mats || []).find(m => m.aluno_id === a.id)?.turma_id;
      const turma = (turmas || []).find(t => t.id === turmaId)?.nome || '—';
      return { nome: a.nome, ra: a.ra, turma, horas: horas.toFixed(1) };
    }).filter(a => parseFloat(a.horas) > 0).sort((a, b) => parseFloat(b.horas) - parseFloat(a.horas));
    return res.json(result);
  }

  res.json([]);
});

// ── SUPER ADMIN — LOGS ────────────────────────────────────────────────────────

app.get('/api/superadmin/logs', async (req, res) => {
  const [profs, alunos, tentativas, certs] = await Promise.all([
    sb('/profiles?role=eq.professor&select=nome,created_at&order=created_at.desc&limit=5'),
    sb('/profiles?role=eq.aluno&select=nome,created_at&order=created_at.desc&limit=5'),
    sb('/tentativas?select=aluno_id,nota,created_at&order=created_at.desc&limit=5'),
    sb('/certificados?select=aluno_id,horas,emitido_em&order=emitido_em.desc&limit=5'),
  ]);
  const { data: alunosMap } = await sb('/profiles?role=eq.aluno&select=id,nome');
  const getAluno = (id) => (alunosMap || []).find(a => a.id === id)?.nome || 'Aluno';

  const logs = [
    ...(profs.data || []).map(p => ({ icone: "👨‍🏫", descricao: `Professor ${p.nome} foi cadastrado`, data: p.created_at })),
    ...(alunos.data || []).map(a => ({ icone: "👤", descricao: `Aluno ${a.nome} foi cadastrado`, data: a.created_at })),
    ...(tentativas.data || []).map(t => ({ icone: "📝", descricao: `${getAluno(t.aluno_id)} realizou uma atividade com nota ${t.nota}`, data: t.created_at })),
    ...(certs.data || []).map(c => ({ icone: "🎓", descricao: `${getAluno(c.aluno_id)} recebeu certificado de ${c.horas}h`, data: c.emitido_em })),
  ].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 20);

  res.json(logs);
});

// ── SUPER ADMIN — ENGAJAMENTO ─────────────────────────────────────────────────

app.get('/api/superadmin/engajamento', async (req, res) => {
  const [alunos, tentativas, modulos, atividades, profs] = await Promise.all([
    sb('/profiles?role=eq.aluno&select=id'),
    sb('/tentativas?select=aluno_id,atividade_id'),
    sb('/modulos?select=id,titulo'),
    sb('/atividades?select=id,modulo_id,professor_id'),
    sb('/profiles?role=eq.professor&select=id,nome,curso_id'),
  ]);
  const { data: cursos } = await sb('/cursos?select=id,nome');

  const totalAlunos = (alunos.data || []).length;
  const alunosAtivos = new Set((tentativas.data || []).map(t => t.aluno_id)).size;

  // Módulos mais acessados
  const contagemMods = {};
  (tentativas.data || []).forEach(t => {
    const ativ = (atividades.data || []).find(a => a.id === t.atividade_id);
    if (ativ) contagemMods[ativ.modulo_id] = (contagemMods[ativ.modulo_id] || 0) + 1;
  });
  const modulosMaisAcessados = Object.entries(contagemMods)
    .map(([id, acessos]) => ({ titulo: (modulos.data || []).find(m => m.id === parseInt(id))?.titulo || '—', acessos }))
    .sort((a, b) => b.acessos - a.acessos).slice(0, 5);

  // Professores mais ativos
  const contagemProfs = {};
  (atividades.data || []).forEach(a => {
    if (a.professor_id) contagemProfs[a.professor_id] = (contagemProfs[a.professor_id] || 0) + 1;
  });
  const professoresMaisAtivos = Object.entries(contagemProfs)
    .map(([id, ativs]) => {
      const prof = (profs.data || []).find(p => p.id === parseInt(id));
      const curso = (cursos || []).find(c => c.id === prof?.curso_id)?.nome || '—';
      return { nome: prof?.nome || '—', curso, atividades: ativs };
    })
    .sort((a, b) => b.atividades - a.atividades).slice(0, 3);

  res.json({ totalAlunos, alunosAtivos, modulosMaisAcessados, professoresMaisAtivos });
});

// ── RELATÓRIO POR CURSO (Admin) ──────────────────────────────────────────────

app.get('/api/relatorios/curso', async (req, res) => {
  const { curso_id } = req.query;

  // Professores do curso
  const filter = curso_id ? `?role=eq.professor&curso_id=eq.${curso_id}&select=id` : '?role=eq.professor&select=id';
  const { data: profs } = await sb(`/profiles${filter}`);
  const profIds = (profs || []).map(p => p.id);

  if (profIds.length === 0) return res.json({ turmas: [], alunosHoras: [] });

  // Turmas dos professores
  const { data: turmas } = await sb(`/turmas?professor_id=in.(${profIds.join(',')})&select=*`);
  const turmasArr = turmas || [];
  if (turmasArr.length === 0) return res.json({ turmas: [], alunosHoras: [] });

  const turmaIds = turmasArr.map(t => t.id);

  // Alunos de todas as turmas
  const { data: mats } = await sb(`/matriculas?turma_id=in.(${turmaIds.join(',')})&select=*,profiles!aluno_id(id,nome,ra)`);
  const matriculas = mats || [];

  // Módulos e atividades
  const { data: modulos } = await sb(`/modulos?turma_id=in.(${turmaIds.join(',')})&select=*`);
  const modIds = (modulos || []).map(m => m.id);
  let atividades = [];
  if (modIds.length > 0) {
    const { data: ativs } = await sb(`/atividades?modulo_id=in.(${modIds.join(',')})&select=*`);
    atividades = ativs || [];
  }

  // Tentativas de todos
  const alunoIds = [...new Set(matriculas.map(m => m.profiles?.id).filter(Boolean))];
  let tentativas = [];
  if (alunoIds.length > 0) {
    const { data: tents } = await sb(`/tentativas?aluno_id=in.(${alunoIds.join(',')})&select=*`);
    tentativas = tents || [];
  }

  // Certificados de todos
  let certificados = [];
  if (alunoIds.length > 0) {
    const { data: certs } = await sb(`/certificados?aluno_id=in.(${alunoIds.join(',')})&select=*`);
    certificados = certs || [];
  }

  // Stats por turma
  const statsPorTurma = turmasArr.map(turma => {
    const matsT = matriculas.filter(m => m.turma_id === turma.id);
    const alunosT = matsT.map(m => m.profiles?.id).filter(Boolean);
    const tentsT = tentativas.filter(t => alunoIds.includes(t.aluno_id) && alunosT.includes(t.aluno_id));
    const notas = tentsT.map(t => t.nota);
    const mediaGeral = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : null;
    const aprovados = [...new Set(tentsT.filter(t => t.nota >= 6).map(t => t.aluno_id))].length;
    return {
      id: turma.id,
      nome: turma.nome,
      totalAlunos: matsT.length,
      totalAtividades: tentsT.length,
      mediaGeral,
      aprovados,
    };
  });

  // Relatório de horas por aluno
  const alunosHoras = matriculas.map(m => {
    const aluno = m.profiles;
    if (!aluno) return null;
    const turma = turmasArr.find(t => t.id === m.turma_id);
    const certs = certificados.filter(c => c.aluno_id === aluno.id);
    const horas = certs.reduce((s, c) => s + (parseFloat(c.horas) || 0), 0);
    return { id: aluno.id, nome: aluno.nome, ra: aluno.ra, turma: turma?.nome || '—', horas };
  }).filter(Boolean).filter(a => a.horas > 0);

  res.json({ turmas: statsPorTurma, alunosHoras });
});

// ── N8N — GERAR QUESTÕES COM IA ───────────────────────────────────────────────

app.post('/api/gerar-questoes', async (req, res) => {
  const { texto, numQuestoes, tema, modulo_id, atividade_id, professor_id } = req.body;
  
  if (!texto || !modulo_id) return res.status(400).json({ erro: 'Dados incompletos' });

  try {
    const response = await fetch('https://muriloterra19.app.n8n.cloud/webhook/gerar-questoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, numQuestoes: numQuestoes || 5, tema, modulo_id, atividade_id, professor_id })
    });

    const data = await response.json();

    if (!data.sucesso) return res.status(500).json({ erro: data.erro || 'Erro ao gerar questões' });

    // Salva as questões no Supabase como pendentes (resposta_correta = -1 indica pendente de curadoria)
    const questoesSalvas = [];
    for (const q of data.questoes) {
      const { data: questao } = await sb(`/questoes`, {
        method: 'POST',
        body: JSON.stringify({
          atividade_id,
          enunciado: q.enunciado,
          alternativas: JSON.stringify(q.alternativas),
          resposta_correta: q.resposta_correta,
          status: 'pendente'
        }),
      });
      questoesSalvas.push(Array.isArray(questao) ? questao[0] : questao);
    }

    res.json({ sucesso: true, questoes: questoesSalvas, total: questoesSalvas.length });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao conectar com o gerador de IA: ' + error.message });
  }
});
// ── START ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ Know-How API rodando em http://localhost:${PORT}`);
  console.log(`☁️  Banco: Supabase (PostgreSQL na nuvem)`);
});