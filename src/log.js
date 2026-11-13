// Structured JSON logger with request-id correlation. Never log secrets or PII.
const emit = (level, obj) => {
  const line = typeof obj === 'string' ? { msg: obj } : (obj || {});
  const out = JSON.stringify({ level, time: new Date().toISOString(), ...line });
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
};

export const log = {
  info: (obj) => emit('info', obj),
  warn: (obj) => emit('warn', obj),
  error: (obj) => emit('error', obj),
};
