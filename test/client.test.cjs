/**
 * Exercises the RadioBOSS client against a stand-in HTTP server that mimics the
 * remote control API, including its habit of reporting failures with HTTP 200.
 *
 * Run with `npm test`, which compiles the modules under test into `.test-build`
 * first — see `tsconfig.test.json`.
 */
const http = require("node:http");
const assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");

const { RadioBossClient, RadioBossError, parseMicState } = require("../.test-build/radioboss/client.js");
const { isConfigured, resolveConnection } = require("../.test-build/radioboss/settings.js");

const PASSWORD = "s3cret";

describe("parseMicState", () => {
	const cases = [
		['<?xml version="1.0" encoding="utf-8"?><Mic on="1"/>', true],
		['<?xml version="1.0" encoding="utf-8"?><Mic on="0"/>', false],
		['<Response state="on"/>', true],
		['<Response enabled="false"/>', false],
		["1", true],
		["0", false],
		["on", true],
		["OFF", false],
		["true", true],
		// The write variant answers `OK`, which carries no state.
		["OK", undefined],
		["", undefined]
	];

	for (const [body, expected] of cases) {
		it(`reads ${JSON.stringify(body)} as ${expected}`, () => {
			assert.equal(parseMicState(body), expected);
		});
	}
});

describe("resolveConnection", () => {
	it("defaults to the RadioBOSS loopback address", () => {
		assert.deepEqual(resolveConnection(undefined), {
			host: "127.0.0.1",
			port: 9000,
			secure: false,
			user: "",
			password: "",
			timeout: 4000
		});
	});

	it("accepts the strings the property inspector persists", () => {
		assert.equal(resolveConnection({ port: "9001" }).port, 9001);
		assert.equal(resolveConnection({ timeout: "1500" }).timeout, 1500);
	});

	it("falls back on unusable values", () => {
		assert.equal(resolveConnection({ port: "nope" }).port, 9000);
		assert.equal(resolveConnection({ port: "70000" }).port, 9000);
		assert.equal(resolveConnection({ host: "   " }).host, "127.0.0.1");
	});

	it("trims the host", () => {
		assert.equal(resolveConnection({ host: "  studio-pc  " }).host, "studio-pc");
	});

	it("treats a missing password as unconfigured", () => {
		assert.equal(isConfigured(resolveConnection({})), false);
		assert.equal(isConfigured(resolveConnection({ password: PASSWORD })), true);
	});
});

describe("RadioBossClient", () => {
	let server;
	let port;
	let micOn = false;
	let requests = [];

	before(async () => {
		server = http.createServer((req, res) => {
			const url = new URL(req.url, "http://localhost");
			requests.push(url.search);

			if (url.searchParams.get("pass") !== PASSWORD) {
				// RadioBOSS reports this with a 200, not a 401.
				res.writeHead(200, { "content-type": "text/plain" });
				res.end("Error: access denied");
				return;
			}

			res.writeHead(200, { "content-type": "text/xml" });

			switch (url.searchParams.get("action")) {
				case "mic": {
					const on = url.searchParams.get("on");
					if (on === null) {
						res.end(`<?xml version="1.0" encoding="utf-8"?>\n<Mic on="${micOn ? 1 : 0}"/>`);
					} else {
						micOn = on === "1";
						res.end("OK");
					}
					return;
				}

				case "status":
					res.end('<?xml version="1.0" encoding="utf-8"?>\n<Info version="6.3.4.0" uptime="1024"/>');
					return;

				default:
					res.end("OK");
			}
		});

		await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
		port = server.address().port;
	});

	after(() => server?.close());

	const connect = (overrides) => new RadioBossClient(resolveConnection({ port, password: PASSWORD, ...overrides }));

	it("reports the RadioBOSS version, not the XML declaration's", async () => {
		assert.equal(await connect().status(), "RadioBOSS 6.3.4.0");
	});

	it("switches the microphone and reads it back", async () => {
		const client = connect();

		await client.setMic(false);
		assert.equal(await client.getMic(), false);

		await client.setMic(true);
		assert.equal(await client.getMic(), true);

		await client.setMic(false);
		assert.equal(await client.getMic(), false);
	});

	it("sends the credentials and the action", async () => {
		requests = [];
		await connect({ user: "dj" }).setMic(true);

		assert.match(requests[0], /\buser=dj\b/);
		assert.match(requests[0], new RegExp(`\\bpass=${PASSWORD}\\b`));
		assert.match(requests[0], /\baction=mic\b/);
		assert.match(requests[0], /\bon=1\b/);
	});

	it("omits the user when none is configured", async () => {
		requests = [];
		await connect().getMic();

		assert.doesNotMatch(requests[0], /\buser=/);
	});

	it("rejects a wrong password", async () => {
		await assert.rejects(() => connect({ password: "wrong" }).getMic(), (error) => {
			assert.ok(error instanceof RadioBossError);
			assert.match(error.message, /rejected the request/);
			return true;
		});
	});

	it("reports an unreachable host", async () => {
		// Port 1 is reserved and never served by RadioBOSS.
		await assert.rejects(() => connect({ port: 1, timeout: 1500 }).getMic(), (error) => {
			assert.ok(error instanceof RadioBossError);
			assert.match(error.message, /could not be reached/);
			return true;
		});
	});
});
