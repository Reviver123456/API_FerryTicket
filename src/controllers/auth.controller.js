import {
  createPasswordResetRequest,
  getMe,
  loginUser,
  registerUser,
  resetPassword,
  uploadProfileImage
} from '../services/user.service.js';
import { ok } from '../utils/http.js';

export const register = async (req, res, next) => {
  try {
    const data = await registerUser(req.body);
    return ok(res, data, 'User registered', 201);
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const data = await loginUser(req.body);
    return ok(res, data, 'Login successful');
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    const data = await getMe(req.user.sub);
    return ok(res, data, 'Profile loaded');
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const data = await createPasswordResetRequest(req.body, {
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null
    });
    return ok(res, data, data.message);
  } catch (error) {
    next(error);
  }
};

export const resetPasswordByToken = async (req, res, next) => {
  try {
    const data = await resetPassword(req.body);
    return ok(res, data, 'Password reset successful');
  } catch (error) {
    next(error);
  }
};

export const updateProfileImage = async (req, res, next) => {
  try {
    const data = await uploadProfileImage(req.user.sub, req.body);
    return ok(res, data, 'Profile image updated');
  } catch (error) {
    next(error);
  }
};
