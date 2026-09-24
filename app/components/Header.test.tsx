// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import Header from "./Header";

function renderHeaderAt(path: string) {
	return renderToStaticMarkup(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route path="/" element={<Header />} />
				<Route path="/mailbox/:mailboxId" element={<Header />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("Header", () => {
	it("does not show mail search on the mailbox list", () => {
		const html = renderHeaderAt("/");
		expect(html).not.toContain("Search emails");
		expect(html).not.toContain("Tasks");
	});

	it("shows mail search inside a mailbox", () => {
		const html = renderHeaderAt("/mailbox/inbox@example.com");
		expect(html).toContain("Search emails");
		expect(html).not.toContain("Tasks");
	});

	it("does not render a theme toggle", () => {
		const html = renderHeaderAt("/");
		expect(html.toLowerCase()).not.toContain("dark mode");
		expect(html.toLowerCase()).not.toContain("light mode");
	});
});
