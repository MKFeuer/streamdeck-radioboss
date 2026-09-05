import streamDeck from "@elgato/streamdeck";

import { MicAction } from "./actions/mic";

// Deliberately not "trace": that records every message exchanged with Stream Deck,
// which would write the RadioBOSS API password into the plugin's log files.
streamDeck.logger.setLevel("info");

// Only emit the did-receive-settings events when settings actually change, rather
// than also on every read. Without this, reading the global settings during a
// refresh would trigger another refresh. Requires Stream Deck 7.1.
streamDeck.settings.useExperimentalMessageIdentifiers = true;

streamDeck.actions.registerAction(new MicAction());

streamDeck.connect();
