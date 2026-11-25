/* =========================================================
   Studio Rebeca Cristina — interações e animações
   ========================================================= */

/* ---------------------------------------------------------
   CONFIGURAÇÕES — edite aqui com facilidade
   --------------------------------------------------------- */
const CONFIG = {
    // Número do WhatsApp (somente números, com 55 + DDD)
    whatsapp: '5571993018287',

    // Serviços que aparecem no agendamento
    servicos: [
        'Manicure',
        'Pedicure',
        'Mão e pé',
        'Esmaltação em gel',
        'Alongamento em gel',
        'Manutenção do alongamento',
        'Francesinha / Nail art',
        'Spa dos pés',
    ],

    // Horários disponíveis
    horarios: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],

    // Dias em que o studio NÃO atende (0 = domingo, 1 = segunda ... 6 = sábado)
    diasFechados: [0],

    // Quantos dias para frente aparecem no calendário
    diasParaFrente: 21,
};

/* ---------------------------------------------------------
   Utilidades
   --------------------------------------------------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------
   Bloqueio de zoom no celular (pinça e toque duplo)
   --------------------------------------------------------- */
(function blockZoom() {
    // iOS Safari ignora "user-scalable=no", então bloqueamos os gestos manualmente
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(evt =>
        document.addEventListener(evt, e => e.preventDefault(), { passive: false })
    );
    // Pinça com dois dedos
    document.addEventListener('touchmove', e => {
        if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault();
    }, { passive: false });
    // Toque duplo rápido
    let lastTouch = 0;
    document.addEventListener('touchend', e => {
        const now = Date.now();
        if (now - lastTouch <= 300 && !e.target.closest('input, textarea, select')) e.preventDefault();
        lastTouch = now;
    }, { passive: false });
    // Ctrl + roda do mouse / teclado (zoom do navegador em trackpads)
    document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
})();

/* ---------------------------------------------------------
   Preloader + entrada do hero
   --------------------------------------------------------- */
$$('.split').forEach(el => {
    el.innerHTML = `<span class="split__in">${el.innerHTML}</span>`;
});

let started = false;
function startSite() {
    if (started) return;
    started = true;
    $('#preloader').classList.add('is-done');
    document.body.classList.remove('is-loading');
    setTimeout(() => {
        document.body.classList.add('is-ready');
        $$('.hero .reveal-img').forEach(el => el.classList.add('is-in'));
    }, 250);
}
window.addEventListener('load', () => setTimeout(startSite, reducedMotion ? 0 : 1500));
setTimeout(startSite, 4000); // segurança caso algo demore a carregar

/* ---------------------------------------------------------
   Fotos: carrega as imagens da pasta img/ (se existirem)
   Se a foto não existir, fica o degradê elegante no lugar.
   --------------------------------------------------------- */
$$('[data-img]').forEach(el => {
    const src = el.dataset.img;
    const img = new Image();
    img.onload = () => {
        el.style.backgroundImage = `url("${src}")`;
        el.classList.add('has-img');
    };
    img.src = src;
});

/* ---------------------------------------------------------
   Animações ao rolar (reveal)
   --------------------------------------------------------- */
const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        // efeito cascata entre irmãos que entram juntos
        const siblings = $$('.reveal', el.parentElement).filter(s => !s.classList.contains('is-in'));
        const index = Math.max(0, siblings.indexOf(el));
        el.style.setProperty('--d', `${Math.min(index, 6) * 0.08}s`);
        el.classList.add('is-in');
        io.unobserve(el);
    });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

$$('.reveal').forEach(el => io.observe(el));
$$('.reveal-img').forEach(el => { if (!el.closest('.hero')) io.observe(el); });

/* ---------------------------------------------------------
   Header, barra de progresso, botões flutuantes, parallax
   --------------------------------------------------------- */
const header = $('#header');
const progressBar = $('#progressBar');
const toTop = $('#toTop');
const waFloat = $('.wa-float');
const parallaxEls = $$('[data-parallax]');
let lastY = 0;
let ticking = false;

