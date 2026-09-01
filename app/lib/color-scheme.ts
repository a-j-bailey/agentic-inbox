// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

export type ColorMode = "light" | "dark";

export const COLOR_SCHEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export const COLOR_SCHEME_BOOTSTRAP_SCRIPT = `document.documentElement.dataset.mode=window.matchMedia(${JSON.stringify(COLOR_SCHEME_MEDIA_QUERY)}).matches?"dark":"light"`;

export type ColorSchemeMedia = {
	matches: boolean;
	addEventListener: (type: "change", listener: () => void) => void;
	removeEventListener: (type: "change", listener: () => void) => void;
};

export type ColorSchemeRoot = {
	dataset: {
		mode?: string;
	};
};

export function colorModeFromPrefersDark(prefersDark: boolean): ColorMode {
	return prefersDark ? "dark" : "light";
}

export function applyDocumentColorMode(args: {
	root: ColorSchemeRoot;
	mode: ColorMode;
}): void {
	args.root.dataset.mode = args.mode;
}

export function syncDocumentColorModeFromMedia(args: {
	root: ColorSchemeRoot;
	media: Pick<ColorSchemeMedia, "matches">;
}): ColorMode {
	const mode = colorModeFromPrefersDark(args.media.matches);
	applyDocumentColorMode({ root: args.root, mode });
	return mode;
}

export function subscribeDocumentColorMode(args: {
	root: ColorSchemeRoot;
	media: ColorSchemeMedia;
}): () => void {
	const sync = () => {
		syncDocumentColorModeFromMedia({ root: args.root, media: args.media });
	};
	sync();
	args.media.addEventListener("change", sync);
	return () => args.media.removeEventListener("change", sync);
}
