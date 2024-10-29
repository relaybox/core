export function getISODateString(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  if (/^\d+$/.test(value)) {
    const timestamp = value.length === 10 ? parseInt(value, 10) * 1000 : parseInt(value, 10);

    const date = new Date(timestamp);

    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  const date = new Date(value);

  return isNaN(date.getTime()) ? null : date.toISOString();
}
