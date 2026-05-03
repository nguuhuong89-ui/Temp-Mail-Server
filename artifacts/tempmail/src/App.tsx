import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import EmailView from "@/pages/email";
import Dashboard from "@/pages/admin/dashboard";
import Domains from "@/pages/admin/domains";
import EmailsExplorer from "@/pages/admin/emails";
import Ads from "@/pages/admin/ads";
import Blocklist from "@/pages/admin/blocklist";
import ApiKeys from "@/pages/admin/api-keys";
import ApiDocs from "@/pages/admin/api-docs";
import SetupGuide from "@/pages/admin/setup";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/inbox/:address" component={Home} />
      <Route path="/email/:id" component={EmailView} />
      
      <Route path="/admin" component={Dashboard} />
      <Route path="/admin/domains" component={Domains} />
      <Route path="/admin/emails" component={EmailsExplorer} />
      <Route path="/admin/ads" component={Ads} />
      <Route path="/admin/blocklist" component={Blocklist} />
      <Route path="/admin/api-keys" component={ApiKeys} />
      <Route path="/admin/api-docs" component={ApiDocs} />
      <Route path="/admin/setup" component={SetupGuide} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
