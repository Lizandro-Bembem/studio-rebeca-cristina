/* =========================================================
   Studio Rebeca Cristina — painel de agendamentos (só a Rebeca)
   ========================================================= */
(function painel() {
    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => [...el.querySelectorAll(s)];
    const CFG = window.RC_CONFIG || {};

    // Mesmos serviços e horários do site (script.js → CONFIG)
    const SERVICOS = ['Manicure', 'Pedicure', 'Mão e pé', 'Esmaltação em gel', 'Alongamento em gel', 'Manutenção do alongamento', 'Francesinha / Nail art', 'Spa dos pés'];
    const HORARIOS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const STATUS = { pendente: 'Aguardando', confirmado: 'Confirmado', recusado: 'Recusado', cancelado: 'Cancelado' };

    const mostrar = id => ['admOff', 'admLogin', 'admNegado', 'admPainel'].forEach(s => { $('#' + s).hidden = s !== id; });

    // service worker (notificações e app offline)
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

    if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !window.supabase) { mostrar('admOff'); return; }

    const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'rc-sessao' },
    });

    // ---------- utilidades ----------
    const escapar = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const dataObj = iso => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
    const dataExtenso = iso => { const [a, m, d] = iso.split('-'); return `${DIAS[dataObj(iso).getDay()]}, ${d}/${m}/${a}`; };
    const tituloDia = iso => {
        const hoje = hojeISO(), amanha = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
        const base = dataExtenso(iso);
        return iso === hoje ? `Hoje · ${base}` : iso === amanha ? `Amanhã · ${base}` : base.charAt(0).toUpperCase() + base.slice(1);
    };
    const telBonito = t => t ? `(${t.slice(2, 4)}) ${t.slice(4, -4)}-${t.slice(-4)}` : '';
    function normalizarTelefone(v) {
        let d = String(v || '').replace(/\D/g, '');
        if (d.length === 10 || d.length === 11) d = '55' + d;
        return /^55\d{10,11}$/.test(d) ? d : null;
    }
    $$('input[type="tel"]').forEach(input => input.addEventListener('input', () => {
        const d = input.value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11);
        let v = d;
        if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
        if (d.length > 7) v = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
        input.value = v;
    }));
    // botão de "olho" (mostrar/ocultar senha)
    $$('input[type="password"]').forEach(input => {
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
    let toastT;
    function toast(txt, ms = 4500) {
        const t = $('#toast'); t.textContent = txt; t.classList.add('is-show');
        clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-show'), ms);
    }
    const carregando = (btn, sim) => { btn.disabled = sim; btn.classList.toggle('is-loading', sim); };
    async function erroDaFuncao(error) {
        try { return await error.context.json(); } catch { return { erro: 'Sem conexão. Tente de novo.' }; }
    }
    /** Abre o WhatsApp (no iPhone, sair do app pelo link é o jeito mais confiável) */
    const abrirWhatsApp = link => { window.location.href = link; };

    // ---------- modais ----------
    const abrir = m => { m.classList.add('is-open'); m.setAttribute('aria-hidden', 'false'); };
    const fechar = m => { m.classList.remove('is-open'); m.setAttribute('aria-hidden', 'true'); };
    $$('.isheet').forEach(m => {
        $$('[data-isheet-close]', m).forEach(b => b.addEventListener('click', () => fechar(m)));
        m.addEventListener('click', e => { if (e.target === m) fechar(m); });
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.isheet.is-open').forEach(fechar); });

    // ---------- login ----------
    $('#admFormLogin').addEventListener('submit', async e => {
        e.preventDefault();
        const f = e.currentTarget, err = $('.aerr', f), btn = $('button[type="submit"]', f);
        const tel = normalizarTelefone(f.telefone.value);
        if (!tel || f.senha.value.length < 6) { err.textContent = 'Digite o WhatsApp e a senha.'; return; }
        carregando(btn, true); err.textContent = '';
        const { error } = await sb.auth.signInWithPassword({ email: `${tel}@clientes.studiorebecacristina.app`, password: f.senha.value });
        carregando(btn, false);
        if (error) err.textContent = 'WhatsApp ou senha incorretos.';
    });
    const sair = async () => { await sb.auth.signOut(); };
    $('#admSair').addEventListener('click', sair);
    $$('[data-sair]').forEach(b => b.addEventListener('click', sair));

    let iniciado = false;
    async function verificarSessao(session) {
        $('#admSair').hidden = !session;
        if (!session) { iniciado = false; mostrar('admLogin'); return; }
        const { data } = await sb.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
        if (!data) { mostrar('admNegado'); return; }
        mostrar('admPainel');
        if (!iniciado) { iniciado = true; iniciarPainel(session.user.id); }
    }
    sb.auth.getSession().then(({ data }) => verificarSessao(data.session));
    sb.auth.onAuthStateChange((ev, session) => {
        if (['SIGNED_IN', 'SIGNED_OUT'].includes(ev)) setTimeout(() => verificarSessao(session), 0);
    });

    // ---------- painel ----------
    let agendamentos = [];
    let meuId = null;

    async function iniciarPainel(userId) {
        meuId = userId;
        prepararNotificacoes();
        await carregar();
        // atualiza sozinho quando chegar pedido novo
        sb.channel('agendamentos').on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => carregar()).subscribe();
        document.addEventListener('visibilitychange', () => { if (!document.hidden) carregar(); });
        // veio da notificação? abre a janela "Adicionar agendamento?"
        const pedido = new URLSearchParams(location.search).get('pedido');
        if (pedido) { abrirPedido(pedido); history.replaceState(null, '', location.pathname); }
    }

    async function carregar() {
        const desde = new Date(); desde.setDate(desde.getDate() - 45);
        const { data, error } = await sb.from('agendamentos').select('*')
            .gte('data', `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`)
            .order('data').order('hora');
        if (error) { toast('Não foi possível carregar os agendamentos.'); return; }
        agendamentos = data;
        renderizar();
    }

    function cartao(a, botoes = '') {
        return `<li class="acard acard--${a.status}" data-id="${a.id}">
            <div class="acard__hora"><strong>${a.hora}</strong><small>${a.data.slice(8)}/${a.data.slice(5, 7)}</small></div>
            <div class="acard__info">
                <strong>${escapar(a.nome)}</strong>
                <span>${escapar(a.servicos.join(', '))}</span>
                ${a.observacao ? `<em>“${escapar(a.observacao)}”</em>` : ''}
                ${a.telefone ? `<a href="https://wa.me/${a.telefone}" target="_blank" rel="noopener">${telBonito(a.telefone)}</a>` : ''}
            </div>
            <div class="acard__acoes">${botoes}</div>
        </li>`;
    }

    function renderizar() {
        const hoje = hojeISO();
        const pendentes = agendamentos.filter(a => a.status === 'pendente' && a.data >= hoje);
        const confirmados = agendamentos.filter(a => a.status === 'confirmado' && a.data >= hoje);
        const historico = agendamentos.filter(a => !pendentes.includes(a) && !confirmados.includes(a)).reverse().slice(0, 40);

        $('#contPendentes').textContent = pendentes.length;
        if ('setAppBadge' in navigator) (pendentes.length ? navigator.setAppBadge(pendentes.length) : navigator.clearAppBadge()).catch(() => {});

        $('#listaPendentes').innerHTML = pendentes.length
            ? pendentes.map(a => cartao(a, `<button type="button" class="btn btn--dark btn--sm" data-responder="${a.id}">Responder</button>`)).join('')
            : '<li class="adm__vazio">Nenhum pedido aguardando resposta. ✨</li>';

        const porDia = {};
        confirmados.forEach(a => { (porDia[a.data] ||= []).push(a); });
        $('#listaAgenda').innerHTML = Object.keys(porDia).length
            ? Object.entries(porDia).map(([dia, itens]) => `<h3 class="adm__dia">${tituloDia(dia)}</h3><ul class="adm__lista">${itens.map(a => cartao(a, `<button type="button" class="auth__link" data-cancelar="${a.id}">Cancelar</button>`)).join('')}</ul>`).join('')
            : '<p class="adm__vazio">Nenhum horário confirmado ainda.</p>';

        $('#listaHistorico').innerHTML = historico.length
            ? historico.map(a => cartao(a, `<span class="tag tag--${a.status}">${STATUS[a.status]}</span>`)).join('')
            : '<li class="adm__vazio">Sem histórico por enquanto.</li>';

        $$('[data-responder]').forEach(b => b.addEventListener('click', () => abrirPedido(b.dataset.responder)));
        $$('[data-cancelar]').forEach(b => b.addEventListener('click', () => cancelar(b.dataset.cancelar)));
    }

    // abas
    $$('.adm__tab').forEach(t => t.addEventListener('click', () => {
        $$('.adm__tab').forEach(x => x.classList.toggle('is-active', x === t));
        $$('[data-painel-tab]').forEach(p => { p.hidden = p.dataset.painelTab !== t.dataset.tab; });
    }));

    async function cancelar(id) {
        const a = agendamentos.find(x => x.id === id);
        if (!a || !confirm(`Cancelar o horário de ${a.nome} (${a.hora} de ${dataExtenso(a.data)})? O horário volta a ficar livre no site.`)) return;
        const { error } = await sb.from('agendamentos').update({ status: 'cancelado', decidido_em: new Date().toISOString() }).eq('id', id);
        if (error) { toast('Não foi possível cancelar.'); return; }
        toast('Horário cancelado e liberado no site.');
        carregar();
    }

    // ---------- janela "Adicionar Agendamento?" ----------
    const modal = $('#pedidoModal');
    let pedidoAtual = null;

    async function abrirPedido(id) {
        let a = agendamentos.find(x => x.id === id);
        if (!a) { const { data } = await sb.from('agendamentos').select('*').eq('id', id).maybeSingle(); a = data; }
        if (!a) { toast('Esse pedido não foi encontrado.'); return; }
        pedidoAtual = a;
        $('#pedidoInfo').innerHTML = `
            <dt>Cliente</dt><dd>${escapar(a.nome)}</dd>
            <dt>WhatsApp</dt><dd>${a.telefone ? telBonito(a.telefone) : '—'}</dd>
            <dt>Serviço</dt><dd>${escapar(a.servicos.join(', '))}</dd>
            <dt>Dia</dt><dd>${dataExtenso(a.data)}</dd>
            <dt>Horário</dt><dd>${a.hora}</dd>
            ${a.observacao ? `<dt>Observação</dt><dd>${escapar(a.observacao)}</dd>` : ''}`;
        $('#pedidoConflito').hidden = true;
        $('#pedidoErro').textContent = '';
        const jaRespondido = a.status !== 'pendente';
        $('#pedidoAcoes').hidden = jaRespondido;
        $('#pedidoStatus').hidden = !jaRespondido;
        $('#pedidoStatus').textContent = jaRespondido ? `Este pedido já foi respondido: ${STATUS[a.status]}.` : '';
        $('#pedidoTitulo').textContent = jaRespondido ? 'Agendamento' : 'Adicionar Agendamento?';
        abrir(modal);
    }

    async function decidir(acao, btn) {
        if (!pedidoAtual) return;
        carregando(btn, true);
        $('#pedidoErro').textContent = '';
        const { data, error } = await sb.functions.invoke('decidir', { body: { id: pedidoAtual.id, acao } });
        carregando(btn, false);

        if (error) {
            const corpo = await erroDaFuncao(error);
            if (corpo.conflito !== undefined) {
                const c = corpo.conflito;
                $('#pedidoConflitoTxt').textContent = c
                    ? `${c.nome} já está marcada para ${c.servico} em ${dataExtenso(c.data)} às ${c.hora}.`
                    : 'Escolha outro horário para esta cliente.';
                $('#pedidoConflito').hidden = false;
                $('#pedidoAcoes').hidden = true;
                return;
            }
            $('#pedidoErro').textContent = corpo.erro || 'Não foi possível responder. Tente de novo.';
            return;
        }

        fechar(modal);
        carregar();
        if (acao === 'adicionar') {
            if (data.whatsapp === 'enviado') toast('Agendamento adicionado! ✅ A cliente recebeu a confirmação no WhatsApp.');
            else if (data.link) { toast('Agendamento adicionado! Abrindo o WhatsApp para enviar a confirmação…'); setTimeout(() => abrirWhatsApp(data.link), 700); }
            else toast('Agendamento adicionado! ✅');
        } else {
            if (data.link) { toast('Abrindo o WhatsApp com os horários disponíveis…'); setTimeout(() => abrirWhatsApp(data.link), 700); }
            else toast('Pedido recusado.');
        }
    }
    $('#pedidoAdicionar').addEventListener('click', e => decidir('adicionar', e.currentTarget));
    $('#pedidoRecusar').addEventListener('click', e => decidir('recusar', e.currentTarget));
    $('#pedidoRecusarConflito').addEventListener('click', e => decidir('recusar', e.currentTarget));

    // ---------- novo agendamento manual ----------
    $('#novoServico').innerHTML = SERVICOS.map(s => `<option>${s}</option>`).join('');
    $('#novoHora').innerHTML = HORARIOS.map(h => `<option>${h}</option>`).join('');
    $('#btnNovo').addEventListener('click', () => {
        $('#formNovo').reset();
        $('#formNovo').data.value = hojeISO();
        $('#formNovo').data.min = hojeISO();
        $('.aerr', $('#formNovo')).textContent = '';
        abrir($('#novoModal'));
    });
    $('#formNovo').addEventListener('submit', async e => {
        e.preventDefault();
        const f = e.currentTarget, err = $('.aerr', f), btn = $('button[type="submit"]', f);
        const nome = f.nome.value.trim();
        const tel = f.telefone.value.trim() ? normalizarTelefone(f.telefone.value) : null;
        if (nome.length < 1) { err.textContent = 'Digite o nome da cliente.'; return; }
        if (f.telefone.value.trim() && !tel) { err.textContent = 'WhatsApp inválido (com DDD).'; return; }
        if (!f.data.value) { err.textContent = 'Escolha o dia.'; return; }
        carregando(btn, true); err.textContent = '';
        const { error } = await sb.from('agendamentos').insert({
            nome, telefone: tel, servicos: [f.servico.value], data: f.data.value, hora: f.hora.value,
            status: 'confirmado', origem: 'manual', decidido_em: new Date().toISOString(),
        });
        carregando(btn, false);
        if (error) {
            if (error.code === '23505') {
                const outro = agendamentos.find(a => a.status === 'confirmado' && a.data === f.data.value && a.hora === f.hora.value);
                err.textContent = `⚠️ Já existe agendamento nesse horário${outro ? ` (${outro.nome} – ${outro.servicos.join(', ')})` : ''}.`;
            } else err.textContent = 'Não foi possível salvar. Tente de novo.';
            return;
        }
        fechar($('#novoModal'));
        toast('Agendamento adicionado à agenda! ✅');
        carregar();
    });

    // ---------- senha nova para cliente ----------
    $('#btnSenha').addEventListener('click', () => { $('#formSenha').reset(); $('.aerr', $('#formSenha')).textContent = ''; abrir($('#senhaModal')); });
    $('#formSenha').addEventListener('submit', async e => {
        e.preventDefault();
        const f = e.currentTarget, err = $('.aerr', f), btn = $('button[type="submit"]', f);
        carregando(btn, true); err.textContent = '';
        const { data, error } = await sb.functions.invoke('redefinir-senha', { body: { telefone: f.telefone.value, senha: f.senha.value } });
        carregando(btn, false);
        if (error) { err.textContent = (await erroDaFuncao(error)).erro || 'Não foi possível salvar.'; return; }
        fechar($('#senhaModal'));
        toast(`Senha nova salva para ${data.nome}. Envie a senha para ela pelo WhatsApp.`);
    });

    // ---------- notificações no celular ----------
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const instalado = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

    function chaveVapid(base64) {
        const pad = '='.repeat((4 - base64.length % 4) % 4);
        const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
        return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
    }

    function statusNotif(titulo, texto, botao = null) {
        $('#notifTitulo').textContent = titulo;
        $('#notifTexto').textContent = texto;
        $('#notifBtn').hidden = !botao;
        if (botao) $('#notifBtn').textContent = botao;
        $('#admNotif').classList.toggle('is-ok', !botao && titulo.includes('ativadas'));
    }

    async function prepararNotificacoes() {
        if (!CFG.vapidPublicKey) { statusNotif('Notificações', 'Chave de notificações ainda não configurada.'); return; }
        if (isIOS && !instalado) { statusNotif('Instale o app para receber avisos', 'No iPhone: toque em Compartilhar → "Adicionar à Tela de Início" e abra o painel pelo app.'); return; }
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
            statusNotif('Notificações indisponíveis', isIOS ? 'Atualize o iPhone para o iOS 16.4 ou mais novo.' : 'Este navegador não suporta notificações.');
            return;
        }
        if (Notification.permission === 'denied') {
            statusNotif('Notificações bloqueadas', isIOS ? 'Ative em Ajustes → Notificações → Rebeca Cristina.' : 'Libere as notificações nas configurações do navegador.');
            return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub && Notification.permission === 'granted') { await salvarInscricao(sub); statusNotif('Notificações ativadas ✓', 'Você será avisada a cada novo pedido neste aparelho.'); return; }
        statusNotif('Ative as notificações', 'Receba um aviso no celular a cada novo agendamento.', 'Ativar');
    }

    async function salvarInscricao(sub) {
        const j = sub.toJSON();
        await sb.from('push_inscricoes').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: meuId });
    }

    $('#notifBtn').addEventListener('click', async e => {
        const btn = e.currentTarget;
        carregando(btn, true);
        try {
            const permissao = await Notification.requestPermission();
            if (permissao !== 'granted') { carregando(btn, false); prepararNotificacoes(); return; }
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveVapid(CFG.vapidPublicKey) });
            await salvarInscricao(sub);
            await reg.showNotification('Notificações ativadas ✨', { body: 'Pronto! Você será avisada a cada novo agendamento.', icon: 'icons/icon-192.png', badge: 'icons/favicon-32.png' });
            statusNotif('Notificações ativadas ✓', 'Você será avisada a cada novo pedido neste aparelho.');
        } catch (err) {
            console.error(err);
            statusNotif('Não foi possível ativar', 'Tente de novo. No iPhone, abra o painel pelo app instalado.', 'Tentar de novo');
        }
        carregando(btn, false);
    });
})();
