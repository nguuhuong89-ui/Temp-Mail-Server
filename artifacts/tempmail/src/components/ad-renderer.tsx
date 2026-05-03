import { useGetActiveAds } from "@workspace/api-client-react";

export function AdRenderer({ placement }: { placement: "header" | "sidebar" | "inbox_top" | "email_body" }) {
  const { data: ads } = useGetActiveAds();
  
  if (!ads) return null;

  const relevantAds = ads.filter(ad => ad.placement === placement);
  if (relevantAds.length === 0) return null;

  // Pick a random ad
  const ad = relevantAds[Math.floor(Math.random() * relevantAds.length)];

  const content = (
    <div className="bg-card border rounded-lg p-4 shadow-sm flex flex-col gap-2 relative overflow-hidden group">
      <div className="absolute top-0 right-0 bg-muted text-[10px] uppercase font-bold px-2 py-0.5 rounded-bl-md opacity-50">Ad</div>
      {ad.imageUrl && (
        <div className="aspect-video w-full rounded-md overflow-hidden bg-muted mb-2">
          <img src={ad.imageUrl} alt={ad.name} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
        </div>
      )}
      <div className="text-sm font-medium text-foreground whitespace-pre-wrap break-words">{ad.content}</div>
    </div>
  );

  if (ad.linkUrl) {
    return (
      <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="block outline-none hover:opacity-90 transition-opacity">
        {content}
      </a>
    );
  }

  return content;
}
