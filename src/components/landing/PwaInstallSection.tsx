import { useEffect, useState } from "react";
import { Smartphone, Apple, Share, Plus, Chrome, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Minimal type for the BeforeInstallPromptEvent (not in standard TS DOM libs).
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

const PwaInstallSection = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [androidModalOpen, setAndroidModalOpen] = useState(false);
  const [iosModalOpen, setIosModalOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleAndroid = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    } else {
      setAndroidModalOpen(true);
    }
  };

  const handleIos = () => {
    setIosModalOpen(true);
  };

  if (installed) {
    return (
      <section className="w-full py-12 bg-muted/20">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="w-4 h-4 text-primary" />
            Bezli máte už nainstalované na ploše.
          </div>
        </div>
      </section>
    );
  }

  const BadgeButton = ({
    onClick,
    icon,
    label,
    sub,
  }: {
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    sub: string;
  }) => (
    <button
      onClick={onClick}
      className="group inline-flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    >
      <span className="flex h-9 w-9 items-center justify-center text-foreground">{icon}</span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{sub}</span>
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </span>
    </button>
  );

  return (
    <section className="w-full py-16 bg-muted/20">
      <div className="container mx-auto max-w-3xl px-4 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          <Smartphone className="w-4 h-4" />
          Mobilní aplikace
        </div>
        <h2 className="font-heading text-2xl md:text-3xl font-bold mb-2">
          Mějte Bezli po ruce v telefonu
        </h2>
        <p className="text-muted-foreground text-sm mb-8 max-w-xl mx-auto">
          Nainstalujte si Bezli na plochu jako aplikaci – funguje offline, otevírá se na celou
          obrazovku a chová se jako nativní appka. Bez obchodu, bez stahování.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <BadgeButton
            onClick={handleAndroid}
            icon={<Chrome className="w-7 h-7" />}
            label="Stáhnout pro Android"
            sub="Chrome · Edge"
          />
          <BadgeButton
            onClick={handleIos}
            icon={<Apple className="w-7 h-7" />}
            label="Stáhnout pro iPhone"
            sub="Safari"
          />
        </div>

        <p className="text-xs text-muted-foreground mt-6 max-w-md mx-auto">
          Bezli je webová aplikace (PWA). Není v Google Play ani App Storu – instaluje se přímo
          z prohlížeče na plochu telefonu a běží jako plnohodnotná aplikace.
        </p>
      </div>

      {/* Android fallback modal */}
      <Dialog open={androidModalOpen} onOpenChange={setAndroidModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Chrome className="w-5 h-5" /> Instalace na Android
            </DialogTitle>
            <DialogDescription>
              {deferredPrompt
                ? "Prohlížeč by měl nabídnout instalační dialog. Pokud se neobjevil, postupujte podle kroků níže."
                : "Váš prohlížeč zatím nenabídl přímou instalaci. Postupujte podle kroků níže."}
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm text-muted-foreground text-left list-decimal list-inside">
            <li>Otevřete <strong className="text-foreground">bezli.cz</strong> v prohlížeči <strong className="text-foreground">Chrome</strong> na telefonu.</li>
            <li>Ťukněte na menu (tři tečky vpravo nahoře).</li>
            <li>Vyberte <strong className="text-foreground">Nainstalovat aplikaci</strong> (nebo „Přidat na plochu").</li>
            <li>Potvrďte instalaci – Bezli se objeví na ploše.</li>
          </ol>
        </DialogContent>
      </Dialog>

      {/* iPhone / iOS modal */}
      <Dialog open={iosModalOpen} onOpenChange={setIosModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Apple className="w-5 h-5" /> Instalace na iPhone / iPad
            </DialogTitle>
            <DialogDescription>
              Na iOS není instalace možná jedním kliknutím. Postupujte podle kroků níže.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm text-muted-foreground text-left list-decimal list-inside">
            <li>Otevřete <strong className="text-foreground">bezli.cz</strong> v prohlížeči <strong className="text-foreground">Safari</strong>.</li>
            <li>
              Ťukněte na ikonu <strong className="text-foreground inline-flex items-center gap-1 align-middle">Sdílet <Share className="w-3.5 h-3.5" /></strong> (čtvereček se šipkou vzhůru, dole v liště).
            </li>
            <li>
              V nabídce vyberte <strong className="text-foreground inline-flex items-center gap-1 align-middle">Přidat na plochu <Plus className="w-3.5 h-3.5" /></strong>.
            </li>
            <li>Potvrďte – Bezli se objeví mezi aplikacemi na ploše.</li>
          </ol>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default PwaInstallSection;
