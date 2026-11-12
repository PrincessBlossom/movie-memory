"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shows the Google profile photo, or initials when there's no photo or the
 * photo fails to load (expired URL, blocked by an extension, offline).
 *
 * Plain <img> (not next/image) avoids allow-listing and proxying Google's
 * image CDN through our server.
 *
 * Decorative (alt=""): the user's name is printed right next to it.
 */
export function Avatar({
  name,
  email,
  image,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  // The image is server-rendered, so it can fail before React hydrates and
  // attaches onError. Catch that case by checking the element on mount.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={img}
        src={image}
        alt=""
        referrerPolicy="no-referrer" // Google avatars can 403 when a referrer is sent
        onError={() => setFailed(true)}
        className="h-16 w-16 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      aria-hidden
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xl font-semibold text-brand"
    >
      {initials(name ?? email ?? "?")}
    </div>
  );
}

function initials(source: string): string {
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]!.toUpperCase());
  return letters.join("") || "?";
}
