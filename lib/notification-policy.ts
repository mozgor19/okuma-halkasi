export function nextDeviceNotification<T extends { id: string }>(items: T[], groupId: string, memberId: number, day: string, alreadySent: (key: string) => boolean) {
  for (const prefix of ["changed-", "new-", "upcoming-"]) {
    for (const notification of items) {
      if (!notification.id.startsWith(prefix)) continue;
      const period = prefix === "changed-" ? "event" : day;
      const key = `book-club-notified-${groupId}-${memberId}-${period}-${notification.id}`;
      if (!alreadySent(key)) return { notification, key };
    }
  }
  return null;
}
