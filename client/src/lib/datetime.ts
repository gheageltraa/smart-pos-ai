const greetingByHour = (hour: number) => {
  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 18) return "Selamat sore";
  return "Selamat malam";
};

export function getGreeting(date: Date = new Date()) {
  return greetingByHour(date.getHours());
}

export function formatOverviewDate(date: Date = new Date()) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatJakartaDateKey(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function resolveDisplayName(
  profileFullName?: string | null,
  metadataFullName?: string | null,
  username?: string | null,
  email?: string | null
) {
  const name = [profileFullName, metadataFullName, username, email?.split("@")[0]]
    .map(value => value?.trim())
    .find((value): value is string => Boolean(value));
  return name || "Pengguna";
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Pengguna";
}
