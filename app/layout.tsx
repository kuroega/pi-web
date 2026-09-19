import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/PwaRegistration";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./skins.css";

export const metadata: Metadata = {
  title: "omp-web",
  description: "Web view for the omp (oh-my-pi) coding agent",
  applicationName: "omp-web",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "omp-web",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  // Matches --bg in app/globals.css: omp's `light` page surface and the
  // `titanium` brushed-titanium surface.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#151820" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement,m=localStorage.getItem("omp-theme")==="dark"?"dark":"light",c=JSON.parse(localStorage.getItem("omp-theme-config")||"null"),p=c&&c.palettes&&c.palettes[m];r.dataset.ompThemeMode=m;if(p){Object.keys(p.variables).forEach(function(k){r.style.setProperty(k,p.variables[k])});r.dataset.ompThemeName=p.name;r.style.colorScheme=p.colorScheme;r.classList.toggle("dark",p.colorScheme==="dark")}else{r.classList.toggle("dark",m==="dark")}var s=JSON.parse(localStorage.getItem("omp-ui-skin")||"null");if(s&&s.id&&s.appearance){r.dataset.ompSkin=s.id;r.dataset.ompSkinFamily=s.family;r.dataset.ompSkinPalette=s.paletteMode;var ks=["bg","panel","elevated","hover","selected","border","text","muted","dim","accent","accentHover","userBubble","toolSurface","success","danger","warning"];["light","dark"].forEach(function(mode){ks.forEach(function(k){var n=k.replace(/[A-Z]/g,function(x){return "-"+x.toLowerCase()});r.style.setProperty("--skin-"+mode+"-"+n,s[mode][k])})});r.style.setProperty("--skin-font-family",s.appearance.fontFamily);r.style.setProperty("--skin-code-font-family",s.appearance.codeFontFamily);r.style.setProperty("--skin-control-radius",s.appearance.controlRadius+"px");r.style.setProperty("--skin-panel-radius",s.appearance.panelRadius+"px");r.style.setProperty("--skin-bubble-radius",s.appearance.bubbleRadius+"px");r.style.setProperty("--skin-composer-radius",s.appearance.composerRadius+"px");r.style.setProperty("--skin-shadow-strength",s.appearance.shadowStrength);r.style.setProperty("--skin-density",s.appearance.density)}}catch(e){}})();`,
          }}
        />
      </head>
      <body translate="no" className="notranslate">
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
