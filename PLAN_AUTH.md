# Plan de implementación — Autenticación y roles (implementado)

## Pasos para poner en marcha

1. **Variables de entorno**  
   En `.env` añade (recomendado en producción):
   ```
   AUTH_SECRET=una-cadena-secreta-mínimo-32-caracteres
   ```

2. **Migración y primer usuario**
   ```bash
   npx prisma migrate deploy
   node scripts/seed-admin.mjs
   ```
   Por defecto crea `admin@example.com` / `admin123`. Para otro usuario:
   ```bash
   ADMIN_EMAIL=tu@email.com ADMIN_PASSWORD=tuPassword node scripts/seed-admin.mjs
   ```

3. **Iniciar la app**
   ```bash
   npm run dev
   ```
   Entra en `/login`, inicia sesión y serás redirigido al dashboard.

## Resumen de cambios
- **BD:** Modelo User (ADMIN/USER), userId en FBSession, Post, Setting.
- **Auth:** Login email+password, bcrypt, JWT en cookie httpOnly, requireAuth/requireAdmin.
- **APIs:** Todas protegidas; USER filtra por userId, ADMIN ve todo; impersonación para ADMIN.
- **Middleware:** Protege /dashboard y /admin; redirige a /login si no hay sesión.
- **UI:** /login, AuthContext, /admin/users, TopBar con “Salir de ver como usuario”.
