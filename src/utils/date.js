export const nowIso = () => new Date().toISOString();

export const addMinutesIso = (minutes) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
};

export const isExpired = (isoDate) => new Date(isoDate).getTime() < Date.now();
