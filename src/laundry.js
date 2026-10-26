const DAY = 86400000;

const toDate = (value) => new Date(`${value}T00:00:00Z`);
const formatDate = (value) => value.toISOString().slice(0, 10);

export function dateInParis(value) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value).filter((part) => part.type !== 'literal').map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function mondayOnOrAfter(value) {
  const date = toDate(value);
  date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7));
  return formatDate(date);
}

export function nextLaundryDate(value) {
  const date = toDate(value);
  date.setUTCDate(date.getUTCDate() + 7);
  return formatDate(date);
}

export function rotateQueue(queue) {
  return queue.length > 1 ? [...queue.slice(1), queue[0]] : [...queue];
}

export function projectLaundry(startDate, currentDate, queue, events = [], count = 52) {
  const byDate = new Map(events.map((event) => [event.date, event]));
  const current = toDate(currentDate);

  return Array.from({ length: count }, (_, index) => {
    const date = toDate(startDate);
    date.setUTCDate(date.getUTCDate() + index * 7);
    const key = formatDate(date);
    const event = byDate.get(key);
    if (key < currentDate) return { date: key, ...(event || {}) };
    const offset = Math.round((date - current) / (7 * DAY));
    const player = queue.length ? queue[offset % queue.length] : null;
    return { date: key, user_id: player?.id ?? null, name: player?.name ?? null };
  });
}