/** Card header background from a course colour (falls back to the brand purple). */
export function courseBg(color?: string | null) {
  return color && /^#[0-9a-f]{3,8}$/i.test(color)
    ? { background: `linear-gradient(135deg, ${color}, #1e1b4b)` }
    : { background: "linear-gradient(135deg, #7c3aed, #1e1b4b)" };
}

/** Course icon if it is a short emoji, else a book. */
export function courseIcon(icon?: string | null) {
  return icon && icon.length <= 4 ? icon : "📘";
}
