import streamDeck from "@elgato/streamdeck";

import { resolveConnection, type Connection, type ConnectionSettings } from "./settings";

/**
 * Reads the connection from the plugin's global settings.
 *
 * @returns The resolved connection.
 */
export async function readConnection(): Promise<Connection> {
	return resolveConnection(await streamDeck.settings.getGlobalSettings<ConnectionSettings>());
}
