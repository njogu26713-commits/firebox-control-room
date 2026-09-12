import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster /><DashboardLayout><Switch><Route path="/" component={Home} /><Route path="/applications" component={Home} /><Route path="/databases" component={Home} /><Route path="/statistics" component={Home} /><Route path="/activity" component={Home} /><Route path="/api-keys" component={Home} /><Route path="/settings" component={Home} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></DashboardLayout></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
