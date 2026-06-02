# Diagramas C4 – TaxiGo API (Nivel Normal)

> Documentación académica de la arquitectura del sistema TaxiGo usando la notación **C4 Model** de Simon Brown.

---

## Nivel 1: Diagrama de Contexto

Muestra el sistema TaxiGo y sus actores externos principales.

```mermaid
C4Context
    title Diagrama de Contexto – TaxiGo API

    Person(passenger, "Pasajero", "Usuario que solicita viajes de taxi a través de la aplicación web")
    Person(driver, "Conductor", "Operador que acepta, inicia y completa viajes asignados")

    System(taxigo, "TaxiGo System", "Plataforma de reservas de taxi con API REST, WebSocket en tiempo real y SPA Vue.js")

    System_Ext(supabase, "Supabase PostgreSQL", "Base de datos relacional en la nube para persistencia de usuarios, viajes y tokens")

    Rel(passenger, taxigo, "Solicita viajes, consulta estado e historial", "HTTPS / WebSocket")
    Rel(driver, taxigo, "Acepta viajes, cambia estados, recibe notificaciones", "HTTPS / WebSocket")
    Rel(taxigo, supabase, "Lee y escribe datos", "PostgreSQL (SSL)")
```

### Descripción

| Actor / Sistema | Descripción |
|---|---|
| **Pasajero** | Se registra con rol `passenger`, solicita viajes indicando origen y destino, y monitorea el estado en tiempo real |
| **Conductor** | Se registra con rol `driver`, recibe notificaciones de nuevos viajes, los acepta y gestiona el flujo `accepted → on_ride → completed` |
| **TaxiGo System** | Backend Node.js/Express + Frontend Vue.js que expone API REST y eventos WebSocket |
| **Supabase PostgreSQL** | Base de datos alojada en Supabase que almacena usuarios, viajes y refresh tokens |

---

## Nivel 2: Diagrama de Contenedores

Descompone el sistema TaxiGo en sus contenedores técnicos.

```mermaid
C4Container
    title Diagrama de Contenedores – TaxiGo System

    Person(passenger, "Pasajero")
    Person(driver, "Conductor")

    Container_Boundary(taxigo, "TaxiGo System") {
        Container(spa, "TaxiGo Web SPA", "Vue.js 3, Pinia, Vite, TailwindCSS", "Interfaz de usuario responsiva con dashboards diferenciados por rol")
        Container(api, "TaxiGo API", "Node.js, Express, TypeScript, TypeORM", "API REST con autenticación JWT y documentación Swagger")
        Container(ws, "WebSocket Server", "Socket.IO", "Servidor de eventos en tiempo real para notificaciones de viajes")
    }

    ContainerDb(db, "PostgreSQL", "Supabase", "Almacena: users, trips, refresh_tokens")

    Rel(passenger, spa, "Usa", "HTTPS")
    Rel(driver, spa, "Usa", "HTTPS")
    Rel(spa, api, "Consume API REST", "HTTP/JSON + Bearer JWT")
    Rel(spa, ws, "Recibe eventos en tiempo real", "WebSocket (Socket.IO)")
    Rel(api, db, "Lee/Escribe datos", "TypeORM / PostgreSQL")
    Rel(api, ws, "Emite eventos de viaje", "Internal")
```

### Detalle de Contenedores

| Contenedor | Tecnología | Responsabilidad |
|---|---|---|
| **TaxiGo Web SPA** | Vue.js 3 + Pinia + Vite + TailwindCSS | Interfaz de usuario con dashboards de pasajero y conductor, formularios de solicitud, mapas y stepper de estado |
| **TaxiGo API** | Express + TypeScript + TypeORM + Zod | API REST protegida por JWT con validación de datos, middleware de roles, rate limiting y Swagger UI |
| **WebSocket Server** | Socket.IO 4 | Emite eventos `trip:requested`, `trip:accepted`, `trip:started`, `trip:completed`, `trip:cancelled` a rooms específicos |
| **PostgreSQL** | Supabase (PostgreSQL 16) | Tres tablas principales: `users`, `trips`, `refresh_tokens` con relaciones FK e índices |

