// script.js
document.addEventListener('DOMContentLoaded', async () => {
  // --- UI elements ---
  const authContainer = document.getElementById('auth-container');
  const loginBox = document.getElementById('login-box');
  const registerBox = document.getElementById('register-box');
  const showRegister = document.getElementById('show-register');
  const showLogin = document.getElementById('show-login');

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const rememberMe = document.getElementById('remember-me');

  const userBar = document.getElementById('user-bar');
  const userNameSpan = document.getElementById('user-name');
  const logoutBtn = document.getElementById('logout-btn');

  // App elements (same as original)
  const appRoot = document.getElementById('app-root');
  const entryForm = document.getElementById('entry-form');
  const editForm = document.getElementById('edit-form');
  const entriesList = document.getElementById('entries-list');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const editModal = document.getElementById('edit-modal');
  const editModalClose = document.getElementById('edit-modal-close');
  const deleteBtn = document.getElementById('delete-btn');

  // Auth fields
  const loginUsernameEl = document.getElementById('login-username');
  const loginPasswordEl = document.getElementById('login-password');
  const registerUsernameEl = document.getElementById('register-username');
  const registerPasswordEl = document.getElementById('register-password');
  const registerPassword2El = document.getElementById('register-password2');

  // state
  let users = loadUsers();               // array of user objects
  let currentUser = null;                // user object when logged in
  let entries = [];                      // entries for current user
  let appInitialized = false;

  // --- helper: localStorage keys ---
  function usersKey() { return 'dw_users'; }
  function sessionKey() { return 'dw_currentUserId'; }
  function entriesKeyFor(userId) { return `dailyWorkEntries_${userId}`; }

  // --- basic UI toggles ---
  showRegister.addEventListener('click', (e) => { e.preventDefault(); loginBox.style.display='none'; registerBox.style.display='block'; });
  showLogin.addEventListener('click', (e) => { e.preventDefault(); registerBox.style.display='none'; loginBox.style.display='block'; });

  // if already logged in (session or remember), auto-login
  const remembered = sessionStorage.getItem(sessionKey()) || localStorage.getItem(sessionKey());
  if (remembered) {
    const u = users.find(x => String(x.id) === String(remembered));
    if (u) await loginSuccess(u, false);
    else showAuth();
  } else {
    showAuth();
  }

  // ----------------------------
  // AUTH: register & login
  // ----------------------------
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = (registerUsernameEl.value || '').trim().toLowerCase();
    const pw = registerPasswordEl.value || '';
    const pw2 = registerPassword2El.value || '';

    if (!username || !pw) return alert('Please fill username and password.');
    if (pw.length < 6) return alert('Password must be at least 6 characters.');
    if (pw !== pw2) return alert('Passwords do not match.');

    if (users.some(u => u.username === username)) return alert('User already exists. Choose another username.');

    // create salt + hashed pw with WebCrypto PBKDF2
    const salt = arrayBufferToBase64(crypto.getRandomValues(new Uint8Array(16)).buffer);
    const hash = await hashPassword(pw, salt);

    const user = { id: Date.now(), username, passwordHash: hash, salt, createdAt: new Date().toISOString() };
    users.push(user);
    saveUsers(users);

    // auto-login after register
    await loginSuccess(user, true);
    alert('Registered and logged in!');
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = (loginUsernameEl.value || '').trim().toLowerCase();
    const pw = loginPasswordEl.value || '';

    if (!username || !pw) return alert('Enter username & password.');

    const user = users.find(u => u.username === username);
    if (!user) return alert('Invalid credentials.');

    const hash = await hashPassword(pw, user.salt);
    if (hash !== user.passwordHash) return alert('Invalid credentials.');

    await loginSuccess(user, rememberMe.checked);
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem(sessionKey());
    localStorage.removeItem(sessionKey());
    currentUser = null;
    entries = [];
    appRoot.style.display = 'none';
    userBar.style.display = 'none';
    showAuth();
  });

  async function loginSuccess(user, remember = false) {
    currentUser = user;
    // store session
    sessionStorage.setItem(sessionKey(), user.id);
    if (remember) localStorage.setItem(sessionKey(), user.id);

    // update UI
    userNameSpan.textContent = user.username;
    userBar.style.display = 'block';
    authContainer.style.display = 'none';
    appRoot.style.display = 'block';

    // initialize app features for this user
    await initializeAppForUser();
  }

  function showAuth() {
    authContainer.style.display = 'block';
    appRoot.style.display = 'none';
    userBar.style.display = 'none';
    loginBox.style.display = 'block';
    registerBox.style.display = 'none';
  }

  // ----------------------------
  // APP: per-user entries
  // ----------------------------
  async function initializeAppForUser() {
    if (!currentUser) return showAuth();

    // load entries for user
    entries = JSON.parse(localStorage.getItem(entriesKeyFor(currentUser.id)) || '[]');

    // set default date for add form
    const entryDateEl = document.getElementById('entry-date');
    if (entryDateEl) entryDateEl.valueAsDate = new Date();

    // render entries
    renderEntries(entries);

    // attach event listeners once
    if (!appInitialized) {
      // add new entry
      entryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newEntry = {
          id: Date.now(),
          date: document.getElementById('entry-date').value,
          title: document.getElementById('entry-title').value,
          description: document.getElementById('entry-description').value
        };
        entries.unshift(newEntry);
        saveEntries();
        renderEntries(entries);
        entryForm.reset();
        if (entryDateEl) entryDateEl.valueAsDate = new Date();
      });

      // search
      searchBtn.addEventListener('click', () => {
        const searchTerm = (searchInput.value || '').toLowerCase();
        if (!searchTerm) return renderEntries(entries);
        const filtered = entries.filter(e =>
          (e.title || '').toLowerCase().includes(searchTerm) ||
          (e.description || '').toLowerCase().includes(searchTerm) ||
          (e.date || '').includes(searchTerm)
        );
        renderEntries(filtered);
      });

      searchInput.addEventListener('input', function() {
        if (this.value === '') renderEntries(entries);
      });

      // modal controls
      editModalClose.addEventListener('click', () => editModal.classList.remove('active'));

      deleteBtn.addEventListener('click', () => {
        const id = parseInt(document.getElementById('edit-id').value);
        entries = entries.filter(en => en.id !== id);
        saveEntries();
        renderEntries(entries);
        editModal.classList.remove('active');
      });

      editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('edit-id').value);
        const updated = {
          id,
          date: document.getElementById('edit-date').value,
          title: document.getElementById('edit-title').value,
          description: document.getElementById('edit-description').value
        };
        const idx = entries.findIndex(x => x.id === id);
        if (idx !== -1) entries[idx] = updated;
        saveEntries();
        renderEntries(entries);
        editModal.classList.remove('active');
      });

      appInitialized = true;
    }
  }

  function saveEntries() {
    if (!currentUser) return;
    localStorage.setItem(entriesKeyFor(currentUser.id), JSON.stringify(entries));
  }

  function renderEntries(list) {
    entriesList.innerHTML = '';
    if (!list || list.length === 0) {
      entriesList.innerHTML = '<div class="no-entries">No entries found. Add your first work entry!</div>';
      return;
    }
    // sort newest-first by date
    list.sort((a,b) => new Date(b.date) - new Date(a.date));

    list.forEach(entry => {
      const el = document.createElement('div');
      el.className = 'entry-card';
      const formattedDate = new Date(entry.date).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric', weekday:'short' });
      el.innerHTML = `
        <div class="entry-header">
          <span class="entry-date">${formattedDate}</span>
          <div class="entry-actions">
            <button class="btn btn-info edit-btn" data-id="${entry.id}">Edit</button>
          </div>
        </div>
        <h3 class="entry-title">${escapeHtml(entry.title)}</h3>
        <div class="entry-content">${escapeHtml(entry.description)}</div>
      `;
      entriesList.appendChild(el);
    });

    // attach edit listeners
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'));
        openEditModal(id);
      });
    });
  }

  function openEditModal(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    document.getElementById('edit-id').value = entry.id;
    document.getElementById('edit-date').value = entry.date;
    document.getElementById('edit-title').value = entry.title;
    document.getElementById('edit-description').value = entry.description;
    editModal.classList.add('active');
  }

  // ----------------------------
  // Storage helpers & crypto
  // ----------------------------
  function loadUsers() {
    return JSON.parse(localStorage.getItem(usersKey()) || '[]');
  }
  function saveUsers(u) {
    localStorage.setItem(usersKey(), JSON.stringify(u));
  }

  // WebCrypto: PBKDF2 (client-side) -> returns base64 of derived bits (SHA-256)
  async function hashPassword(password, saltBase64) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    const saltBuf = base64ToArrayBuffer(saltBase64);
    const derivedBits = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: 100000,
      hash: 'SHA-256'
    }, keyMaterial, 256);
    return arrayBufferToBase64(derivedBits);
  }

  // small helpers for ArrayBuffer <-> base64
  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  // small escape to avoid injecting raw HTML from user inputs (display only)
  function escapeHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
