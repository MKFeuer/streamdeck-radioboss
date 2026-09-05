/**
 * Localizes the property inspector.
 *
 * sdpi-components resolves any attribute written as `__MSG_key__` through
 * `SDPIComponents.i18n`, but never populates its `locales` itself — so the
 * translations are handed to it here, before the components upgrade.
 *
 * Anything sdpi-components cannot reach (plain markup, slotted content, text
 * built at runtime) carries a `data-i18n` attribute instead and is filled in
 * once the document is parsed.
 */
(() => {
	const locales = {
		en: {
			onKeyPress: "On key press",
			modeToggle: "Toggle",
			modeOn: "Microphone on",
			modeOff: "Mute microphone",
			pollStatus: "Poll status",
			pollOff: "off",
			pollMax: "10 s",
			keyTitle: "Title",
			showTitle: "Show status on key",
			connection: "Connection",
			host: "Host",
			port: "Port",
			user: "User",
			userOptional: "optional",
			password: "Password",
			https: "HTTPS",
			secure: "Encrypted connection",
			timeout: "Timeout (ms)",
			testConnection: "Test connection",
			testing: "Testing …",
			hint: "Enable the API in RadioBOSS under Settings ➝ Remote control, and set the same password there.",
			intervalOff: "Off",
			intervalOne: "Every second",
			intervalMany: "Every {0} seconds"
		},
		de: {
			onKeyPress: "Bei Tastendruck",
			modeToggle: "Umschalten",
			modeOn: "Mikrofon an",
			modeOff: "Mikrofon stumm",
			pollStatus: "Status abfragen",
			pollOff: "aus",
			pollMax: "10 s",
			keyTitle: "Beschriftung",
			showTitle: "Status auf der Taste anzeigen",
			connection: "Verbindung",
			host: "Host",
			port: "Port",
			user: "Benutzer",
			userOptional: "optional",
			password: "Passwort",
			https: "HTTPS",
			secure: "Verschlüsselte Verbindung",
			timeout: "Timeout (ms)",
			testConnection: "Verbindung testen",
			testing: "Teste …",
			hint: "In RadioBOSS unter Settings ➝ Remote control die API aktivieren und dort dasselbe Passwort setzen.",
			intervalOff: "Aus",
			intervalOne: "Jede Sekunde",
			intervalMany: "Alle {0} Sekunden"
		}
	};

	SDPIComponents.i18n.locales = locales;

	/**
	 * Translates a key, substituting `{0}` with the argument when given.
	 *
	 * @param {string} key Key within the locale.
	 * @param {string|number} [arg] Value for the `{0}` placeholder.
	 * @returns {string} The translation, or the key when it is missing.
	 */
	window.t = (key, arg) => {
		const message = SDPIComponents.i18n.getMessage(key) || key;
		return arg === undefined ? message : message.replace("{0}", String(arg));
	};

	// Fill everything sdpi-components does not localize on its own.
	document.addEventListener("DOMContentLoaded", () => {
		for (const element of document.querySelectorAll("[data-i18n]")) {
			element.textContent = window.t(element.dataset.i18n);
		}
	});
})();
