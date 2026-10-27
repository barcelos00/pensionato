/**
 * js/app.js
 * Manipulação do DOM, Modais e Eventos
 */

// MODAIS
function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = 'flex';
    if (id === 'modal-room') populateCasaSelect('room-casa-select');
    if (id === 'modal-tenant') populateBedSelect('tenant-bed-select');
    if (id === 'modal-edit-tenant') populateBedSelect('edit-tenant-bed-select');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = 'none';
}

// POPULADORES DE SELECT
async function populateCasaSelect(selectId, selectedCasaId = null) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="">Carregando casas...</option>';
    const casas = await DBService.getCasas();
    select.innerHTML = '<option value="">Selecione uma casa...</option>';

    (casas || []).forEach(c => {
        const isSelected = selectedCasaId && parseInt(selectedCasaId) === parseInt(c.id) ? 'selected' : '';
        select.innerHTML += `<option value="${c.id}" ${isSelected}>🏠 ${c.nome} (${c.bairro})</option>`;
    });
}

async function populateBedSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="">Carregando leitos vagos...</option>';
    const rooms = await DBService.getRooms();
    select.innerHTML = '<option value="">Selecione um leito vago...</option>';

    (rooms || []).forEach(r => {
        (r.beds || []).forEach(b => {
            if (!b.tenantId) {
                select.innerHTML += `<option value="${b.id}">${r.number || r.numero} - ${b.codigo || b.code}</option>`;
            }
        });
    });
}

// GESTÃO DE CASAS
async function handleCreateCasa(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('nome', document.getElementById('casa-nome').value.trim());
    formData.append('bairro', document.getElementById('casa-bairro').value.trim());
    formData.append('endereco', document.getElementById('casa-endereco').value.trim());
    formData.append('fotoFachada', document.getElementById('casa-foto-url').value.trim());

    const fileInput = document.getElementById('casa-foto-file');
    if (fileInput && fileInput.files.length > 0) {
        formData.append('fotoFile', fileInput.files[0]);
    }

    await DBService.addCasa(formData);
    closeModal('modal-casa');
    e.target.reset();

    if (typeof renderCasasEQuartos === 'function') await renderCasasEQuartos();
}

async function openEditCasaModal(casaId) {
    const casas = await DBService.getCasas();
    const casa = casas.find(c => parseInt(c.id) === parseInt(casaId));
    if (!casa) return;

    document.getElementById('edit-casa-id').value = casa.id;
    document.getElementById('edit-casa-nome').value = casa.nome;
    document.getElementById('edit-casa-bairro').value = casa.bairro;
    document.getElementById('edit-casa-endereco').value = casa.endereco || '';
    document.getElementById('edit-casa-foto-url').value = casa.foto_fachada || '';

    openModal('modal-edit-casa');
}

async function handleUpdateCasa(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('id', document.getElementById('edit-casa-id').value);
    formData.append('nome', document.getElementById('edit-casa-nome').value.trim());
    formData.append('bairro', document.getElementById('edit-casa-bairro').value.trim());
    formData.append('endereco', document.getElementById('edit-casa-endereco').value.trim());
    formData.append('fotoFachada', document.getElementById('edit-casa-foto-url').value.trim());

    const fileInput = document.getElementById('edit-casa-foto-file');
    if (fileInput && fileInput.files.length > 0) {
        formData.append('fotoFile', fileInput.files[0]);
    }

    await DBService.updateCasa(formData);
    closeModal('modal-edit-casa');
    e.target.reset();

    if (typeof renderCasasEQuartos === 'function') await renderCasasEQuartos();
}

async function handleDeleteCasa(casaId) {
    if (confirm("Deseja excluir esta casa? Os quartos vinculados ficarão sem casa associada.")) {
        await DBService.deleteCasa(casaId);
        if (typeof renderCasasEQuartos === 'function') await renderCasasEQuartos();
    }
}

// GESTÃO DE QUARTOS
async function openAddRoomForCasa(casaId) {
    openModal('modal-room');
    await populateCasaSelect('room-casa-select', casaId);
}

