"use client";

/**
 * App Router `template.tsx` re-mounts its subtree on every navigation, so this
 * wrapper's CSS entrance (`page-up`) replays each time the route changes —
 * giving the "new page rises up from below" switch the user asked for.
 * No library, no effect on the sticky header or the intro overlay (both live
 * in the layout, outside this subtree).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-swipe">{children}</div>;
}
