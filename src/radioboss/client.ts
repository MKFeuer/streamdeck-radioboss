import type { Connection } from "./settings";

/** Raised when RadioBOSS could not be reached, or rejected the request. */
export class RadioBossError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "RadioBossError";
	}
}

const TRUTHY = new Set(["1", "on", "true", "yes", "enabled", "active"]);
const FALSY = new Set(["0", "off", "false", "no", "disabled", "inactive"]);

/**
 * Drops the XML declaration from a response.
 *
 * RadioBOSS prefixes its XML with `<?xml version="1.0" encoding="utf-8"?>`, whose
 * own attributes would otherwise be picked up when scanning for one.
 *
 * @param body Raw response body.
 * @returns The body without its declaration.
 */
function stripProlog(body: string): string {
	return body.replace(/<\?xml[^>]*\?>/gi, " ");
}

/**
 * Reads a microphone state out of a RadioBOSS response.
 *
 * The manual documents `action=mic` without the `on` parameter as "returns
 * microphone status", but does not pin the format down, so accept the shapes it
 * plausibly uses: an XML attribute such as `<Mic on="1"/>`, or a bare value such
 * as `1`, `on` or `true`. Anything else — including the plain `OK` returned by
 * the write variant — reports "no state", and the caller keeps what it had.
 *
 * @param body Raw response body.
 * @returns `true` when live, `false` when muted, `undefined` when unreadable.
 */
export function parseMicState(body: string): boolean | undefined {
	const xml = stripProlog(body);
	const attribute = /\b(?:on|mic|state|status|enabled|value)\s*=\s*"?([A-Za-z0-9_-]+)"?/i.exec(xml);
	const raw = (attribute?.[1] ?? xml.replace(/<[^>]*>/g, " ")).trim().toLowerCase();

	if (TRUTHY.has(raw)) {
		return true;
	}
	if (FALSY.has(raw)) {
		return false;
	}
	return undefined;
}

/** Talks to the RadioBOSS remote control API over HTTP. */
export class RadioBossClient {
	readonly #connection: Connection;

	/**
	 * Initializes a new instance of the {@link RadioBossClient} class.
	 *
	 * @param connection Resolved connection details.
	 */
	constructor(connection: Connection) {
		this.#connection = connection;
	}

	/**
	 * Base address of the API, without a trailing slash; safe to show in logs and
	 * the property inspector as it carries no credentials.
	 *
	 * @returns The address.
	 */
	public get address(): string {
		const { secure, host, port } = this.#connection;
		return `${secure ? "https" : "http"}://${host}:${port}`;
	}

	/**
	 * Reads the current microphone state.
	 *
	 * @returns The state, or `undefined` when RadioBOSS did not report one.
	 */
	public async getMic(): Promise<boolean | undefined> {
		return parseMicState(await this.#request({ action: "mic" }));
	}

	/**
	 * Turns the microphone on or off.
	 *
	 * @param on `true` to go live, `false` to mute.
	 */
	public async setMic(on: boolean): Promise<void> {
		await this.#request({ action: "mic", on: on ? "1" : "0" });
	}

	/**
	 * Verifies the connection and credentials.
	 *
	 * @returns A short description of the running RadioBOSS instance.
	 */
	public async status(): Promise<string> {
		const body = await this.#request({ action: "status" });
		const version = /\bversion\s*=\s*"([^"]*)"/i.exec(stripProlog(body))?.[1];
		return version ? `RadioBOSS ${version}` : "RadioBOSS";
	}

	/**
	 * Sends a request to the API and returns the trimmed response body.
	 *
	 * @param params Query parameters, appended after the credentials.
	 * @returns The response body.
	 */
	async #request(params: Record<string, string>): Promise<string> {
		const { user, password, timeout } = this.#connection;

		const url = new URL(`${this.address}/`);
		if (user) {
			url.searchParams.set("user", user);
		}
		url.searchParams.set("pass", password);
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value);
		}

		const response = await fetch(url, { signal: AbortSignal.timeout(timeout) }).catch((cause: unknown) => {
			throw new RadioBossError(
				`${this.address} could not be reached. Is RadioBOSS running with the remote control API enabled?`,
				{ cause }
			);
		});

		if (!response.ok) {
			throw new RadioBossError(`RadioBOSS replied with HTTP ${response.status} ${response.statusText}.`);
		}

		const body = (await response.text()).trim();

		// RadioBOSS answers 200 with an error in the body rather than a 4xx status,
		// so a successful HTTP request is not on its own a successful command.
		if (/^(?:error|invalid|access denied|unauthori[sz]ed|wrong password)/i.test(body)) {
			throw new RadioBossError(`RadioBOSS rejected the request: ${body.slice(0, 200)}`);
		}

		return body;
	}
}

/**
 * Reduces an unknown error to a message suitable for a log line or a key title.
 *
 * @param error The caught value.
 * @returns The message.
 */
export function describeError(error: unknown): string {
	if (error instanceof RadioBossError) {
		return error.message;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
