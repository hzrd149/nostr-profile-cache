import followRedirects from "follow-redirects";
const { http, https } = followRedirects;

export function getBufferFromURL(url: URL | string) {
  if (typeof url === "string") url = new URL(url);

  return new Promise<Buffer>((res, rej) => {
    const data: Uint8Array[] = [];
    const request = (url.protocol === "https:" ? https : http).get(url, (response) => {
      response.on("data", (chunk) => data.push(chunk));
      response.on("error", (err) => rej(err));
      response.on("end", () => res(Buffer.concat(data)));
    });
    request.on("error", (err) => rej(err));
    request.end();
  });
}
