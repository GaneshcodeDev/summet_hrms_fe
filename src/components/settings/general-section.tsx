"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useSettings } from "@/lib/settings-context";
import { useAccessControl } from "@/lib/access-control-context";

const MAX_LOGO_BYTES = 1024 * 1024; // 1MB — data URLs are stored in localStorage, keep it light

export function GeneralSection() {
  const { settings, updateGeneral } = useSettings();
  const { canFeature } = useAccessControl();
  const canEdit = canFeature("settings.organization", "edit");

  const [name, setName] = useState(settings.general.name);
  const [logoDataUrl, setLogoDataUrl] = useState(settings.general.logoDataUrl);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    if (!file.type.startsWith("image/")) {
      setLogoError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo must be smaller than 1MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateGeneral({ name, logoDataUrl });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">General Settings</h2>

      <Field label="Organization Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required />
      </Field>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Organization Logo</span>
        <div className="flex items-center gap-4">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data: URL, not an optimizable static asset
            <img src={logoDataUrl} alt="Organization logo" className="h-16 w-16 rounded-xl border border-slate-200 object-cover dark:border-slate-700" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
              Logo
            </div>
          )}
          <div>
            <Button type="button" variant="outline" size="sm" disabled={!canEdit} onClick={() => document.getElementById("logo-upload-input")?.click()}>
              {logoDataUrl ? "Change Logo" : "Upload Logo"}
            </Button>
            <input id="logo-upload-input" type="file" accept="image/*" onChange={handleLogoChange} className="hidden" disabled={!canEdit} />
            {logoDataUrl && canEdit && (
              <button type="button" onClick={() => setLogoDataUrl(undefined)} className="ml-3 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400">
                Remove
              </button>
            )}
          </div>
        </div>
        {logoError && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5" /> {logoError}
          </p>
        )}
      </div>

      {canEdit ? (
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
          {saved && (
            <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" /> Saved
            </span>
          )}
          <Button type="submit">Save Changes</Button>
        </div>
      ) : (
        <p className="border-t border-slate-100 pt-5 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
          You have view-only access to General Settings.
        </p>
      )}
    </form>
  );
}
