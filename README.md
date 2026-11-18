# NexComerce

Plataforma SaaS multiempresa para gestionar cualquier tipo de negocio: inventario, ventas, clientes, equipo, finanzas, reportes y atención automatizada por WhatsApp Business con IA.

Interfaz **mobile-first** en español, con estética blanca/violeta, navegación inferior en móvil y dashboard visual con indicadores y gráficas.

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · TanStack Query · React Router 7 · Recharts · Lucide |
| Backend | ASP.NET Core (.NET 10) · Minimal APIs · JWT |
| Persistencia | PostgreSQL 16 · EF Core 10 (proveedor InMemory para desarrollo) |
| WhatsApp | Meta Cloud API (Graph v21.0) · webhooks · bot determinista + IA opcional (OpenAI-compatible) |

## Funcionalidades

- **Multiempresa real**: registro independiente por negocio, datos aislados por `TenantId` con filtros globales de EF Core y validación de escritura.
- **Roles y sedes**: propietario, administrador, gerente, cajero, bodega y asesor; permisos granulares por módulo y sucursal.
- **Punto de venta (POS)**: búsqueda por nombre/SKU/código, variantes, carrito, descuentos, impuestos, múltiples métodos de pago, ticket y devolución de stock al anular.
- **Catálogo e inventario**: productos y servicios, categorías, variantes, stock mínimo, alertas, movimientos (entrada, salida, ajuste, devolución, traslado) con trazabilidad.
- **Ventas y finanzas**: historial filtrable, detalle, anulación, gastos por categoría/proveedor/sede y reportes de ventas, inventario y rentabilidad.
- **Contactos**: clientes con historial, puntos y etiquetas; proveedores.
- **Equipo**: usuarios, permisos, sedes y límites del plan.
- **WhatsApp Business**: conexión por negocio, bandeja de conversaciones, respuestas automáticas, FAQs por prioridad, consulta de productos/precios/stock, horarios, ubicación, pagos, handoff humano, simulador y métricas.
- **Dashboard**: KPIs, evolución de ingresos, métodos de pago, productos más vendidos y acciones rápidas.

## Arquitectura

Monolito modular con separación por capas:

```
NexComerce/
├─ src/
│  ├─ NexComerce.Domain/          # Entidades, enums y reglas de dominio
│  ├─ NexComerce.Infrastructure/  # EF Core, tenancy, seguridad, WhatsApp, IA, seed
│  └─ NexComerce.Api/             # Minimal APIs, DTOs, middleware, DI
├─ frontend/                      # SPA React + TypeScript
├─ docker-compose.yml             # PostgreSQL local
├─ .env.example
└─ NexComerce.slnx
```

**Aislamiento por negocio**

1. El JWT incluye el claim `tenant_id`.
2. `TenantContext` lo expone durante la petición.
3. EF Core aplica un filtro global a toda entidad `ITenantScoped`.
4. `SaveChanges` rechaza escrituras con un `TenantId` distinto al de la sesión.

Los tokens de WhatsApp se cifran con AES-GCM antes de guardarse.

---

## Requisitos

- .NET SDK 10
- Node.js 20+ y npm
- PostgreSQL 16 (opcional en desarrollo; Docker recomendado)

## Inicio rápido (desarrollo, base en memoria)

```bash
# Backend
cd src/NexComerce.Api
dotnet run --urls http://localhost:5150
```

```bash
# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173. El backend siembra automáticamente un negocio demo.

**Credenciales demo**

```
Correo:  demo@nexcomerce.app
Clave:   Demo1234!
```

También puedes usar **Probar con negocio demo** en la pantalla de login.

Documentación interactiva de la API: http://localhost:5150/docs · Health: http://localhost:5150/health

## Desarrollo con PostgreSQL

```bash
docker compose up -d
```

```bash
# Variables de entorno (PowerShell)
$env:ASPNETCORE_ENVIRONMENT="Production"
$env:Database__Provider="Postgres"
$env:ConnectionStrings__Default="Host=localhost;Port=5432;Database=nexcomerce;Username=nexcomerce;Password=nexcomerce_dev"
$env:Seed__Enabled="true"