---

## Nivel 3: Diagrama de Componentes

Descompone el contenedor **TaxiGo API** en sus componentes internos.

```mermaid
C4Component
    title Diagrama de Componentes – TaxiGo API

    Container_Boundary(api, "TaxiGo API") {
        Component(authRouter, "AuthRouter", "Express Router", "POST /auth/register, /auth/login, /auth/refresh, /auth/logout, GET /auth/me")
        Component(tripsRouter, "TripsRouter", "Express Router", "CRUD de viajes: POST, GET, PATCH con rutas protegidas por rol")
        Component(travelsRouter, "TravelsRouter", "Express Router", "Alias académico: /travels/request, /:id/accept, start, complete, cancel")
        Component(meRouter, "MeRouter", "Express Router", "GET /me/travels — alias de historial del usuario")

        Component(authMiddleware, "AuthMiddleware", "Express Middleware", "Valida Bearer JWT y adjunta user a req. Guard de roles (passenger/driver)")
        Component(jwtService, "JWTService", "Service", "Genera access/refresh tokens, verifica y revoca refresh tokens")
        Component(socketService, "SocketService", "Socket.IO", "Emite eventos en tiempo real a rooms de usuario y drivers")

        Component(userEntity, "User Entity", "TypeORM Entity", "Mapea tabla users con campos id, name, email, password_hash, role, phone, rating")
        Component(tripEntity, "Trip Entity", "TypeORM Entity", "Mapea tabla trips con estado enum, coordenadas GPS y timestamps")
        Component(refreshEntity, "RefreshToken Entity", "TypeORM Entity", "Mapea tabla refresh_tokens para rotación segura de tokens")

        Component(zodValidation, "Zod Schemas", "Validation", "DTOs de validación para register, login, request trip y status update")
        Component(swaggerConfig, "SwaggerConfig", "swagger-jsdoc", "Genera documentación OpenAPI 3.0 automática desde JSDoc")
        Component(dbConfig, "DatabaseConfig", "TypeORM DataSource", "Configuración de conexión PostgreSQL con SSL y migraciones")
    }

    ContainerDb(db, "PostgreSQL")

    Rel(authRouter, authMiddleware, "Usa")
    Rel(authRouter, jwtService, "Genera y valida tokens")
    Rel(authRouter, zodValidation, "Valida DTOs")
    Rel(tripsRouter, authMiddleware, "Protege rutas")
    Rel(tripsRouter, socketService, "Emite eventos WS")
    Rel(tripsRouter, zodValidation, "Valida datos")
    Rel(travelsRouter, authMiddleware, "Protege rutas")
    Rel(travelsRouter, socketService, "Emite eventos WS")
    Rel(meRouter, authMiddleware, "Protege rutas")

    Rel(authRouter, userEntity, "CRUD usuarios")
    Rel(tripsRouter, tripEntity, "CRUD viajes")
    Rel(jwtService, refreshEntity, "Gestiona refresh tokens")

    Rel(userEntity, db, "TypeORM")
    Rel(tripEntity, db, "TypeORM")
    Rel(refreshEntity, db, "TypeORM")
```

### Tabla de Componentes

| Componente | Archivo(s) | Responsabilidad |
|---|---|---|
| **AuthRouter** | `routes/auth.ts` | Registro, login, logout, refresh y perfil del usuario autenticado |
| **TripsRouter** | `routes/trips.ts` | Flujo completo de viajes: solicitud, aceptación, inicio, completar, cancelar, historial y viaje activo |
| **TravelsRouter** | `routes/travels.ts` | Alias académico (`/api/travels/*`) que replica la lógica de trips para cumplir con la especificación |
| **MeRouter** | `routes/me.ts` | `GET /api/me/travels` — historial del usuario (alias académico) |
| **AuthMiddleware** | `middleware/auth.ts` | `authenticate()` verifica JWT y carga usuario. `requireRole()` valida roles `passenger`/`driver` |
| **JWTService** | `services/jwt.ts` | Genera pares de tokens (access 15min + refresh 7d), verifica y revoca con rotación |
| **SocketService** | `services/socket.ts` | Inicializa Socket.IO, gestiona rooms (`user:{id}`, `drivers`) y emite eventos de ciclo de vida |
| **Zod Schemas** | Inline en routers | Validación de DTOs con `z.object()` para register, login, trip request y status update |
| **Entities** | `entities/*.ts` | Mapeo ORM: `User`, `Trip`, `RefreshToken` con decoradores TypeORM |
| **SwaggerConfig** | `config/swagger.ts` | OpenAPI 3.0 con schemas, security schemes y JSDoc annotations |
| **DatabaseConfig** | `config/database.ts` | DataSource de TypeORM con PostgreSQL, SSL, migraciones y sincronización |

