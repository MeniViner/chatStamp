export function formatShortChatTimestamp(dateIso: string): string {
  const date = new Date(dateIso);
  if (!Number.isFinite(date.getTime())) return '';

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
