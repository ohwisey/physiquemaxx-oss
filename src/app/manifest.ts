import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PHYSIQUEMAXX",
    short_name: "PHYSIQUEMAXX",
    description: "No-BS physique intelligence.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#070807",
    theme_color: "#070807",
    orientation: "portrait",
    icons: [
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
