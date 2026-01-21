/**
 * Crypto Dependencies Wrapper
 *
 * This module provides jsonwebtoken and bcryptjs imports that work
 * correctly with tsx's module resolution from the project root.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const jwt = require('jsonwebtoken');
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const bcrypt = require('bcryptjs');
