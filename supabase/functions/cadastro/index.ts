// Cria a conta da cliente: nome + WhatsApp + e-mail + senha.
// O login é feito com WhatsApp + senha; o e-mail serve para recuperar a senha.
import { db, emailInterno, emailValido, Erro, json, normalizarTelefone, servir } from '../_shared/comum.ts';

servir(async req => {
    const { nome, telefone, email, senha } = await req.json().catch(() => ({}));

    const nomeLimpo = String(nome || '').replace(/\s+/g, ' ').trim();
    if (nomeLimpo.length < 2 || nomeLimpo.length > 80) throw new Erro(400, 'Digite o seu nome.');
    const tel = normalizarTelefone(telefone);
    if (!tel) throw new Erro(400, 'Digite um WhatsApp válido, com DDD.');
    const mail = String(email || '').trim().toLowerCase();
    if (!emailValido(mail)) throw new Erro(400, 'Digite um e-mail válido.');
    if (typeof senha !== 'string' || senha.length < 6) throw new Erro(400, 'A senha precisa ter pelo menos 6 caracteres.');
    if (senha.length > 72) throw new Erro(400, 'Senha muito longa.');

    const { data: existente } = await db.from('perfis').select('id').eq('telefone', tel).maybeSingle();
    if (existente) throw new Erro(409, 'Já existe uma conta com esse WhatsApp. Faça login.');
    const { data: emailUsado } = await db.from('perfis').select('id').eq('email', mail).maybeSingle();
    if (emailUsado) throw new Erro(409, 'Esse e-mail já está em outra conta. Use outro ou faça login.');

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

    const { error: perfilErro } = await db.from('perfis').insert({ id: criado.user.id, nome: nomeLimpo, telefone: tel, email: mail });
    if (perfilErro) {
        await db.auth.admin.deleteUser(criado.user.id);
        if (perfilErro.code === '23505') throw new Erro(409, 'Esse e-mail já está em outra conta. Use outro ou faça login.');
        throw perfilErro;
    }

    // O número configurado como da Rebeca vira administrador automaticamente
    const telAdmin = normalizarTelefone(Deno.env.get('ADMIN_TELEFONE') || '');
    if (telAdmin && telAdmin === tel) await db.from('admins').insert({ user_id: criado.user.id });

    return json({ ok: true });
});
