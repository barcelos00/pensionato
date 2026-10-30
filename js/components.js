/**
 * js/components.js
 * Renderizador de Vistas (Integrado à API PHP)
 */

function formatMoney(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function initDatePickers() {
    const picker = document.getElementById('month-picker');
    if (picker) picker.value = DBService.getCurrentSelectedMonth();

    const todayDisplay = document.getElementById('today-date-display');
    if (todayDisplay) {
        const now = new Date();
        todayDisplay.innerText = `Hoje: ${now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
}

function handleMonthChange(val) {
    DBService.setSelectedMonth(val);
    location.reload();
}

// 1. DASHBOARD
async function renderDashboard() {
    const currentMonth = DBService.getCurrentSelectedMonth();
    
    const tenants = await DBService.getTenants();
    const rooms = await DBService.getRooms();
    const expensesList = await DBService.getExpenses(currentMonth);

    const revenue = (tenants || []).reduce((sum, t) => sum + parseFloat(t.rent || t.valor_aluguel || 0), 0);
    const expenses = (expensesList || []).reduce((sum, e) => sum + parseFloat(e.amount || e.valor || 0), 0);

    let totalBeds = 0, occupiedBeds = 0;
    (rooms || []).forEach(r => (r.beds || []).forEach(b => {
        totalBeds++;
        if (b.tenantId) occupiedBeds++;
    }));

    if (document.getElementById('kpi-revenue')) document.getElementById('kpi-revenue').innerText = formatMoney(revenue);
    if (document.getElementById('kpi-expenses')) document.getElementById('kpi-expenses').innerText = formatMoney(expenses);
    if (document.getElementById('kpi-profit')) document.getElementById('kpi-profit').innerText = formatMoney(revenue - expenses);
    if (document.getElementById('kpi-occupancy')) document.getElementById('kpi-occupancy').innerText = `${totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0}%`;
    if (document.getElementById('kpi-occupancy-sub')) document.getElementById('kpi-occupancy-sub').innerText = `${occupiedBeds} de ${totalBeds} leitos ocupados`;

    const upcomingList = document.getElementById('upcoming-dues-list');
    if (upcomingList) {
        upcomingList.innerHTML = (!tenants || tenants.length === 0)
            ? `<p style="font-size: 0.8rem; color: #94a3b8;">Nenhum morador cadastrado.</p>`
            : tenants.map(t => {
                const name = t.name || t.nome || 'Não Informado';
                const dueDay = t.dueDay || t.dia_vencimento || 10;
                const rent = t.rent || t.valor_aluguel || 0;
                const isPaid = (t.paidMonths || []).includes(currentMonth);
                const st = isPaid 
                    ? { status: "Pago", class: "badge-paid" } 
                    : { status: "Pendente", class: "badge-pending" };

                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:0.5rem; margin-bottom:0.5rem;">
                        <div>
                            <strong>${name}</strong>
                            <div style="font-size:0.75rem; color:#64748b;">Vencimento Dia ${dueDay}</div>
                        </div>
                        <div style="text-align:right;">
                            <div><strong>${formatMoney(rent)}</strong></div>
                            <span class="badge ${st.class}">${st.status}</span>
                        </div>
                    </div>
                `;
            }).join('');
    }

    renderChart(revenue, expenses);
}

