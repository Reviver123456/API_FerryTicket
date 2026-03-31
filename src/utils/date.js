export const addMinutesIso = (minutes) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
};
