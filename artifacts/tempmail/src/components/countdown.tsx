import { useState, useEffect } from "react";
import { differenceInSeconds } from "date-fns";

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const target = new Date(expiresAt).getTime();
    
    const update = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((target - now) / 1000));
      setTimeLeft(diff);
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const secs = (timeLeft % 60).toString().padStart(2, '0');

  if (timeLeft === 0) {
    return <span className="text-destructive font-mono font-medium">Expired</span>;
  }

  return <span className="font-mono font-medium">{mins}:{secs}</span>;
}
