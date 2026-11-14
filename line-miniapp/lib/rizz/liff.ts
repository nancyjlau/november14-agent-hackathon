/** LINE's first redirect wraps a LIFF deep-link query in `liff.state`. */
export function shouldInitializeLine(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get("import") === "1" || params.has("liff.state");
}
