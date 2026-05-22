let _dbInitError: string | null = null;

export function setDbInitError(msg: string) { _dbInitError = msg; }
export function getDbInitError() { return _dbInitError; }
