/* Dependency-extracted replacement for ios27-design-system's clsx-based cn (MIT). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
