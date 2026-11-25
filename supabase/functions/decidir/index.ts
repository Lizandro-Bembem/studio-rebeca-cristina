// A Rebeca responde um pedido: "adicionar" ou "recusar".
//  - adicionar: confirma (se o horário estiver livre) e manda o WhatsApp de confirmação para a cliente
//  - recusar:   marca como recusado e devolve o link do WhatsApp com a mensagem de horários disponíveis
import {
    dataCurta, dataExtenso, db, enviarWhatsApp, Erro, exigirAdmin, horariosLivres, json,
    linkWhatsApp, servir, STUDIO, telefoneBonito, whatsappAtivo,
} from '../_shared/comum.ts';

/** Texto da confirmação (o mesmo do modelo "agendamento_confirmado"), usado quando a API não está ativa */
const textoConfirmacao = (servico: string, data: string, hora: string) =>
    `*MENSAGEM AUTOMÁTICA*\n\n` +
    `*Agendamento realizado!* ✅\n` +
    `Você marcou um serviço de *${servico}* com a profissional ${STUDIO.profissional}\n` +
    `No dia *${dataExtenso(data)}* às *${hora}*.\n\n` +
    `*Nossa tolerância para atraso é de 20 minutos.* Após esse tempo seu horário é cancelado ou seu serviço reduzido.\n\n` +
    `Caso precise desmarcar, por favor avise com antecedência.`;

async function textoRecusa(nome: string, servico: string, data: string, hora: string) {
    const livres = await horariosLivres(5);
    const lista = livres.length
        ? livres.map(d => `*${dataCurta(d.data)}:* ${d.horas.join(', ')}`).join('\n')
        : 'No momento a agenda está cheia. Me chame aqui que encontramos um encaixe pra você!';
    return `Olá, ${nome.split(' ')[0]}! Aqui é do ${STUDIO.nome} 💅\n\n` +
        `Infelizmente o horário de *${servico}* no dia *${dataExtenso(data)}* às *${hora}* não está disponível.\n\n` +
        `📅 *Horários disponíveis:*\n${lista}\n\n` +
        `É só responder com o melhor horário pra você ou agendar de novo pelo site:\n${STUDIO.site}#agendar`;
}

servir(async req => {
    await exigirAdmin(req);
    const { id, acao } = await req.json().catch(() => ({}));
    if (!id || !['adicionar', 'recusar'].includes(acao)) throw new Erro(400, 'Pedido inválido.');

    const { data: ag } = await db.from('agendamentos').select('*').eq('id', id).maybeSingle();
    if (!ag) throw new Erro(404, 'Esse agendamento não existe mais.');
    const servico = (ag.servicos as string[]).join(', ');

    if (acao === 'adicionar') {
        if (ag.status !== 'confirmado') {
            const { error } = await db.from('agendamentos')
                .update({ status: 'confirmado', decidido_em: new Date().toISOString() }).eq('id', id);
            if (error) {
                // índice único: já existe agendamento confirmado nesse dia e horário
                if (error.code === '23505') {
                    const { data: outro } = await db.from('agendamentos').select('nome, servicos, data, hora')
                        .eq('data', ag.data).eq('hora', ag.hora).eq('status', 'confirmado').maybeSingle();
                    throw new Erro(409, 'Já existe um agendamento nesse horário.', {
                        conflito: outro ? { nome: outro.nome, servico: (outro.servicos as string[]).join(', '), data: outro.data, hora: outro.hora } : null,
                    });
                }
                throw error;
            }
        }

        // Confirmação para a cliente pelo número do studio
        // modelo "agendamento_confirmado": {{1}} serviço · {{2}} data · {{3}} hora
        let whatsapp: 'enviado' | 'manual' | 'sem-telefone' = 'sem-telefone';
        let link: string | null = null;
        if (ag.telefone) {
            const enviado = await enviarWhatsApp(ag.telefone, 'agendamento_confirmado', [servico, dataExtenso(ag.data), ag.hora]).catch(() => false);
            if (enviado) whatsapp = 'enviado';
            else { whatsapp = 'manual'; link = linkWhatsApp(ag.telefone, textoConfirmacao(servico, ag.data, ag.hora)); }
        }
        return json({ ok: true, status: 'confirmado', whatsapp, link, apiAtiva: whatsappAtivo() });
    }

    // ---- recusar ----
    if (ag.status === 'confirmado') throw new Erro(409, 'Esse agendamento já foi confirmado. Use "Cancelar" na agenda.');
    await db.from('agendamentos').update({ status: 'recusado', decidido_em: new Date().toISOString() }).eq('id', id);
    const link = ag.telefone ? linkWhatsApp(ag.telefone, await textoRecusa(ag.nome, servico, ag.data, ag.hora)) : null;
    return json({ ok: true, status: 'recusado', link, telefone: ag.telefone ? telefoneBonito(ag.telefone) : null });
});
