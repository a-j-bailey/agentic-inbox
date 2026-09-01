// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ColorSchemeSync from "../components/ColorSchemeSync";
import {
	COLOR_SCHEME_BOOTSTRAP_SCRIPT,
	COLOR_SCHEME_MEDIA_QUERY,
	applyDocumentColorMode,
	colorModeFromPrefersDark,
	subscribeDocumentColorMode,
	syncDocumentColorModeFromMedia,
	type ColorSchemeMedia,
} from "./color-scheme";

describe("colorModeFromPrefersDark", () => {
	it("maps OS dark to Kumo data-mode dark", () => {
		expect(colorModeFromPrefersDark(true)).toBe("dark");
		expect(colorModeFromPrefersDark(false)).toBe("light");
	});
});

describe("applyDocumentColorMode", () => {
	it("writes data-mode on the root", () => {
		const root = { dataset: {} };
		applyDocumentColorMode({ root, mode: "dark" });
		expect(root.dataset.mode).toBe("dark");
		applyDocumentColorMode({ root, mode: "light" });
		expect(root.dataset.mode).toBe("light");
	});
});

describe("syncDocumentColorModeFromMedia", () => {
	it("follows the media query", () => {
		const root = { dataset: {} };
		expect(
			syncDocumentColorModeFromMedia({ root, media: { matches: true } }),
		).toBe("dark");
		expect(root.dataset.mode).toBe("dark");
		expect(
			syncDocumentColorModeFromMedia({ root, media: { matches: false } }),
		).toBe("light");
		expect(root.dataset.mode).toBe("light");
	});
});

describe("subscribeDocumentColorMode", () => {
	it("applies now and on change, then unsubscribes", () => {
		const root = { dataset: {} };
		const listeners: Array<() => void> = [];
		const media: ColorSchemeMedia = {
			matches: false,
			addEventListener: (_type, listener) => {
				listeners.push(listener);
			},
			removeEventListener: (_type, listener) => {
				const index = listeners.indexOf(listener);
				if (index >= 0) listeners.splice(index, 1);
			},
		};

		const unsubscribe = subscribeDocumentColorMode({ root, media });
		expect(root.dataset.mode).toBe("light");
		expect(listeners).toHaveLength(1);

		media.matches = true;
		listeners[0]?.();
		expect(root.dataset.mode).toBe("dark");

		unsubscribe();
		expect(listeners).toHaveLength(0);
	});
});

describe("COLOR_SCHEME_BOOTSTRAP_SCRIPT", () => {
	it("sets data-mode from prefers-color-scheme with no storage override", () => {
		expect(COLOR_SCHEME_BOOTSTRAP_SCRIPT).toContain(COLOR_SCHEME_MEDIA_QUERY);
		expect(COLOR_SCHEME_BOOTSTRAP_SCRIPT).toContain("dataset.mode");
		expect(COLOR_SCHEME_BOOTSTRAP_SCRIPT).not.toContain("localStorage");
		expect(COLOR_SCHEME_BOOTSTRAP_SCRIPT).not.toContain("toggle");
	});
});

describe("ColorSchemeSync", () => {
	it("renders no chrome", () => {
		expect(renderToStaticMarkup(<ColorSchemeSync />)).toBe("");
	});
});
