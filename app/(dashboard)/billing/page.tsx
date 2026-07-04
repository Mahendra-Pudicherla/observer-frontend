import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COLORS, PRICING_TIERS } from "@/lib/constants";

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-medium text-xl">Billing</h1>
      <p className="text-sm" style={{ color: COLORS.slate }}>
        Display-only plans — no payment processor connected. All organisations
        currently receive full Enterprise-level access.
      </p>
      <div className="grid md:grid-cols-3 gap-4">
        {Object.entries(PRICING_TIERS).map(([key, tier]) => {
          const recommended = "recommended" in tier && tier.recommended;
          return (
          <Card
            key={key}
            className={recommended ? "border-2" : ""}
            style={{ borderColor: recommended ? COLORS.signalBlue : undefined }}
          >
            <CardHeader>
              <CardTitle className="font-medium">{tier.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm" style={{ color: COLORS.slate }}>
                {tier.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <Button
                className="w-full mt-4 font-medium"
                variant="outline"
                disabled
              >
                Contact us
              </Button>
            </CardContent>
          </Card>
          );
        })}
      </div>
      <Link href="/pricing" style={{ color: COLORS.signalBlue }} className="text-sm">
        View public pricing page →
      </Link>
    </div>
  );
}