async function handleCreateRoom(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('casaId', document.getElementById('room-casa-select').value);
    formData.append('number', document.getElementById('room-number').value.trim());
    formData.append('floor', document.getElementById('room-floor').value.trim());
    formData.append('tipoMobilia', document.getElementById('room-tipo-mobilia').value);
    formData.append('valorBase', document.getElementById('room-valor-base').value);
    formData.append('bedCount', document.getElementById('room-beds').value);
    formData.append('features', document.getElementById('room-features').value.trim());
    formData.append('fotoUrl', document.getElementById('room-foto-url').value.trim());

    const fileInput = document.getElementById('room-foto-file');
    if (fileInput && fileInput.files.length > 0) {
        formData.append('fotoFile', fileInput.files[0]);
    }

    await DBService.addRoom(formData);
    closeModal('modal-room');
    e.target.reset();

    if (typeof renderCasasEQuartos === 'function') await renderCasasEQuartos();
}

async function openEditRoomModal(roomId) {
    const rooms = await DBService.getRooms();
    const room = rooms.find(r => parseInt(r.id) === parseInt(roomId));
    if (!room) return;

    await populateCasaSelect('edit-room-casa-select', room.casa_id);

    document.getElementById('edit-room-id').value = room.id;
    document.getElementById('edit-room-number').value = room.number || room.numero;
    document.getElementById('edit-room-floor').value = room.floor || room.andar || '';
    document.getElementById('edit-room-tipo-mobilia').value = room.tipo_mobilia || 'Quarto Simples';
    document.getElementById('edit-room-valor-base').value = room.valor_base || 0;
    document.getElementById('edit-room-foto-url').value = room.foto_url || '';
    document.getElementById('edit-room-features').value = (room.features || []).join(', ');

    openModal('modal-edit-room');
}

async function handleUpdateRoom(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('id', document.getElementById('edit-room-id').value);
    formData.append('casaId', document.getElementById('edit-room-casa-select').value);
    formData.append('number', document.getElementById('edit-room-number').value.trim());
    formData.append('floor', document.getElementById('edit-room-floor').value.trim());
    formData.append('tipoMobilia', document.getElementById('edit-room-tipo-mobilia').value);
    formData.append('valorBase', document.getElementById('edit-room-valor-base').value);
    formData.append('features', document.getElementById('edit-room-features').value.trim());
    formData.append('fotoUrl', document.getElementById('edit-room-foto-url').value.trim());

    const fileInput = document.getElementById('edit-room-foto-file');
    if (fileInput && fileInput.files.length > 0) {
        formData.append('fotoFile', fileInput.files[0]);
    }

    await DBService.updateRoom(formData);
    closeModal('modal-edit-room');
    e.target.reset();

    if (typeof renderCasasEQuartos === 'function') await renderCasasEQuartos();
}

async function handleDeleteRoom(roomId) {
    if (confirm("Remover este quarto? Os moradores nele alocados serão desvinculados.")) {
        await DBService.deleteRoom(roomId);
        if (typeof renderCasasEQuartos === 'function') await renderCasasEQuartos();
    }
}

async function handleVacateBed(bedId) {
    if (confirm("Desocupar este leito?")) {
        await DBService.vacateBed(bedId);
        if (typeof renderCasasEQuartos === 'function') await renderCasasEQuartos();
        if (typeof renderDashboard === 'function') await renderDashboard();
    }
}

// GESTÃO DE INQUILINOS
async function handleCreateTenant(e) {
    e.preventDefault();
    const name = document.getElementById('tenant-name').value.trim();
    const phone = document.getElementById('tenant-phone').value.trim();
    const rent = document.getElementById('tenant-rent').value;
    const due = document.getElementById('tenant-due').value;
    const bedId = document.getElementById('tenant-bed-select').value;

    if (!name || !phone) return alert("Preencha o nome e o telefone!");
    if (!bedId) return alert("Selecione um leito vago!");

    await DBService.addTenant(name, phone, rent, due, bedId);
    closeModal('modal-tenant');
    e.target.reset();

    if (typeof renderTenants === 'function') await renderTenants();
    if (typeof renderDashboard === 'function') await renderDashboard();
}

