import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
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
import AdminAuditLogs from "@/pages/admin/audit-logs";
import AdminSystemHealth from "@/pages/admin/system-health";
import AdminRateLimits from "@/pages/admin/rate-limits";
import AccountProfile from "@/pages/account/profile";
import AccountSavedInboxes from "@/pages/account/saved-inboxes";
import AccountWebhooks from "@/pages/account/webhooks";
import DocsPage from "@/pages/docs";
import AcceptableUsePage from "@/pages/acceptable-use";
import AbusePage from "@/pages/abuse";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: false, staleTime: 30_000 },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/inbox/:address" component={Home} />
      <Route path="/email/:id" component={EmailView} />
      <Route path="/docs" component={DocsPage} />
      <Route path="/acceptable-use" component={AcceptableUsePage} />
      <Route path="/abuse" component={AbusePage} />

      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />

      <Route path="/account" component={AccountHome} />
      <Route path="/account/profile" component={AccountProfile} />
      <Route path="/account/webhooks" component={AccountWebhooks} />
      <Route path="/account/inboxes" component={AccountInboxes} />
      <Route path="/account/saved-inboxes" component={AccountSavedInboxes} />
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
      <Route path="/admin/audit-logs" component={AdminAuditLogs} />
      <Route path="/admin/system-health" component={AdminSystemHealth} />
      <Route path="/admin/rate-limits" component={AdminRateLimits} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </WouterRouter>
  );
}

export default App;
