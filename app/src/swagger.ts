/**
 * Swagger/OpenAPI Documentation Setup
 * Generates API documentation from JSDoc comments
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { env } from './config/env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Loyal Supply Chain API',
      version: '1.0.0',
      description: 'API documentation for Loyal Supply Chain Management System',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || `http://localhost:${env.PORT}`,
        description: env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/v1/auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            message: {
              type: 'string',
              description: 'Detailed error message',
            },
          },
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy'],
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            database: {
              type: 'string',
            },
            uptime: {
              type: 'number',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Authentication endpoints',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Shipments',
        description: 'Shipment management endpoints',
      },
      {
        name: 'Companies',
        description: 'Company management endpoints',
      },
      {
        name: 'Ports',
        description: 'Port management endpoints',
      },
      {
        name: 'Contracts',
        description: 'Contract management endpoints',
      },
      {
        name: 'Finance',
        description: 'Finance and transfer endpoints',
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/index.ts',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Loyal Supply Chain API Documentation',
  }));

  // JSON endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

export { swaggerSpec };

