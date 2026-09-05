/**
 * Wires up the connection panel's test button.
 *
 * The plugin performs the request rather than the property inspector: it already
 * holds the connection settings, and the request would otherwise leave the
 * Stream Deck sandbox from a browser context.
 */
(() => {
	const button = document.querySelector("#test");
	const result = document.querySelector("#test-result");
	if (button === null || result === null) {
		return;
	}

	/**
	 * Shows the outcome below the button.
	 *
	 * @param {string} className Either `ok`, `failed`, or an empty string.
	 * @param {string} message Text to display.
	 */
	function show(className, message) {
		result.className = className;
		result.textContent = message;
		result.style.display = "block";
	}

	button.addEventListener("click", () => {
		button.disabled = true;
		show("", t("testing"));

		SDPIComponents.streamDeckClient.send("sendToPlugin", { event: "testConnection" });
	});

	SDPIComponents.streamDeckClient.sendToPropertyInspector.subscribe((ev) => {
		if (ev?.payload?.event !== "testConnection") {
			return;
		}

		button.disabled = false;
		show(ev.payload.ok ? "ok" : "failed", ev.payload.message);
	});
})();
