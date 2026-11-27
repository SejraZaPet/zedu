// Stav aktivity pro mobilní dálkové ovládání a rozhodnutí o příkazech start/publish.
// Čte se jen ze session (settings, current_question_index, status), nikdy z lokálního odhadu,
// a obrazovka učitele podle stejné funkce rozhoduje, zda příkaz provést (idempotence).
import { isAwaitingStart } from "@/lib/live-timing";
import { isLiveMcqSlide, isMcqRevealed } from "@/lib/live-mcq";
import { isWordcloudShown } from "@/lib/wordcloud-visibility";
import { pendingClickActivity } from "@/lib/slide-block-animations";

export type RemotePublishKind = "poll" | "wall" | "wordcloud" | "mcq";

export interface RemoteActivityState {
  isActivity: boolean;
  /** Čeká na „Spustit“ (stejná podmínka jako StartActivityPanel). */
  awaitingStart: boolean;
  /** Typ, u kterého obrazovka učitele umí zveřejnit výsledky; null = neumí. */
  publishKind: RemotePublishKind | null;
  published: boolean;
}

export function remoteActivityState(slide: any, settings: any, index: number, status?: string | null): RemoteActivityState {
  const spec = slide?.activitySpec;
  const isActivity = slide?.type === "activity" && !!spec;
  const empty: RemoteActivityState = { isActivity: false, awaitingStart: false, publishKind: null, published: false };
  if (!isActivity || index < 0 || status !== "playing") return { ...empty, isActivity };
  const revealCount = typeof settings?.animationRevealCount === "number" ? settings.animationRevealCount : 0;
  const awaitingStart = isAwaitingStart(settings, slide, index) || !!pendingClickActivity(slide, revealCount);
  const t = spec?.activityType;
  let publishKind: RemotePublishKind | null = null;
  let published = false;
  if (t === "poll") {
    publishKind = "poll";
    published = settings?.pollPublished === true && settings?.pollPublishedQuestion === index;
  } else if (t === "wall") {
    publishKind = "wall";
    published = settings?.wallPublished === true && settings?.wallPublishedQuestion === index;
  } else if (t === "wordcloud") {
    publishKind = "wordcloud";
    published = isWordcloudShown(settings, index);
  } else if (isLiveMcqSlide(slide)) {
    publishKind = "mcq";
    published = isMcqRevealed(settings, index);
  }
  return { isActivity, awaitingStart, publishKind, published };
}

export type RemoteAction = { type: "start" } | { type: "publish"; kind: RemotePublishKind } | null;

/** Co má obrazovka učitele udělat s příkazem z ovladače; null = ignorovat. */
export function decideRemoteActivityCmd(cmd: string, st: RemoteActivityState): RemoteAction {
  if (!st.isActivity) return null;
  if (cmd === "start") return st.awaitingStart ? { type: "start" } : null;
  if (cmd === "publish") {
    if (st.awaitingStart || !st.publishKind || st.published) return null;
    return { type: "publish", kind: st.publishKind };
  }
  return null;
}
