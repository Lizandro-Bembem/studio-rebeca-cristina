/* =========================================================
   Studio Rebeca Cristina — agenda online (login, cadastro, pedidos)
   Funciona junto com o script.js. As chaves ficam em config.js;
   enquanto estiverem vazias, o site continua no modo antigo (WhatsApp).
   ========================================================= */
const RC_CONFIG = window.RC_CONFIG || {};

window.RC = { ativo: false };

(function agendaOnline() {
    if (!RC_CONFIG.supabaseUrl || !RC_CONFIG.supabaseAnonKey) return;

    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => [...el.querySelectorAll(s)];
    const emailInterno = tel => `${tel}@clientes.studiorebecacristina.app`;
    const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const STATUS = { pendente: 'Aguardando', confirmado: 'Confirmado', recusado: 'Indisponível', cancelado: 'Cancelado' };

    function normalizarTelefone(v) {
        let d = String(v || '').replace(/\D/g, '');
        if (d.length === 10 || d.length === 11) d = '55' + d;
        return /^55\d{10,11}$/.test(d) ? d : null;
    }
    function mascaraTelefone(input) {
        input.addEventListener('input', () => {
            const d = input.value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11);
            let v = d;
            if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
            if (d.length > 7) v = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
            input.value = v;
        });
    }
    /** Coloca o botão de "olho" (mostrar/ocultar senha) em todos os campos de senha */
    function olhosDeSenha(raiz) {
        $$('input[type="password"]', raiz).forEach(input => {
            if (input.parentElement.classList.contains('afield__senha')) return;
            const caixa = document.createElement('div');
            caixa.className = 'afield__senha';
            input.replaceWith(caixa);
            const olho = document.createElement('button');
            olho.type = 'button';
            olho.className = 'afield__olho';
            olho.setAttribute('aria-label', 'Mostrar senha');
            olho.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="risco" d="M3 3l18 18"/></svg>';
            olho.addEventListener('click', e => {
                e.preventDefault();
                const mostrar = input.type === 'password';
                input.type = mostrar ? 'text' : 'password';
                olho.classList.toggle('is-on', mostrar);
                olho.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
                input.focus();
            });
            caixa.append(input, olho);
        });
    }
    const dataCurta = iso => { const [a, m, d] = iso.split('-'); return `${DIAS_CURTOS[new Date(+a, m - 1, +d).getDay()]}, ${d}/${m}`; };
    const escapar = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // Carrega a biblioteca do Supabase só quando a agenda online está ativa
    const lib = document.createElement('script');
    lib.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
    lib.onload = iniciar;
    document.head.appendChild(lib);

    function iniciar() {
        const sb = window.supabase.createClient(RC_CONFIG.supabaseUrl, RC_CONFIG.supabaseAnonKey, {
            auth: { persistSession: true, autoRefreshToken: true, storageKey: 'rc-sessao' },
        });
        window.RC = { ativo: true, sb, config: RC_CONFIG, enviarPedido };
        window.RC.normalizarTelefone = normalizarTelefone;
        window.RC.emailInterno = emailInterno;

        let perfil = null;     // { nome, telefone }
        let ehAdmin = false;
        let acaoPendente = null; // pedido aguardando login

        const authModal = $('#authModal');
        const contaModal = $('#contaModal');
        const contaBtns = $$('[data-conta]');
        const bConta = $('#bConta');
        const bNameField = $('#bName')?.closest('.field');

        // ---------------- Modais ----------------
        const abrir = m => { m.classList.add('is-open'); m.setAttribute('aria-hidden', 'false'); };
        const fechar = m => { m.classList.remove('is-open'); m.setAttribute('aria-hidden', 'true'); };
        [authModal, contaModal].forEach(m => {
            $$('[data-isheet-close]', m).forEach(b => b.addEventListener('click', () => fechar(m)));
            m.addEventListener('click', e => { if (e.target === m) fechar(m); });
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') { fechar(authModal); fechar(contaModal); } });

        // abas Entrar / Criar conta (e a tela "Esqueci minha senha")
        function aba(nome) {
            $$('.auth__tab', authModal).forEach(b => b.classList.toggle('is-active', b.dataset.aba === nome));
            $('.auth__tabs', authModal).hidden = nome === 'recuperar';
            $$('[data-painel]', authModal).forEach(p => { p.hidden = p.dataset.painel !== nome; });
            $$('.aerr, .aok', authModal).forEach(e => { e.textContent = ''; });
        }
        $$('[data-aba]', authModal).forEach(b => b.addEventListener('click', () => aba(b.dataset.aba)));
        $$('input[type="tel"]', authModal).forEach(mascaraTelefone);
        olhosDeSenha(document);

        function abrirLogin(abaInicial = 'entrar', aviso = '') {
            aba(abaInicial);
            $('#authAviso').textContent = aviso;
            $('#authAviso').hidden = !aviso;
            abrir(authModal);
            setTimeout(() => $(`[data-painel="${abaInicial}"] input`, authModal)?.focus(), 350);
        }

        const carregando = (btn, sim) => { btn.disabled = sim; btn.classList.toggle('is-loading', sim); };

        // Entrar
        $('#formEntrar').addEventListener('submit', async e => {
            e.preventDefault();
            const f = e.currentTarget, err = $('.aerr', f), btn = $('button[type="submit"]', f);
            const tel = normalizarTelefone(f.telefone.value);
            if (!tel) { err.textContent = 'Digite o seu WhatsApp com DDD.'; return; }
            if (f.senha.value.length < 6) { err.textContent = 'Digite a sua senha.'; return; }
            carregando(btn, true); err.textContent = '';
            const { error } = await sb.auth.signInWithPassword({ email: emailInterno(tel), password: f.senha.value });
            carregando(btn, false);
            if (error) { err.textContent = /invalid/i.test(error.message) ? 'WhatsApp ou senha incorretos.' : 'Não foi possível entrar. Tente de novo.'; return; }
            f.reset();
        });

        // Criar conta
        $('#formCadastro').addEventListener('submit', async e => {
            e.preventDefault();
            const f = e.currentTarget, err = $('.aerr', f), btn = $('button[type="submit"]', f);
            const nome = f.nome.value.trim();
            const tel = normalizarTelefone(f.telefone.value);
            const email = f.email.value.trim().toLowerCase();
            if (nome.length < 2) { err.textContent = 'Digite o seu nome.'; return; }
            if (!tel) { err.textContent = 'Digite um WhatsApp válido, com DDD.'; return; }
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = 'Digite um e-mail válido.'; return; }
            if (f.senha.value.length < 6) { err.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
            if (f.senha.value !== f.senha2.value) { err.textContent = 'As senhas não são iguais.'; return; }
            carregando(btn, true); err.textContent = '';
            const { data, error } = await sb.functions.invoke('cadastro', { body: { nome, telefone: tel, email, senha: f.senha.value } });
            if (error) {
                carregando(btn, false);
                let msg = 'Não foi possível criar a conta. Tente de novo.';
                try { msg = (await error.context.json()).erro || msg; } catch {}
                err.textContent = msg;
                return;
            }
            if (data?.ok) {
                const { error: e2 } = await sb.auth.signInWithPassword({ email: emailInterno(tel), password: f.senha.value });
                carregando(btn, false);
                if (e2) { err.textContent = 'Conta criada! Agora é só entrar.'; aba('entrar'); return; }
                f.reset();
            }
        });

        // ---------------- Esqueci minha senha ----------------
        function pedirAjudaAoStudio(contato) {
            const msg = `Olá! Esqueci a senha da minha conta no site do Studio.${contato ? ` Meus dados: ${contato}.` : ''} Pode criar uma senha nova pra mim?`;
            window.open(`https://wa.me/${RC_CONFIG.whatsappStudio}?text=${encodeURIComponent(msg)}`, '_blank');
        }
        $('#esqueciSenha').addEventListener('click', () => {
            aba('recuperar');
            $('#formRecuperar').contato.value = $('#formEntrar').telefone.value;
            setTimeout(() => $('#formRecuperar').contato.focus(), 50);
        });
        $('#formRecuperar').addEventListener('submit', async e => {
            e.preventDefault();
            const f = e.currentTarget, err = $('.aerr', f), okMsg = $('.aok', f), btn = $('button[type="submit"]', f);
            const contato = f.contato.value.trim();
            if (!contato) { err.textContent = 'Digite o e-mail ou o WhatsApp da sua conta.'; return; }
            carregando(btn, true); err.textContent = ''; okMsg.textContent = '';
            const { data, error } = await sb.functions.invoke('recuperar-senha', { body: { contato } });
            carregando(btn, false);
            if (error) {
                let msg = 'Não foi possível enviar agora. Tente de novo.';
                try { msg = (await error.context.json()).erro || msg; } catch {}
                err.textContent = msg;
                return;
            }
            if (data?.motivo === 'email-desativado' || data?.motivo === 'email-falhou') {
                err.textContent = 'Não conseguimos enviar o e-mail agora. Vamos te levar ao WhatsApp do studio para ajudar.';
                setTimeout(() => pedirAjudaAoStudio(contato), 1200);
                return;
            }
            okMsg.textContent = `${data.mensagem} Confira também a caixa de spam.`;
        });

        // Link do e-mail: ?recuperar=<código> → criar senha nova
        const novaSenhaModal = $('#novaSenhaModal');
        $$('[data-isheet-close]', novaSenhaModal).forEach(b => b.addEventListener('click', () => fechar(novaSenhaModal)));
        const codigoRecuperacao = new URLSearchParams(location.search).get('recuperar');
        if (codigoRecuperacao) {
            history.replaceState(null, '', location.pathname + location.hash);
            sb.auth.verifyOtp({ token_hash: codigoRecuperacao, type: 'recovery' }).then(({ error }) => {
                if (error) {
                    abrirLogin('recuperar');
                    $('.aerr', $('#formRecuperar')).textContent = 'Esse link expirou ou já foi usado. Peça um link novo abaixo.';
                    return;
                }
                abrir(novaSenhaModal);
                setTimeout(() => $('#formNovaSenha').senha.focus(), 350);
            });
        }
        $('#formNovaSenha').addEventListener('submit', async e => {
            e.preventDefault();
            const f = e.currentTarget, err = $('.aerr', f), btn = $('button[type="submit"]', f);
            if (f.senha.value.length < 6) { err.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
            if (f.senha.value !== f.senha2.value) { err.textContent = 'As senhas não são iguais.'; return; }
            carregando(btn, true); err.textContent = '';
            const { error } = await sb.auth.updateUser({ password: f.senha.value });
            carregando(btn, false);
            if (error) { err.textContent = /different|same/i.test(error.message) ? 'A senha nova precisa ser diferente da antiga.' : 'Não foi possível salvar. Peça um link novo.'; return; }
            f.reset();
            fechar(novaSenhaModal);
            avisar('Senha nova salva! Você já está conectada. ✨');
        });
        function avisar(texto) {
            let t = $('.toast');
            if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
            t.textContent = texto; t.classList.add('is-show');
            setTimeout(() => t.classList.remove('is-show'), 4500);
        }

        // ---------------- Sessão ----------------
        async function atualizarSessao(session) {
            perfil = null; ehAdmin = false;
            if (session?.user) {
                const [{ data: p }, { data: a }] = await Promise.all([
                    sb.from('perfis').select('nome, telefone').eq('id', session.user.id).maybeSingle(),
                    sb.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle(),
                ]);
                perfil = p || { nome: session.user.user_metadata?.nome || 'Cliente', telefone: session.user.user_metadata?.telefone || '' };
                ehAdmin = !!a;
            }
            const primeiroNome = perfil?.nome?.split(' ')[0];
            contaBtns.forEach(b => {
                b.hidden = false;
                $('span', b).textContent = perfil ? primeiroNome : 'Entrar';
                b.setAttribute('aria-label', perfil ? 'Minha conta' : 'Entrar ou criar conta');
            });
            $$('[data-admin-link]').forEach(a => { a.hidden = !ehAdmin; });

            // passo 3 do agendamento
            if (bNameField) bNameField.hidden = true;
            bConta.hidden = false;
            bConta.innerHTML = perfil
                ? `<span>Agendando como</span><strong>${escapar(perfil.nome)}</strong>`
                : `<span>Para enviar o pedido</span><strong>Entre ou crie sua conta</strong><button type="button" class="bconta__sair" data-entrar>Entrar</button>`;
            $('[data-entrar]', bConta)?.addEventListener('click', () => abrirLogin());

            if (perfil) {
                fechar(authModal);
                if (acaoPendente) { const a = acaoPendente; acaoPendente = null; enviarPedido(a); }
            }
        }
        sb.auth.getSession().then(({ data }) => atualizarSessao(data.session));
        sb.auth.onAuthStateChange((evento, session) => {
            if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(evento)) setTimeout(() => atualizarSessao(session), 0);
        });

        // Botão da conta (cabeçalho / menu)
        contaBtns.forEach(b => b.addEventListener('click', () => {
            if (document.body.classList.contains('menu-open')) window.toggleMenu?.(false);
            if (perfil) abrirConta(); else abrirLogin();
        }));
        $('#contaSair').addEventListener('click', async () => { await sb.auth.signOut(); fechar(contaModal); });

        async function abrirConta() {
            $('#contaNome').textContent = perfil.nome;
            $('#contaTel').textContent = perfil.telefone ? `(${perfil.telefone.slice(2, 4)}) ${perfil.telefone.slice(4, -4)}-${perfil.telefone.slice(-4)}` : '';
            const lista = $('#contaLista');
            lista.innerHTML = '<li class="clista__vazio">Carregando…</li>';
            abrir(contaModal);
            const { data } = await sb.from('agendamentos').select('servicos, data, hora, status')
                .order('data', { ascending: false }).order('hora', { ascending: false }).limit(12);
            lista.innerHTML = data?.length
                ? data.map(a => `<li><div><strong>${escapar(a.servicos.join(', '))}</strong><small>${dataCurta(a.data)} às ${a.hora}</small></div><span class="tag tag--${a.status}">${STATUS[a.status]}</span></li>`).join('')
                : '<li class="clista__vazio">Você ainda não tem agendamentos.</li>';
        }

        // ---------------- Horários ocupados ----------------
        async function carregarOcupados() {
            const hoje = new Date();
            const fim = new Date(); fim.setDate(fim.getDate() + 30);
            const { data, error } = await sb.rpc('horarios_ocupados', { inicio: RCsite.ymd(hoje), fim: RCsite.ymd(fim) });
            if (error) return;
            window.RC_OCUPADOS = new Set(data.map(o => `${o.data} ${o.hora}`));
            RCsite.renderTimes();
        }
        carregarOcupados();
        document.addEventListener('visibilitychange', () => { if (!document.hidden) carregarOcupados(); });

        // ---------------- Enviar pedido ----------------
        async function enviarPedido(pedido) {
            if (!perfil) {
                acaoPendente = pedido;
                abrirLogin('entrar', 'Entre ou crie sua conta para enviar o pedido. Leva menos de 1 minuto!');
                return;
            }
            const btn = $('#bookingForm button[type="submit"]');
            const err = $('[data-error="3"]');
            carregando(btn, true);
            const { data, error } = await sb.functions.invoke('agendar', { body: pedido });
            carregando(btn, false);
            if (error) {
                let corpo = {};
                try { corpo = await error.context.json(); } catch {}
                err.textContent = corpo.erro || 'Não foi possível enviar. Verifique a internet e tente de novo.';
                err.classList.remove('is-show'); void err.offsetWidth; err.classList.add('is-show');
                if (corpo.ocupado) { await carregarOcupados(); RCsite.state.hora = null; RCsite.goTo(2, true); }
                return;
            }
            $('#bdone h3').textContent = 'Pedido enviado!';
            $('#bdone p').textContent = data?.whatsapp
                ? 'A Rebeca já recebeu o seu pedido. Você receberá a confirmação no seu WhatsApp. 💅'
                : 'A Rebeca já recebeu o seu pedido e vai confirmar pelo WhatsApp em breve. 💅';
            RCsite.mostrarConcluido();
        }
    }
})();
