/** timeOfDayGreeting() from GlobalHelpers.php: hour in Africa/Kampala, < 12 morning, < 17 afternoon, else evening. */
export function timeOfDayGreeting(now: Date = new Date(), timeZone = 'Africa/Kampala'): string {
  const hour =
    Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone }).format(now)) % 24
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