---

## Nivel 4: Diagrama de Código

Detalle a nivel de clases/entidades y sus relaciones.

```mermaid
classDiagram
    direction TB

    class User {
        +String id [PK]
        +String name
        +String email [UNIQUE]
        +String password [SELECT: false]
        +UserRole role
        +String phone [NULL]
        +Number rating [DEFAULT: 5.0]
        +Date createdAt
        +Trip[] passengerTrips
        +Trip[] driverTrips
        +RefreshToken[] refreshTokens
    }

    class Trip {
        +String id [PK]
        +String passengerId [FK]
        +String driverId [FK, NULL]
        +String originAddress
        +Number originLat
        +Number originLng
        +String destinationAddress
        +Number destinationLat
        +Number destinationLng
        +TripStatus status
        +VehicleType vehicleType
        +String notes [NULL]
        +Number fare [NULL]
        +Number distance [NULL]
        +Number duration [NULL]
        +Date requestedAt
        +Date acceptedAt [NULL]
        +Date startedAt [NULL]
        +Date completedAt [NULL]
    }

    class RefreshToken {
        +String id [PK]
        +String userId [FK]
        +String token [UNIQUE]
        +Date expiresAt
        +Date createdAt
    }

    class UserRole {
        <<enumeration>>
        passenger
        driver
    }

    class TripStatus {
        <<enumeration>>
        requested
        accepted
        on_ride
        completed
        cancelled
    }

    class VehicleType {
        <<enumeration>>
        standard
        comfort
        xl
    }

    class AuthMiddleware {
        +authenticate(req, res, next) void
        +requireRole(role) Middleware
        +errorHandler(err, req, res, next) void
    }

    class JWTService {
        +generateTokens(user) AuthTokens
        +verifyAccessToken(token) Payload
        +verifyRefreshToken(token) Payload
        +revokeRefreshToken(token) void
    }

    class SocketService {
        -SocketIOServer io
        +initSocket(httpServer) SocketIOServer
        +getIO() SocketIOServer
        +emitTripRequested(trip) void
        +emitTripAccepted(passengerId, trip) void
        +emitTripStatusUpdated(passengerId, driverId, trip, event) void
    }

    User "1" --> "*" Trip : passengerTrips
    User "1" --> "*" Trip : driverTrips
    User "1" --> "*" RefreshToken : refreshTokens
    Trip --> "1" User : passenger
    Trip --> "0..1" User : driver
    RefreshToken --> "1" User : user

    User --> UserRole : role
    Trip --> TripStatus : status
    Trip --> VehicleType : vehicleType

    AuthMiddleware --> JWTService : verifica tokens
    AuthMiddleware --> User : carga usuario
    JWTService --> RefreshToken : gestiona rotación
    SocketService --> Trip : emite eventos
```

### Flujo de Estado del Viaje

```mermaid
stateDiagram-v2
    direction LR

    [*] --> requested : Pasajero solicita viaje
    requested --> accepted : Conductor acepta
    requested --> cancelled : Pasajero o conductor cancela
    accepted --> on_ride : Conductor inicia viaje
    accepted --> cancelled : Pasajero o conductor cancela
    on_ride --> completed : Conductor finaliza viaje
    on_ride --> cancelled : Pasajero o conductor cancela
    completed --> [*]
    cancelled --> [*]
```

### Eventos WebSocket por Transición

