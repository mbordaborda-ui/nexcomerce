# Desplegar la base de datos en Supabase

El archivo [`supabase-schema.sql`](./supabase-schema.sql) contiene el esquema completo generado desde las migraciones de Entity Framework Core.

## 1. Crear el proyecto en Supabase

1. Entra a <https://supabase.com/dashboard>.
2. Crea un proyecto nuevo y guarda la contraseña de la base de datos.
3. Espera a que el proyecto termine de aprovisionarse.

## 2. Ejecutar el SQL

1. Abre **SQL Editor** → **New query**.
2. Copia todo el contenido de `supabase-schema.sql`.
3. Pega y pulsa **Run**.

El script es idempotente: se puede ejecutar varias veces sin duplicar tablas.

Verifica en **Table Editor** que aparezcan, entre otras:

- `Tenants`
- `Users`
- `Products`
- `Sales`
- `CashSessions`
- `Receivables`
- `Orders`
- `Subscriptions`
- `SubscriptionInvoices`

## 3. Obtener la cadena de conexión

En Supabase: **Project Settings** → **Database** → **Connection string** → **Session pooler** (recomendado para un backend persistente).

Formato para .NET/Npgsql:

```text
Host=aws-0-<region>.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.<project-ref>;Password=<password>;SSL Mode=Require;Trust Server Certificate=true
```

También puedes usar la conexión directa:

```text
Host=db.<project-ref>.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=<password>;SSL Mode=Require;Trust Server Certificate=true
```

> Si tu hosting no soporta IPv6, usa el **Session pooler**, que sí funciona por IPv4.

## 4. Configurar el backend

Variables de entorno del API:

```env
ASPNETCORE_ENVIRONMENT=Production
Database__Provider=Postgres
ConnectionStrings__Default=Host=...;Port=5432;Database=postgres;Username=postgres.<project-ref>;Password=<password>;SSL Mode=Require;Trust Server Certificate=true
Jwt__Key=<secreto-de-al-menos-64-caracteres>
WhatsApp__EncryptionKey=<secreto-de-al-menos-32-caracteres>
Seed__Enabled=true
Cors__Origins__0=https://nexcomerce.netlify.app
```

### Probar el backend en local contra Supabase

No guardes la contraseña en el repositorio. Usa el script interactivo:

```powershell
.\scripts\run-api-supabase.ps1 -Seed
```

Pega la cadena de conexión cuando la pida. Luego abre:

```text
http://localhost:5150/health
```

Debe responder `healthy` con proveedor `Npgsql`.

> Las claves `sb_publishable_...` y `sb_secret_...` de Supabase **no se usan** en este backend. El API .NET se conecta directamente a PostgreSQL con la contraseña de la base de datos. No pongas la clave secreta en Netlify ni en el frontend.

- `Seed__Enabled=true` crea el negocio demo **solo si la base está vacía**. Después puedes cambiarlo a `false`.
- Como el SQL ya insertó las migraciones en `__EFMigrationsHistory`, el backend no volverá a crear las tablas al arrancar.

## 5. Conectar el frontend

En Netlify, edita el `index.html` del deploy o recompila con:

```env
VITE_API_URL=https://url-publica-del-backend
```

El ZIP `nexcomerce-netlify.zip` incluye esta línea editable en `index.html`:

```html
window.__NEXCOMERCE_API_URL__ = "";
```

Cámbiala por la URL del backend:

```html
window.__NEXCOMERCE_API_URL__ = "https://url-publica-del-backend";
```

## 6. Verificar

```text
https://url-publica-del-backend/health
```

Debe responder con estado `healthy`. Después podrás iniciar sesión con:

```text
demo@nexcomerce.app
Demo1234!
```

## Seguridad

- No publiques la `service_role` key de Supabase ni la cadena de conexión en el frontend.
- El frontend debe hablar únicamente con el API .NET.
- Si vas a exponer el esquema `public` mediante la API REST de Supabase/PostgREST, habilita **Row Level Security (RLS)**. El backend actual se conecta como propietario de las tablas y no se ve afectado por RLS.
