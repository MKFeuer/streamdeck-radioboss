/**
 * Connection details for the RadioBOSS remote control API.
 *
 * These are stored in the plugin's *global* settings rather than on an action,
 * so every RadioBOSS button shares one configuration — change the password once
 * and every key follows. The property inspector writes them via sdpi-components'
 * `global` attribute.
 */
export type ConnectionSettings = {
	host?: string;
	port?: number | string;
	secure?: boolean;
	user?: string;
	password?: string;
	timeout?: number | string;
};

/** RadioBOSS listens on the loopback interface by default. */
export const DEFAULT_HOST = "127.0.0.1";

/** Default port of the remote control API (Settings ➝ Remote control). */
export const DEFAULT_PORT = 9000;

/** Requests are aborted after this many milliseconds. */
export const DEFAULT_TIMEOUT = 4000;

/**
 * A connection whose values have all been coerced, trimmed and range-checked.
 *
 * The property inspector persists most values as strings, so nothing that comes
 * out of settings can be trusted to already have the right type.
 */
export type Connection = {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	password: string;
	timeout: number;
};

/**
 * Parses a settings value as an integer, falling back when it is missing or out of range.
 *
 * @param value Raw value from settings; typically a string.
 * @param fallback Value to use when {@link value} cannot be used.
 * @param min Smallest accepted value, inclusive.
 * @param max Largest accepted value, inclusive.
 * @returns The parsed integer, or {@link fallback}.
 */
export function toInteger(value: unknown, fallback: number, min: number, max: number): number {
	const parsed = Number.parseInt(String(value ?? "").trim(), 10);
	return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

/**
 * Turns raw settings into a usable connection.
 *
 * @param settings Settings as persisted by Stream Deck.
 * @returns The resolved connection.
 */
export function resolveConnection(settings: ConnectionSettings | undefined): Connection {
	return {
		host: String(settings?.host ?? "").trim() || DEFAULT_HOST,
		port: toInteger(settings?.port, DEFAULT_PORT, 1, 65535),
		secure: settings?.secure === true,
		user: String(settings?.user ?? "").trim(),
		password: String(settings?.password ?? ""),
		timeout: toInteger(settings?.timeout, DEFAULT_TIMEOUT, 250, 60000)
	};
}

/**
 * Determines whether enough has been configured to talk to RadioBOSS. The remote
 * control API refuses to start without a password, so an empty one means the user
 * has not finished setting things up.
 *
 * @param connection Connection to check.
 * @returns `true` when the connection is usable.
 */
export function isConfigured(connection: Connection): boolean {
	return connection.password.length > 0;
}
