/**
 * Crypto Dependencies Wrapper
 *
 * This module provides jsonwebtoken and bcryptjs imports that work
 * correctly with tsx's module resolution.
 *
 * The issue: tsx's ESM loader has trouble resolving CommonJS packages
 * when imported from nested subdirectories in ESM mode.
 *
 * The solution: Use absolute file paths with dynamic import() to completely
 * bypass tsx's resolution logic. This requires hardcoded paths in Docker.
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Detect if we're running in Docker (has /app/node_modules) or locally
const isDocker = process.cwd() === '/app';
const nodeModulesPath = isDocker ? '/app/node_modules' : join(process.cwd(), 'node_modules');

// Use dynamic import with absolute paths to bypass tsx resolution entirely
// This is the only approach that works reliably with tsx's aggressive interception
export const jwt = await import(`${nodeModulesPath}/jsonwebtoken/index.js`).then(m => m.default || m);
export const bcrypt = await import(`${nodeModulesPath}/bcryptjs/index.js`).then(m => m.default || m);