| Transición | Evento Emitido | Destino |
|---|---|---|
| `→ requested` | `trip:requested` | Room `drivers` (todos los conductores) |
| `requested → accepted` | `trip:accepted` | Room `user:{passengerId}` (el pasajero) |
| `accepted → on_ride` | `trip:started` | Rooms `user:{passengerId}` + `user:{driverId}` |
| `on_ride → completed` | `trip:completed` | Rooms `user:{passengerId}` + `user:{driverId}` |
| `* → cancelled` | `trip:cancelled` | Rooms `user:{passengerId}` + `user:{driverId}` |

---

### Diagrama de Secuencia: Flujo Completo de un Viaje

```mermaid
sequenceDiagram
    participant P as 🧍 Pasajero (SPA)
    participant API as 🚖 TaxiGo API
    participant WS as 📡 Socket.IO
    participant DB as 🗄️ PostgreSQL
    participant D as 🚗 Conductor (SPA)

    Note over P, D: 1. Autenticación
    P->>API: POST /api/auth/login {email, password}
    API->>DB: SELECT user WHERE email
    API-->>P: {user, tokens: {accessToken, refreshToken}}
    P->>WS: connect + emit("join", userId)

    D->>API: POST /api/auth/login {email, password}
    API-->>D: {user, tokens}
    D->>WS: connect + emit("join", userId) + emit("join:drivers")

    Note over P, D: 2. Solicitud de Viaje
    P->>API: POST /api/trips {origin, destination}
    API->>DB: INSERT trip (status: requested)
    API->>WS: emitTripRequested(trip)
    WS-->>D: event "trip:requested" → aparece en dashboard
    API-->>P: 201 {data: trip}

    Note over P, D: 3. Aceptación
    D->>API: POST /api/trips/:id/accept
    API->>DB: UPDATE trip SET status=accepted, driver_id
    API->>WS: emitTripAccepted(passengerId, trip)
    WS-->>P: event "trip:accepted" → UI muestra conductor asignado
    API-->>D: 200 {data: trip}

    Note over P, D: 4. Inicio del Viaje
    D->>API: POST /api/trips/:id/start
    API->>DB: UPDATE trip SET status=on_ride
    API->>WS: emitTripStatusUpdated("trip:started")
    WS-->>P: event "trip:started" → stepper avanza
    API-->>D: 200 {data: trip}

    Note over P, D: 5. Completar Viaje
    D->>API: POST /api/trips/:id/complete
    API->>DB: UPDATE trip SET status=completed
    API->>WS: emitTripStatusUpdated("trip:completed")
    WS-->>P: event "trip:completed" → muestra resumen y tarifa
    API-->>D: 200 {data: trip}
```

---

## Modelo de Datos (ERD)

```mermaid
erDiagram
    USERS {
        varchar id PK "UUID"
        varchar name "NOT NULL"
        varchar email UK "NOT NULL"
        varchar password "NOT NULL, SELECT false"
        varchar role "CHECK(passenger, driver)"
        varchar phone "NULLABLE"
        numeric rating "DEFAULT 5.0"
        timestamp created_at "DEFAULT NOW()"
    }

    TRIPS {
        varchar id PK "UUID"
        varchar passenger_id FK "NOT NULL → users.id"
        varchar driver_id FK "NULLABLE → users.id"
        text origin_address "NOT NULL"
        numeric origin_lat "NOT NULL"
        numeric origin_lng "NOT NULL"
        text destination_address "NOT NULL"
        numeric destination_lat "NOT NULL"
        numeric destination_lng "NOT NULL"
        varchar status "CHECK(requested, accepted, on_ride, completed, cancelled)"
        varchar vehicle_type "CHECK(standard, comfort, xl)"
        text notes "NULLABLE"
        numeric fare "NULLABLE"
        numeric distance "NULLABLE"
        integer duration "NULLABLE"
        timestamp requested_at "DEFAULT NOW()"
        timestamp accepted_at "NULLABLE"
        timestamp started_at "NULLABLE"
        timestamp completed_at "NULLABLE"
    }

    REFRESH_TOKENS {
        varchar id PK "UUID (jti)"
        varchar user_id FK "NOT NULL → users.id"
        text token UK "NOT NULL"
        timestamp expires_at "NOT NULL"
        timestamp created_at "DEFAULT NOW()"
    }

    USERS ||--o{ TRIPS : "passenger_id"
    USERS ||--o{ TRIPS : "driver_id"
    USERS ||--o{ REFRESH_TOKENS : "user_id"
```

