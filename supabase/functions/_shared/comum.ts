// =========================================================
// Código compartilhado pelas funções do Studio Rebeca Cristina
// =========================================================
import { createClient, type User } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

// ---------- Configurações do studio (iguais às do site: script.js → CONFIG) ----------
export const STUDIO = {
    nome: 'Studio Rebeca Cristina',
    profissional: 'Rebeca Cristina',
    site: 'https://lizandro-bembem.github.io/studio-rebeca-cristina/',
    servicos: [
        'Manicure', 'Pedicure', 'Mão e pé', 'Esmaltação em gel',
        'Alongamento em gel', 'Manutenção do alongamento', 'Francesinha / Nail art', 'Spa dos pés',
    ],
    horarios: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    diasFechados: [0],      // 0 = domingo
    diasParaFrente: 21,
    fusoHorario: '-03:00',  // Salvador
    maxPedidosPendentesPorCliente: 3,
};

// ---------- Respostas HTTP ----------
export const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export class Erro extends Error {
    constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}

/** Envolve a função: responde CORS, converte erros em JSON */
export function servir(handler: (req: Request) => Promise<Response>) {
    Deno.serve(async req => {
        if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
        if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405);
        try {
            return await handler(req);
        } catch (e) {
            if (e instanceof Erro) return json({ erro: e.message, ...e.extra }, e.status);
            console.error(e);
            return json({ erro: 'Erro inesperado. Tente novamente.' }, 500);
        }
    });
}

// ---------- Banco (com permissão total; só usado aqui no servidor) ----------
export const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
});

export async function usuario(req: Request): Promise<User> {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) throw new Erro(401, 'Faça login para continuar.');
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) throw new Erro(401, 'Sua sessão expirou. Entre de novo.');
    return data.user;
}

export async function exigirAdmin(req: Request): Promise<User> {
    const u = await usuario(req);
    const { data } = await db.from('admins').select('user_id').eq('user_id', u.id).maybeSingle();
    if (!data) throw new Erro(403, 'Acesso permitido só para o studio.');
    return u;
}

// ---------- Telefone ----------
/** Deixa o telefone no formato 55 + DDD + número (só dígitos) */
export function normalizarTelefone(valor: string): string | null {
    let d = String(valor || '').replace(/\D/g, '');
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return /^55\d{10,11}$/.test(d) ? d : null;
}
export const emailInterno = (tel: string) => `${tel}@clientes.studiorebecacristina.app`;
export function telefoneBonito(tel: string) {
    const n = tel.replace(/^55/, '');
    return `(${n.slice(0, 2)}) ${n.slice(2, -4)}-${n.slice(-4)}`;
}

// ---------- Datas (horário de Salvador) ----------
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Data "AAAA-MM-DD" de hoje em Salvador */
export function hojeISO(): string {
    const agora = new Date(Date.now() - 3 * 3600 * 1000);
    return agora.toISOString().slice(0, 10);
}
export function somarDias(iso: string, n: number): string {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}
export const diaDaSemana = (iso: string) => new Date(iso + 'T12:00:00Z').getUTCDay();
export const momento = (iso: string, hora: string) => new Date(`${iso}T${hora}:00${STUDIO.fusoHorario}`);
export function dataExtenso(iso: string) {
    const [a, m, d] = iso.split('-');
    return `${DIAS[diaDaSemana(iso)]}, ${d}/${m}/${a}`;
}
export function dataCurta(iso: string) {
    const [, m, d] = iso.split('-');
    return `${DIAS_CURTOS[diaDaSemana(iso)]}, ${d}/${m}`;
}

/** Horários livres a partir de hoje (no máx. `dias` dias com atendimento) */
export async function horariosLivres(dias = 5): Promise<{ data: string; horas: string[] }[]> {
    const inicio = hojeISO();
    const fim = somarDias(inicio, STUDIO.diasParaFrente);
    const { data: ocupados } = await db.from('agendamentos').select('data, hora')
        .eq('status', 'confirmado').gte('data', inicio).lte('data', fim);
    const tomados = new Set((ocupados || []).map(o => `${o.data} ${o.hora}`));
    const agora = Date.now();
    const lista: { data: string; horas: string[] }[] = [];
    for (let i = 0; i <= STUDIO.diasParaFrente && lista.length < dias; i++) {
        const dia = somarDias(inicio, i);
        if (STUDIO.diasFechados.includes(diaDaSemana(dia))) continue;
        const horas = STUDIO.horarios.filter(h => !tomados.has(`${dia} ${h}`) && momento(dia, h).getTime() > agora + 30 * 60 * 1000);
        if (horas.length) lista.push({ data: dia, horas });
    }
    return lista;
}

// ---------- WhatsApp (API oficial da Meta) ----------
const WA_TOKEN = Deno.env.get('WHATSAPP_TOKEN');
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID');
export const whatsappAtivo = () => Boolean(WA_TOKEN && WA_PHONE_ID);

/**
 * Envia uma mensagem de MODELO aprovado pela Meta.
 * (Mensagens que a empresa inicia precisam ser modelos aprovados.)
 * Os parâmetros não podem ter quebra de linha.
 */
export async function enviarWhatsApp(telefone: string, modelo: string, parametros: string[]): Promise<boolean> {
    if (!whatsappAtivo()) return false;
    const res = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: telefone,
            type: 'template',
            template: {
                name: modelo,
                language: { code: 'pt_BR' },
                components: [{
                    type: 'body',
                    parameters: parametros.map(t => ({ type: 'text', text: String(t).replace(/\s+/g, ' ').trim() })),
                }],
            },
        }),
    });
    if (!res.ok) {
        console.error('WhatsApp falhou', res.status, await res.text());
        return false;
    }
    return true;
}

/** Link que abre o WhatsApp de quem clicar com a mensagem pronta para o número */
export const linkWhatsApp = (telefone: string, texto: string) =>
    `https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`;

// ---------- Notificações (Web Push) ----------
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails(STUDIO.site, VAPID_PUBLIC, VAPID_PRIVATE);

/** Envia notificação para todos os aparelhos da Rebeca */
export async function notificarAdmins(payload: Record<string, unknown>): Promise<number> {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return 0;
    const { data: inscricoes } = await db.from('push_inscricoes').select('endpoint, p256dh, auth');
    let enviados = 0;
    await Promise.all((inscricoes || []).map(async s => {
        try {
            await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                JSON.stringify(payload),
                { TTL: 60 * 60 * 24, urgency: 'high' },
            );
            enviados++;
        } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            // aparelho desinstalou o app ou trocou de permissão: remove a inscrição
            if (code === 404 || code === 410) await db.from('push_inscricoes').delete().eq('endpoint', s.endpoint);
            else console.error('Push falhou', code, e);
        }
    }));
    return enviados;
}
