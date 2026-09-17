/**
 * Environment Variables Validation
 * Validates that all required environment variables are set
 */

interface EnvVar {
  key: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
  example?: string;
}

const ENV_VARS: EnvVar[] = [
  // Required variables
  {
    key: 'VITE_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
    validator: (value) => value.startsWith('https://') && value.includes('.supabase.co'),
    example: 'https://your-project.supabase.co',
  },
  {
    key: 'VITE_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key',
    validator: (value) => value.startsWith('eyJ') && value.length > 100,
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  // Provider keys belong to server-only variables and are intentionally not
  // validated in the browser.
  // Optional public variables
  {
    key: 'VITE_N8N_WEBHOOK_URL',
    required: false,
    description: 'n8n webhook URL',
    validator: (value) => value.startsWith('http') && value.includes('/webhook/'),
    example: 'https://n8n.mycompany.com/webhook/arroko',
  },
  {
    key: 'VITE_N8N_WORKFLOW_ID',
    required: false,
    description: 'n8n workflow ID',
    example: 'arroko-automation',
  },
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  missingOptional: string[];
}

/**
 * Get environment variable value
 */
function getEnvVar(key: string): string | undefined {
  // Support both import.meta.env and process.env
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && (process as any).env) {
    return (process as any).env[key];
  }
  return undefined;
}

/**
 * Validate all environment variables
 */
export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = getEnvVar(envVar.key);

    // Check if variable is set
    if (!value || value.trim() === '') {
      if (envVar.required) {
        missingRequired.push(envVar.key);
        errors.push(
          `❌ ${envVar.key} is required but not set.\n` +
          `   Description: ${envVar.description}\n` +
          `   Example: ${envVar.example || 'N/A'}`
        );
      } else {
        missingOptional.push(envVar.key);
        warnings.push(
          `⚠️  ${envVar.key} is not set (optional).\n` +
          `   Description: ${envVar.description}`
        );
      }
      continue;
    }

    // Check for placeholder values
    const placeholders = ['your_', 'YOUR_', 'placeholder', 'PLACEHOLDER', 'example', 'EXAMPLE'];
    if (placeholders.some(p => value.includes(p))) {
      errors.push(
        `❌ ${envVar.key} contains a placeholder value.\n` +
        `   Current: ${value.substring(0, 50)}...\n` +
        `   Please replace with a real value.`
      );
      continue;
    }

    // Run custom validator if provided
    if (envVar.validator && !envVar.validator(value)) {
      errors.push(
        `❌ ${envVar.key} has an invalid format.\n` +
        `   Current: ${value.substring(0, 50)}...\n` +
        `   Expected format: ${envVar.example || 'See documentation'}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingRequired,
    missingOptional,
  };
}

/**
 * Print validation results to console
 */
export function printValidationResults(result: ValidationResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 ENVIRONMENT VARIABLES VALIDATION');
  console.log('='.repeat(60) + '\n');

  if (result.valid) {
    console.log('✅ All required environment variables are configured correctly!\n');

    if (result.warnings.length > 0) {
      console.log('⚠️  Optional variables not configured:');
      result.warnings.forEach(warning => console.log(warning));
      console.log('');
    }
  } else {
    console.error('❌ Environment validation failed!\n');
    console.error('ERRORS:');
    result.errors.forEach(error => console.error(error + '\n'));

    console.error('\n📚 SETUP INSTRUCTIONS:');
    console.error('1. Copy .env.example to .env.local');
    console.error('2. Fill in the required values');
    console.error('3. Read ENV_SETUP_GUIDE.md for detailed instructions');
    console.error('4. Restart the development server\n');
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Validate and throw error if invalid (for production)
 */
export function validateEnvOrThrow(): void {
  const result = validateEnv();

  if (!result.valid) {
    printValidationResults(result);
    throw new Error(
      `Missing required environment variables: ${result.missingRequired.join(', ')}\n` +
      'Please configure .env.local file. See ENV_SETUP_GUIDE.md for instructions.'
    );
  }
}

/**
 * Get a typed environment variable with fallback
 */
export function getEnv(key: string, fallback?: string): string {
  const value = getEnvVar(key);

  if (!value && !fallback) {
    console.warn(`⚠️  Environment variable ${key} is not set and no fallback provided`);
  }

  return value || fallback || '';
}

/**
 * Check if environment is production
 */
export function isProduction(): boolean {
  const mode = getEnvVar('NODE_ENV') || getEnvVar('MODE');
  return mode === 'production';
}

/**
 * Check if environment is development
 */
export function isDevelopment(): boolean {
  const mode = getEnvVar('NODE_ENV') || getEnvVar('MODE');
  return mode === 'development' || !mode;
}

// Run validation in development mode on load
if (isDevelopment()) {
  const result = validateEnv();
  printValidationResults(result);
}
