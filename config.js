/* =========================================================
   Studio Rebeca Cristina — chaves da agenda online
   Enquanto supabaseUrl/supabaseAnonKey estiverem vazios, o site
   funciona no modo antigo (pedido enviado pelo WhatsApp da cliente).
   ========================================================= */
window.RC_CONFIG = {
    // Supabase → Project Settings → API (são chaves públicas, podem ficar no site)
    supabaseUrl: 'https://herzntjzefolqmuuxllp.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlcnpudGp6ZWZvbHFtdXV4bGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2MzY5MzksImV4cCI6MjExMTIxMjkzOX0.YYKZ0UCjFgX2rONMOnxrRKNVEILVwob4abCCkW1UKQo',
    // Chave PÚBLICA das notificações (VAPID)
    vapidPublicKey: 'BPlVME51UFawGTnkUro63IcKesUPXoQ4BGnrhBM9MGRdr0xCX3AC8ZyKjuoRI2z_n_peCqre5cIbZgEAAeG6A9o',
    // Número do studio (usado em "Esqueci minha senha")
    whatsappStudio: '5571993018287',
};
