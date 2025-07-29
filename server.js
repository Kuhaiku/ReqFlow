// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const initialTemplatesData = require('./templates');

const app = express();
app.use(express.json());
const PORT = 3000;

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
const protect = (req, res, next) => {
    const bearer = req.headers.authorization;
    if (!bearer || !bearer.startsWith('Bearer ')) return res.status(401).json({ message: 'Acesso não autorizado' });
    const token = bearer.split(' ')[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (e) {
        return res.status(401).json({ message: 'Token inválido ou expirado' });
    }
};

// --- ROTAS PÚBLICAS: AUTENTICAÇÃO ---
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        await db.User.create({ username, password: hashedPassword });
        res.status(201).json({ message: 'Usuário criado com sucesso!' });
    } catch (e) {
        res.status(500).json({ message: 'Erro ao registrar usuário.' });
    }
});
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.User.findOne({ where: { username } });
    if (!user) return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: user.username });
});

// --- ROTAS PROTEGIDAS: PROJETOS ---
app.get('/api/projects', protect, async (req, res) => {
    const projects = await db.Projeto.findAll({ where: { userId: req.user.id }, order: [['updatedAt', 'DESC']] });
    res.json(projects);
});
app.post('/api/projects', protect, async (req, res) => {
    const { nome, descricao, templateId } = req.body;
    const projeto = await db.Projeto.create({ nome, descricao, userId: req.user.id });
    if (templateId) {
        const requisitosDoTemplate = await db.TemplateRequisito.findAll({ where: { templateId } });
        if (requisitosDoTemplate.length > 0) {
            const novosRequisitos = requisitosDoTemplate.map(r => ({ ...r.get({ plain: true }), id: undefined, projetoId: projeto.id }));
            await db.Requisito.bulkCreate(novosRequisitos);
        }
    }
    res.status(201).json(projeto);
});
app.put('/api/projects/:id', protect, async (req, res) => {
    const project = await db.Projeto.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado.' });
    await project.update(req.body);
    res.json(project);
});
app.delete('/api/projects/:id', protect, async (req, res) => {
    const project = await db.Projeto.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado.' });
    await project.destroy();
    res.status(204).send();
});

// --- ROTAS PROTEGIDAS: REQUISITOS ---
app.get('/api/projects/:projectId/requirements', protect, async (req, res) => {
    const project = await db.Projeto.findOne({ where: { id: req.params.projectId, userId: req.user.id } });
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado.' });
    const requirements = await db.Requisito.findAll({ where: { projetoId: req.params.projectId } });
    res.json(requirements);
});
app.post('/api/projects/:projectId/requirements', protect, async (req, res) => {
    const project = await db.Projeto.findOne({ where: { id: req.params.projectId, userId: req.user.id } });
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado.' });
    const requirement = await db.Requisito.create({ ...req.body, projetoId: req.params.projectId });
    res.status(201).json(requirement);
});
app.put('/api/requirements/:id', protect, async (req, res) => {
    const requirement = await db.Requisito.findByPk(req.params.id, { include: db.Projeto });
    if (!requirement || requirement.Projeto.userId !== req.user.id) return res.status(404).json({ message: 'Acesso negado.' });
    await requirement.update(req.body);
    res.json(requirement);
});
app.patch('/api/requirements/:id/status', protect, async (req, res) => {
    const requirement = await db.Requisito.findByPk(req.params.id, { include: db.Projeto });
    if (!requirement || requirement.Projeto.userId !== req.user.id) return res.status(404).json({ message: 'Acesso negado.' });
    requirement.status = req.body.status;
    await requirement.save();
    res.json(requirement);
});
app.delete('/api/requirements/:id', protect, async (req, res) => {
    const requirement = await db.Requisito.findByPk(req.params.id, { include: db.Projeto });
    if (!requirement || requirement.Projeto.userId !== req.user.id) return res.status(404).json({ message: 'Acesso negado.' });
    await requirement.destroy();
    res.status(204).send();
});

// --- ROTAS PROTEGIDAS: TEMPLATES ---
app.get('/api/templates', protect, async (req, res) => {
    const templates = await db.Template.findAll({ order: [['nome', 'ASC']] });
    res.json(templates);
});
app.post('/api/templates/from-project', protect, async (req, res) => {
    const { projectId, templateName } = req.body;
    const project = await db.Projeto.findOne({ where: { id: projectId, userId: req.user.id } });
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado.' });
    const existingTemplate = await db.Template.findOne({ where: { nome: templateName } });
    if (existingTemplate) return res.status(409).json({ error: 'Um modelo com este nome já existe.' });
    const requisitos = await db.Requisito.findAll({ where: { projetoId: projectId } });
    if (requisitos.length === 0) return res.status(400).json({ error: 'Este projeto não tem requisitos.' });
    const novoTemplate = await db.Template.create({ nome: templateName, isNative: false });
    const reqsParaSalvar = requisitos.map(r => ({ titulo: r.titulo, descricao: r.descricao, tipo: r.tipo, prioridade: r.prioridade, templateId: novoTemplate.id }));
    await db.TemplateRequisito.bulkCreate(reqsParaSalvar);
    res.status(201).json(novoTemplate);
});
app.put('/api/templates/:id', protect, async (req, res) => {
    const template = await db.Template.findByPk(req.params.id);
    if (!template) return res.status(404).json({ error: 'Modelo não encontrado.' });
    if (template.isNative) return res.status(403).json({ error: 'Modelos nativos não podem ser editados.' });
    await template.update({ nome: req.body.nome });
    res.json(template);
});
app.delete('/api/templates/:id', protect, async (req, res) => {
    const template = await db.Template.findByPk(req.params.id);
    if (!template) return res.status(404).json({ error: 'Modelo não encontrado.' });
    if (template.isNative) return res.status(403).json({ error: 'Modelos nativos não podem ser excluídos.' });
    await template.destroy();
    res.status(204).send();
});

// --- SERVIR ARQUIVOS DO FRONTEND ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- INICIALIZAÇÃO E SEEDING ---
const start = async () => {
    await db.sync();
    const templateCount = await db.Template.count();
    if (templateCount === 0) {
        console.log('Populando banco com templates nativos...');
        for (const tName in initialTemplatesData) {
            const tData = initialTemplatesData[tName];
            const newTemplate = await db.Template.create({ nome: tData.nome, isNative: true });
            const reqs = tData.requisitos.map(r => ({ ...r, templateId: newTemplate.id }));
            await db.TemplateRequisito.bulkCreate(reqs);
        }
    }
    app.listen(PORT, () => console.log(`Servidor ReqFlow rodando na porta ${PORT}`));
};
start();