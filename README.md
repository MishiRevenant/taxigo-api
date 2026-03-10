# 🚖 TaxiGo API

> Backend REST para la plataforma TaxiGo construido con **Express + TypeScript + SQLite (better-sqlite3)**  
> JWT con rotación de refresh tokens, CORS configurable y sin dependencias de base de datos externa.

---

## 🛠 Tecnologías

| Herramienta | Versión | Uso |
|---|---|---|
| [Express](https://expressjs.com) | ^4.18 | Framework HTTP |
| [TypeScript](https://typescriptlang.org) | ^5.4 | Tipado estático |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | ^9 | Base de datos SQLite embebida |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | ^9 | JWT access + refresh tokens |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | ^2.4 | Hashing de contraseñas |
| [Zod](https://zod.dev) | ^3 | Validación de cuerpos de request |
| [cors](https://github.com/expressjs/cors) | ^2 | Control de CORS |
| [helmet](https://helmetjs.github.io) | ^7 | Headers de seguridad |
| [morgan](https://github.com/expressjs/morgan) | ^1 | Logging de requests |

---

## 🚀 Inicio Rápido

```bash
cd taxigo-api
npm install
cp .env.example .env   # (o editar el .env existente)
npm run dev
# → http://localhost:8000
```

Verificar que el servidor corre:

```bash
curl http://localhost:8000/health
# {"status":"ok","timestamp":"..."}
```

---

## ⚙️ Variables de Entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `8000` | Puerto HTTP |
| `JWT_ACCESS_SECRET` | `access_secret_dev` | Secret para access tokens (cambiar en prod) |
| `JWT_REFRESH_SECRET` | `refresh_secret_dev` | Secret para refresh tokens (cambiar en prod) |
| `JWT_ACCESS_EXPIRES` | `15m` | Duración del access token |
| `JWT_REFRESH_EXPIRES` | `7d` | Duración del refresh token |
| `DB_PATH` | `./taxigo.db` | Ruta al archivo SQLite |
| `CORS_ORIGIN` | `http://localhost:5173` | Orígenes permitidos (separados por coma) |
| `NODE_ENV` | `development` | Entorno (`development`/`production`) |

---

## 👤 Usuarios de Prueba (pre-seeded)

| Rol | Email | Contraseña |
|---|---|---|
| 🧍 Pasajero | `passenger@taxigo.com` | `password` |
| 🚗 Conductor | `driver@taxigo.com` | `password` |

---

## 📡 Referencia de la API

### Base URL

```
http://localhost:8000/api
```

Todos los endpoints protegidos requieren:
```
Authorization: Bearer <accessToken>
```

---

### 🔐 Auth — `/api/auth`

#### `POST /api/auth/register`

Registra un nuevo usuario.

**Body:**
```json
{
  "name": "María García",
  "email": "maria@ejemplo.com",
  "password": "secreto123",
  "role": "passenger",
  "phone": "+34 600 000 000"
}
```

**Respuesta 201:**
```json
{
  "data": {
    "user": { "id": "...", "name": "María García", "email": "...", "role": "passenger", "rating": 5.0, "createdAt": "..." },
    "tokens": { "accessToken": "eyJ...", "refreshToken": "eyJ..." }
  }
}
```

**Errores:**
- `422` — datos de entrada inválidos
- `409` — el email ya está registrado

---

#### `POST /api/auth/login`

Inicia sesión con email y contraseña.

**Body:**
```json
{ "email": "passenger@taxigo.com", "password": "password" }
```

**Respuesta 200:** igual que register (`data.user` + `data.tokens`).

**Errores:**
- `401` — credenciales incorrectas

---

#### `GET /api/auth/me` 🔒

Devuelve el perfil del usuario autenticado.

**Respuesta 200:**
```json
{ "data": { "user": { "id": "...", "name": "...", "role": "...", ... } } }
```

---

#### `POST /api/auth/logout` 🔒

Revoca el refresh token.

**Body:**
```json
{ "refreshToken": "eyJ..." }
```

**Respuesta 200:**
```json
{ "message": "Sesión cerrada" }
```

---

#### `POST /api/auth/refresh`

Renueva el access token usando el refresh token (rotación: el refresh token viejo queda invalidado).

**Body:**
```json
{ "refreshToken": "eyJ..." }
```

**Respuesta 200:**
```json
{ "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." } }
```

**Errores:**
- `401` — refresh token inválido o expirado

---

### 🚗 Trips — `/api/trips`

Todos los endpoints de viajes requieren autenticación (`Authorization: Bearer <token>`).

#### `POST /api/trips` 🔒 (solo pasajero)

Crea una nueva solicitud de viaje.

**Body:**
```json
{
  "originAddress": "Calle 72 #10-07, Bogotá",
  "destinationAddress": "Aeropuerto El Dorado",
  "vehicleType": "standard",
  "notes": "Equipaje de bodega"
}
```

> `vehicleType`: `"standard"` | `"comfort"` | `"xl"`

**Respuesta 201:**
```json
{
  "data": {
    "id": "uuid",
    "passengerId": "...",
    "originAddress": "Calle 72 #10-07, Bogotá",
    "originLat": 4.6097,
    "originLng": -74.0817,
    "destinationAddress": "Aeropuerto El Dorado",
    "destinationLat": 4.701,
    "destinationLng": -74.146,
    "status": "requested",
    "vehicleType": "standard",
    "requestedAt": "2024-03-04T10:00:00.000Z"
  }
}
```

**Errores:**
- `409` — el pasajero ya tiene un viaje activo
- `422` — datos inválidos

---

#### `GET /api/trips/active` 🔒

Devuelve el viaje activo del usuario autenticado (cualquier rol). Estado `requested`, `accepted` o `on_ride`.

**Respuesta 200:**
```json
{ "data": { ...trip, "passenger": {...user}, "driver": {...user} } }
```

**Errores:**
- `404` — sin viaje activo

---

#### `GET /api/trips/available` 🔒 (solo conductor)

Lista todos los viajes con estado `requested` (disponibles para aceptar).

**Respuesta 200:**
```json
{ "data": [ {...trip}, {...trip} ] }
```

---

#### `GET /api/trips/history` 🔒

Historial de viajes del usuario (completados o cancelados).

**Respuesta 200:**
```json
{ "data": [ {...trip}, ... ] }
```

---

#### `GET /api/trips/:id` 🔒

Devuelve un viaje específico por ID.

**Respuesta 200:**
```json
{ "data": { ...trip } }
```

---

#### `POST /api/trips/:id/accept` 🔒 (solo conductor)

El conductor acepta un viaje solicitado. Asigna tarifa y distancia simuladas.

**Respuesta 200:**
```json
{
  "data": {
    "...trip",
    "status": "accepted",
    "driverId": "...",
    "fare": 25000,
    "distance": 12.5,
    "acceptedAt": "2024-03-04T10:02:00.000Z"
  }
}
```

**Errores:**
- `404` — viaje no encontrado
- `409` — el viaje ya no está disponible

---

#### `PATCH /api/trips/:id/status` 🔒

Actualiza el estado de un viaje.

**Body:**
```json
{ "status": "on_ride" }
```

> `status`: `"on_ride"` | `"completed"` | `"cancelled"`

Transiciones automáticas:
- `on_ride` → añade `startedAt`
- `completed` → añade `completedAt` + `duration` (simulado)

**Respuesta 200:**
```json
{ "data": { ...trip, "status": "on_ride" } }
```

---

### ❤️ Health Check

#### `GET /health`

```json
{ "status": "ok", "timestamp": "2024-03-04T10:00:00.000Z" }
```

---

## 🗃 Esquema de Base de Datos (SQLite)

```sql
-- Usuarios
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,              -- bcrypt hash
  role        TEXT NOT NULL CHECK(role IN ('passenger','driver')),
  phone       TEXT,
  rating      REAL NOT NULL DEFAULT 5.0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Refresh tokens (rotación: uno por sesión)
CREATE TABLE refresh_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Viajes
CREATE TABLE trips (
  id                  TEXT PRIMARY KEY,
  passenger_id        TEXT NOT NULL REFERENCES users(id),
  driver_id           TEXT REFERENCES users(id),
  origin_address      TEXT NOT NULL,
  origin_lat          REAL NOT NULL,
  origin_lng          REAL NOT NULL,
  destination_address TEXT NOT NULL,
  destination_lat     REAL NOT NULL,
  destination_lng     REAL NOT NULL,
  status              TEXT NOT NULL DEFAULT 'requested'
                      CHECK(status IN ('requested','accepted','on_ride','completed','cancelled')),
  vehicle_type        TEXT NOT NULL DEFAULT 'standard'
                      CHECK(vehicle_type IN ('standard','comfort','xl')),
  notes               TEXT,
  fare                REAL,
  distance            REAL,
  duration            INTEGER,
  requested_at        TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at         TEXT,
  started_at          TEXT,
  completed_at        TEXT
);
```

---

## 🏗 Arquitectura

```
src/
├── db/
│   └── init.ts        # Conexión SQLite + creación de tablas
├── middleware/
│   └── auth.ts        # authenticate, requireRole, errorHandler
├── routes/
│   ├── auth.ts        # /api/auth/*
│   └── trips.ts       # /api/trips/*
├── services/
│   └── jwt.ts         # generateTokens / verifyAccessToken / verifyRefreshToken / revokeRefreshToken
├── types/
│   └── index.ts       # User, Trip, AuthTokens (+ Express module augmentation)
└── index.ts           # Bootstrap Express app
```

---

## 🐳 Docker

```bash
# Build
docker build -t taxigo-api:latest .

# Ejecutar (puerto 8000)
docker run -p 8000:8000 \
  -e JWT_ACCESS_SECRET=cambia_esto \
  -e JWT_REFRESH_SECRET=cambia_esto \
  taxigo-api:latest
```

---

## 🧪 Scripts

```bash
npm run dev      # ts-node / tsx en modo watch
npm run build    # tsc → dist/
npm start        # node dist/index.js
```

---

## 🔒 Notas de Seguridad para Producción

1. **Cambiar secrets JWT** — nunca usar los defaults del `.env.example`
2. **CORS** — establecer `CORS_ORIGIN` solo a los dominios del frontend
3. **HTTPS** — poner detrás de un proxy (Nginx, Caddy, Vercel Edge, etc.)
4. **DB** — considerar PostgreSQL/MySQL para producción real (SQLite es para prototipos)
5. **Rate limiting** — añadir `express-rate-limit` en producción
