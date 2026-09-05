import streamDeck from "@elgato/streamdeck";

import { describeError, RadioBossClient } from "./radioboss/client";
import { readConnection } from "./radioboss/global-settings";
import { isConfigured } from "./radioboss/settings";

/** Messages a property inspector can send to the plugin. */
export type UIMessage = {
	event?: string;
};

/**
 * Handles the connection panel's "test" button, which every property inspector
 * carrying that panel can send.
 *
 * @param payload Message from the property inspector.
 * @returns `true` when the message was handled and needs no further work.
 */
export async function handleConnectionTest(payload: UIMessage | undefined): Promise<boolean> {
	if (payload?.event !== "testConnection") {
		return false;
	}

	const connection = await readConnection();
	if (!isConfigured(connection)) {
		await reply(streamDeck.i18n.translate("Enter the API password first."), false);
		return true;
	}

	const client = new RadioBossClient(connection);
	try {
		await reply(`${streamDeck.i18n.translate("Connected to")} ${await client.status()} (${client.address}).`, true);
	} catch (error) {
		await reply(describeError(error), false);
	}

	return true;
}

/**
 * Sends the outcome of a connection test back to the property inspector.
 *
 * @param message Text to show below the button.
 * @param ok Whether the test succeeded.
 */
async function reply(message: string, ok: boolean): Promise<void> {
	await streamDeck.ui.sendToPropertyInspector({ event: "testConnection", ok, message });
}
