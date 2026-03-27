import { randomUUID } from 'crypto';

export const requestContext = (req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
};
