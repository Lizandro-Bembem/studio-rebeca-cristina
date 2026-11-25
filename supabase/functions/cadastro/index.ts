// Cria a conta da cliente: nome + telefone (WhatsApp) + senha. Não usa e-mail.
import { db, emailInterno, Erro, json, normalizarTelefone, servir } from '../_shared/comum.ts';

servir(async req => {
    const { nome, telefone, senha } = await req.json().catch(() => ({}));

    const nomeLimpo = String(nome || '').replace(/\s+/g, ' ').trim();
    if (nomeLimpo.length < 2 || nomeLimpo.length > 80) throw new Erro(400, 'Digite o seu nome.');
    const tel = normalizarTelefone(telefone);
    if (!tel) throw new Erro(400, 'Digite um WhatsApp válido, com DDD.');
    if (typeof senha !== 'string' || senha.length < 6) throw new Erro(400, 'A senha precisa ter pelo menos 6 caracteres.');
    if (senha.length > 72) throw new Erro(400, 'Senha muito longa.');

    const { data: existente } = await db.from('perfis').select('id').eq('telefone', tel).maybeSingle();
    if (existente) throw new Erro(409, 'Já existe uma conta com esse WhatsApp. Faça login.');

    const { data: criado, error } = await db.auth.admin.createUser({
        email: emailInterno(tel),
        password: senha,
        email_confirm: true,
        user_metadata: { nome: nomeLimpo, telefone: tel },
    });
    if (error || !criado.user) {
        if (/already|registered|exists/i.test(error?.message || '')) throw new Erro(409, 'Já existe uma conta com esse WhatsApp. Faça login.');
        throw error;
    }

    const { error: perfilErro } = await db.from('perfis').insert({ id: criado.user.id, nome: nomeLimpo, telefone: tel });
    if (perfilErro) {
        await db.auth.admin.deleteUser(criado.user.id);
        throw perfilErro;
    }

    // O número configurado como da Rebeca vira administrador automaticamente
    const telAdmin = normalizarTelefone(Deno.env.get('ADMIN_TELEFONE') || '');
    if (telAdmin && telAdmin === tel) await db.from('admins').insert({ user_id: criado.user.id });

    return json({ ok: true });
});