// 2. CASAS E QUARTOS
async function renderCasasEQuartos() {
    const container = document.getElementById('casas-container') || document.getElementById('rooms-container');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center; padding:2rem; color:#94a3b8;">Carregando unidades e acomodações...</div>`;

    const casas = await DBService.getCasas();
    const rooms = await DBService.getRooms();
    const tenants = await DBService.getTenants();

    if (!casas || casas.length === 0) {
        container.innerHTML = `
            <div style="background:#fff; border:1px dashed #cbd5e1; border-radius:0.75rem; padding:3rem; text-align:center; color:#64748b;">
                <h3>Nenhuma casa cadastrada</h3>
                <p style="margin-top:0.5rem; font-size:0.9rem;">Clique no botão <strong>+ Nova Casa</strong> para cadastrar a primeira unidade.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = casas.map(casa => {
        const quartosDaCasa = (rooms || []).filter(r => parseInt(r.casa_id) === parseInt(casa.id));

        let totalLeitosCasa = 0;
        let leitosOcupadosCasa = 0;

        quartosDaCasa.forEach(r => {
            (r.beds || []).forEach(b => {
                totalLeitosCasa++;
                if (b.tenantId) leitosOcupadosCasa++;
            });
        });

        const fotoCasa = casa.foto_fachada && casa.foto_fachada.trim() !== '' 
            ? casa.foto_fachada 
            : 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80';

        return `
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:0.75rem; overflow:hidden; margin-bottom:1.5rem; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                <div style="display:flex; flex-wrap:wrap; border-bottom:1px solid #e2e8f0;">
                    <div style="width:260px; height:160px; background-image:url('${fotoCasa}'); background-size:cover; background-position:center; flex-shrink:0;"></div>
                    
                    <div style="flex:1; padding:1.25rem; display:flex; flex-direction:column; justify-content:space-between; min-width:280px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <h3 style="font-size:1.3rem; color:#0f172a; font-weight:800;">🏠 ${casa.nome}</h3>
                                <p style="font-size:0.85rem; color:#64748b; margin-top:0.25rem;">📍 ${casa.bairro} ${casa.endereco ? '• ' + casa.endereco : ''}</p>
                            </div>
                            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                                <button onclick="openAddRoomForCasa(${casa.id})" class="btn-primary" style="padding:0.35rem 0.65rem; font-size:0.8rem;">+ Add Quarto</button>
                                <button onclick="openEditCasaModal(${casa.id})" class="btn-action btn-action-blue">Editar Casa</button>
                                <button onclick="handleDeleteCasa(${casa.id})" class="btn-action btn-action-rose">Excluir</button>
                            </div>
                        </div>

                        <div style="display:flex; gap:1.5rem; margin-top:1rem; flex-wrap:wrap;">
                            <div style="background:#f8fafc; padding:0.5rem 0.85rem; border-radius:0.5rem; border:1px solid #e2e8f0;">
                                <span style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase; display:block;">Total de Quartos</span>
                                <strong style="font-size:1.1rem; color:#0f172a;">${quartosDaCasa.length} Quartos</strong>
                            </div>
                            <div style="background:#f8fafc; padding:0.5rem 0.85rem; border-radius:0.5rem; border:1px solid #e2e8f0;">
                                <span style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase; display:block;">Capacidade de Leitos</span>
                                <strong style="font-size:1.1rem; color:#2563eb;">${totalLeitosCasa} Leitos Total</strong>
                            </div>
                            <div style="background:#f8fafc; padding:0.5rem 0.85rem; border-radius:0.5rem; border:1px solid #e2e8f0;">
                                <span style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase; display:block;">Ocupação Atual</span>
                                <strong style="font-size:1.1rem; color:#10b981;">${leitosOcupadosCasa} Pessoas (${totalLeitosCasa - leitosOcupadosCasa} Vagas)</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="padding:1.5rem; background:#fafafa;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h4 style="font-size:0.9rem; color:#64748b; text-transform:uppercase; font-weight:800;">Quartos desta Unidade</h4>
                        <button onclick="openAddRoomForCasa(${casa.id})" class="btn-action btn-action-blue">+ Adicionar Quarto para esta Casa</button>
                    </div>
                    
                    ${quartosDaCasa.length === 0 
                        ? `<p style="font-size:0.85rem; color:#94a3b8; font-style:italic;">Nenhum quarto cadastrado nesta casa ainda.</p>`
                        : `<div class="rooms-grid">
                            ${quartosDaCasa.map(room => {
                                const fotoQuarto = room.foto_url && room.foto_url.trim() !== '' ? room.foto_url : fotoCasa;
                                return `
                                    <div class="room-card">
                                        <div style="height:110px; background-image:linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.7)), url('${fotoQuarto}'); background-size:cover; background-position:center; padding:0.75rem; display:flex; justify-content:space-between; align-items:flex-end;">
                                            <div>
                                                <h3 style="color:#fff; font-size:1rem; text-shadow:0 1px 2px rgba(0,0,0,0.8);">${room.number || room.numero}</h3>
                                                <small style="color:#e2e8f0; font-size:0.7rem;">${room.floor || room.andar || 'Térreo'} • ${room.tipo_mobilia || 'Simples'}</small>
                                            </div>
                                            <div style="display:flex; gap:0.25rem;">
                                                <button onclick="openEditRoomModal(${room.id})" class="btn-action" style="color:#fff; background:rgba(0,0,0,0.5); padding:0.2rem 0.4rem;">Editar</button>
                                                <button onclick="handleDeleteRoom(${room.id})" class="btn-action" style="color:#f87171; background:rgba(0,0,0,0.5); padding:0.2rem 0.4rem;">Excluir</button>
                                            </div>
                                        </div>

                                        <div style="padding:0.5rem 0.75rem; border-bottom:1px solid #f1f5f9; display:flex; gap:0.25rem; flex-wrap:wrap; background:#fff;">
                                            ${(room.features || []).map(f => `<span class="feature-tag">${f}</span>`).join('')}
                                        </div>

                                        <div style="padding:0.75rem; display:flex; flex-direction:column; gap:0.4rem; background:#fff;">
                                            ${(room.beds || []).map(bed => {
                                                const tenant = (tenants || []).find(t => t.bedId === bed.id || t.id === bed.tenantId);
                                                return `
                                                    <div style="padding:0.4rem 0.6rem; border:1px solid #e2e8f0; border-radius:0.4rem; display:flex; justify-content:space-between; align-items:center;">
                                                        <div>
                                                            <small style="color:#94a3b8; font-weight:700;">${bed.codigo || bed.code}</small>
                                                            <div style="font-size:0.85rem;"><strong>${tenant ? (tenant.name || tenant.nome) : 'Vago'}</strong></div>
                                                        </div>
                                                        ${tenant 
                                                            ? `<button onclick="handleVacateBed(${bed.id})" class="btn-action btn-action-rose">Desocupar</button>` 
                                                            : `<span class="badge badge-paid">Livre</span>`}
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

async function renderRooms() {
    await renderCasasEQuartos();
}

// 3. TABELA DE INQUILINOS
async function renderTenants() {
    const currentMonth = DBService.getCurrentSelectedMonth();
    const tbody = document.getElementById('tenants-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:#94a3b8;">Carregando moradores...</td></tr>`;

    const tenants = await DBService.getTenants();
    const rooms = await DBService.getRooms();

    if (!tenants || tenants.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:#94a3b8;">Nenhum inquilino cadastrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = tenants.map(t => {
        const name = t.name || t.nome || 'Não Informado';
        const phone = t.phone || t.telefone || 'Sem telefone';
        const rent = parseFloat(t.rent || t.valor_aluguel || 0);
        const dueDay = t.dueDay || t.dia_vencimento || 10;
        const bedId = t.bedId || t.leito_id || 0;

        const isPaid = (t.paidMonths || []).includes(currentMonth);
        const st = isPaid 
            ? { status: "Pago", class: "badge-paid" } 
            : { status: "Pendente", class: "badge-pending" };

        return `
            <tr>
                <td><strong>${name}</strong><br><small style="color:#64748b;">${phone}</small></td>
                <td>${getBedInfoFromRooms(bedId, rooms)}</td>
                <td>Dia ${dueDay}</td>
                <td><strong>${formatMoney(rent)}</strong></td>
                <td><button onclick="toggleTenantPaymentForMonth(${t.id})" class="badge ${st.class}" style="border:none; cursor:pointer;">${st.status}</button></td>
                <td style="text-align:right;">
                    <button onclick="openPixModal('${name}', ${rent})" class="btn-action btn-action-blue">PIX</button>
                    <button onclick="openEditTenantModal(${t.id})" class="btn-action btn-action-blue">Editar</button>
                    <button onclick="handleDeleteTenant(${t.id})" class="btn-action btn-action-rose">Remover</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleTenantPaymentForMonth(tenantId) {
    await DBService.toggleTenantPaymentForMonth(tenantId, DBService.getCurrentSelectedMonth());
    renderTenants();
}

// 4. TABELA DE DESPESAS
async function renderExpenses() {
    const currentMonth = DBService.getCurrentSelectedMonth();
    const tbody = document.getElementById('expenses-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:#94a3b8;">Carregando despesas...</td></tr>`;

    const list = await DBService.getExpenses(currentMonth);

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:#94a3b8;">Nenhuma despesa para este mês.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(e => `
        <tr>
            <td><strong>${e.title || e.titulo}</strong></td>
            <td>${e.category || e.categoria}</td>
            <td><span class="badge badge-pending">${e.type || e.tipo}</span></td>
            <td><strong>${formatMoney(e.amount || e.valor)}</strong></td>
            <td><button onclick="toggleExpensePayment(${e.id})" class="badge ${e.status === 'Pago' ? 'badge-paid' : 'badge-late'}" style="border:none; cursor:pointer;">${e.status}</button></td>
            <td style="text-align:right;"><button onclick="handleDeleteExpense(${e.id})" class="btn-action btn-action-rose">Excluir</button></td>
        </tr>
    `).join('');
}

// 5. RELATÓRIO DRE
async function renderDRE() {
    const currentMonth = DBService.getCurrentSelectedMonth();

    const tenants = await DBService.getTenants();
    const list = await DBService.getExpenses(currentMonth);

    const gross = (tenants || []).reduce((sum, t) => sum + parseFloat(t.rent || t.valor_aluguel || 0), 0);
    const pending = (tenants || []).filter(t => !(t.paidMonths || []).includes(currentMonth)).reduce((sum, t) => sum + parseFloat(t.rent || t.valor_aluguel || 0), 0);
    const collected = gross - pending;

    const fixed = (list || []).filter(e => (e.type || e.tipo) === "Consumo").reduce((sum, e) => sum + parseFloat(e.amount || e.valor || 0), 0);
    const emergency = (list || []).filter(e => (e.type || e.tipo) === "Emergência").reduce((sum, e) => sum + parseFloat(e.amount || e.valor || 0), 0);

    if (document.getElementById('dre-gross-revenue')) document.getElementById('dre-gross-revenue').innerText = formatMoney(gross);
    if (document.getElementById('dre-pending-revenue')) document.getElementById('dre-pending-revenue').innerText = `- ${formatMoney(pending)}`;
    if (document.getElementById('dre-collected-revenue')) document.getElementById('dre-collected-revenue').innerText = formatMoney(collected);
    if (document.getElementById('dre-fixed-expenses')) document.getElementById('dre-fixed-expenses').innerText = `- ${formatMoney(fixed)}`;
    if (document.getElementById('dre-emergency-expenses')) document.getElementById('dre-emergency-expenses').innerText = `- ${formatMoney(emergency)}`;
    if (document.getElementById('dre-net-profit')) document.getElementById('dre-net-profit').innerText = formatMoney(collected - (fixed + emergency));
}

function getBedInfoFromRooms(bedId, rooms) {
    for (let r of (rooms || [])) {
        for (let b of (r.beds || [])) {
            if (parseInt(b.id) === parseInt(bedId)) return `${r.number || r.numero} - ${b.codigo || b.code}`;
        }
    }
    return "Sem Leito";
}

let chartInstance = null;
function renderChart(revenue, expenses) {
    const canvas = document.getElementById('financialChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Receita Total', 'Despesas Mês', 'Resultado Líquido'],
            datasets: [{ data: [revenue, expenses, revenue - expenses], backgroundColor: ['#10b981', '#ef4444', '#3b82f6'], borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}