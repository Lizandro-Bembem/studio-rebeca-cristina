// Cliente logada envia um pedido de agendamento.
// Valida, grava como "pendente", avisa a Rebeca (notificação) e manda WhatsApp de "pedido recebido".
import {
    dataCurta, dataExtenso, db, diaDaSemana, enviarWhatsApp, Erro, hojeISO, json, momento,
    notificarAdmins, servir, somarDias, STUDIO, usuario,
} from '../_shared/comum.ts';

servir(async req => {
    const user = await usuario(req);
    const body = await req.json().catch(() => ({}));

    // ---- validações ----
    const servicos: string[] = Array.isArray(body.servicos) ? [...new Set(body.servicos.map(String))] : [];
    if (!servicos.length || servicos.some(s => !STUDIO.servicos.includes(s))) throw new Erro(400, 'Escolha um serviço válido.');

    const data = String(body.data || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Erro(400, 'Escolha um dia válido.');
    const hoje = hojeISO();
    if (data < hoje || data > somarDias(hoje, STUDIO.diasParaFrente)) throw new Erro(400, 'Esse dia não está disponível para agendamento.');
    if (STUDIO.diasFechados.includes(diaDaSemana(data))) throw new Erro(400, 'O studio não atende nesse dia.');

    const hora = String(body.hora || '');
    if (!STUDIO.horarios.includes(hora)) throw new Erro(400, 'Escolha um horário válido.');
    if (momento(data, hora).getTime() <= Date.now()) throw new Erro(400, 'Esse horário já passou. Escolha outro.');

    const observacao = String(body.observacao || '').trim().slice(0, 500) || null;

    // ---- cliente ----
    const { data: perfil } = await db.from('perfis').select('nome, telefone').eq('id', user.id).maybeSingle();
    if (!perfil) throw new Erro(400, 'Complete o seu cadastro para agendar.');

    // ---- horário já ocupado? ----
    const { data: ocupado } = await db.from('agendamentos').select('id')
        .eq('data', data).eq('hora', hora).eq('status', 'confirmado').maybeSingle();
    if (ocupado) throw new Erro(409, 'Esse horário acabou de ser ocupado. Escolha outro, por favor.', { ocupado: true });

    // ---- limite de pedidos em aberto (evita spam) ----
    const { count } = await db.from('agendamentos').select('id', { count: 'exact', head: true })
        .eq('cliente_id', user.id).eq('status', 'pendente').gte('data', hoje);
    if ((count || 0) >= STUDIO.maxPedidosPendentesPorCliente) {
        throw new Erro(429, 'Você já tem pedidos aguardando confirmação. Aguarde a resposta do studio.');
    }

    // ---- grava ----
    const { data: novo, error } = await db.from('agendamentos').insert({
        cliente_id: user.id, nome: perfil.nome, telefone: perfil.telefone,
        servicos, data, hora, observacao, status: 'pendente', origem: 'site',
    }).select('id').single();
    if (error) throw error;

    const servicoTxt = servicos.join(', ');

    // ---- avisa a Rebeca no celular ----
    await notificarAdmins({
        tipo: 'novo-agendamento',
        id: novo.id,
        title: 'Novo agendamento ✨',
        body: `${perfil.nome} · ${servicoTxt}\n${dataCurta(data)} às ${hora}${observacao ? `\nObs.: ${observacao}` : ''}`,
        url: `./admin.html?pedido=${novo.id}`,
    }).catch(e => console.error(e));

    // ---- avisa a cliente no WhatsApp (modelo "agendamento_recebido") ----
    // {{1}} nome · {{2}} serviço · {{3}} data · {{4}} hora
    const whatsapp = await enviarWhatsApp(perfil.telefone, 'agendamento_recebido',
        [perfil.nome.split(' ')[0], servicoTxt, dataExtenso(data), hora]).catch(() => false);

    return json({ ok: true, id: novo.id, whatsapp });
});
