// "Esqueci minha senha": envia para o e-mail da cliente um link para criar uma senha nova.
// A cliente pode informar o e-mail OU o WhatsApp cadastrado.
import {
    db, emailAtivo, emailInterno, emailValido, enviarEmail, Erro, json,
    normalizarTelefone, servir, STUDIO,
} from '../_shared/comum.ts';

const ESPERA_SEGUNDOS = 60;

servir(async req => {
    const { contato } = await req.json().catch(() => ({}));
    const valor = String(contato || '').trim().toLowerCase();
    const tel = normalizarTelefone(valor);
    if (!tel && !emailValido(valor)) throw new Erro(400, 'Digite o e-mail ou o WhatsApp da sua conta.');

    // E-mail ainda não configurado: a cliente fala com o studio
    if (!emailAtivo()) return json({ ok: false, motivo: 'email-desativado' });

    const filtro = tel ? db.from('perfis').select('id, nome, telefone, email, recuperacao_em').eq('telefone', tel)
                       : db.from('perfis').select('id, nome, telefone, email, recuperacao_em').eq('email', valor);
    const { data: perfil } = await filtro.maybeSingle();

    // Resposta igual exista ou não a conta (não revela quem é cliente)
    const resposta = { ok: true, mensagem: 'Se existir uma conta com esses dados, enviamos um link para o e-mail cadastrado.' };
    if (!perfil?.email) return json(resposta);

    if (perfil.recuperacao_em && Date.now() - new Date(perfil.recuperacao_em).getTime() < ESPERA_SEGUNDOS * 1000) {
        throw new Erro(429, 'Acabamos de enviar um link. Confira seu e-mail (e a caixa de spam) ou tente de novo em 1 minuto.');
    }

    const { data: link, error } = await db.auth.admin.generateLink({ type: 'recovery', email: emailInterno(perfil.telefone) });
    if (error || !link?.properties?.hashed_token) throw error || new Error('Falha ao gerar link');
    await db.from('perfis').update({ recuperacao_em: new Date().toISOString() }).eq('id', perfil.id);

    const url = `${STUDIO.site}?recuperar=${encodeURIComponent(link.properties.hashed_token)}`;
    const primeiroNome = perfil.nome.split(' ')[0];
    const html = `
<div style="background:#FFEDD7;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#3D2A1A">
  <div style="max-width:460px;margin:0 auto;background:#FFF8EE;border-radius:20px;padding:32px 28px;text-align:center">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#BB8A5F">${STUDIO.nome}</p>
    <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:normal;font-size:26px;color:#3D2A1A">Criar uma senha nova</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#6b5240">Olá, ${primeiroNome}! Recebemos um pedido para trocar a senha da sua conta. Toque no botão abaixo para criar uma senha nova:</p>
    <a href="${url}" style="display:inline-block;background:#3D2A1A;color:#FFEDD7;text-decoration:none;padding:15px 30px;border-radius:100px;font-size:15px;font-weight:bold">Criar senha nova</a>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#8A6A4C">O link vale por 1 hora e só pode ser usado uma vez.<br>Se não foi você que pediu, é só ignorar este e-mail — sua senha continua a mesma.</p>
  </div>
</div>`;
    const enviado = await enviarEmail(perfil.email, perfil.nome, 'Criar senha nova — Studio Rebeca Cristina', html).catch(() => false);
    // Se o e-mail falhar (ex.: chave do Brevo vencida), a cliente é levada ao WhatsApp do studio
    if (!enviado) {
        await db.from('perfis').update({ recuperacao_em: null }).eq('id', perfil.id);
        return json({ ok: false, motivo: 'email-falhou' });
    }

    return json(resposta);
});
