// Remounts on every navigation, so each page gets an entrance animation.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="anim-fade-up">{children}</div>;
}
