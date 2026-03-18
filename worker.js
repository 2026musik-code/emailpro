const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EMAIL PRO - Temporary Web Mail</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background: radial-gradient(ellipse at top, #581c87, #111827, #000000);
            background-attachment: fixed;
            color: white;
            min-height: 100vh;
        }
        .glass-card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 1.5rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
    </style>
</head>
<body class="antialiased selection:bg-purple-500/30">
    <div id="app" class="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col">
        <header class="flex items-center justify-between py-6 mb-8">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <i data-lucide="mail" class="w-6 h-6 text-white"></i>
                </div>
                <h1 class="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
                    EMAIL PRO
                </h1>
            </div>
            <button id="logoutBtn" class="hidden text-sm font-medium text-purple-200 hover:text-white flex items-center gap-2 transition-colors">
                <i data-lucide="log-out" class="w-4 h-4"></i>
                <span class="hidden sm:inline">Logout</span>
            </button>
        </header>

        <main id="landingPage" class="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
            <div class="text-center mb-10">
                <h2 class="text-4xl font-bold mb-4 tracking-tight">Temporary Email,<br/>Premium Experience.</h2>
                <p class="text-purple-200/80 text-lg">Buat alamat email sementara yang aman dan instan.</p>
            </div>
            <div class="w-full glass-card p-6 sm:p-8">
                <form id="generateForm" class="space-y-5">
                    <div>
                        <label class="block text-sm font-medium text-purple-200 mb-2">Custom Name</label>
                        <input type="text" id="usernameInput" required placeholder="contoh: john" class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-purple-200 mb-2">Pilih Domain</label>
                        <div class="relative">
                            <select id="domainSelect" class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all">
                                <option value="">Memuat domain...</option>
                            </select>
                            <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                                <i data-lucide="chevron-down" class="w-4 h-4"></i>
                            </div>
                        </div>
                    </div>
                    <div id="errorMsg" class="hidden p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"></div>
                    <button type="submit" id="generateBtn" class="w-full bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2">
                        <span id="generateText">Generate Email</span>
                        <i data-lucide="loader-2" id="generateLoader" class="w-5 h-5 animate-spin hidden"></i>
                    </button>
                </form>
            </div>
        </main>

        <main id="dashboardPage" class="hidden flex-1 flex flex-col space-y-6">
            <div class="glass-card p-6 sm:p-8 relative overflow-hidden group">
                <div class="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <p class="text-sm font-medium text-purple-200 mb-3">Alamat Email Anda</p>
                <div id="copyEmailBtn" class="flex items-center justify-between bg-black/20 border border-white/5 rounded-2xl p-4 cursor-pointer hover:bg-black/30 transition-colors group/copy">
                    <span id="currentEmail" class="text-xl sm:text-2xl font-medium truncate pr-4">memuat...</span>
                    <div id="copyIconWrapper" class="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 text-white/50 group-hover/copy:text-white group-hover/copy:bg-white/10 transition-all">
                        <i data-lucide="copy" class="w-5 h-5"></i>
                    </div>
                </div>
                <p id="copiedMsg" class="hidden text-emerald-400 text-sm mt-3 absolute bottom-4 right-8">Disalin ke clipboard!</p>
            </div>

            <div class="glass-card overflow-hidden flex flex-col min-h-[400px]">
                <div class="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                    <div class="flex items-center gap-3">
                        <i data-lucide="inbox" class="w-5 h-5 text-purple-300"></i>
                        <h3 class="text-lg font-semibold">Kotak Masuk</h3>
                        <span id="msgCount" class="bg-purple-500/20 text-purple-300 text-xs font-bold px-2.5 py-1 rounded-full">0</span>
                    </div>
                    <button id="refreshBtn" class="p-2 rounded-lg hover:bg-white/10 text-purple-200 hover:text-white transition-colors" title="Refresh Manual">
                        <i data-lucide="refresh-cw" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="flex-1 overflow-y-auto">
                    <div id="emptyInbox" class="flex flex-col items-center justify-center h-64 text-center px-4">
                        <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                            <i data-lucide="loader-2" class="w-8 h-8 text-purple-400/50 animate-spin"></i>
                        </div>
                        <p class="text-purple-200 font-medium">Menunggu email masuk...</p>
                        <p class="text-sm text-purple-200/60 mt-2">Otomatis refresh setiap 10 detik</p>
                    </div>
                    <ul id="messageList" class="hidden divide-y divide-white/5"></ul>
                </div>
            </div>
        </main>
    </div>

    <div id="messageModal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="modalBackdrop"></div>
        <div class="relative w-full max-w-2xl bg-gray-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="p-4 sm:p-6 border-b border-white/10 flex items-start justify-between bg-white/[0.02]">
                <div class="pr-4">
                    <h2 id="modalSubject" class="text-xl font-bold text-white mb-2">Subjek</h2>
                    <div class="flex items-center gap-2 text-sm text-purple-200">
                        <span id="modalSenderName" class="font-medium text-white">Nama</span>
                        <span id="modalSenderEmail" class="opacity-60">&lt;email&gt;</span>
                    </div>
                </div>
                <button id="closeModalBtn" class="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="p-4 sm:p-6 overflow-y-auto flex-1 bg-black/20">
                <div id="modalLoader" class="flex items-center justify-center h-32">
                    <i data-lucide="loader-2" class="w-8 h-8 text-purple-500 animate-spin"></i>
                </div>
                <div id="modalContent" class="hidden prose prose-invert max-w-none"></div>
            </div>
        </div>
    </div>

    <script>
        lucide.createIcons();
        const API_BASE = 'https://api.mail.tm';
        let account = JSON.parse(localStorage.getItem('mail_account')) || null;
        let token = localStorage.getItem('mail_token') || null;
        let pollingInterval = null;

        const landingPage = document.getElementById('landingPage');
        const dashboardPage = document.getElementById('dashboardPage');
        const logoutBtn = document.getElementById('logoutBtn');
        const domainSelect = document.getElementById('domainSelect');
        const generateForm = document.getElementById('generateForm');
        const usernameInput = document.getElementById('usernameInput');
        const generateBtn = document.getElementById('generateBtn');
        const generateText = document.getElementById('generateText');
        const generateLoader = document.getElementById('generateLoader');
        const errorMsg = document.getElementById('errorMsg');
        const currentEmail = document.getElementById('currentEmail');
        const copyEmailBtn = document.getElementById('copyEmailBtn');
        const copyIconWrapper = document.getElementById('copyIconWrapper');
        const copiedMsg = document.getElementById('copiedMsg');
        const refreshBtn = document.getElementById('refreshBtn');
        const msgCount = document.getElementById('msgCount');
        const emptyInbox = document.getElementById('emptyInbox');
        const messageList = document.getElementById('messageList');
        const messageModal = document.getElementById('messageModal');
        const modalBackdrop = document.getElementById('modalBackdrop');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const modalSubject = document.getElementById('modalSubject');
        const modalSenderName = document.getElementById('modalSenderName');
        const modalSenderEmail = document.getElementById('modalSenderEmail');
        const modalLoader = document.getElementById('modalLoader');
        const modalContent = document.getElementById('modalContent');

        async function init() {
            if (account && token) {
                showDashboard();
            } else {
                showLanding();
                await fetchDomains();
            }
        }

        async function fetchDomains() {
            try {
                const res = await fetch(API_BASE + '/domains');
                const data = await res.json();
                if (data['hydra:member']) {
                    domainSelect.innerHTML = '';
                    data['hydra:member'].forEach(d => {
                        const option = document.createElement('option');
                        option.value = d.domain;
                        option.textContent = '@' + d.domain;
                        option.className = 'bg-gray-900 text-white';
                        domainSelect.appendChild(option);
                    });
                }
            } catch (err) {
                showError('Gagal mengambil daftar domain.');
            }
        }

        generateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = usernameInput.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const domain = domainSelect.value;
            if (!username || !domain) return;

            setLoading(true);
            errorMsg.classList.add('hidden');

            const address = username + '@' + domain;
            const password = Math.random().toString(36).slice(-8) + 'A1!';

            try {
                const accRes = await fetch(API_BASE + '/accounts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address, password })
                });

                if (!accRes.ok) {
                    const errData = await accRes.json();
                    throw new Error(errData.message || 'Gagal membuat akun');
                }
                const accData = await accRes.json();

                const tokenRes = await fetch(API_BASE + '/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address, password })
                });

                if (!tokenRes.ok) throw new Error('Gagal mendapatkan token');
                const tokenData = await tokenRes.json();

                account = accData;
                token = tokenData.token;
                localStorage.setItem('mail_account', JSON.stringify(account));
                localStorage.setItem('mail_token', token);

                showDashboard();
            } catch (err) {
                showError(err.message);
            } finally {
                setLoading(false);
            }
        });

        async function fetchMessages() {
            if (!token) return;
            const refreshIcon = refreshBtn.querySelector('i');
            refreshIcon.classList.add('animate-spin');
            
            try {
                const res = await fetch(API_BASE + '/messages', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    renderMessages(data['hydra:member'] || []);
                }
            } catch (err) {
                console.error('Gagal mengambil pesan', err);
            } finally {
                setTimeout(() => refreshIcon.classList.remove('animate-spin'), 500);
            }
        }

        function renderMessages(messages) {
            msgCount.textContent = messages.length;
            if (messages.length === 0) {
                emptyInbox.classList.remove('hidden');
                messageList.classList.add('hidden');
                return;
            }
            emptyInbox.classList.add('hidden');
            messageList.classList.remove('hidden');
            messageList.innerHTML = '';

            messages.forEach(msg => {
                const time = new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const li = document.createElement('li');
                li.innerHTML = \`
                    <button onclick="readMessage('\${msg.id}')" class="w-full text-left p-4 sm:p-6 hover:bg-white/[0.03] transition-colors flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between mb-1">
                                <p class="font-semibold text-white truncate pr-4">\${msg.from.address}</p>
                                <span class="text-xs text-purple-200/60 whitespace-nowrap">\${time}</span>
                            </div>
                            <p class="text-sm text-purple-200 truncate">\${msg.subject || '(Tanpa Subjek)'}</p>
                        </div>
                    </button>
                \`;
                messageList.appendChild(li);
            });
        }

        window.readMessage = async function(id) {
            messageModal.classList.remove('hidden');
            modalContent.classList.add('hidden');
            modalLoader.classList.remove('hidden');
            
            try {
                const res = await fetch(API_BASE + '/messages/' + id, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    modalSubject.textContent = data.subject || '(Tanpa Subjek)';
                    modalSenderName.textContent = data.from.name || data.from.address;
                    modalSenderEmail.textContent = '<' + data.from.address + '>';
                    
                    if (data.html) {
                        modalContent.innerHTML = \`<iframe srcdoc="\${data.html.replace(/"/g, '&quot;')}" class="w-full min-h-[300px] bg-white rounded-xl" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"></iframe>\`;
                    } else {
                        modalContent.innerHTML = \`<pre class="whitespace-pre-wrap font-sans text-purple-100/80 text-sm leading-relaxed">\${data.text || 'Tidak ada konten'}</pre>\`;
                    }
                    
                    modalLoader.classList.add('hidden');
                    modalContent.classList.remove('hidden');
                }
            } catch (err) {
                console.error('Gagal membaca pesan', err);
                closeModal();
            }
        }

        function showLanding() {
            landingPage.classList.remove('hidden');
            dashboardPage.classList.add('hidden');
            logoutBtn.classList.add('hidden');
            if (pollingInterval) clearInterval(pollingInterval);
        }

        function showDashboard() {
            landingPage.classList.add('hidden');
            dashboardPage.classList.remove('hidden');
            logoutBtn.classList.remove('hidden');
            logoutBtn.classList.add('flex');
            currentEmail.textContent = account.address;
            
            fetchMessages();
            pollingInterval = setInterval(fetchMessages, 10000);
        }

        function setLoading(isLoading) {
            generateBtn.disabled = isLoading;
            if (isLoading) {
                generateText.classList.add('hidden');
                generateLoader.classList.remove('hidden');
            } else {
                generateText.classList.remove('hidden');
                generateLoader.classList.add('hidden');
            }
        }

        function showError(msg) {
            errorMsg.textContent = msg;
            errorMsg.classList.remove('hidden');
        }

        function closeModal() {
            messageModal.classList.add('hidden');
            modalContent.innerHTML = '';
        }

        copyEmailBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(account.address);
            copyIconWrapper.classList.replace('text-white/50', 'text-emerald-400');
            copyIconWrapper.classList.replace('bg-white/5', 'bg-emerald-500/20');
            copiedMsg.classList.remove('hidden');
            
            setTimeout(() => {
                copyIconWrapper.classList.replace('text-emerald-400', 'text-white/50');
                copyIconWrapper.classList.replace('bg-emerald-500/20', 'bg-white/5');
                copiedMsg.classList.add('hidden');
            }, 2000);
        });

        refreshBtn.addEventListener('click', fetchMessages);
        closeModalBtn.addEventListener('click', closeModal);
        modalBackdrop.addEventListener('click', closeModal);
        
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('mail_account');
            localStorage.removeItem('mail_token');
            account = null;
            token = null;
            showLanding();
            fetchDomains();
        });

        init();
    </script>
</body>
</html>\`;

export default {
  async fetch(request, env, ctx) {
    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    });
  },
};
