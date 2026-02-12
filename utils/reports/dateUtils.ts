export enum PresetDateRange {
  TODAY = 'today',
  THIS_WEEK = 'this_week',
  THIS_MONTH = 'this_month',
  THIS_QUARTER = 'this_quarter',
  THIS_YEAR = 'this_year',
  CUSTOM = 'custom'
}

/**
 * Gets date range for preset options
 * @param preset Preset date range option
 * @returns Start and end dates for the preset
 */
export function getPresetDateRange(preset: PresetDateRange): { startDate: Date; endDate: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (preset) {
    case PresetDateRange.TODAY:
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case PresetDateRange.THIS_WEEK:
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek); // Start from Sunday
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;

    case PresetDateRange.THIS_MONTH:
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;

    case PresetDateRange.THIS_QUARTER:
      const month = start.getMonth();
      const quarterStartMonth = Math.floor(month / 3) * 3;
      start.setMonth(quarterStartMonth, 1);
      start.setHours(0, 0, 0, 0);
      
      const quarterEndMonth = quarterStartMonth + 2;
      end.setMonth(quarterEndMonth + 1, 0); // Last day of the quarter month
      end.setHours(23, 59, 59, 999);
      break;

    case PresetDateRange.THIS_YEAR:
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;

    default:
      // For custom range, return current day as default
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
  }

  return { startDate: start, endDate: end };
}

/**
 * Validates if a date range is valid
 * @param startDate Start date
 * @param endDate End date
 * @returns True if the date range is valid, false otherwise
 */
export function isValidDateRange(startDate: Date, endDate: Date): boolean {
  if (!startDate || !endDate) {
    return false;
  }
  
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    return false;
  }
  
  return startDate <= endDate;
}

/**
 * Formats a date as YYYY-MM-DD string
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a date string in YYYY-MM-DD format
 * @param dateString Date string to parse
 * @returns Parsed date object
 */
export function parseDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date;
}