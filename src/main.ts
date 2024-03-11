import { BareHeaders, BareResponse, TransferrableResponse, type BareTransport } from "@mercuryworkshop/bare-mux";
import epoxy from "@mercuryworkshop/epoxy-tls";
export class EpoxyClient implements BareTransport {
  canstart = true;
  epxclient: Awaited<ReturnType<any>>["EpoxyClient"]["prototype"] = null!;
  wisp: string;

  constructor({ wisp }) {
    this.wisp = wisp;
  }
  async init() {
    let { EpoxyClient } = await epoxy();
    this.epxclient = await new EpoxyClient(this.wisp, navigator.userAgent, 10);

    this.ready = true;
  }
  ready = false;
  async meta() { }

  async request(
    remote: URL,
    method: string,
    body: BodyInit | null,
    headers: BareHeaders,
    signal: AbortSignal | undefined
  ): Promise<TransferrableResponse> {
    if (body instanceof Blob)
      body = await body.arrayBuffer();

    try {
      let payload = await this.epxclient.fetch(remote.href, { method, body, headers, redirect: "manual" });
      return {
        body: payload.body!,
        headers: (payload as any).rawHeaders,
        status: payload.status,
        statusText: payload.statusText,
      };
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  connect(
    url: URL,
    origin: string,
    protocols: string[],
    requestHeaders: BareHeaders,
    onopen: (protocol: string) => void,
    onmessage: (data: Blob | ArrayBuffer | string) => void,
    onclose: (code: number, reason: string) => void,
    onerror: (error: string) => void,
  ): (data: Blob | ArrayBuffer | string) => void {
    let epsocket = this.epxclient.connect_ws(
      onopen,
      onclose,
      onerror,
      (data: Uint8Array | string) => data instanceof Uint8Array ? onmessage(data.buffer) : onmessage(data),
      url.href,
      protocols,
      origin,
    );

    return async (data) => {
      if (typeof data === 'string') {
        (await epsocket).send_text(data);
      } else {
        (await epsocket).send_binary(data);
      }
    };
  }
}
