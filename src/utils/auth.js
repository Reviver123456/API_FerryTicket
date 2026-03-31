import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signToken = (payload, options = {}) => jwt.sign(payload, env.jwtSecret, {
  expiresIn: options.expiresIn || env.jwtExpiresIn
});
export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);
