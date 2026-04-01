const MAX_BUFFER = 50;
const isDev = import.meta.env.DEV;

let userContext = {};
const errorBuffer = [];

function timestamp() {
  return new Date().toISOString();
}

function formatContext(ctx) {
  const merged = { ...userContext, ...ctx };
  return Object.keys(merged).length ? merged : undefined;
}

const logger = {
  error(message, error, context) {
    const entry = {
      ts: timestamp(),
      level: 'error',
      message,
      error: error?.message || error,
      context: formatContext(context),
    };
    errorBuffer.push(entry);
    if (errorBuffer.length > MAX_BUFFER) errorBuffer.shift();
    console.error(`[ERROR] ${message}`, error || '', entry.context || '');
  },

  warn(message, errorOrContext) {
    const isError = errorOrContext instanceof Error;
    const entry = {
      ts: timestamp(),
      level: 'warn',
      message,
      ...(isError ? { error: errorOrContext.message } : { context: formatContext(errorOrContext) }),
    };
    console.warn(`[WARN] ${message}`, isError ? errorOrContext : entry.context || '');
  },

  info(message, context) {
    if (!isDev) return;
    console.log(`[INFO] ${message}`, formatContext(context) || '');
  },

  setUserContext(ctx) {
    userContext = ctx || {};
  },

  getRecentErrors() {
    return [...errorBuffer];
  },
};

export default logger;
