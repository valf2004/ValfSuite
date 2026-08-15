export function publicBaseUrl(request:Request,requestHeaders:Headers){
  const forwardedHost=requestHeaders.get("x-forwarded-host")||requestHeaders.get("host")||new URL(request.url).host;
  const forwardedProtocol=requestHeaders.get("x-forwarded-proto")||new URL(request.url).protocol.replace(":","");
  return process.env["PUBLIC_BASE_URL"]?.trim().replace(/\/$/,"")||`${forwardedProtocol}://${forwardedHost}`;
}