---

## Endpoints Implementados

### Autenticación (`/api/auth`)

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Registro con nombre, email, contraseña y rol | ❌ |
| POST | `/api/auth/login` | Login y generación de tokens JWT | ❌ |
| GET | `/api/auth/me` | Perfil del usuario autenticado | ✅ |
| POST | `/api/auth/logout` | Revocar refresh token | ✅ |
| POST | `/api/auth/refresh` | Renovar access token | ❌ |

### Viajes – Rutas Principales (`/api/trips`)

| Método | Ruta | Descripción | Auth | Rol |
|---|---|---|---|---|
| POST | `/api/trips` | Solicitar un viaje nuevo | ✅ | passenger |
| GET | `/api/trips/available` | Listar viajes disponibles | ✅ | driver |
| GET | `/api/trips/active` | Viaje activo del usuario | ✅ | any |
| GET | `/api/trips/history` | Historial de viajes | ✅ | any |
| POST | `/api/trips/:id/accept` | Aceptar un viaje | ✅ | driver |
| POST | `/api/trips/:id/start` | Iniciar un viaje | ✅ | driver |
| POST | `/api/trips/:id/complete` | Completar un viaje | ✅ | driver |
| POST | `/api/trips/:id/cancel` | Cancelar un viaje | ✅ | any |
| PATCH | `/api/trips/:id/status` | Actualizar estado (legacy) | ✅ | any |
| GET | `/api/trips/:id` | Obtener viaje por ID | ✅ | any |

### Viajes – Alias Académicos (`/api/travels`)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/travels/request` | Alias de `POST /api/trips` |
| POST | `/api/travels/:id/accept` | Alias de `POST /api/trips/:id/accept` |
| POST | `/api/travels/:id/start` | Alias de `POST /api/trips/:id/start` |
| POST | `/api/travels/:id/complete` | Alias de `POST /api/trips/:id/complete` |
| POST | `/api/travels/:id/cancel` | Alias de `POST /api/trips/:id/cancel` |
| GET | `/api/me/travels` | Alias de `GET /api/trips/history` |

---

## Stack Tecnológico

### Backend
| Tecnología | Versión | Propósito |
|---|---|---|
| Node.js | 20+ | Runtime |
| Express | 4.19 | Framework HTTP |
| TypeScript | 5.4 | Tipado estático |
| TypeORM | 0.3.20 | ORM con entidades decoradas |
| PostgreSQL | 16 | Base de datos relacional |
| Socket.IO | 4.7 | WebSocket en tiempo real |
| JWT (jsonwebtoken) | 9.0 | Autenticación stateless |
| Zod | 3.22 | Validación de DTOs |
| Swagger (swagger-jsdoc) | 6.2 | Documentación OpenAPI |
| Winston | 3.13 | Logging estructurado |
| Helmet | 7.1 | Seguridad HTTP headers |
| bcryptjs | 2.4 | Hash de contraseñas |

### Frontend
| Tecnología | Versión | Propósito |
|---|---|---|
| Vue.js | 3.4 | Framework SPA reactivo |
| Pinia | 2.1 | State management |
| Vue Router | 4.3 | Enrutamiento SPA |
| Axios | 1.6 | Cliente HTTP |
| Socket.IO Client | 4.x | WebSocket en tiempo real |
| TailwindCSS | 3.4 | Framework CSS utilitario |
| Vee-Validate + Zod | 4.15 | Validación de formularios |
| Leaflet | 1.9 | Mapas interactivos |

### Infraestructura
| Componente | Herramienta |
|---|---|
| Contenedores | Docker + Docker Compose |
| Base de Datos | Supabase (PostgreSQL cloud) |
| Despliegue Backend | Render.com |
| Despliegue Frontend | Vercel |
