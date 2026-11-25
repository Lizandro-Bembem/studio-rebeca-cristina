/* =========================================================
   Studio Rebeca Cristina — chaves da agenda online
   Enquanto supabaseUrl/supabaseAnonKey estiverem vazios, o site
   funciona no modo antigo (pedido enviado pelo WhatsApp da cliente).
   ========================================================= */
window.RC_CONFIG = {
    // Supabase → Project Settings → API (são chaves públicas, podem ficar no site)
    supabaseUrl: '',
    supabaseAnonKey: '',
    // Chave PÚBLICA das notificações (VAPID)
    vapidPublicKey: '',
    // Número do studio (usado em "Esqueci minha senha")
    whatsappStudio: '5571993018287',
};
