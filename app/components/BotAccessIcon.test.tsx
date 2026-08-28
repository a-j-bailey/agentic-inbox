// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BotAccessIcon } from "./BotAccessIcon";

describe("BotAccessIcon", () => {
	it("renders a bot icon only when access is on", () => {
		const on = renderToStaticMarkup(<BotAccessIcon enabled />);
		const off = renderToStaticMarkup(<BotAccessIcon enabled={false} />);
		expect(on).toContain("bot-access-icon");
		expect(on).toContain("Bot access on");
		expect(off).toBe("");
	});
});
