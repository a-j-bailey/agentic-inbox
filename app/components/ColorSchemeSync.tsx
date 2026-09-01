// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useEffect } from "react";
import {
	COLOR_SCHEME_MEDIA_QUERY,
	subscribeDocumentColorMode,
} from "~/lib/color-scheme";

export default function ColorSchemeSync() {
	useEffect(() => {
		return subscribeDocumentColorMode({
			root: document.documentElement,
			media: window.matchMedia(COLOR_SCHEME_MEDIA_QUERY),
		});
	}, []);
	return null;
}
