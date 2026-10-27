/**
 * js/state.js
 * Camada de Integração com as APIs em PHP
 */
const DBService = {
    // AUTENTICAÇÃO
    async login(user, pass) {
        try {
            const res = await fetch('api/auth.php?action=login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user, pass })
            });
            const data = await res.json();
            if (data.success) {
                sessionStorage.setItem("pensionato_auth", "true");
                sessionStorage.setItem("pensionato_user_name", data.name);
                return true;
            }
            return false;
        } catch (e) {
            console.error("Erro no login:", e);
            return false;
        }
    },

    async registerUser(name, user, pass) {
        try {
            const res = await fetch('api/auth.php?action=register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, user, pass })
            });
            const data = await res.json();
            return data.success;
        } catch (e) {
            console.error("Erro no cadastro:", e);
            return false;
        }
    },

    logout() {
        sessionStorage.removeItem("pensionato_auth");
        sessionStorage.removeItem("pensionato_user_name");
        window.location.href = "login.html";
    },

    checkAuth() {
        if (!sessionStorage.getItem("pensionato_auth")) {
            window.location.href = "login.html";
        }
    },

    // MÊS DE REFERÊNCIA
    getCurrentSelectedMonth() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return localStorage.getItem("pensionato_selected_month") || `${year}-${month}`;
    },

    setSelectedMonth(monthStr) {
        localStorage.setItem("pensionato_selected_month", monthStr);
    },

    // CASAS / UNIDADES
    async getCasas() {
        try {
            const res = await fetch('api/casas.php?action=list');
            return await res.json();
        } catch (e) {
            console.error("Erro ao buscar casas:", e);
            return [];
        }
    },

    async addCasa(formData) {
        try {
            const res = await fetch('api/casas.php?action=add', { method: 'POST', body: formData });
            return await res.json();
        } catch (e) {
            console.error("Erro ao adicionar casa:", e);
            return { success: false };
        }
    },

    async updateCasa(formData) {
        try {
            const res = await fetch('api/casas.php?action=update', { method: 'POST', body: formData });
            return await res.json();
        } catch (e) {
            console.error("Erro ao atualizar casa:", e);
            return { success: false };
        }
    },

    async deleteCasa(casaId) {
        try {
            const res = await fetch('api/casas.php?action=delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: casaId })
            });
            return await res.json();
        } catch (e) {
            console.error("Erro ao deletar casa:", e);
            return { success: false };
        }
    },

    // QUARTOS
    async getRooms() {
        try {
            const res = await fetch('api/quartos.php?action=list');
            return await res.json();
        } catch (e) {
            console.error("Erro ao buscar quartos:", e);
            return [];
        }
    },

    async addRoom(formData) {
        try {
            const res = await fetch('api/quartos.php?action=add', { method: 'POST', body: formData });
            return await res.json();
        } catch (e) {
            console.error("Erro ao adicionar quarto:", e);
            return { success: false };
        }
    },

    async updateRoom(formData) {
        try {
            const res = await fetch('api/quartos.php?action=update', { method: 'POST', body: formData });
            return await res.json();
        } catch (e) {
            console.error("Erro ao atualizar quarto:", e);
            return { success: false };
        }
    },

    async deleteRoom(roomId) {
        try {
            const res = await fetch('api/quartos.php?action=delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: roomId })
            });
            return await res.json();
        } catch (e) {
            console.error("Erro ao deletar quarto:", e);
            return { success: false };
        }
    },

    // INQUILINOS
    async getTenants() {
        try {
            const res = await fetch('api/inquilinos.php?action=list');
            return await res.json();
        } catch (e) {
            console.error("Erro ao buscar inquilinos:", e);
            return [];
        }
    },

    async addTenant(name, phone, rent, dueDay, bedId) {
        try {
            const res = await fetch('api/inquilinos.php?action=add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, rent, dueDay, bedId })
            });
            return await res.json();
        } catch (e) {
            console.error("Erro ao cadastrar inquilino:", e);
            return { success: false };
        }
    },

    async updateTenant(id, name, phone, rent, dueDay, bedId) {
        try {
            const res = await fetch('api/inquilinos.php?action=update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name, phone, rent, dueDay, bedId })
            });
            return await res.json();
        } catch (e) {
            console.error("Erro ao atualizar inquilino:", e);
            return { success: false };
        }
    },

    async deleteTenant(tenantId) {
        try {
            const res = await fetch('api/inquilinos.php?action=delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: tenantId })
            });
            return await res.json();
        } catch (e) {
            console.error("Erro ao remover inquilino:", e);
            return { success: false };
        }
    },

    async vacateBed(bedId) {
        try {
            const res = await fetch('api/inquilinos.php?action=vacate_bed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bedId })
            });
            return await res.json();
        } catch (e) {
            console.error("Erro ao desocupar leito:", e);
            return { success: false };
        }
    },

    async toggleTenantPaymentForMonth(tenantId, monthYear) {
        try {
            const res = await fetch('api/inquilinos.php?action=toggle_payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId, monthYear })
            });
            return await res.json();
        } catch (e) {
            console.error("Erro ao alterar pagamento:", e);
            return { success: false };
        }
    },

    // DESPESAS E RATEIO
    async getExpenses(monthYear) {
        try {
            const month = monthYear || this.getCurrentSelectedMonth();
            const res = await fetch(`api/despesas.php?action=list&month=${month}`);
            return await res.json();
        } catch (e) {
            console.error("Erro ao buscar despesas:", e);
            return [];
        }
    },

    async addExpense(title, amount, category, type) {
        try {
            const monthYear = this.getCurrentSelectedMonth();
            const res = await fetch('api/despesas.php?action=add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, amount, category, type, monthYear })
            });
            return await res.json();
        } catch (e) {
            console.error("Erro ao adicionar despesa:", e);
            return { success: false };
        }
    },

    async deleteExpense(expenseId) {
        try {
            const res = await fetch('api/despesas.php?action=delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: expenseId })
            });
            return await res.json();
        } catch (e) {
            console.error("Erro ao deletar despesa:", e);
            return { success: false };
        }
    },

    async toggleExpensePayment(expenseId) {
        try {
            const res = await fetch('api/despesas.php?action=toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: expenseId })
            });
            return await res.json();
        } catch (e) {
            console.error("Erro ao alterar pagamento:", e);
            return { success: false };
        }
    },

    async rateioConsumo() {
        try {
            const monthYear = this.getCurrentSelectedMonth();
            const res = await fetch('api/despesas.php?action=rateio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monthYear })
            });
            return await res.json();
        } catch (e) {
            console.error("Erro no rateio:", e);
            return { success: false, message: "Erro de comunicação." };
        }
    }
};