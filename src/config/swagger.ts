import swaggerJsdoc from 'swagger-jsdoc'

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: '🚖 TaxiGo API',
            version: '2.0.0',
            description: `
API de reservas de taxi construida con **Express + TypeScript + TypeORM + PostgreSQL**.
Permite a pasajeros solicitar viajes y a conductores aceptarlos y gestionarlos en tiempo real mediante WebSockets.

## Autenticación
Todos los endpoints protegidos requieren un **Bearer Token** en el header \`Authorization\`.
Obtén tu token haciendo \`POST /api/auth/login\`.

## Credenciales de Prueba
| Rol | Email | Contraseña |
|---|---|---|
| 🧍 Pasajero | passenger@taxigo.com | password |
| 🚗 Conductor | driver@taxigo.com | password |

## Flujo de Estado del Viaje
\`requested\` → \`accepted\` → \`on_ride\` → \`completed\`
            `,
            contact: {
                name: 'TaxiGo API',
            },
        },
        servers: [
            {
                url: process.env.API_URL || 'http://localhost:8000',
                description: 'Servidor local de desarrollo',
            },
            {
                url: 'https://taxigo-api.onrender.com',
                description: 'Servidor de producción (Render)',
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string', example: 'Carlos Méndez' },
                        email: { type: 'string', format: 'email' },
                        role: { type: 'string', enum: ['passenger', 'driver'] },
                        phone: { type: 'string', example: '+57 300 123 4567' },
                        rating: { type: 'number', example: 4.8 },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                Trip: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        passengerId: { type: 'string' },
                        driverId: { type: 'string', nullable: true },
                        passenger: { $ref: '#/components/schemas/User' },
                        driver: { $ref: '#/components/schemas/User', nullable: true },
                        originAddress: { type: 'string', example: 'Calle 72 #10-07, Bogotá' },
                        originLat: { type: 'number', example: 4.6097 },
                        originLng: { type: 'number', example: -74.0817 },
                        destinationAddress: { type: 'string', example: 'Aeropuerto El Dorado' },
                        destinationLat: { type: 'number', example: 4.7014 },
                        destinationLng: { type: 'number', example: -74.1469 },
                        status: {
                            type: 'string',
                            enum: ['requested', 'accepted', 'on_ride', 'completed', 'cancelled'],
                        },
                        vehicleType: { type: 'string', enum: ['standard', 'comfort', 'xl'] },
                        notes: { type: 'string', nullable: true },
                        fare: { type: 'number', nullable: true, example: 25000 },
                        distance: { type: 'number', nullable: true, example: 12.5 },
                        duration: { type: 'number', nullable: true, example: 35 },
                        requestedAt: { type: 'string', format: 'date-time' },
                        acceptedAt: { type: 'string', format: 'date-time', nullable: true },
                        startedAt: { type: 'string', format: 'date-time', nullable: true },
                        completedAt: { type: 'string', format: 'date-time', nullable: true },
                    },
                },
                AuthTokens: {
                    type: 'object',
                    properties: {
                        accessToken: { type: 'string', description: 'JWT de acceso (15 min)' },
                        refreshToken: { type: 'string', description: 'JWT de actualización (7 días)' },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                    },
                },
            },
        },
        security: [],
        tags: [
            { name: 'Auth', description: 'Registro, login y gestión de sesión' },
            { name: 'Trips', description: 'Gestión del ciclo de vida de los viajes' },
        ],
    },
    apis: ['./src/routes/*.ts', './dist/routes/*.js'],
}

export const swaggerSpec = swaggerJsdoc(options)
