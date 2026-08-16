export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  const loginUrl = new URL("/area-riservata", window.location.origin);
  loginUrl.searchParams.set("sessione", "scaduta");
  window.location.replace(`${loginUrl.pathname}${loginUrl.search}`);

  return new Promise<Response>(() => {});
}
