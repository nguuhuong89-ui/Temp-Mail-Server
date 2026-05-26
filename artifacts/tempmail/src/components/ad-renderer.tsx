import { useGetActiveAds } from "@workspace/api-client-react";
import { useEffect, useRef } from "react";

/** Detect if content is an ad-network embed (script/ins tags) vs simple HTML vs plain text */
function detectContentType(content: string): "embed" | "html" | "text" {
  const trimmed = content.trim();
  if (/<script[\s>]/i.test(trimmed) || /<ins[\s>]/i.test(trimmed)) return "embed";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return "html";
  return "text";
}

/** Renders an ad-network embed (AdSense, etc.) inside an isolated iframe so scripts execute */
function EmbedAd({ code }: { code: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8">
<style>body{margin:0;padding:0;background:transparent;}</style>
</head><body>${code}</body></html>`);
    doc.close();
  }, [code]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg">
      <div className="absolute top-1 right-1 z-10 bg-black/50 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">Ad</div>
      <iframe
        ref={iframeRef}
        title="Ad"
        scrolling="no"
        className="w-full border-0 min-h-[90px]"
        style={{ height: "auto" }}
      />
    </div>
  );
}

export function AdRenderer({ placement }: { placement: "header" | "sidebar" | "inbox_top" | "email_body" }) {
  const { data: ads } = useGetActiveAds();

  if (!ads || !Array.isArray(ads)) return null;

  const relevantAds = ads.filter(ad => ad.placement === placement);
  if (relevantAds.length === 0) return null;

  const ad = relevantAds[Math.floor(Math.random() * relevantAds.length)];
  const type = detectContentType(ad.content);

  // === Embed mode: AdSense / ad network script code ===
  if (type === "embed") {
    return <EmbedAd code={ad.content} />;
  }

  // === Internal campaign: HTML or plain text ===
  const body = (
    <div className="bg-card border rounded-lg p-4 shadow-sm flex flex-col gap-2 relative overflow-hidden group">
      <div className="absolute top-0 right-0 bg-muted text-[10px] uppercase font-bold px-2 py-0.5 rounded-bl-md opacity-50">Ad</div>
      {ad.imageUrl && (
        <div className="aspect-video w-full rounded-md overflow-hidden bg-muted mb-2">
          <img
            src={ad.imageUrl}
            alt={ad.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
          />
        </div>
      )}
      {type === "html" ? (
        <div
          className="text-sm font-medium text-foreground"
          dangerouslySetInnerHTML={{ __html: ad.content }}
        />
      ) : (
        <div className="text-sm font-medium text-foreground whitespace-pre-wrap break-words">{ad.content}</div>
      )}
    </div>
  );

  if (ad.linkUrl) {
    return (
      <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="block outline-none hover:opacity-90 transition-opacity">
        {body}
      </a>
    );
  }

  return body;
}
