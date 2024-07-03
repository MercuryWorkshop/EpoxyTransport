import { BareHeaders, BareResponse, TransferrableResponse, type BareTransport } from "@mercuryworkshop/bare-mux";
import epoxy from "@mercuryworkshop/epoxy-tls";
//@ts-expect-error typescript doesnt follow the npm exports for some reason
import ROOTS from "@mercuryworkshop/epoxy-tls/certs"
export class EpoxyClient implements BareTransport {
	canstart = true;
	epxclient: Awaited<ReturnType<any>>["EpoxyClient"]["prototype"] = null!;
	wisp: string;
	EpoxyHandlers: Awaited<ReturnType<any>>["EpoxyHandlers"]["prototype"] = null!;

	constructor({ wisp }) {
		this.wisp = wisp;
	}
	async init() {
		const { EpoxyClient, EpoxyClientOptions, EpoxyHandlers } = await epoxy();

		let options = new EpoxyClientOptions();
		options.user_agent = navigator.userAgent;
		options.udp_extension_required = false;
		this.epxclient = await new EpoxyClient(this.wisp, ROOTS, options);
		this.EpoxyHandlers = EpoxyHandlers;

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
	): [ (data: Blob | ArrayBuffer | string) => void, (code: number, reason: string) => void ] {
		let handlers = new this.EpoxyHandlers(
			onopen,
			onclose,
			onerror,
			(data: Uint8Array | string) => data instanceof Uint8Array ? onmessage(data.buffer) : onmessage(data)
		);
		let epsocket = this.epxclient.connect_websocket(
			handlers,
			url.href,
			protocols
		);

		return [ 
			async (data) => {
				await epsocket.send(data);
			},
			async (code, reason) => {
				epsocket.close()
			}
		]
	}
}
