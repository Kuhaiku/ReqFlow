document.addEventListener('DOMContentLoaded', () => {
    // --- 1. ELEMENTOS DO DOM ---
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const appView = document.getElementById('app-view');
    const projectsView = document.getElementById('projects-view');
    const kanbanView = document.getElementById('kanban-view');
    const templatesView = document.getElementById('templates-view');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');
    const projectsList = document.getElementById('projects-list');
    const templatesList = document.getElementById('templates-list');
    const addProjectForm = document.getElementById('add-project-form');
    const board = document.getElementById('kanban-board');
    const addReqBtn = document.getElementById('add-req-btn');
    const backToProjectsBtn = document.getElementById('back-to-projects');
    const manageTemplatesBtn = document.getElementById('manage-templates-btn');
    const backFromTemplatesBtn = document.getElementById('back-to-projects-from-templates');
    const saveAsTemplateBtn = document.getElementById('save-as-template-btn');
    const addReqModal = document.getElementById('add-req-modal');
    const viewReqModal = document.getElementById('view-req-modal');
    const editProjectModal = document.getElementById('edit-project-modal');
    const saveTemplateModal = document.getElementById('save-template-modal');
    const editTemplateModal = document.getElementById('edit-template-modal');
    const reqForm = document.getElementById('add-req-form');
    const editProjectForm = document.getElementById('edit-project-form');
    const saveTemplateForm = document.getElementById('save-template-form');
    const editTemplateForm = document.getElementById('edit-template-form');

    const exportTxtBtn = document.getElementById('export-txt-btn'); // NOVO ELEMENTO


    // --- 2. VARIÁVEIS DE ESTADO ---
    let currentProjectId = null;
    let editingProjectId = null;
    let editingRequirementId = null;
    let editingTemplateId = null;
    const colunasStatus = ['A Levantar', 'Em Análise', 'Aprovado', 'Concluído'];
    const priorityOrder = { 'Crítica': 1, 'Alta': 2, 'Média': 3, 'Baixa': 4 };

    // --- 3. API HELPER ---
    const api = {
        getToken: () => localStorage.getItem('token'),
        setToken: (token) => localStorage.setItem('token', token),
        clearToken: () => localStorage.removeItem('token'),
        request: async (endpoint, method = 'GET', body = null) => {
            const headers = { 'Content-Type': 'application/json' };
            const token = api.getToken();
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const config = { method, headers };
            if (body) config.body = JSON.stringify(body);
            const response = await fetch(endpoint, config);
            if (response.status === 401) { handleLogout(); return null; }
            return response;
        }
    };

    // --- 4. GERENCIAMENTO DE TELAS ---
    const updateUI = () => {
        const token = api.getToken();
        if (token) {
            loginView.style.display = 'none';
            registerView.style.display = 'none';
            appView.style.display = 'block';
            showProjectsView();
            document.getElementById('username-display').textContent = localStorage.getItem('username');
        } else {
            loginView.style.display = 'block';
            registerView.style.display = 'none';
            appView.style.display = 'none';
        }
    };
    const showProjectsView = () => { projectsView.style.display = 'block'; kanbanView.style.display = 'none'; templatesView.style.display = 'none'; currentProjectId = null; loadProjects(); loadTemplatesDropdown(); };
    const showKanbanView = (projectId, projectName) => { projectsView.style.display = 'none'; kanbanView.style.display = 'block'; templatesView.style.display = 'none'; currentProjectId = projectId; document.getElementById('kanban-project-title').textContent = `Projeto: ${projectName}`; renderBoard(); };
    const showTemplatesView = () => { projectsView.style.display = 'none'; kanbanView.style.display = 'none'; templatesView.style.display = 'block'; loadTemplatesList(); };

    // --- 5. LÓGICA DE CADA TELA ---
    const loadTemplatesDropdown = async () => { try { const response = await api.request('/api/templates'); if (!response.ok) return; const templates = await response.json(); const select = document.getElementById('template'); select.options.length = 1; templates.forEach(t => select.add(new Option(t.nome, t.id))); } catch (e) { console.error(e); } };
    const loadProjects = async () => { try { const response = await api.request('/api/projects'); if (!response.ok) return; const projects = await response.json(); projectsList.innerHTML = ''; if (projects.length === 0) { projectsList.innerHTML = '<p>Nenhum projeto. Crie o primeiro!</p>'; } else { projects.forEach(p => { const li = document.createElement('li'); li.innerHTML = ` <div class="project-info"> <h3>${p.nome}</h3> <p>${p.descricao || ''}</p> </div> <div class="project-actions"> <button class="edit-project-btn" title="Editar">✏️</button> <button class="delete-project-btn" title="Excluir">🗑️</button> </div> `; li.querySelector('.project-info').addEventListener('click', () => showKanbanView(p.id, p.nome)); li.querySelector('.delete-project-btn').addEventListener('click', async e => { e.stopPropagation(); if (confirm(`Excluir o projeto "${p.nome}"?`)) { await api.request(`/api/projects/${p.id}`, 'DELETE'); loadProjects(); } }); li.querySelector('.edit-project-btn').addEventListener('click', e => { e.stopPropagation(); editingProjectId = p.id; document.getElementById('edit-project-nome').value = p.nome; document.getElementById('edit-project-descricao').value = p.descricao || ''; editProjectModal.style.display = 'block'; }); projectsList.appendChild(li); }); } } catch (e) { console.error(e); } };
    const renderBoard = () => { board.innerHTML = ''; colunasStatus.forEach(status => { const col = document.createElement('div'); col.className = 'kanban-column'; col.innerHTML = `<h2>${status}</h2><div class="kanban-cards" data-status="${status}"></div>`; board.appendChild(col); }); initializeSortable(); fetchAndRenderCards(); };
    const fetchAndRenderCards = async () => { if (!currentProjectId) return; const response = await api.request(`/api/projects/${currentProjectId}/requirements`); if (!response.ok) return; let reqs = await response.json(); reqs.sort((a,b) => priorityOrder[a.prioridade] - priorityOrder[b.prioridade]); document.querySelectorAll('.kanban-cards').forEach(c => c.innerHTML = ''); reqs.forEach(createAndAppendCard); };
    const createAndAppendCard = (req) => { const column = document.querySelector(`.kanban-cards[data-status="${req.status}"]`); if (!column) return; const card = document.createElement('div'); const classMapper = (text) => text.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-'); card.className = `kanban-card priority-${req.prioridade} tipo-${classMapper(req.tipo)} status-${classMapper(req.status)}`; card.dataset.id = req.id; card.innerHTML = ` <div class="card-title">${req.titulo}</div> <span class="card-tag tag-${classMapper(req.tipo)}">${req.tipo}</span> <div class="card-actions"> <button class="edit-btn" title="Editar">✏️</button> <button class="delete-btn" title="Excluir">🗑️</button> </div> `; column.appendChild(card); card.addEventListener('click', () => { document.getElementById('view-req-title').textContent = req.titulo; document.getElementById('view-req-description').textContent = req.descricao; document.getElementById('view-req-status').textContent = req.status; document.getElementById('view-req-priority').textContent = req.prioridade; document.getElementById('view-req-type').textContent = req.tipo; viewReqModal.style.display = 'block'; }); card.querySelector('.delete-btn').addEventListener('click', async e => { e.stopPropagation(); if (confirm(`Excluir o requisito "${req.titulo}"?`)) { await api.request(`/api/requirements/${req.id}`, 'DELETE'); fetchAndRenderCards(); } }); card.querySelector('.edit-btn').addEventListener('click', e => { e.stopPropagation(); editingRequirementId = req.id; addReqModal.querySelector('h2').textContent = 'Editar Requisito'; addReqModal.querySelector('button[type="submit"]').innerHTML = '💾 Atualizar'; document.getElementById('req-titulo').value = req.titulo; document.getElementById('req-descricao').value = req.descricao; document.getElementById('req-tipo').value = req.tipo; document.getElementById('req-prioridade').value = req.prioridade; addReqModal.style.display = 'block'; }); };
    const initializeSortable = () => { document.querySelectorAll('.kanban-cards').forEach(c => new Sortable(c, { group: 'kanban', animation: 150, onEnd: async e => { await api.request(`/api/requirements/${e.item.dataset.id}/status`, 'PATCH', { status: e.to.dataset.status }); fetchAndRenderCards(); } })); };
    const loadTemplatesList = async () => { const response = await api.request('/api/templates'); if (!response.ok) return; const templates = await response.json(); templatesList.innerHTML = ''; templates.forEach(t => { const li = document.createElement('li'); li.innerHTML = ` <div class="project-info"><h3>${t.nome}</h3></div> <div class="project-actions"> <button class="edit-template-btn" title="Editar">✏️</button> <button class="delete-template-btn" title="Excluir">🗑️</button> </div> `; const delBtn = li.querySelector('.delete-template-btn'); if (t.isNative) { delBtn.classList.add('disabled'); delBtn.title = 'Modelos nativos não podem ser excluídos'; } else { delBtn.addEventListener('click', async e => { e.stopPropagation(); if (confirm(`Excluir o modelo "${t.nome}"?`)) { await api.request(`/api/templates/${t.id}`, 'DELETE'); loadTemplatesList(); } }); } li.querySelector('.edit-template-btn').addEventListener('click', e => { e.stopPropagation(); if (t.isNative) { alert('Modelos nativos não podem ser editados.'); return; } editingTemplateId = t.id; document.getElementById('edit-template-name').value = t.nome; editTemplateModal.style.display = 'block'; }); templatesList.appendChild(li); }); };

    // --- 6. EVENT LISTENERS ---
    loginForm.addEventListener('submit', async e => { e.preventDefault(); const username = document.getElementById('login-username').value; const password = document.getElementById('login-password').value; const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); if (response.ok) { const data = await response.json(); api.setToken(data.token); localStorage.setItem('username', data.username); updateUI(); } else { alert('Falha no login.'); } });
    registerForm.addEventListener('submit', async e => { e.preventDefault(); const username = document.getElementById('register-username').value; const password = document.getElementById('register-password').value; const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); if (response.ok) { alert('Usuário registrado!'); showLoginLink.click(); registerForm.reset(); } else { alert('Erro ao registrar.'); } });
    logoutBtn.addEventListener('click', () => { api.clearToken(); localStorage.removeItem('username'); updateUI(); });
    addProjectForm.addEventListener('submit', async e => { e.preventDefault(); const nome = document.getElementById('nome').value; const descricao = document.getElementById('descricao').value; const templateId = document.getElementById('template').value; await api.request('/api/projects', 'POST', { nome, descricao, templateId }); loadProjects(); addProjectForm.reset(); });
    editProjectForm.addEventListener('submit', async e => { e.preventDefault(); await api.request(`/api/projects/${editingProjectId}`, 'PUT', { nome: document.getElementById('edit-project-nome').value, descricao: document.getElementById('edit-project-descricao').value }); editProjectModal.style.display = 'none'; loadProjects(); });
    reqForm.addEventListener('submit', async e => { e.preventDefault(); const data = { titulo: document.getElementById('req-titulo').value, descricao: document.getElementById('req-descricao').value, tipo: document.getElementById('req-tipo').value, prioridade: document.getElementById('req-prioridade').value }; const url = editingRequirementId ? `/api/requirements/${editingRequirementId}` : `/api/projects/${currentProjectId}/requirements`; const method = editingRequirementId ? 'PUT' : 'POST'; await api.request(url, method, data); addReqModal.style.display = 'none'; fetchAndRenderCards(); });
    saveTemplateForm.addEventListener('submit', async e => { e.preventDefault(); const templateName = document.getElementById('template-name').value; const response = await api.request('/api/templates/from-project', 'POST', { projectId: currentProjectId, templateName }); if (response.ok) { alert(`Modelo "${templateName}" salvo!`); saveTemplateModal.style.display = 'none'; } else { const err = await response.json(); alert(`Erro: ${err.error}`); } });
    editTemplateForm.addEventListener('submit', async e => { e.preventDefault(); await api.request(`/api/templates/${editingTemplateId}`, 'PUT', { nome: document.getElementById('edit-template-name').value }); editTemplateModal.style.display = 'none'; loadTemplatesList(); });
    backToProjectsBtn.addEventListener('click', showProjectsView);
    manageTemplatesBtn.addEventListener('click', showTemplatesView);
    backFromTemplatesBtn.addEventListener('click', showProjectsView);
    addReqBtn.onclick = () => { editingRequirementId = null; addReqModal.querySelector('h2').textContent = 'Novo Requisito'; addReqModal.querySelector('button[type="submit"]').innerHTML = '💾 Salvar Requisito'; reqForm.reset(); addReqModal.style.display = 'block'; };
    saveAsTemplateBtn.onclick = () => { saveTemplateForm.reset(); saveTemplateModal.style.display = 'block'; };
    showRegisterLink.addEventListener('click', e => { e.preventDefault(); loginView.style.display = 'none'; registerView.style.display = 'block'; });
    showLoginLink.addEventListener('click', e => { e.preventDefault(); loginView.style.display = 'block'; registerView.style.display = 'none'; });
    [addReqModal, viewReqModal, editProjectModal, saveTemplateModal, editTemplateModal].forEach(m => { if (m) m.querySelector('.close-btn').onclick = () => m.style.display = 'none'; });
    window.onclick = e => { [addReqModal, viewReqModal, editProjectModal, saveTemplateModal, editTemplateModal].forEach(m => { if (e.target == m) m.style.display = 'none'; }); };
//
     // NOVO LISTENER PARA O BOTÃO DE EXPORTAR
    exportTxtBtn.addEventListener('click', async () => {
        if (!currentProjectId) {
            alert('Nenhum projeto selecionado.');
            return;
        }

        // Busca os dados do projeto e dos requisitos
        const projectResponse = await api.request(`/api/projects`);
        const reqsResponse = await api.request(`/api/projects/${currentProjectId}/requirements`);

        if (!projectResponse.ok || !reqsResponse.ok) {
            alert('Não foi possível carregar os dados para exportação.');
            return;
        }

        const projects = await projectResponse.json();
        const requirements = await reqsResponse.json();
        
        const currentProject = projects.find(p => p.id === currentProjectId);
        const projectName = currentProject ? currentProject.nome : 'projeto';

        // Formata o conteúdo do arquivo de texto
        let fileContent = `Projeto: ${projectName}\n`;
        fileContent += `Descrição: ${currentProject.descricao || 'Nenhuma'}\n`;
        fileContent += "===================================================\n\n";

        colunasStatus.forEach(status => {
            fileContent += `--- STATUS: ${status.toUpperCase()} ---\n\n`;
            const reqsInStatus = requirements.filter(r => r.status === status);
            
            if (reqsInStatus.length === 0) {
                fileContent += "\t(Nenhum requisito nesta etapa)\n\n";
            } else {
                reqsInStatus
                    .sort((a,b) => priorityOrder[a.prioridade] - priorityOrder[b.prioridade])
                    .forEach(req => {
                        fileContent += `[${req.prioridade}] ${req.titulo}\n`;
                        fileContent += `\t- Tipo: ${req.tipo}\n`;
                        fileContent += `\t- Descrição: ${req.descricao.replace(/\n/g, '\n\t  ')}\n\n`;
                    });
            }
        });
        
        // Função para iniciar o download
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeFileName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.setAttribute('href', url);
        link.setAttribute('download', `requisitos_${safeFileName}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });
    // --- 7. INICIALIZAÇÃO ---
    updateUI();
});
