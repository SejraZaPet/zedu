import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, UserPlus, LogIn, GraduationCap, BookOpenText, KeyRound, CheckCircle2, Eye, EyeOff, Users, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { useSchoolBranding } from "@/hooks/useSchoolBranding";

type Role = "student" | "teacher" | "rodic";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const { toast } = useToast();
  const { isLoggedIn, role: authRole, loading: authLoading } = useAuth();
  const { branding } = useSchoolBranding();
  const [mode, setMode] = useState<"login" | "register" | "pin">("login");
  const [pinUsername, setPinUsername] = useState("");
  const [pinValue, setPinValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [childCode, setChildCode] = useState("");
  const [pendingLogin, setPendingLogin] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register fields
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [school, setSchool] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [year, setYear] = useState("");
  const [classCode, setClassCode] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [gdprConsent, setGdprConsent] = useState(false);

  // React to auth state changes - redirect when logged in
  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) return;

    // Wait for role to be resolved before redirecting
    if (authRole === null) return;

    if (authRole === "admin") {
      navigate(redirectTo || "/admin", { replace: true });
    } else if (authRole === "teacher" || authRole === "lektor") {
      navigate(redirectTo || "/ucitel", { replace: true });
    } else if (authRole === "rodic") {
      // Always go to /rodic — parents shouldn't be redirected to student/teacher routes
      navigate("/rodic", { replace: true });
    } else {
      navigate(redirectTo || "/student", { replace: true });
    }
  }, [authLoading, isLoggedIn, authRole, navigate, redirectTo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    let loginEmail = email.trim();
    if (!loginEmail.includes("@")) {
      const { data: lookupData, error: lookupError } = await supabase.functions.invoke("lookup-username", {
        body: { username: loginEmail }
      });
      if (lookupError || !lookupData?.email) {
        setError("Uživatelské jméno nenalezeno. Zkuste přihlášení pomocí emailu.");
        setLoading(false);
        return;
      }
      loginEmail = lookupData.email;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({ email: loginEmail, password });

    if (authError) {
      if (authError.message?.toLowerCase().includes("email not confirmed")) {
        setError("Nejprve potvrďte svůj e-mail prostřednictvím odkazu, který jsme vám poslali.");
      } else {
        setError("Nesprávné přihlašovací údaje.");
      }
      setLoading(false);
      return;
    }

    // Check profile status after successful auth
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", session.user.id)
        .single();

      if (profile?.status === "pending") {
        await supabase.auth.signOut();
        setError("Váš účet čeká na schválení administrátorem.");
        setLoading(false);
        return;
      }

      if (profile?.status === "blocked") {
        await supabase.auth.signOut();
        setError("Váš účet byl zablokován.");
        setLoading(false);
        return;
      }
    }

    // Auth state change will trigger redirect via the useEffect above
    setPendingLogin(true);
    // Don't setLoading(false) — keep button disabled until redirect happens
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!pinUsername.trim() || !/^\d{4}$/.test(pinValue)) {
      setError("Zadej uživatelské jméno a 4-místný PIN.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-pin", {
        body: { username: pinUsername.trim(), pin: pinValue },
      });
      if (fnError || !data?.access_token) {
        setError("Špatný PIN nebo uživatelské jméno.");
        setLoading(false);
        return;
      }
      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (setErr) {
        setError("Nepodařilo se přihlásit, zkus to znovu.");
        setLoading(false);
        return;
      }
      setPendingLogin(true);
      navigate("/student", { replace: true });
    } catch {
      setError("Špatný PIN nebo uživatelské jméno.");
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!role) {
      setError("Vyberte typ účtu.");
      setLoading(false);
      return;
    }

    if (!gdprConsent) {
      setError("Pro registraci je nutný souhlas se zpracováním osobních údajů.");
      setLoading(false);
      return;
    }

    if (regPassword !== regPasswordConfirm) {
      setError("Hesla se neshodují.");
      setLoading(false);
      return;
    }

    if (regPassword.length < 6) {
      setError("Heslo musí mít alespoň 6 znaků.");
      setLoading(false);
      return;
    }

    const trimmedChildCode = childCode.trim().toUpperCase();
    if (role === "rodic" && trimmedChildCode && !/^ZAK-[A-Z0-9]{4,}$/.test(trimmedChildCode)) {
      setError("Kód dítěte musí být ve formátu ZAK-XXXX.");
      setLoading(false);
      return;
    }

    const metadata: Record<string, unknown> = {
      first_name: firstName,
      last_name: lastName,
      school: role === "rodic" ? "" : school,
      role_label: role === "rodic" ? "rodic" : role === "teacher" ? "teacher" : "user",
      status: role === "rodic" ? "approved" : "pending",
    };

    if (role === "student") {
      metadata.field_of_study = fieldOfStudy;
      metadata.year = year || null;
      metadata.class_code = classCode.trim() || null;
    }
    if (role === "teacher" && schoolCode.trim()) {
      metadata.school_code = schoolCode.trim().toUpperCase();
    }
    if (role === "rodic" && trimmedChildCode) {
      metadata.child_code = trimmedChildCode;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        data: metadata,
        emailRedirectTo: window.location.origin,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Verify profile was created by the trigger
    if (signUpData?.user?.id) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", signUpData.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error("Profil nebyl vytvořen triggerem:", profileError?.message || "záznam nenalezen", "user_id:", signUpData.user.id);
        toast({
          title: "Upozornění",
          description: "Registrace proběhla, ale profil se nemusel vytvořit správně. Kontaktujte administrátora.",
          variant: "destructive",
        });
      }
    }

    // Parent: try to link child by code if signup auto-logged-in
    let childLinked = false;
    let childLinkFailed = false;
    if (role === "rodic" && trimmedChildCode && signUpData?.session) {
      const { data: student } = await supabase.rpc("find_student_by_code", { _code: trimmedChildCode });
      const studentId = Array.isArray(student) ? student[0]?.id : (student as any)?.id;
      if (studentId) {
        const { error: linkErr } = await supabase
          .from("parent_student_links")
          .insert({ parent_id: signUpData.user!.id, student_id: studentId });
        if (!linkErr) childLinked = true;
        else childLinkFailed = true;
      } else {
        childLinkFailed = true;
      }
    }

    toast({
      title: "Registrace úspěšná",
      description:
        role === "rodic"
          ? childLinked
            ? "Účet byl vytvořen a dítě bylo propojeno."
            : childLinkFailed
              ? "Účet byl vytvořen, ale kód dítěte se nepodařilo propojit. Zkuste to po přihlášení v sekci Rodič."
              : "Účet byl vytvořen. Přihlaste se a přidejte své děti přes kód žáka ZAK-XXXX."
          : "Potvrďte svůj e-mail a vyčkejte na schválení účtu administrátorem.",
    });

    setMode("login");
    setLoading(false);
  };

  if (forgotPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {!resetSent ? (
            <>
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="w-6 h-6 text-primary" />
                </div>
                <h1 className="font-heading text-2xl font-bold">Obnova hesla</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Zadejte váš email a zašleme vám odkaz pro obnovu hesla.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="resetEmail">E-mail</Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="vas@email.cz"
                    className="mt-1"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={async () => {
                    if (!resetEmail) return;
                    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) {
                      toast({ title: "Chyba", description: error.message, variant: "destructive" });
                    } else {
                      setResetSent(true);
                    }
                  }}
                >
                  Odeslat odkaz pro obnovu
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setForgotPassword(false)}>
                  ← Zpět na přihlášení
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <h1 className="font-heading text-2xl font-bold">Email odeslán!</h1>
              <p className="text-sm text-muted-foreground mt-2 mb-6">
                Zkontrolujte váš email <strong>{resetEmail}</strong> a klikněte na odkaz pro obnovu hesla.
              </p>
              <Button
                variant="outline"
                onClick={() => { setForgotPassword(false); setResetSent(false); setResetEmail(""); }}
              >
                Zpět na přihlášení
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold">
            {mode === "login" ? "Přihlášení" : mode === "pin" ? "Přihlášení PINem" : "Registrace"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login"
              ? "Přihlaste se do svého účtu"
              : mode === "pin"
              ? "Zadej uživatelské jméno a 4-místný PIN"
              : "Vytvořte si nový účet"}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex mb-6 bg-card rounded-lg p-1 border border-border">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              mode === "login"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LogIn className="w-4 h-4" /> Přihlášení
          </button>
          <button
            onClick={() => { setMode("pin"); setError(""); }}
            className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              mode === "pin"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Hash className="w-4 h-4" /> PIN
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); setRole(null); }}
            className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              mode === "register"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="w-4 h-4" /> Registrace
          </button>
        </div>

        {mode === "pin" ? (
          <form onSubmit={handlePinLogin} className="space-y-4">
            <div>
              <Label htmlFor="pinUsername">Uživatelské jméno</Label>
              <Input
                id="pinUsername"
                type="text"
                value={pinUsername}
                onChange={(e) => setPinUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="anovakova"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="pin">PIN (4 číslice)</Label>
              <Input
                id="pin"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                required
                placeholder="••••"
                className="mt-1 text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Přihlašování..." : "Přihlásit se PINem"}
            </Button>
          </form>
        ) : mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">E-mail nebo uživatelské jméno</Label>
              <Input id="email" type="text" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" placeholder="email@domena.cz nebo anovakova" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Heslo</Label>
              <div className="relative">
                <Input id="password" type={showLoginPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="mt-1 pr-10" />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setForgotPassword(true)}
                className="text-xs text-primary hover:underline mt-1 text-right w-full"
              >
                Zapomenuté heslo?
              </button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Přihlašování..." : "Přihlásit se"}
            </Button>
          </form>
        ) : role === null ? (
          /* Step 1 — role picker */
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">Vyberte svou roli</p>
              <p className="text-xs text-muted-foreground mt-1">
                Podle volby přizpůsobíme registrační formulář.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { value: "teacher" as const, icon: BookOpenText, title: "Učitel", desc: "Tvořte lekce a sledujte třídy." },
                { value: "student" as const, icon: GraduationCap, title: "Žák", desc: "Učte se a plňte úkoly." },
                { value: "rodic" as const, icon: Users, title: "Rodič", desc: "Sledujte pokrok dítěte." },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className="group flex flex-col items-center justify-center text-center gap-3 rounded-2xl border-2 border-border bg-card p-5 min-h-[170px] transition-all duration-200 hover:border-primary hover:bg-primary/[0.04] hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <opt.icon className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-heading text-base font-semibold">{opt.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-5">
            {/* Selected role + change link */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                {role === "teacher" && <BookOpenText className="w-5 h-5 text-primary shrink-0" />}
                {role === "student" && <GraduationCap className="w-5 h-5 text-primary shrink-0" />}
                {role === "rodic" && <Users className="w-5 h-5 text-primary shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Typ účtu</p>
                  <p className="text-sm font-semibold truncate">
                    {role === "teacher" ? "Učitel / Lektor" : role === "student" ? "Žák" : "Rodič"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setRole(null); setError(""); }}
                className="text-xs text-primary hover:underline shrink-0"
              >
                Změnit
              </button>
            </div>

            {/* Common fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">Jméno</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="lastName">Příjmení</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="regEmail">E-mail</Label>
              <Input id="regEmail" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required className="mt-1" />
            </div>
            {role !== "rodic" && (
              <div>
                <Label htmlFor="school">Škola</Label>
                <Input id="school" value={school} onChange={(e) => setSchool(e.target.value)} className="mt-1" placeholder="Název školy" />
              </div>
            )}

            {/* Teacher-only: school registration code */}
            {role === "teacher" && (
              <div>
                <Label htmlFor="schoolCode">
                  Kód školy <span className="text-muted-foreground font-normal">(volitelné)</span>
                </Label>
                <Input
                  id="schoolCode"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                  className="mt-1 font-mono uppercase tracking-widest"
                  placeholder="ABC123"
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Pokud máte 6místný registrační kód své školy, zadejte ho a budete automaticky přiřazeni.
                </p>
              </div>
            )}

            {/* Student-only fields */}
            {role === "student" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="fieldOfStudy">Obor</Label>
                    <Input id="fieldOfStudy" value={fieldOfStudy} onChange={(e) => setFieldOfStudy(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="year">Ročník</Label>
                    <Input id="year" type="number" min="1" max="6" value={year} onChange={(e) => setYear(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="classCode">Kód třídy <span className="text-muted-foreground font-normal">(volitelné)</span></Label>
                  <Input id="classCode" value={classCode} onChange={(e) => setClassCode(e.target.value)} className="mt-1 font-mono" placeholder="např. AB12CD" maxLength={10} />
                  <p className="text-xs text-muted-foreground mt-1">Pokud máš kód třídy od učitele, zadej ho sem.</p>
                </div>
              </>
            )}

            {/* Parent-only fields */}
            {role === "rodic" && (
              <div>
                <Label htmlFor="childCode">Kód dítěte <span className="text-muted-foreground font-normal">(volitelné)</span></Label>
                <Input
                  id="childCode"
                  value={childCode}
                  onChange={(e) => setChildCode(e.target.value.toUpperCase())}
                  className="mt-1 font-mono uppercase"
                  placeholder="ZAK-XXXX"
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Kód získáte od dítěte v jeho profilu. Pokud ho nemáte teď, můžete dítě přidat později v sekci Rodič.
                </p>
              </div>
            )}

            {/* Password */}
            <div>
              <Label htmlFor="regPassword">Heslo</Label>
              <Input id="regPassword" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="regPasswordConfirm">Heslo znovu</Label>
              <Input id="regPasswordConfirm" type="password" value={regPasswordConfirm} onChange={(e) => setRegPasswordConfirm(e.target.value)} required className="mt-1" />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-start gap-2">
              <Checkbox
                id="gdprConsent"
                checked={gdprConsent}
                onCheckedChange={(v) => setGdprConsent(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="gdprConsent" className="text-xs leading-relaxed font-normal cursor-pointer">
                Souhlasím se{" "}
                <a href="/gdpr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  zpracováním osobních údajů
                </a>
                {" "}a podmínkami užívání služby ZEdu.cz. *
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !gdprConsent}>
              {loading ? "Registrace..." : "Zaregistrovat se"}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <a href="/" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            ← Zpět na web
          </a>
        </div>
      </div>
    </div>
  );
};

export default Auth;
