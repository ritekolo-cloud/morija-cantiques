import swaggerJSDoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Morija-Cantiques API',
      version: '1.0.0',
      description: 'API for the Morija-Cantiques Hymn Book application',
    },
    servers: [
      {
        url: `http://localhost:${env.port}/api`,
        description: 'Development server',
      },
      {
        url: 'https://api.morijacantiques.com/api',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.validator.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
