import { useCallback, useEffect, useRef, useState } from "react";

/** Wall-clock delta keeps timers correct after background tab throttling. */
export function useClassroomClock(duration: number | null, onEnd?: () => void) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const base = useRef(0);
  const start = useRef(0);
  const end = useRef(onEnd);
  end.current = onEnd;
  const read = useCallback(() => base.current + (start.current ? Date.now() - start.current : 0), []);
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const next = read();
      if (duration !== null && next >= duration) {
        base.current = duration; start.current = 0;
        setElapsed(duration); setRunning(false); end.current?.();
      } else setElapsed(next);
    };
    const id = window.setInterval(tick, 80);
    tick();
    return () => window.clearInterval(id);
  }, [running, duration, read]);
  const toggle = () => {
    if (running) { base.current = read(); start.current = 0; setElapsed(base.current); setRunning(false); }
    else { if (duration !== null && base.current >= duration) base.current = 0; start.current = Date.now(); setRunning(true); }
  };
  const reset = () => { base.current = 0; start.current = 0; setRunning(false); setElapsed(0); };
  return { elapsed, running, toggle, reset, read };
}