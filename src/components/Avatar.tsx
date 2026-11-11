/**
 * Shows the Google profile photo, or falls back to initials when the user has
 * no photo. Plain <img> (not next/image) keeps us from having to allow-list
 * Google's image CDN and proxy the image through our server.
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
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer" // Google avatars can 403 when a referrer is sent
        className="h-16 w-16 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      aria-hidden
      className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-semibold text-indigo-700"
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
