function initials(name: string) {
  return name
    .split(" ")
    .filter((w) => !["Head", "Office", "Corporate", "Business", "Hub", "Park", "Tech"].includes(w))
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface SiteLogoProps {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "h-8 w-8 rounded-lg text-xs",
  md: "h-9 w-9 rounded-xl text-sm",
  lg: "h-14 w-14 rounded-2xl text-lg",
};

export function SiteLogo({ name, color, size = "md" }: SiteLogoProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center font-bold text-white ${sizes[size]}`}
      style={{ backgroundColor: color }}
    >
      {initials(name) || "S"}
    </div>
  );
}
