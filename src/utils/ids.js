import { customAlphabet } from 'nanoid';

const alphaNum = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);
const digit6 = customAlphabet('0123456789', 6);

export const generateBookingNo = () => `BK${alphaNum()}`;
export const generatePaymentRef = () => `PAY${alphaNum()}`;
export const generateTicketNo = () => `TK${alphaNum()}`;
export const generateScanCode = () => `SC${alphaNum(16)}`;
export const generateScheduleCode = () => `SCH${digit6()}`;
