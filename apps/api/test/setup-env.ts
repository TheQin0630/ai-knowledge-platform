process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.DATABASE_URL =
  'postgresql://user:password@localhost:5432/ai_knowledge_test';
process.env.REDIS_URL = 'redis://:password@localhost:6379/1';
process.env.JWT_ACCESS_SECRET = '0123456789abcdef0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'fedcba9876543210fedcba9876543210';
