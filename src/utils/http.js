export const ok = (res, data = {}, message = 'OK', status = 200) => {
  return res.status(status).json({ success: true, message, data });
};

export const fail = (res, message = 'Bad Request', status = 400, errors = null, meta = {}) => {
  return res.status(status).json({ success: false, message, errors, ...meta });
};
