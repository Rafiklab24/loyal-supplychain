import { z } from 'zod';
// Note: Cannot use logger here as it depends on env validation
// This is startup code that runs before logger is available

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long')
    .refine(
      (val) => val !== 'your-secret-key-change-in-production',
      { message: 'JWT_SECRET must not be the default value' }
    ),
  PORT: z
    .string()
    .regex(/^\d+$/, 'PORT must be a number')
    .transform(Number)
    .default('3000'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'], {
      errorMap: () => ({ message: 'NODE_ENV must be development, production, or test' }),
    })
    .default('development'),
  ALLOWED_ORIGINS: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug'], {
      errorMap: () => ({ message: 'LOG_LEVEL must be error, warn, info, or debug' }),
    })
    .default('info'),
  REDIS_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  JWT_EXPIRES_IN: z.string().optional(),
  QUALITY_MEDIA_PATH: z.string().optional(),
});

// Parse and validate environment variables
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment variable validation failed:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export { env };