function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;

    header.classList.toggle('is-scrolled', y > 30);
    if (!document.body.classList.contains('menu-open')) {
        header.classList.toggle('is-hidden', y > lastY && y > 500);
    }
    progressBar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    toTop.classList.toggle('is-visible', y > 800);
    waFloat.classList.toggle('is-visible', y > 300);

    if (!reducedMotion) {
        parallaxEls.forEach(el => {
            const speed = parseFloat(el.dataset.parallax) || 0;
            const rect = el.getBoundingClientRect();
            const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed;
            el.style.translate = `0 ${offset.toFixed(1)}px`;
        });
    }

    lastY = y;
    ticking = false;
}
window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
}, { passive: true });
onScroll();

toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* Link ativo no menu conforme a seção */
const navLinks = $$('.nav__link');
const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            navLinks.forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === `#${entry.target.id}`));
        }
    });
}, { rootMargin: '-45% 0px -50% 0px' });
$$('section[id]').forEach(s => sectionObserver.observe(s));

/* ---------------------------------------------------------
   Menu mobile
   --------------------------------------------------------- */
const burger = $('#burger');
function toggleMenu(force) {
    const open = typeof force === 'boolean' ? force : !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    $('#mmenu').setAttribute('aria-hidden', !open);
    header.classList.remove('is-hidden');
}
burger.addEventListener('click', () => toggleMenu());
$$('.mmenu a').forEach(a => a.addEventListener('click', () => toggleMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { toggleMenu(false); closeLightbox(); } });

/* ---------------------------------------------------------
   Cursor personalizado, botões magnéticos e cards 3D (desktop)
   --------------------------------------------------------- */
