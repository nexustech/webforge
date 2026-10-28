import type { Net } from "electron";
import type { BundleFetch } from "./bundle-download.js";

/**
 * Download and bundle's fetch through Electron's network (3.9), answering a redirect with itself
 * rather than following it, so `bundle-download.ts` checks every hop. Not `net.fetch`: with
 * `redirect: "manual"` it throws ("Redirect was cancelled", Electron 44) instead of giving the
 * redirect, so a redirect could never be checked and followed. `net.request` in manual mode tells
 * where it would go; this answers that as a 3xx with its `Location`, and cancels the request.
 * Cookies aren't sent: the download is anonymous.
 */
export function electronBundleFetch(net: Pick<Net, "request">): BundleFetch {
  return (url, { signal }) =>
    new Promise<Response>((resolve, reject) => {
      const request = net.request({ url, redirect: "manual", useSessionCookies: false });
      const stop = () => {
        request.abort();
        reject(new Error("The download was stopped"));
      };
      if (signal.aborted) {
        stop();
        return;
      }
      signal.addEventListener("abort", stop, { once: true });
      request.on("redirect", (statusCode, _method, redirectUrl) => {
        signal.removeEventListener("abort", stop);
        request.abort();
        resolve(new Response(null, { status: statusCode, headers: { location: redirectUrl } }));
      });
      request.on("response", (response) => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          headers.set(name, Array.isArray(value) ? value.join(", ") : value);
        }
        // The body as it arrives; cancelling it (past the size limit) stops the download.
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            response.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
            response.on("end", () => {
              signal.removeEventListener("abort", stop);
              controller.close();
            });
            response.on("error", (error: Error) => controller.error(error));
          },
          cancel() {
            signal.removeEventListener("abort", stop);
            request.abort();
          },
        });
        resolve(new Response(body, { status: response.statusCode, headers }));
      });
      request.on("error", (error) => {
        signal.removeEventListener("abort", stop);
        reject(error);
      });
      request.end();
    });
}
