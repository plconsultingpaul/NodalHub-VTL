const TZ_OFFSETS: Record<string, string> = {
  'UTC': 'UTC',
  'US/Eastern': 'America/New_York',
  'US/Central': 'America/Chicago',
  'US/Mountain': 'America/Denver',
  'US/Pacific': 'America/Los_Angeles',
  'Europe/London': 'Europe/London',
  'Europe/Paris': 'Europe/Paris',
  'Asia/Tokyo': 'Asia/Tokyo',
  'Australia/Sydney': 'Australia/Sydney',
};

function getIANATimezone(tz: string): string {
  return TZ_OFFSETS[tz] || tz || 'UTC';
}

function getDatePartsInTZ(date: Date, tz: string): { year: number; month: number; day: number; hour: number; minute: number; dow: number } {
  const ianaZone = getIANATimezone(tz);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    year: parseInt(get('year')),
    month: parseInt(get('month')),
    day: parseInt(get('day')),
    hour: parseInt(get('hour')) % 24,
    minute: parseInt(get('minute')),
    dow: dayMap[get('weekday')] ?? 0,
  };
}

function buildDateInTZ(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const ianaZone = getIANATimezone(tz);
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  const guess = new Date(iso + 'Z');
  const parts = getDatePartsInTZ(guess, tz);
  const offsetMs = (parts.hour * 60 + parts.minute) - (guess.getUTCHours() * 60 + guess.getUTCMinutes());
  const adjusted = new Date(guess.getTime() - offsetMs * 60000);
  const check = getDatePartsInTZ(adjusted, tz);
  if (check.hour !== hour || check.minute !== minute) {
    const diff = ((hour * 60 + minute) - (check.hour * 60 + check.minute)) * 60000;
    return new Date(adjusted.getTime() + diff);
  }
  return adjusted;
}

function parseCronField(field: string, max: number): number[] | null {
  if (field === '*') return null;
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2));
    if (!step || step <= 0) return null;
    const vals: number[] = [];
    for (let i = 0; i < max; i += step) vals.push(i);
    return vals;
  }
  return field.split(',').map(v => parseInt(v)).filter(v => !isNaN(v));
}

export function computeNextCronRun(cronExpression: string, timezone: string = 'UTC'): string {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return new Date(Date.now() + 60000).toISOString();

  const [minPart, hourPart, domPart, , dowPart] = parts;

  const minutes = parseCronField(minPart, 60);
  const hours = parseCronField(hourPart, 24);
  const doms = parseCronField(domPart, 32);
  const dows = parseCronField(dowPart, 7);

  const now = new Date();
  const nowParts = getDatePartsInTZ(now, timezone);

  // For simple interval patterns (*/N * * * *), just add the interval
  if (minPart.startsWith('*/') && hourPart === '*' && domPart === '*' && dowPart === '*') {
    const step = parseInt(minPart.slice(2)) || 1;
    const nextMin = (Math.floor(nowParts.minute / step) + 1) * step;
    if (nextMin < 60) {
      return buildDateInTZ(nowParts.year, nowParts.month, nowParts.day, nowParts.hour, nextMin, timezone).toISOString();
    }
    const nextHourDate = new Date(now.getTime() + (60 - nowParts.minute) * 60000);
    const nhParts = getDatePartsInTZ(nextHourDate, timezone);
    return buildDateInTZ(nhParts.year, nhParts.month, nhParts.day, nhParts.hour, 0, timezone).toISOString();
  }

  // Every minute
  if (minPart === '*' && hourPart === '*' && domPart === '*' && dowPart === '*') {
    return new Date(now.getTime() + 60000).toISOString();
  }

  // For specific time patterns, find the actual next occurrence
  for (let dayOffset = 0; dayOffset <= 400; dayOffset++) {
    const candidate = new Date(now.getTime() + dayOffset * 86400000);
    const candParts = getDatePartsInTZ(candidate, timezone);

    if (doms && !doms.includes(candParts.day)) continue;
    if (dows && !dows.includes(candParts.dow)) continue;

    const hourList = hours || Array.from({ length: 24 }, (_, i) => i);
    const minList = minutes || Array.from({ length: 60 }, (_, i) => i);

    for (const h of hourList) {
      for (const m of minList) {
        if (dayOffset === 0) {
          if (h < nowParts.hour || (h === nowParts.hour && m <= nowParts.minute)) continue;
        }
        const result = buildDateInTZ(candParts.year, candParts.month, candParts.day, h, m, timezone);
        if (result > now) return result.toISOString();
      }
    }
  }

  return new Date(now.getTime() + 86400000).toISOString();
}
