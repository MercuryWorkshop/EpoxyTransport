import type { BareHeaders, TransferrableResponse, BareTransport } from "@mercuryworkshop/bare-mux";
import initEpoxy, { EpoxyClient, EpoxyClientOptions, EpoxyHandlers } from "@mercuryworkshop/epoxy-tls";
export default class EpoxyTransport implements BareTransport {
	canstart = true;
	epxclient: Awaited<ReturnType<any>>["EpoxyClient"]["prototype"] = null!;
	wisp: string;
	wisp_v2: boolean;
	udp_extension_required: boolean;
	EpoxyHandlers: Awaited<ReturnType<any>>["EpoxyHandlers"]["prototype"] = null!;

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
		this.epxclient = new EpoxyClient(this.wisp, options);
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
	): [(data: Blob | ArrayBuffer | string) => void, (code: number, reason: string) => void] {
		let handlers = new this.EpoxyHandlers(
			onopen,
			onclose,
			onerror,
			(data: Uint8Array | string) => data instanceof Uint8Array ? onmessage(data.buffer) : onmessage(data)
		);
		let epsocket = this.epxclient.connect_websocket(
			handlers,
			url.href,
			protocols,
			{ "Origin": origin }
		);

		return [
			async (data) => {
				(await epsocket).send(data);
			},
			async (code, reason) => {
				(await epsocket).close(close, reason)
			}
		]
	}
}
