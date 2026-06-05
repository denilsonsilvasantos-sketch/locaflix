// Load .env file if it exists (works locally and on servers with .env uploaded)
try {
  process.loadEnvFile('.env')
} catch {
  // .env not found — env vars must be set externally (e.g. hosting panel)
}

await import('./dist/server/index.js')
