"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The profile photo, or the given initials when there's no photo or it fails
 * to load (expired URL, blocked by an extension, offline). The only state is
 * that display fallback.
 *
 * Plain <img> (not next/image) avoids allow-listing and proxying Google's
 * image CDN through our server.
 *
 * Decorative (alt=""): the user's name is printed right next to it.
 */
export function Avatar({ image, initials }: { image: string | null; initials: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  // The image is server-rendered, so it can fail before React hydrates and attaches onError. Catch that case by checking the element on mount.
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
        referrerPolicy="no-referrer" // Google avatars can 403 (no permission) when a referrer is sent
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
      {initials}
    </div>
  );
}
