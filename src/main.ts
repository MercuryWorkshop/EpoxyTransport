import type { BareHeaders, TransferrableResponse, BareTransport } from "@mercuryworkshop/bare-mux";
import initEpoxy, { EpoxyClient, EpoxyClientOptions, EpoxyHandlers, info } from "@mercuryworkshop/epoxy-tls";

export { info as epoxyInfo };

export default class EpoxyTransport implements BareTransport {
	canstart = true;
	ready = false;

	client: EpoxyClient = null!;

	wisp: string;
	wisp_v2: boolean;
	udp_extension_required: boolean;

	constructor({ wisp, wisp_v2, udp_extension_required }) {
		this.wisp = wisp;
		this.wisp_v2 = wisp_v2 || false;
		this.udp_extension_required = udp_extension_required || false;
	}
	async init() {
		await initEpoxy();

		let options = new EpoxyClientOptions();
		options.user_agent = navigator.userAgent;
		options.udp_extension_required = this.udp_extension_required;
		options.wisp_v2 = this.wisp_v2;
		this.client = new EpoxyClient(this.wisp, options);

		this.ready = true;
	}
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
			let res = await this.client.fetch(remote.href, { method, body, headers, redirect: "manual" });
			return {
				body: res.body!,
				headers: (res as any).rawHeaders,
				status: res.status,
				statusText: res.statusText,
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
	): [(data: Blob | ArrayBuffer | string) => void, (code: number, reason: string) => void] {
		let handlers = new EpoxyHandlers(
			onopen,
			onclose,
			onerror,
			(data: Uint8Array | string) => data instanceof Uint8Array ? onmessage(data.buffer) : onmessage(data)
		);
		let ws = this.client.connect_websocket(
			handlers,
			url.href,
			protocols,
			Object.assign({ "Origin": origin }, requestHeaders)
		);

		return [
			async (data) => {
				(await ws).send(data);
			},
			async (code, reason) => {
				(await ws).close(code, reason || "")
			}
		]
	}
}
