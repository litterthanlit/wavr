// The editor is set in litt.md's type: Geist at its three weights by role
// (400 text, 500 titles and controls, 600 labels) and Geist Mono at 400.
// Loaded here rather than in the root layout so the landing page keeps its own type.
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-mono/400.css";

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