if (finePointer && !reducedMotion) {
    const cursor = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;

    window.addEventListener('mousemove', e => {
        mx = e.clientX; my = e.clientY;
        dot.style.transform = `translate(${mx}px, ${my}px)`;
    });
    (function loop() {
        rx += (mx - rx) * 0.16;
        ry += (my - ry) * 0.16;
        ring.style.transform = `translate(${rx}px, ${ry}px)`;
        requestAnimationFrame(loop);
    })();
    document.addEventListener('mouseover', e => {
        cursor.classList.toggle('is-hover', !!e.target.closest('a, button, .g-item, .service, label'));
    });

    // Botões magnéticos
    $$('.magnetic').forEach(btn => {
        btn.addEventListener('mousemove', e => {
            const r = btn.getBoundingClientRect();
            const x = e.clientX - r.left - r.width / 2;
            const y = e.clientY - r.top - r.height / 2;
            btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
        });
        btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });

    // Cards com inclinação 3D + brilho que segue o mouse
    $$('.tilt').forEach(card => {
        card.addEventListener('mousemove', e => {
            const r = card.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width;
            const py = (e.clientY - r.top) / r.height;
            card.style.setProperty('--mx', `${px * 100}%`);
            card.style.setProperty('--my', `${py * 100}%`);
            card.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 8}deg) rotateY(${(px - 0.5) * 8}deg) translateY(-6px)`;
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
}

/* ---------------------------------------------------------
   Galeria: filtros + lightbox
   --------------------------------------------------------- */
const filters = $('.filters');
const pill = document.createElement('span');
pill.className = 'filters__pill';
filters.prepend(pill);

function movePill(btn) {
    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.transform = `translateX(${btn.offsetLeft}px)`;
}
const activeFilter = $('.filter.is-active');
requestAnimationFrame(() => movePill(activeFilter));
window.addEventListener('resize', () => movePill($('.filter.is-active')));
document.fonts && document.fonts.ready.then(() => movePill($('.filter.is-active')));

const gItems = $$('.g-item');
$$('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.filter').forEach(b => b.classList.toggle('is-active', b === btn));
        movePill(btn);
        const cat = btn.dataset.filter;

        gItems.forEach(item => { item.style.opacity = '0'; item.style.transform = 'scale(.94)'; });
        setTimeout(() => {
            gItems.forEach(item => {
                const show = cat === 'todos' || item.dataset.cat === cat;
                item.classList.toggle('is-hidden', !show);
                item.classList.add('is-in');
            });
            requestAnimationFrame(() => {
                gItems.forEach((item, i) => {
                    setTimeout(() => { item.style.opacity = ''; item.style.transform = ''; }, i * 50);
                });
            });
        }, 300);
    });
});

const lightbox = $('#lightbox');
const lbImg = $('#lbImg');
const lbCap = $('#lbCap');
let lbIndex = 0;
const visibleItems = () => gItems.filter(i => !i.classList.contains('is-hidden'));

function showLightbox(i) {
    const list = visibleItems();
    lbIndex = (i + list.length) % list.length;
    const item = list[lbIndex];
    const ph = $('.ph', item);
    lbImg.style.backgroundImage = getComputedStyle(ph).backgroundImage;
    lbCap.textContent = $('figcaption', item)?.textContent || '';
}
function openLightbox(item) {
    showLightbox(visibleItems().indexOf(item));
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-open');
}
function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-open');
}
gItems.forEach(item => item.addEventListener('click', () => openLightbox(item)));
$('#lbClose').addEventListener('click', closeLightbox);
$('#lbPrev').addEventListener('click', () => showLightbox(lbIndex - 1));
$('#lbNext').addEventListener('click', () => showLightbox(lbIndex + 1));
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'ArrowLeft') showLightbox(lbIndex - 1);
    if (e.key === 'ArrowRight') showLightbox(lbIndex + 1);
});
// Deslizar para os lados no celular
let touchX = null;
lightbox.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
lightbox.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) showLightbox(lbIndex + (dx < 0 ? 1 : -1));
    touchX = null;
});

/* ---------------------------------------------------------
   Agendamento (envia o pedido pelo WhatsApp)
   --------------------------------------------------------- */
const form = $('#bookingForm');
const state = { step: 1, servicos: new Set(), dia: null, hora: null };
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_EXTENSO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

// Serviços
const serviceChips = $('#serviceChips');
CONFIG.servicos.forEach(nome => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = nome;
    b.dataset.value = nome;
    b.addEventListener('click', () => {
        state.servicos.has(nome) ? state.servicos.delete(nome) : state.servicos.add(nome);
        b.classList.toggle('is-selected');
    });
    serviceChips.appendChild(b);
});

// Dias
const daysEl = $('#days');
const today = new Date();
today.setHours(0, 0, 0, 0);
for (let i = 0; i < CONFIG.diasParaFrente; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'day';
    b.innerHTML = `<small>${i === 0 ? 'Hoje' : DIAS_SEMANA[d.getDay()]}</small><strong>${String(d.getDate()).padStart(2, '0')}</strong><small>${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small>`;
    b.disabled = CONFIG.diasFechados.includes(d.getDay());
    b.addEventListener('click', () => {
        $$('.day', daysEl).forEach(x => x.classList.remove('is-selected'));
        b.classList.add('is-selected');
        state.dia = d;
        renderTimes();
    });
    daysEl.appendChild(b);
}

// Horários
const timeChips = $('#timeChips');
function renderTimes() {
    timeChips.innerHTML = '';
    const now = new Date();
    CONFIG.horarios.forEach(h => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = h;
        if (state.dia) {
            const [hh, mm] = h.split(':').map(Number);
            const slot = new Date(state.dia);
            slot.setHours(hh, mm);
            b.disabled = slot < now;
        }
        if (state.hora === h && !b.disabled) b.classList.add('is-selected');
        b.addEventListener('click', () => {
            $$('.chip', timeChips).forEach(x => x.classList.remove('is-selected'));
            b.classList.add('is-selected');
            state.hora = h;
        });
        timeChips.appendChild(b);
    });
    if (state.hora && !$('.chip.is-selected', timeChips)) state.hora = null;
}
renderTimes();

// Navegação entre passos
const steps = $$('.bstep', form);
const bar = $('#bformBar');
function goTo(n, back = false) {
    state.step = n;
    steps.forEach(s => {
        const active = Number(s.dataset.step) === n;
        s.classList.toggle('is-active', active);
        s.classList.toggle('is-back', active && back);
    });
    bar.style.width = `${(n / 3) * 100}%`;
    $$('.bform__error', form).forEach(e => e.classList.remove('is-show'));
    if (n === 3) renderSummary();
}
function showError(n) {
    const err = $(`[data-error="${n}"]`, form);
    err.classList.remove('is-show');
    void err.offsetWidth; // reinicia a animação
    err.classList.add('is-show');
}
function validate(n) {
    if (n === 1) return state.servicos.size > 0;
    if (n === 2) return !!state.dia && !!state.hora;
    if (n === 3) return $('#bName').value.trim().length > 1;
    return true;
}
$$('[data-next]', form).forEach(b => b.addEventListener('click', () => {
    if (!validate(state.step)) return showError(state.step);
    goTo(state.step + 1);
}));
$$('[data-prev]', form).forEach(b => b.addEventListener('click', () => goTo(state.step - 1, true)));

function dataFormatada(d) {
    return `${DIAS_EXTENSO[d.getDay()]}, ${d.toLocaleDateString('pt-BR')}`;
}
function renderSummary() {
    $('#summary').innerHTML = `
    <div><b>Serviço:</b> ${[...state.servicos].join(', ')}</div>
    <div><b>Dia:</b> ${dataFormatada(state.dia)}</div>
    <div><b>Horário:</b> ${state.hora}</div>`;
}

form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate(3)) return showError(3);

    const nome = $('#bName').value.trim();
    const obs = $('#bNote').value.trim();
    let msg = `Olá, Rebeca! Gostaria de agendar um horário 💅\n\n`;
    msg += `*Nome:* ${nome}\n`;
    msg += `*Serviço:* ${[...state.servicos].join(', ')}\n`;
    msg += `*Dia:* ${dataFormatada(state.dia)}\n`;
    msg += `*Horário:* ${state.hora}\n`;
    if (obs) msg += `*Observação:* ${obs}\n`;
    msg += `\nEsse horário está disponível?`;

    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');

    steps.forEach(s => s.classList.remove('is-active'));
    $('#bdone').classList.add('is-active');
    bar.style.width = '100%';
});

$('#bRestart').addEventListener('click', () => {
    state.servicos.clear(); state.dia = null; state.hora = null;
    $$('.chip, .day', form).forEach(c => c.classList.remove('is-selected'));
    form.reset();
    renderTimes();
    $('#bdone').classList.remove('is-active');
    goTo(1);
});

// Botão "Agendar" dos cards de serviço → já seleciona o serviço
$$('.service').forEach(card => {
    $('.service__btn', card).addEventListener('click', () => {
        const nome = card.dataset.service;
        const chip = $(`.chip[data-value="${CSS.escape(nome)}"]`, serviceChips);
        if (chip && !state.servicos.has(nome)) { state.servicos.add(nome); chip.classList.add('is-selected'); }
        if (state.step !== 1 && !$('#bdone').classList.contains('is-active')) goTo(1, true);
        $('#agendar').scrollIntoView({ behavior: 'smooth' });
    });
});

/* Ano no rodapé */
$('#year').textContent = new Date().getFullYear();

/* ---------------------------------------------------------
   App instalável (PWA)
   --------------------------------------------------------- */
// Service worker: deixa o app instalável e funcionando sem internet
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}

(function installApp() {
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const installBtns = $$('[data-install]');
    const sheet = $('#installSheet');
    let deferredPrompt = null;

    const showButtons = show => installBtns.forEach(b => { b.hidden = !show; });

    // Já está aberto como app: não mostra o botão
    if (isStandalone) return;

    // Android, Windows, Mac, Linux e ChromeOS (Chrome, Edge, Samsung Internet, Opera...)
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        showButtons(true);
    });
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        showButtons(false);
        closeSheet();
    });

    // iPhone/iPad não têm botão automático: mostramos o passo a passo
    if (isIOS) showButtons(true);

    function openSheet() {
        $$('.isheet__steps', sheet).forEach(ol => { ol.hidden = ol.dataset.os !== (isIOS ? 'ios' : 'other'); });
        sheet.classList.add('is-open');
        sheet.setAttribute('aria-hidden', 'false');
    }
    function closeSheet() {
        sheet.classList.remove('is-open');
        sheet.setAttribute('aria-hidden', 'true');
    }

    installBtns.forEach(btn => btn.addEventListener('click', async () => {
        if (document.body.classList.contains('menu-open')) toggleMenu(false);
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            if (outcome === 'accepted') showButtons(false);
        } else {
            openSheet();
        }
    }));
    $$('[data-isheet-close]', sheet).forEach(b => b.addEventListener('click', closeSheet));
    sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
})();