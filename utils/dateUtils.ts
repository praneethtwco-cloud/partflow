export const formatDateForDb = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(formatDateForDb);
  }

  if (typeof obj === 'object') {
    const result: any = { ...obj };
    for (const key in result) {
      if (result[key] instanceof Date) {
        result[key] = result[key].toISOString();
      } else if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
        result[key] = formatDateForDb(result[key]);
      }
    }
    return result;
  }

  return obj;
};
