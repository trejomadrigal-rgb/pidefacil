// Carga variables de entorno para tests de integración antes de que NestJS arranque
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-chars!!';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';
// DATABASE_URL y REDIS_URL se leen de .env.test si no están en el entorno
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.test') });
}
