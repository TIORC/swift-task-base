// Supabase config — uses the project's public anon key
const SUPABASE_URL = 'https://wisbzvooxrgyltbebuyb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpc2J6dm9veHJneWx0YmVidXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTQ4NzksImV4cCI6MjA5MDAzMDg3OX0.UhZJGeVW5uLJ31TN7JsDfwzUxvbRtz62sWx6wNLlSic';

let session = null;
let machineInfo = { username: 'Desconhecido', hostname: 'Desconhecido' };
let selectedCategory = null;
let isSubmitting = false;

const CATEGORY_LABELS = {
  computador: 'Computador',
  sistema: 'Sistema',
  impressora: 'Impressora',
  ramal: 'Ramal',
};

// Receive machine info from main process
if (window.electronAPI) {
  window.electronAPI.onMachineInfo((info) => {
    machineInfo = info;
    updateUserInfo();
  });
}

// Try to restore session from localStorage
const savedSession = localStorage.getItem('orcoma_session');
if (savedSession) {
  try {
    session = JSON.parse(savedSession);
    showMainScreen();
  } catch { /* ignore */ }
}

function updateUserInfo() {
  const el = document.getElementById('user-info');
  if (el) {
    el.textContent = `${machineInfo.username} • ${machineInfo.hostname}`;
  }
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!email || !password) {
    errorEl.textContent = 'Preencha email e senha';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando...';
  errorEl.textContent = '';

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error_description || data.msg || 'Credenciais inválidas');
    }

    session = data;
    localStorage.setItem('orcoma_session', JSON.stringify(session));
    showMainScreen();
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

function doLogout() {
  session = null;
  localStorage.removeItem('orcoma_session');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  resetForm();
}

function showMainScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'flex';
  updateUserInfo();
}

// ===== STEP 1: select category (does NOT submit) =====
function selectCategory(category) {
  selectedCategory = category;
  document.querySelectorAll('.ticket-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.category === category);
  });
  updateSubmitState();

  // Move focus to description with subtle pulse
  const desc = document.getElementById('description');
  if (desc) {
    desc.focus();
    desc.classList.remove('textarea-pulse');
    // re-trigger animation
    void desc.offsetWidth;
    desc.classList.add('textarea-pulse');
  }
}

function updateSubmitState() {
  const btn = document.getElementById('submit-btn');
  if (btn) btn.disabled = !selectedCategory || isSubmitting;
}

function resetForm() {
  selectedCategory = null;
  document.querySelectorAll('.ticket-btn').forEach(b => b.classList.remove('selected'));
  const desc = document.getElementById('description');
  if (desc) desc.value = '';
  const status = document.getElementById('status-msg');
  if (status) { status.textContent = ''; status.className = 'status-msg'; }
  const success = document.getElementById('success-panel');
  if (success) success.style.display = 'none';
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.style.display = 'block';
    submitBtn.textContent = 'Enviar chamado';
  }
  updateSubmitState();
}

// ===== STEP 4: submit (only here the ticket is created) =====
async function submitTicket() {
  if (isSubmitting) return;
  if (!selectedCategory) return;

  const statusEl = document.getElementById('status-msg');
  const submitBtn = document.getElementById('submit-btn');
  const descricao = document.getElementById('description').value.trim();

  if (!session) {
    statusEl.className = 'status-msg error';
    statusEl.textContent = 'Sessão expirada. Faça login novamente.';
    return;
  }

  isSubmitting = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';
  statusEl.className = 'status-msg loading';
  statusEl.textContent = '⏳ Criando chamado...';

  const finalDescription = descricao || null;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/support-ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        categoria: selectedCategory,
        descricao: finalDescription,
        usuario_windows: machineInfo.username,
        nome_maquina: machineInfo.hostname,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
          isSubmitting = false;
          return submitTicket();
        }
        doLogout();
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      throw new Error(data.error || 'Erro ao criar chamado');
    }

    // Success — show confirmation panel
    statusEl.textContent = '';
    statusEl.className = 'status-msg';
    showSuccess({
      protocol: data.protocol || data.task_id || data.id,
      categoria: CATEGORY_LABELS[selectedCategory] || selectedCategory,
    });
  } catch (err) {
    statusEl.className = 'status-msg error';
    statusEl.textContent = `❌ ${err.message}`;
    submitBtn.textContent = 'Enviar chamado';
  } finally {
    isSubmitting = false;
    updateSubmitState();
  }
}

function showSuccess({ protocol, categoria }) {
  const submitBtn = document.getElementById('submit-btn');
  const panel = document.getElementById('success-panel');
  const details = document.getElementById('success-details');
  if (submitBtn) submitBtn.style.display = 'none';

  const now = new Date();
  const horario = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const protocolStr = protocol ? `#${String(protocol).slice(0, 8).toUpperCase()}` : '—';

  details.innerHTML = `
    <div class="row"><span class="k">Protocolo</span><span class="v">${protocolStr}</span></div>
    <div class="row"><span class="k">Categoria</span><span class="v">${categoria}</span></div>
    <div class="row"><span class="k">Responsável</span><span class="v">Aguardando atribuição</span></div>
    <div class="row"><span class="k">Horário</span><span class="v">${horario}</span></div>
  `;
  panel.style.display = 'block';
}

async function refreshToken() {
  if (!session?.refresh_token) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) return false;
    session = await res.json();
    localStorage.setItem('orcoma_session', JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

// Handle Enter key on login
document.getElementById('login-password')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});
