// Chamado 1x por semana (agendamento no banco) para usar a chave do Brevo
// e evitar que ela expire por 90 dias sem uso. Não envia e-mail nenhum.
import { json, servir } from '../_shared/comum.ts';

servir(async () => {
    const chave = Deno.env.get('BREVO_API_KEY');
    if (!chave) return json({ ok: false, motivo: 'sem-chave' });
    const res = await fetch('https://api.brevo.com/v3/smtp/statistics/aggregatedReport?days=1', {
        headers: { 'api-key': chave, Accept: 'application/json' },
    });
    if (!res.ok) console.error('Chave do Brevo com problema:', res.status, await res.text());
    return json({ ok: res.ok, status: res.status });
});
