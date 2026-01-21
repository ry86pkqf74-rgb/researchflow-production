/**
 * Crypto Dependencies Wrapper
 *
 * This module provides jsonwebtoken and bcryptjs imports that work
 * correctly with tsx's module resolution. Uses absolute paths to
 * bypass tsx's module resolution hooks entirely.
 */

import { createRequire } from 'module';
import { join } from 'path';

// Create require function and use absolute paths to node_modules
const require = createRequire(import.meta.url);
const nodeModulesPath = '/app/node_modules';

export const jwt = require(join(nodeModulesPath, 'jsonwebtoken'));
export const bcrypt = require(join(nodeModulesPath, 'bcryptjs'));
