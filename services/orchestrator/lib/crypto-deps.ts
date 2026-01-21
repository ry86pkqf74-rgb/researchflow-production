/**
 * Crypto Dependencies Wrapper
 *
 * This module provides jsonwebtoken and bcryptjs imports that work
 * correctly with tsx's module resolution. By placing this file at
 * /app/lib/ (closer to node_modules), the require() calls resolve properly.
 */

import { createRequire } from 'module';

// Create require function anchored to this file's location
// Since this file is at /app/lib/, it's one level from /app/node_modules
const require = createRequire(import.meta.url);

export const jwt = require('jsonwebtoken');
export const bcrypt = require('bcryptjs');