cd src/NexComerce.Api
dotnet run --urls http://localhost:5150
```

Las migraciones se aplican automáticamente al iniciar. Para crear una nueva migración:

```bash
dotnet ef migrations add NombreMigracion \
  --project src/NexComerce.Infrastructure \
  --startup-project src/NexComerce.Api
```

> `Seed:Enabled=true` inserta el negocio demo si la base está vacía; en producción suele dejarse en `false`.

## Variables de configuración

Copia `.env.example` como referencia. Las claves más relevantes:

| Variable | Descripción |
| --- | --- |
| `Database:Provider` / `Database__Provider` | `InMemory` o `Postgres` |
| `ConnectionStrings:Default` / `ConnectionStrings__Default` | Cadena de conexión PostgreSQL |
| `Jwt:Key` / `Jwt__Key` | Secreto HS256 (mín. 64 caracteres en producción) |
| `WhatsApp:EncryptionKey` / `WhatsApp__EncryptionKey` | Clave para cifrar tokens de Meta |
| `WhatsApp:AiApiKey` / `WhatsApp__AiApiKey` | Clave opcional del proveedor de IA |
| `App:PublicUrl` / `App__PublicUrl` | URL pública para el webhook |
| `Seed:Enabled` / `Seed__Enabled` | Sembrar datos demo |
| `VITE_API_URL` | URL del API si no se usa el proxy de Vite |

## WhatsApp Business

1. En **WhatsApp → Conexión**, guarda el *WABA ID*, *Phone Number ID*, número visible y el token permanente de Meta.
2. Copia la **Callback URL** (`/api/webhooks/whatsapp`) y el **Verify Token** en tu app de Meta Developers.
3. Suscribe el webhook a los eventos `messages`.
4. Sin credenciales, el sistema funciona en modo simulación: la bandeja, el bot y el simulador registran mensajes localmente sin enviar nada a clientes reales.

El bot responde por:
- Preguntas frecuentes ordenadas por prioridad.
- Productos del catálogo (precio y stock).
- Horarios, ubicación, métodos de pago y servicios configurados.
- Transferencia a un asesor cuando no hay coincidencia (o si se solicita).
- IA opcional si `WhatsApp:AiApiKey` está configurada; si falla, vuelve al bot determinista.

## Scripts útiles

```bash
# Frontend
npm run dev        # servidor de desarrollo
npm run typecheck  # verificación de tipos
npm run build      # build de producción en frontend/dist

# Backend
dotnet build NexComerce.slnx
```

## Despliegue en un solo servicio

El API sirve la SPA si encuentra `wwwroot/index.html`:

```bash
cd frontend
npm run build
# copia el build dentro del API
xcopy /E /I /Y dist ..\src\NexComerce.Api\wwwroot
```

Luego publica el backend:

```bash
dotnet publish src/NexComerce.Api -c Release -o publish
```

Con `Database__Provider=Postgres`, el arranque aplica migraciones y deja la app disponible en el puerto configurado. Para producción configura HTTPS, un `Jwt__Key` y `WhatsApp__EncryptionKey` propios, `Cors__Origins__0` con tu dominio y `Seed__Enabled=false`.

## Seguridad

- Contraseñas con PBKDF2 + salt.
- JWT firmado, expiración configurable y emisor/audiencia validados.
- Consultas filtradas por negocio a nivel de EF Core y guardas adicionales al guardar.
- Tokens de WhatsApp cifrados en reposo (AES-GCM).
- Cabeceras de seguridad y manejo uniforme de errores (`ProblemDetails`).
- Permisos verificados en el backend para cada módulo.

## Estado del proyecto

Funcional de extremo a extremo: registro, login, aislamiento entre negocios, POS con variantes, ventas, inventario, clientes, proveedores, gastos, reportes, equipo, configuración y WhatsApp con bot/simulador. El entorno de desarrollo usa EF InMemory; la migración `InitialCreate` está generada para PostgreSQL.
