export function todayAtProperty(date=new Date()){
  const parts=new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
