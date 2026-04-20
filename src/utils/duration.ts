function utcDateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function daysInUtcMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function plural(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

export function calculateDuration(joiningDate: Date, exitDate: Date | null) {
  if (!exitDate) return "Ongoing";

  const start = utcDateOnly(joiningDate);
  const end = utcDateOnly(exitDate);

  if (end.getTime() < start.getTime()) {
    throw new Error("Date of exit cannot be earlier than joining date.");
  }

  if (end.getTime() === start.getTime()) {
    return "1 day";
  }

  const inclusiveEnd = new Date(end.getTime());
  inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() + 1);

  let years = inclusiveEnd.getUTCFullYear() - start.getUTCFullYear();
  let months = inclusiveEnd.getUTCMonth() - start.getUTCMonth();
  let days = inclusiveEnd.getUTCDate() - start.getUTCDate();

  if (days < 0) {
    const previousMonthIndex = inclusiveEnd.getUTCMonth() - 1;
    const previousMonthYear = previousMonthIndex < 0 ? inclusiveEnd.getUTCFullYear() - 1 : inclusiveEnd.getUTCFullYear();
    const normalizedPreviousMonthIndex = previousMonthIndex < 0 ? 11 : previousMonthIndex;
    days += daysInUtcMonth(previousMonthYear, normalizedPreviousMonthIndex);
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const parts = [
    years > 0 ? plural(years, "year") : "",
    months > 0 ? plural(months, "month") : "",
    days > 0 ? plural(days, "day") : ""
  ].filter(Boolean);

  return parts.join(", ");
}
