// A Rebeca cria uma senha nova para uma cliente que esqueceu (não usamos e-mail).
import { db, Erro, exigirAdmin, json, normalizarTelefone, servir } from '../_shared/comum.ts';

servir(async req => {
    await exigirAdmin(req);
    const { telefone, senha } = await req.json().catch(() => ({}));
    const tel = normalizarTelefone(telefone);
    if (!tel) throw new Erro(400, 'Digite o WhatsApp da cliente, com DDD.');
    if (typeof senha !== 'string' || senha.length < 6) throw new Erro(400, 'A nova senha precisa ter pelo menos 6 caracteres.');

    const { data: perfil } = await db.from('perfis').select('id, nome').eq('telefone', tel).maybeSingle();
    if (!perfil) throw new Erro(404, 'Não existe cliente cadastrada com esse WhatsApp.');

    const { error } = await db.auth.admin.updateUserById(perfil.id, { password: senha });
    if (error) throw error;
    return json({ ok: true, nome: perfil.nome });
});
