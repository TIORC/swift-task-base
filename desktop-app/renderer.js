// Supabase config — uses the project's public anon key
const SUPABASE_URL = 'https://wisbzvooxrgyltbebuyb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpc2J6dm9veHJneWx0YmVidXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTQ4NzksImV4cCI6MjA5MDAzMDg3OX0.UhZJGeVW5uLJ31TN7JsDfwzUxvbRtz62sWx6wNLlSic';

let session = null;
let machineInfo = { username: 'Desconhecido', hostname: 'Desconhecido' };

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
}

function showMainScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'flex';
  updateUserInfo();
}

async function createTicket(categoria) {
  const statusEl = document.getElementById('status-msg');
  const descricao = document.getElementById('description').value.trim();
  const buttons = document.querySelectorAll('.ticket-btn');

  if (!session) {
    statusEl.className = 'status-msg error';
    statusEl.textContent = 'Sessão expirada. Faça login novamente.';
    return;
  }

  buttons.forEach(b => b.disabled = true);
  statusEl.className = 'status-msg loading';
  statusEl.textContent = '⏳ Criando chamado...';

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/support-ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        categoria,
        descricao: descricao || null,
        usuario_windows: machineInfo.username,
        nome_maquina: machineInfo.hostname,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Token might be expired
      if (res.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
          buttons.forEach(b => b.disabled = false);
          return createTicket(categoria);
        }
        doLogout();
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      throw new Error(data.error || 'Erro ao criar chamado');
    }

    statusEl.className = 'status-msg success';
    statusEl.textContent = '✅ Chamado criado com sucesso!';
    document.getElementById('description').value = '';

    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'status-msg';
    }, 3000);
  } catch (err) {
    statusEl.className = 'status-msg error';
    statusEl.textContent = `❌ ${err.message}`;
  } finally {
    buttons.forEach(b => b.disabled = false);
  }
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
