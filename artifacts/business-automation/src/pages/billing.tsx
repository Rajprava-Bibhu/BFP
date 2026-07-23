import { PageHeader } from "@/components/page-header";
import { useListBillingPlans, useListSubscriptions, useListInvoices } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Billing() {
  const { data: plans, isLoading: plansLoading } = useListBillingPlans();
  const { data: subs, isLoading: subsLoading } = useListSubscriptions();
  const { data: invoices, isLoading: invLoading } = useListInvoices();

  return (
    <div className="space-y-12">
      <PageHeader 
        title="Billing & Subscriptions" 
        description="Manage plans, view subscriptions and download invoices."
      />

      {/* Plans Section */}
      <div>
        <h2 className="text-xl font-display font-bold mb-6">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plansLoading ? (
            [1,2,3,4].map(i => <div key={i} className="h-80 bg-slate-100 animate-pulse rounded-2xl" />)
          ) : (
            plans?.map((plan) => (
              <Card key={plan.id} className="relative flex flex-col rounded-2xl border-border/50 shadow-sm hover:shadow-lg transition-all overflow-hidden">
                {plan.slug === 'professional' && (
                  <div className="absolute top-0 inset-x-0 h-1 bg-primary" />
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-lg font-display uppercase tracking-wider text-muted-foreground">{plan.name}</CardTitle>
                  <div className="mt-4 flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-display font-bold text-foreground">₹{Number(plan.price).toLocaleString("en-IN")}</span>
                    <span className="text-sm text-muted-foreground">/{plan.billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3 text-sm">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800" variant={plan.slug === 'professional' ? 'default' : 'outline'}>
                    Subscribe
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Active Subscriptions */}
      <div>
        <h2 className="text-xl font-display font-bold mb-6">Active Subscriptions</h2>
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-border">
              <tr>
                <th className="px-6 py-4">Tenant</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Period</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subsLoading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : subs?.map(sub => (
                <tr key={sub.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-medium text-foreground">{sub.tenantName}</td>
                  <td className="px-6 py-4 capitalize">{sub.planName}</td>
                  <td className="px-6 py-4">
                    <Badge className={sub.status === 'active' ? "bg-emerald-500" : "bg-amber-500"}>{sub.status}</Badge>
                  </td>
                  <td className="px-6 py-4 font-medium">₹{Number(sub.amount).toLocaleString("en-IN")}/mo</td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">
                    {new Date(sub.currentPeriodStart).toLocaleDateString()} - {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoices */}
      <div>
        <h2 className="text-xl font-display font-bold mb-6">Recent Invoices</h2>
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-border">
              <tr>
                <th className="px-6 py-4">Invoice ID</th>
                <th className="px-6 py-4">Tenant</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : invoices?.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">INV-{inv.id.toString().padStart(6, '0')}</td>
                  <td className="px-6 py-4 font-medium">{inv.tenantName}</td>
                  <td className="px-6 py-4 text-muted-foreground">{inv.description}</td>
                  <td className="px-6 py-4 font-bold text-foreground">₹{Number(inv.amount).toLocaleString("en-IN")}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={inv.status === 'paid' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : ''}>
                      {inv.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
