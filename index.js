// Hostinger entry point — runs TypeScript server directly via tsx (no build needed)
import { register } from 'node:module'
register('tsx/esm', import.meta.url)
await import('./server/index.ts')
