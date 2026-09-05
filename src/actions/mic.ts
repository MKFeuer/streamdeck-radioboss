import streamDeck, {
	action,
	SingletonAction,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type SendToPluginEvent,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";

import { handleConnectionTest, type UIMessage } from "../property-inspector";
import { describeError, RadioBossClient } from "../radioboss/client";
import { readConnection } from "../radioboss/global-settings";
import { isConfigured, resolveConnection, toInteger, type Connection, type ConnectionSettings } from "../radioboss/settings";

/** What a key press should do to the microphone. */
export type MicMode = "toggle" | "on" | "off";

/**
 * Per-key settings. Connection details deliberately live in the plugin's global
 * settings instead — see {@link ConnectionSettings}.
 */
export type MicSettings = {
	/** Behaviour on press; defaults to `toggle`. */
	mode?: MicMode;

	/** How often to poll RadioBOSS for the current state, in seconds; `0` disables polling. */
	pollInterval?: number | string;

	/** Renders the current state as the key title. */
	showTitle?: boolean;
};

const DEFAULT_POLL_INTERVAL = 2;

/**
 * Switches the RadioBOSS microphone on, off, or toggles it, and mirrors the
 * current state back onto the key.
 *
 * State `0` is a muted microphone, state `1` is a live one; both are declared in
 * the manifest so Stream Deck can render the right image without the plugin
 * having to push one.
 */
@action({ UUID: "com.moritz-koschel.radioboss.mic" })
export class MicAction extends SingletonAction<MicSettings> {
	/** Settings of every visible instance, keyed by action id. */
	readonly #instances = new Map<string, MicSettings>();

	/** Last known microphone state; `undefined` until RadioBOSS has answered. */
	#micOn: boolean | undefined;

	/** Last error, surfaced on the key when a title is enabled. */
	#error: string | undefined;

	#timer: NodeJS.Timeout | undefined;

	/** Interval the current {@link MicAction.#timer} runs at, in seconds. */
	#timerInterval = 0;

	/**
	 * Initializes a new instance of the {@link MicAction} class.
	 */
	constructor() {
		super();

		// The connection is global, so a change in the property inspector affects
		// every key. Refresh from the event payload rather than re-reading the
		// settings, which would emit this same event again.
		streamDeck.settings.onDidReceiveGlobalSettings<ConnectionSettings>((ev) => {
			void this.#refresh(resolveConnection(ev.settings));
		});
	}

	/**
	 * @inheritdoc
	 */
	override async onWillAppear(ev: WillAppearEvent<MicSettings>): Promise<void> {
		this.#instances.set(ev.action.id, ev.payload.settings);
		this.#reschedule();

		await this.#render();
		await this.#refresh();
	}

	/**
	 * @inheritdoc
	 */
	override onWillDisappear(ev: WillDisappearEvent<MicSettings>): void {
		this.#instances.delete(ev.action.id);
		this.#reschedule();
	}

	/**
	 * @inheritdoc
	 */
	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<MicSettings>): Promise<void> {
		this.#instances.set(ev.action.id, ev.payload.settings);
		this.#reschedule();

		await this.#render();
	}

	/**
	 * @inheritdoc
	 */
	override async onKeyDown(ev: KeyDownEvent<MicSettings>): Promise<void> {
		const connection = await readConnection();
		if (!isConfigured(connection)) {
			streamDeck.logger.warn("Ignoring key press: the RadioBOSS API password has not been set.");
			this.#error = streamDeck.i18n.translate("Not configured");
			await ev.action.showAlert();
			await this.#render();
			return;
		}

		const client = new RadioBossClient(connection);
		const { mode = "toggle" } = ev.payload.settings;

		try {
			await client.setMic(await this.#resolveTarget(client, mode));

			// Re-read rather than assuming the write landed, so the key still agrees
			// with RadioBOSS if the mic was also switched from somewhere else.
			this.#error = undefined;
			await this.#refresh(connection);
		} catch (error) {
			this.#error = describeError(error);
			streamDeck.logger.error("Failed to switch the microphone.", error);

			await ev.action.showAlert();
			await this.#render();
		}
	}

	/**
	 * @inheritdoc
	 */
	override async onSendToPlugin(ev: SendToPluginEvent<UIMessage, MicSettings>): Promise<void> {
		await handleConnectionTest(ev.payload);
	}

	/**
	 * Works out which state a key press should put the microphone into.
	 *
	 * @param client Client used to read the current state in `toggle` mode.
	 * @param mode Configured behaviour.
	 * @returns `true` to go live, `false` to mute.
	 */
	async #resolveTarget(client: RadioBossClient, mode: MicMode): Promise<boolean> {
		if (mode === "on") {
			return true;
		}
		if (mode === "off") {
			return false;
		}

		// Ask RadioBOSS so toggling stays correct even when the microphone was last
		// switched elsewhere; fall back to the cached state if it reports none.
		const current = await client.getMic().catch(() => undefined);
		return !(current ?? this.#micOn ?? false);
	}

	/**
	 * Reads the current state from RadioBOSS and repaints every visible key.
	 *
	 * @param connection Connection to use; read from global settings when omitted.
	 */
	async #refresh(connection?: Connection): Promise<void> {
		if (this.#instances.size === 0) {
			return;
		}

		connection ??= await readConnection();
		if (!isConfigured(connection)) {
			this.#micOn = undefined;
			this.#error = streamDeck.i18n.translate("Not configured");
			await this.#render();
			return;
		}

		try {
			const state = await new RadioBossClient(connection).getMic();
			if (state !== undefined) {
				this.#micOn = state;
			}
			this.#error = undefined;
		} catch (error) {
			this.#error = describeError(error);
			streamDeck.logger.warn(`Could not read the microphone state: ${this.#error}`);
		}

		await this.#render();
	}

	/**
	 * Applies the current state and title to every visible key.
	 */
	async #render(): Promise<void> {
		const title = this.#title();

		for (const instance of this.actions) {
			if (!instance.isKey()) {
				continue;
			}

			await instance.setState(this.#micOn ? 1 : 0);

			const { showTitle } = this.#instances.get(instance.id) ?? {};
			await instance.setTitle(showTitle ? title : undefined);
		}
	}

	/**
	 * Builds the title shown on keys that have the state title enabled.
	 *
	 * @returns The title.
	 */
	#title(): string {
		if (this.#error !== undefined) {
			return streamDeck.i18n.translate("ERROR");
		}
		if (this.#micOn === undefined) {
			return "–";
		}
		return streamDeck.i18n.translate(this.#micOn ? "LIVE" : "MUTED");
	}

	/**
	 * Restarts the shared poll timer so it runs at the shortest interval any
	 * visible key asks for, and stops it when nothing needs polling.
	 */
	#reschedule(): void {
		const intervals = [...this.#instances.values()]
			.map(({ pollInterval }) => toInteger(pollInterval, DEFAULT_POLL_INTERVAL, 0, 3600))
			.filter((interval) => interval > 0);

		const interval = intervals.length > 0 ? Math.min(...intervals) : 0;
		if (interval === this.#timerInterval) {
			return;
		}

		this.#timerInterval = interval;
		if (this.#timer !== undefined) {
			clearInterval(this.#timer);
			this.#timer = undefined;
		}

		if (interval > 0) {
			this.#timer = setInterval(() => void this.#refresh(), interval * 1000);

			// Polling should never be the reason the plugin process stays alive.
			this.#timer.unref();
		}
	}
}
