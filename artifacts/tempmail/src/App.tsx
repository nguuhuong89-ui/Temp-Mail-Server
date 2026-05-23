import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import EmailView from "@/pages/email";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import AccountHome from "@/pages/account";
import AccountInboxes from "@/pages/account/inboxes";
import AccountApiKeys from "@/pages/account/api-keys";
import AccountDomains from "@/pages/account/domains";
import AccountPlan from "@/pages/account/plan";
import Dashboard from "@/pages/admin/dashboard";
import Domains from "@/pages/admin/domains";
import EmailsExplorer from "@/pages/admin/emails";
import Ads from "@/pages/admin/ads";
import Blocklist from "@/pages/admin/blocklist";
import ApiKeys from "@/pages/admin/api-keys";
import ApiDocs from "@/pages/admin/api-docs";
import AdminUsers from "@/pages/admin/users";
import SetupGuide from "@/pages/admin/setup";
import AdminInboxes from "@/pages/admin/inboxes";
import AdminSettings from "@/pages/admin/settings";
import AcceptableUsePage from "@/pages/acceptable-use";
import AbusePage from "@/pages/abuse";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: false, staleTime: 30_000 },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(199 89% 48%)",
    colorForeground: "hsl(222 47% 11%)",
    colorMutedForeground: "hsl(215 16% 47%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(0 0% 100%)",
    colorInputForeground: "hsl(222 47% 11%)",
    colorNeutral: "hsl(214 32% 91%)",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white dark:bg-zinc-900 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    return addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prev.current !== undefined && prev.current !== id) {
        qc.clear();
        if (id) {
          fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/account/me`, {
            credentials: "include",
          }).catch(() => {});
        }
      }
      prev.current = id;
    });
  }, [addListener, qc]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/inbox/:address" component={Home} />
      <Route path="/email/:id" component={EmailView} />
      <Route path="/acceptable-use" component={AcceptableUsePage} />
      <Route path="/abuse" component={AbusePage} />

      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

      <Route path="/account" component={AccountHome} />
      <Route path="/account/inboxes" component={AccountInboxes} />
      <Route path="/account/api-keys" component={AccountApiKeys} />
      <Route path="/account/domains" component={AccountDomains} />
      <Route path="/account/plan" component={AccountPlan} />

      <Route path="/admin" component={Dashboard} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/domains" component={Domains} />
      <Route path="/admin/emails" component={EmailsExplorer} />
      <Route path="/admin/ads" component={Ads} />
      <Route path="/admin/blocklist" component={Blocklist} />
      <Route path="/admin/api-keys" component={ApiKeys} />
      <Route path="/admin/api-docs" component={ApiDocs} />
      <Route path="/admin/setup" component={SetupGuide} />
      <Route path="/admin/inboxes" component={AdminInboxes} />
      <Route path="/admin/settings" component={AdminSettings} />

      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
