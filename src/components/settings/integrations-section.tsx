"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings-context";
import { useAccessControl } from "@/lib/access-control-context";
import { integrationCatalog } from "@/lib/settings-data";

export function IntegrationsSection() {
  const { settings, toggleIntegration } = useSettings();
  const { canFeature } = useAccessControl();
  const canEdit = canFeature("settings.organization", "edit");

  const categories = Array.from(new Set(integrationCatalog.map((i) => i.category)));

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">Integrations</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Connect HRMS with the tools your team already uses.
      </p>

      <div className="mt-5 space-y-6">
        {categories.map((category) => (
          <div key={category}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{category}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {integrationCatalog
                .filter((i) => i.category === category)
                .map((integration) => {
                  const Icon = integration.icon;
                  const connected = Boolean(settings.integrations[integration.id]);
                  return (
                    <Card key={integration.id} className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-800 dark:text-slate-100">{integration.name}</p>
                          <Badge tone={connected ? "emerald" : "slate"}>{connected ? "Connected" : "Not Connected"}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{integration.description}</p>
                      </div>
                      {canEdit && (
                        <Button
                          type="button"
                          size="sm"
                          variant={connected ? "outline" : "primary"}
                          onClick={() => toggleIntegration(integration.id)}
                        >
                          {connected ? "Disconnect" : "Connect"}
                        </Button>
                      )}
                    </Card>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
