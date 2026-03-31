import {
  createPasswordResetRequest,
  getMe,
  loginUser,
  registerUser,
  resetPassword,
  uploadProfileImage
} from '../services/user.service.js';
import { createHandler as handle } from '../utils/controller.js';

export const register = handle(registerUser, 'User registered', {
  status: 201
});

export const login = handle(loginUser, 'Login successful');

export const me = handle(getMe, 'Profile loaded', {
  mapArgs: (req) => [req.user.sub]
});

export const forgotPassword = handle(createPasswordResetRequest, (data) => data.message, {
  mapArgs: (req) => [req.body, {
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null
  }]
});

export const resetPasswordByToken = handle(resetPassword, 'Password reset successful');

export const updateProfileImage = handle(uploadProfileImage, 'Profile image updated', {
  mapArgs: (req) => [req.user.sub, req.body]
});
