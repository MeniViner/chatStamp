export function stripDirectionMarks(input: string): string {
  return input.replace(/[\u200e\u200f\u202a-\u202e]/g, '');
}

export function parseWhatsAppDateToIso(datePart: string, timePart: string): string | null {
  const cleanDate = stripDirectionMarks(datePart).trim();
  const cleanTime = stripDirectionMarks(timePart).trim();

  const dateMatch = cleanDate.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  const timeMatch = cleanTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AP]M))?$/i);

  if (!dateMatch || !timeMatch) return null;

  const firstDatePart = Number(dateMatch[1]);
  const secondDatePart = Number(dateMatch[2]);
  let year = Number(dateMatch[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;

  const { day, month } = resolveDayAndMonth(firstDatePart, secondDatePart);
  if (!isValidDatePart(day, 1, 31) || !isValidDatePart(month, 1, 12)) {
    return null;
  }

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = timeMatch[3] ? Number(timeMatch[3]) : 0;
  const ampm = timeMatch[4]?.toUpperCase();

  if (!isValidDatePart(minute, 0, 59) || !isValidDatePart(second, 0, 59)) {
    return null;
  }
  if (ampm && (hour < 1 || hour > 12)) {
    return null;
  }
  if (!ampm && (hour < 0 || hour > 23)) {
    return null;
  }

  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const date = new Date(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null;
  }

  return date.toISOString();
}

function resolveDayAndMonth(firstDatePart: number, secondDatePart: number): { day: number; month: number } {
  if (firstDatePart > 12) return { day: firstDatePart, month: secondDatePart };
  if (secondDatePart > 12) return { day: secondDatePart, month: firstDatePart };
  return { day: firstDatePart, month: secondDatePart };
}

function isValidDatePart(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
