# 🚖 TaxiGo API v2

> Backend REST + WebSockets para la plataforma TaxiGo.  
> **Express + TypeScript + TypeORM + PostgreSQL (Supabase) + Socket.IO + JWT + Swagger**

---

## 🛠 Stack Tecnológico

| Herramienta | Versión | Rol |
|---|---|---|
| [Express](https://expressjs.com) | ^4.19 | Framework HTTP |
| [TypeScript](https://typescriptlang.org) | ^5.4 | Tipado estático |
| [TypeORM](https://typeorm.io) | ^0.3 | ORM (entidades, relaciones, migraciones) |
| [PostgreSQL](https://postgresql.org) | 16 | Base de datos relacional |
| [Socket.IO](https://socket.io) | ^4.7 | WebSockets tiempo real |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | ^9 | JWT access + refresh tokens |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | ^2.4 | Hashing de contraseñas |
| [Zod](https://zod.dev) | ^3 | Validación de cuerpos de request |
| [Swagger/OpenAPI](https://swagger.io) | ^3 | Documentación interactiva |
| [Winston](https://github.com/winstonjs/winston) | ^3 | Logging estructurado |
| [Helmet](https://helmetjs.github.io) | ^7 | Cabeceras de seguridad HTTP |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | ^7 | Rate limiting |

---

## 🚀 Inicio Rápido (Local)

```bash
cd taxigo-api
npm install
cp .env.example .env   # editar con tu DATABASE_URL
npm run migration:run  # aplica el schema a la DB
npm run seed           # datos de prueba
npm run dev            # servidor en modo watch → http://localhost:8000
```

### Verificar funcionamiento

```bash
curl http://localhost:8000/health
# → {"status":"ok","timestamp":"...","db":"connected"}
```

📚 **Swagger UI**: http://localhost:8000/api/docs

---

## 🐳 Docker Compose (API + PostgreSQL local)

```bash
# Levantar todo con un comando:
docker compose up -d

# Ver logs
docker compose logs -f api

# Parar
docker compose down
```

> Esto levanta PostgreSQL 16 + TaxiGo API en el puerto 8000.  
> Las migraciones se corren automáticamente al iniciar el servidor.

---

## ⚙️ Variables de Entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `8000` | Puerto HTTP |
| `DATABASE_URL` | — | URL de conexión PostgreSQL (Supabase o local) |
| `JWT_ACCESS_SECRET` | `access_secret_dev` | Secret para access tokens |
| `JWT_REFRESH_SECRET` | `refresh_secret_dev` | Secret para refresh tokens |
| `JWT_ACCESS_EXPIRES` | `15m` | Duración del access token |
| `JWT_REFRESH_EXPIRES` | `7d` | Duración del refresh token |
| `CORS_ORIGIN` | `http://localhost:5173` | Origen(es) permitidos (separados por coma) |
| `API_URL` | `http://localhost:8000` | URL del servidor para Swagger |
| `NODE_ENV` | `development` | Entorno |

---

## 👤 Credenciales de Prueba

| Rol | Email | Contraseña |
|---|---|---|
| 🧍 Pasajero | `passenger@taxigo.com` | `password` |
| 🚗 Conductor | `driver@taxigo.com` | `password` |

---

## 📡 Endpoints

### Base URL: `http://localhost:8000/api`

Todos los endpoints protegidos requieren:
```
Authorization: Bearer <accessToken>
```

### 🔐 Auth (`/api/auth`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/register` | ❌ | Registrar usuario |
| POST | `/auth/login` | ❌ | Login → tokens JWT |
| GET | `/auth/me` | ✅ | Perfil del usuario |
| POST | `/auth/logout` | ✅ | Revocar refresh token |
| POST | `/auth/refresh` | ❌ | Rotar tokens |

### 🚗 Trips (`/api/trips`)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/trips` | passenger | Solicitar viaje |
| GET | `/trips/available` | driver | Viajes disponibles |
| GET | `/trips/active` | ambos | Mi viaje activo |
| GET | `/trips/history` | ambos | Historial |
| POST | `/trips/:id/accept` | driver | Aceptar viaje |
| POST | `/trips/:id/start` | driver | Iniciar viaje |
| POST | `/trips/:id/complete` | driver | Finalizar viaje |
| POST | `/trips/:id/cancel` | ambos | Cancelar viaje |
| PATCH | `/trips/:id/status` | ambos | Cambiar estado (genérico) |
| GET | `/trips/:id` | ambos | Detalle de viaje |

### 📍 Alias Académicos

| Método | Ruta | Equivalente |
|---|---|---|
| POST | `/travels/request` | POST `/trips` |
| POST | `/travels/:id/accept` | POST `/trips/:id/accept` |
| POST | `/travels/:id/start` | POST `/trips/:id/start` |
| POST | `/travels/:id/complete` | POST `/trips/:id/complete` |
| POST | `/travels/:id/cancel` | POST `/trips/:id/cancel` |
| GET | `/me/travels` | GET `/trips/history` |

---

## 🔌 WebSocket Events

Conectar al servidor: `ws://localhost:8000`

### Emitir desde el cliente:

| Evento | Payload | Descripción |
|---|---|---|
| `join` | `userId: string` | Unirse a sala personal |
| `join:drivers` | — | Conductor se suscribe a nuevos viajes |

### Recibir desde el servidor:

| Evento | Destinatario | Descripción |
|---|---|---|
| `trip:requested` | Sala `drivers` | Nuevo viaje disponible |
| `trip:accepted` | Pasajero | Su viaje fue aceptado |
| `trip:started` | Ambos | Conductor inició el viaje |
| `trip:completed` | Ambos | Viaje finalizado |
| `trip:cancelled` | Ambos | Viaje cancelado |

---

## 🗃 Schema de Base de Datos

### TypeORM Entities → PostgreSQL Tables

```
src/entities/
├── User.ts          → tabla users
├── Trip.ts          → tabla trips
└── RefreshToken.ts  → tabla refresh_tokens
```

#### `users`
```sql
id VARCHAR(255) PK | name VARCHAR(255) | email VARCHAR(255) UNIQUE
password VARCHAR(255) | role VARCHAR(50) CHECK(passenger|driver)
phone VARCHAR(255) | rating NUMERIC DEFAULT 5.0 | created_at TIMESTAMP
```

#### `trips`
```sql
id VARCHAR(255) PK | passenger_id FK → users | driver_id FK → users (nullable)
origin_address TEXT | origin_lat NUMERIC | origin_lng NUMERIC
destination_address TEXT | destination_lat NUMERIC | destination_lng NUMERIC
status VARCHAR(50) CHECK(requested|accepted|on_ride|completed|cancelled)
vehicle_type VARCHAR(50) CHECK(standard|comfort|xl)
fare NUMERIC | distance NUMERIC | duration INTEGER
requested_at TIMESTAMP | accepted_at TIMESTAMP | started_at TIMESTAMP | completed_at TIMESTAMP
```

#### `refresh_tokens`
```sql
id VARCHAR(255) PK | user_id FK → users (CASCADE DELETE)
token TEXT UNIQUE | expires_at TIMESTAMP | created_at TIMESTAMP
```

---

## 🏗 Arquitectura

```
src/
├── config/
│   ├── database.ts      # DataSource TypeORM (conexión a Supabase/PostgreSQL)
│   └── swagger.ts       # Especificación OpenAPI
├── entities/
│   ├── User.ts          # Entidad usuario con roles
│   ├── Trip.ts          # Entidad viaje con ciclo de vida
│   └── RefreshToken.ts  # Entidad token de actualización
├── migrations/
│   └── 1717286000000-InitialSchema.ts  # Migración inicial (idempotente)
├── middleware/
│   └── auth.ts          # authenticate, requireRole, errorHandler
├── routes/
│   ├── auth.ts          # /api/auth/*
│   ├── trips.ts         # /api/trips/* (rutas primarias)
│   ├── travels.ts       # /api/travels/* (alias académicos)
│   └── me.ts            # /api/me/travels
├── services/
│   ├── jwt.ts           # generateTokens, verifyAccessToken, verifyRefreshToken
│   └── socket.ts        # Socket.IO: initSocket, emitters
├── db/
│   ├── seed.ts          # Datos de prueba
│   └── migration-run.ts # Runner de migraciones
├── logger/
│   └── index.ts         # Winston logger
└── index.ts             # Bootstrap de la aplicación
```

---

## 🛠 Scripts

```bash
npm run build           # Compilar TypeScript → dist/
npm start               # Iniciar servidor compilado
npm run dev             # Desarrollo con ts-node
npm run migration:run   # Aplicar migraciones pendientes a la DB
npm run seed            # Insertar datos de prueba
```

---

## 🐳 Despliegue

### Render (recomendado para API con WebSockets)
> El archivo `render.yaml` está preconfigurado. Solo conecta el repo y configura las variables de entorno marcadas como `sync: false`.

**Variables a configurar en el dashboard de Render:**
- `DATABASE_URL`: tu Supabase connection string
- `CORS_ORIGIN`: URL de tu frontend en Vercel (ej. `https://taxigo-web.vercel.app`)
- `API_URL`: URL de tu servicio en Render

### Vercel (no recomendado para esta API)
> Vercel no soporta WebSockets de larga duración. Úsalo solo para el frontend (`taxigo-web`).

---

## 🔒 Seguridad en Producción

1. **JWT Secrets** — cambiar los secrets por valores seguros (mínimo 64 caracteres aleatorios)
2. **CORS** — configurar `CORS_ORIGIN` exactamente a los dominios del frontend
3. **HTTPS** — obligatorio en producción; Render y Vercel lo proveen automáticamente
4. **Rate Limiting** — ya configurado (100 req/15min por IP)
5. **Helmet** — ya configurado para cabeceras de seguridad HTTP
6. **Database** — nunca exponer `DATABASE_URL` en el código fuente; usar variables de entorno

---

## 📚 Swagger / OpenAPI

La documentación interactiva está disponible en:
```
http://localhost:8000/api/docs
```
Puedes probar todos los endpoints directamente desde el navegador.