async function openEditTenantModal(tenantId) {
    const tenants = await DBService.getTenants();
    const tenant = tenants.find(t => parseInt(t.id) === parseInt(tenantId));
    if (!tenant) return;

    document.getElementById('edit-tenant-id').value = tenant.id;
    document.getElementById('edit-tenant-name').value = tenant.name || tenant.nome;
    document.getElementById('edit-tenant-phone').value = tenant.phone || tenant.telefone;
    document.getElementById('edit-tenant-rent').value = tenant.rent || tenant.valor_aluguel;
    document.getElementById('edit-tenant-due').value = tenant.dueDay || tenant.dia_vencimento;

    openModal('modal-edit-tenant');
}

async function handleUpdateTenant(e) {
    e.preventDefault();
    const id = document.getElementById('edit-tenant-id').value;
    const name = document.getElementById('edit-tenant-name').value.trim();
    const phone = document.getElementById('edit-tenant-phone').value.trim();
    const rent = document.getElementById('edit-tenant-rent').value;
    const due = document.getElementById('edit-tenant-due').value;
    const bedId = document.getElementById('edit-tenant-bed-select').value;

    await DBService.updateTenant(id, name, phone, rent, due, bedId);
    closeModal('modal-edit-tenant');
    e.target.reset();

    if (typeof renderTenants === 'function') await renderTenants();
    if (typeof renderDashboard === 'function') await renderDashboard();
}

async function handleDeleteTenant(tenantId) {
    if (confirm("Remover este morador? O leito ficará vago.")) {
        await DBService.deleteTenant(tenantId);
        if (typeof renderTenants === 'function') await renderTenants();
        if (typeof renderDashboard === 'function') await renderDashboard();
    }
}

// GESTÃO DE DESPESAS E RATEIO
async function handleCreateExpense(e) {
    e.preventDefault();
    const title = document.getElementById('expense-title').value.trim();
    const amount = parseFloat(document.getElementById('expense-value').value);
    const category = document.getElementById('expense-category').value;
    const type = document.getElementById('expense-type').value;

    if (!title || isNaN(amount) || amount <= 0) return alert("Preencha título e valor válidos!");

    await DBService.addExpense(title, amount, category, type);
    closeModal('modal-expense');
    e.target.reset();

    if (typeof renderExpenses === 'function') await renderExpenses();
    if (typeof renderDashboard === 'function') await renderDashboard();
}

async function handleDeleteExpense(expenseId) {
    if (confirm("Excluir esta despesa?")) {
        await DBService.deleteExpense(expenseId);
        if (typeof renderExpenses === 'function') await renderExpenses();
        if (typeof renderDashboard === 'function') await renderDashboard();
    }
}

async function toggleExpensePayment(id) {
    await DBService.toggleExpensePayment(id);
    if (typeof renderExpenses === 'function') await renderExpenses();
    if (typeof renderDashboard === 'function') await renderDashboard();
}

async function processRateio() {
    const res = await DBService.rateioConsumo();
    alert(res.message || "Rateio processado com sucesso!");
    if (res.success) {
        if (typeof renderExpenses === 'function') await renderExpenses();
        if (typeof renderTenants === 'function') await renderTenants();
        if (typeof renderDashboard === 'function') await renderDashboard();
    }
}

// COBRANÇA PIX
function openPixModal(tenantName, amount) {
    document.getElementById('pix-tenant-name').innerText = tenantName;
    document.getElementById('pix-amount').innerText = formatMoney(amount);

    const qrContainer = document.getElementById('pix-qrcode');
    qrContainer.innerHTML = '';

    if (typeof qrcode !== 'undefined') {
        const qr = qrcode(0, 'M');
        qr.addData(`00020126360014BR.GOV.BCB.PIX0114+5561999999999520400005303986540${parseFloat(amount).toFixed(2)}5802BR5915PENSIONATO6008BRASILIA62070503***6304`);
        qr.make();
        qrContainer.innerHTML = qr.createImgTag(5);
    }

    openModal('modal-pix');
}
// ALTERNAR MENU HAMBURGUER (SIDEBAR)
function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebar) {
        sidebar.classList.toggle('open');
    }
    if (overlay) {
        overlay.classList.toggle('active');
    }
}