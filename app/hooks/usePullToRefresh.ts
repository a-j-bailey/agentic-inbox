// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { type TouchEvent, useRef, useState } from "react";

const PULL_THRESHOLD_PX = 56;
const PULL_MAX_PX = 80;

function isIgnoredTarget(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false;
	return Boolean(
		target.closest("button, input, textarea, select, a, [draggable='true']"),
	);
}

export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
	const [offset, setOffset] = useState(0);
	const [refreshing, setRefreshing] = useState(false);
	const startY = useRef<number | null>(null);
	const offsetRef = useRef(0);
	const refreshingRef = useRef(false);

	const onTouchStart = (event: TouchEvent<HTMLElement>) => {
		if (refreshingRef.current) return;
		if (event.currentTarget.scrollTop > 0) return;
		if (isIgnoredTarget(event.target)) return;
		startY.current = event.touches[0]?.clientY ?? null;
	};

	const onTouchMove = (event: TouchEvent<HTMLElement>) => {
		if (startY.current == null) return;
		const y = event.touches[0]?.clientY ?? startY.current;
		const next = Math.min(Math.max(y - startY.current, 0) * 0.45, PULL_MAX_PX);
		offsetRef.current = next;
		setOffset(next);
	};

	const onTouchEnd = () => {
		if (startY.current == null) return;
		const pulled = offsetRef.current;
		startY.current = null;
		offsetRef.current = 0;
		setOffset(0);
		if (pulled < PULL_THRESHOLD_PX || refreshingRef.current) return;
		refreshingRef.current = true;
		setRefreshing(true);
		void onRefresh().finally(() => {
			refreshingRef.current = false;
			setRefreshing(false);
		});
	};

	return { offset, refreshing, onTouchStart, onTouchMove, onTouchEnd };
}
