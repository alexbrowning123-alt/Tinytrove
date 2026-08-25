import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SearchProvider, useSearch } from "@/lib/search-context";
import { Header, MobileNav } from "@/components/Header";
import Home from "@/pages/Home";
import ListingDetail from "@/pages/ListingDetail";
import Sell from "@/pages/Sell";
import Favorites from "@/pages/Favorites";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import OrderConfirmation from "@/pages/OrderConfirmation";
import Orders from "@/pages/Orders";
import Inbox from "@/pages/Inbox";
import Profile, { SellerProfile } from "@/pages/Profile";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/not-found";

function AppRouter() {
  const { setQ } = useSearch();
  return (
    <div className="flex min-h-dvh flex-col">
      <Header onSearch={setQ} />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/listing/:id" component={ListingDetail} />
          <Route path="/sell" component={Sell} />
          <Route path="/sell/:id" component={Sell} />
          <Route path="/login" component={() => <Auth mode="login" />} />
          <Route path="/signup" component={() => <Auth mode="signup" />} />
          <Route path="/favorites" component={Favorites} />
          <Route path="/cart" component={Cart} />
          <Route path="/checkout" component={Checkout} />
          <Route path="/checkout/success" component={CheckoutSuccess} />
          <Route path="/checkout/:listingId" component={Checkout} />
          <Route path="/order/:id" component={OrderConfirmation} />
          <Route path="/orders" component={Orders} />
          <Route path="/inbox" component={Inbox} />
          <Route path="/inbox/:threadId" component={Inbox} />
          <Route path="/profile" component={Profile} />
          <Route path="/seller/:id" component={SellerProfile} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <MobileNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SearchProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </SearchProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
