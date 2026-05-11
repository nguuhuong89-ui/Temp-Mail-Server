import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, Key, RefreshCw, ShieldCheck } from "lucide-react";
import { generateTotp } from "@workspace/api-client-react";

export function TotpWidget() {
  const [secret, setSecret] = useState("");
  const [activeSecret, setActiveSecret] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const tickRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  const refresh = async (s: string) => {
    const trimmed = s.trim();
    if (!trimmed) return;
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await generateTotp({ secret: trimmed });
      if (myReqId !== reqIdRef.current) return; // stale response, ignore
      setCode(res.code);
      setPeriod(res.period);
      setRemaining(res.remainingSeconds);
      setActiveSecret(trimmed);
    } catch (e) {
      if (myReqId !== reqIdRef.current) return;
      const msg = e instanceof Error ? e.message : "Secret không hợp lệ";
      setError(msg);
      setCode(null);
      setActiveSecret(null);
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false);
    }
  };

  // Local countdown — when it hits 0 fetch again using the secret that
  // produced the current code (NOT the live input the user may be editing).
  useEffect(() => {
    if (code === null || activeSecret === null) return;
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          void refresh(activeSecret);
          return period;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, period, activeSecret]);

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast({ title: "Đã copy mã 2FA", description: code });
  };

  const progressPct = code ? (remaining / period) * 100 : 0;

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Trình tạo mã 2FA (TOTP)</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Dán secret 2FA (base32) hoặc URI <code className="font-mono">otpauth://...</code> để lấy mã 6 số đang hiệu lực.
        Secret KHÔNG được lưu.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <Key className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="JBSWY3DPEHPK3PXP hoặc otpauth://..."
            className="pl-9 font-mono text-sm"
            data-testid="input-totp-secret"
          />
        </div>
        <Button
          onClick={() => void refresh(secret)}
          disabled={loading || !secret.trim()}
          data-testid="button-totp-generate"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Tạo mã"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {code && !error && (
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="font-mono text-3xl sm:text-4xl font-bold tracking-[0.3em] text-primary select-all">
              {code}
            </div>
            <div className="mt-2 h-1.5 bg-primary/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-1000 ease-linear"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Hết hạn sau {remaining}s
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={handleCopy} aria-label="Copy mã">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
