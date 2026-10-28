import type { Net } from "electron";
import type { BundleFetch } from "./bundle-download.js";

/** Statuses whose response can have no body (`new Response` refuses one). */
const NO_BODY = new Set([101, 103, 204, 205, 304]);

/**
 * Download and bundle's fetch through Electron's network (3.9), answering a redirect with itself
 * rather than following it, so `bundle-download.ts` checks every hop. Not `net.fetch`: with
 * `redirect: "manual"` it throws ("Redirect was cancelled", Electron 44) instead of giving the
 * redirect, so a redirect could never be checked and followed. `net.request` in manual mode tells
 * where it would go; this answers that as a 3xx with its `Location`, and cancels the request.
 * Cookies aren't sent: the download is anonymous.
 *
 * The signal stops it at any point: before an answer it rejects, and after one it fails the body,
 * so a body that stalls can't outlast the download's deadline.
 */
export function electronBundleFetch(net: Pick<Net, "request">): BundleFetch {
  return (url, { signal }) =>
    new Promise<Response>((resolve, reject) => {
      const request = net.request({ url, redirect: "manual", useSessionCookies: false });
      // The body's controller once there is an answer: the signal fails it, not the promise.
      let body: ReadableStreamDefaultController<Uint8Array> | undefined;
      let settled = false;
      const fail = (error: Error) => {
        if (body !== undefined) {
          try {
            body.error(error);
          } catch {
            // Already closed or failed.
          }
        } else if (!settled) {
          settled = true;
          reject(error);
        }
      };
      const stop = () => {
        request.abort();
        fail(new Error("The download was stopped"));
      };
      if (signal.aborted) {
        stop();
        return;
      }
      signal.addEventListener("abort", stop, { once: true });
      const done = () => signal.removeEventListener("abort", stop);
      request.on("redirect", (statusCode, _method, redirectUrl) => {
        done();
        request.abort();
        settled = true;
        resolve(new Response(null, { status: statusCode, headers: { location: redirectUrl } }));
      });
      request.on("response", (response) => {
        try {
          const headers = new Headers();
          for (const [name, value] of Object.entries(response.headers)) {
            headers.set(name, Array.isArray(value) ? value.join(", ") : value);
          }
          // The body as it arrives; cancelling it (past the size limit) stops the download.
          const stream = NO_BODY.has(response.statusCode)
            ? null
            : new ReadableStream<Uint8Array>({
                start(controller) {
                  body = controller;
                  response.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
                  response.on("end", () => {
                    done();
                    controller.close();
                  });
                  response.on("error", (error: Error) => {
                    done();
                    controller.error(error);
                  });
                  response.on("aborted", () => {
                    done();
                    controller.error(new Error("The download was cut off"));
                  });
                },
                cancel() {
                  done();
                  request.abort();
                },
              });
          settled = true;
          resolve(new Response(stream, { status: response.statusCode, headers }));
        } catch (error) {
          // A status or header `Response` won't take: no answer to give, never a crash in main.
          done();
          request.abort();
          settled = true;
          reject(error instanceof Error ? error : new Error("The answer couldn't be read"));
        }
      });
      request.on("error", (error) => {
        done();
        fail(error);
      });
      request.end();
    });
}
