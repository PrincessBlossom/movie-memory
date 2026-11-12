import type { LengthHint } from "@/types/length-hint";

/**
 * Displays a character counter. UI only: the caller decides whether to show
 * it and what it says (see toLengthHint). Linked to the input through
 * aria-describedby rather than announced live, so a screen reader doesn't
 * read out every keystroke; the error on submit is announced. 
 * This is kept in a separate 
 */
export function TitleLengthHint({ id, hint }: { id: string; hint: LengthHint }) {
  return (
    <p
      id={id}
      className={`text-xs ${hint.over ? "font-semibold text-red-600" : "text-ink/70"}`}
    >
      {hint.text}
    </p>
  );
}
