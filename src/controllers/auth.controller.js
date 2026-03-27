import { loginUser, registerUser, getMe } from '../services/user.service.js';
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
