"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/layout/page-header";
import { useOrg } from "@/lib/org-context";
import { useSiteProfile } from "@/lib/site-profile-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useToast } from "@/lib/toast-context";
import { orgUnitTypeConfig } from "@/lib/org-data";
import { employees } from "@/lib/mock-data";
import { siteCategories, siteCurrencies, siteSegments } from "@/lib/site-profile-data";
import type { OrgUnitType, SiteProfile } from "@/lib/types";

const detailTabs = [
  { id: "basic", label: "Basic" },
  { id: "address", label: "Address" },
  { id: "contact", label: "Contact" },
  { id: "roles", label: "Roles" },
  { id: "location", label: "Physical Location" },
  { id: "shifts", label: "Shift" },
  { id: "holidays", label: "Holidays" },
];

export function SiteProfileDetail({ type, orgUnitId }: { type: OrgUnitType; orgUnitId: string }) {
  const config = orgUnitTypeConfig[type];
  const { orgUnits, updateOrgUnit } = useOrg();
  const {
    profileFor,
    updateProfile,
    addShift,
    removeShift,
    addHoliday,
    removeHoliday,
    employeesMappedTo,
    setEmployeeMapping,
  } = useSiteProfile();
  const { canFeature, roles } = useAccessControl();
  const toast = useToast();
  const [active, setActive] = useState("basic");

  const unit = orgUnits.find((u) => u.id === orgUnitId && u.type === type);
  if (!unit) notFound();

  const canEdit = canFeature("organization.structure", "edit") || canFeature("organization.structure", "manage");
  const profile = profileFor(orgUnitId);
  const mappingField = type === "CostCenter" ? "costCenterId" : "profitCenterId";
  const mappedEmployees = employeesMappedTo(orgUnitId, mappingField);
  const unmappedEmployees = employees.filter((e) => !mappedEmployees.some((m) => m.employeeId === e.employeeId));

  return (
    <div>
      <Link
        href={`/organization/units/${config.slug}`}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {config.pluralLabel}
      </Link>
      <PageHeader
        title={unit.name}
        description={`${config.label} · ${unit.code}`}
        action={<StatusBadge status={unit.status} />}
      />

      <Card>
        <Tabs tabs={detailTabs} active={active} onChange={setActive} className="px-3" />

        {active === "basic" && (
          <BasicTab
            key={unit.id}
            unit={unit}
            profile={profile}
            canEdit={canEdit}
            onSaveUnit={(patch) => updateOrgUnit(unit.id, patch)}
            onSaveProfile={(patch) => updateProfile(orgUnitId, patch)}
            toast={toast}
          />
        )}

        {active === "address" && (
          <AddressTab key={unit.id} profile={profile} canEdit={canEdit} onSave={(patch) => updateProfile(orgUnitId, patch)} toast={toast} />
        )}

        {active === "contact" && (
          <ContactTab key={unit.id} profile={profile} canEdit={canEdit} onSave={(patch) => updateProfile(orgUnitId, patch)} toast={toast} />
        )}

        {active === "roles" && (
          <RolesTab
            profile={profile}
            roles={roles}
            canEdit={canEdit}
            onToggle={(roleId, checked) => {
              const next = checked ? [...profile.roleIds, roleId] : profile.roleIds.filter((r) => r !== roleId);
              updateProfile(orgUnitId, { roleIds: next });
            }}
          />
        )}

        {active === "location" && (
          <LocationTab
            key={unit.id}
            profile={profile}
            canEdit={canEdit}
            onSaveNote={(note) => updateProfile(orgUnitId, { physicalLocationNote: note })}
            mappedEmployees={mappedEmployees}
            unmappedEmployees={unmappedEmployees}
            onAddEmployee={(employeeId) => {
              setEmployeeMapping(employeeId, mappingField, orgUnitId);
              toast.success("Employee mapped to this " + config.label.toLowerCase() + ".");
            }}
            onRemoveEmployee={(employeeId) => {
              setEmployeeMapping(employeeId, mappingField, null);
              toast.success("Employee removed from this " + config.label.toLowerCase() + ".");
            }}
          />
        )}

        {active === "shifts" && (
          <ShiftsTab
            shifts={profile.shifts}
            canEdit={canEdit}
            onAdd={(shift) => {
              addShift(orgUnitId, shift);
              toast.success(`${shift.name} shift added.`);
            }}
            onRemove={(id) => removeShift(orgUnitId, id)}
          />
        )}

        {active === "holidays" && (
          <HolidaysTab
            holidays={profile.holidays}
            canEdit={canEdit}
            onAdd={(holiday) => {
              addHoliday(orgUnitId, holiday);
              toast.success(`${holiday.name} added to the holiday calendar.`);
            }}
            onRemove={(id) => removeHoliday(orgUnitId, id)}
          />
        )}
      </Card>
    </div>
  );
}

function SavedCheck({ saved }: { saved: boolean }) {
  if (!saved) return null;
  return (
    <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
      <Check className="h-4 w-4" /> Saved
    </span>
  );
}

function ViewOnlyNote() {
  return (
    <p className="border-t border-slate-100 pt-5 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
      You have view-only access to this section.
    </p>
  );
}

type ToastApi = ReturnType<typeof useToast>;

function BasicTab({
  unit,
  profile,
  canEdit,
  onSaveUnit,
  onSaveProfile,
  toast,
}: {
  unit: { name: string; code: string };
  profile: SiteProfile;
  canEdit: boolean;
  onSaveUnit: (patch: { name: string; code: string }) => void;
  onSaveProfile: (patch: Partial<SiteProfile>) => void;
  toast: ToastApi;
}) {
  const [form, setForm] = useState({
    name: unit.name,
    code: unit.code,
    category: profile.category,
    currency: profile.currency,
    segment: profile.segment,
    subSegment: profile.subSegment,
    assetBarcodePrefix: profile.assetBarcodePrefix,
    activationDateTime: profile.activationDateTime,
  });
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSaveUnit({ name: form.name, code: form.code });
    onSaveProfile({
      category: form.category,
      currency: form.currency,
      segment: form.segment,
      subSegment: form.subSegment,
      assetBarcodePrefix: form.assetBarcodePrefix,
      activationDateTime: form.activationDateTime,
    });
    setSaved(true);
    toast.success("Basic details saved.");
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Site Name">
          <Input value={form.name} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </Field>
        <Field label="Site Code">
          <Input value={form.code} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Category">
          <Select value={form.category} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            <option value="">Select category</option>
            {siteCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Currency">
          <Select value={form.currency} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
            {siteCurrencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Segment">
          <Select value={form.segment} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}>
            <option value="">Select segment</option>
            {siteSegments.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Sub Segment">
          <Input value={form.subSegment} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, subSegment: e.target.value }))} placeholder="e.g. Product Engineering" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Asset Barcode Prefix">
          <Input value={form.assetBarcodePrefix} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, assetBarcodePrefix: e.target.value }))} placeholder="e.g. CC-ENG" />
        </Field>
        <Field label="Site Activation Date & Time">
          <Input type="datetime-local" value={form.activationDateTime} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, activationDateTime: e.target.value }))} />
        </Field>
      </div>
      {canEdit ? (
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
          <SavedCheck saved={saved} />
          <Button type="submit">Save Changes</Button>
        </div>
      ) : (
        <ViewOnlyNote />
      )}
    </form>
  );
}

function AddressTab({
  profile,
  canEdit,
  onSave,
  toast,
}: {
  profile: { address: { line1: string; line2?: string; city: string; state: string; pincode: string; country: string } };
  canEdit: boolean;
  onSave: (patch: { address: typeof profile.address }) => void;
  toast: ToastApi;
}) {
  const [address, setAddress] = useState(profile.address);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSave({ address });
    setSaved(true);
    toast.success("Address saved.");
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6">
      <Field label="Address Line 1">
        <Input value={address.line1} disabled={!canEdit} onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))} required />
      </Field>
      <Field label="Address Line 2 (optional)">
        <Input value={address.line2 ?? ""} disabled={!canEdit} onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="City">
          <Input value={address.city} disabled={!canEdit} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} required />
        </Field>
        <Field label="State">
          <Input value={address.state} disabled={!canEdit} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))} required />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Pincode">
          <Input value={address.pincode} disabled={!canEdit} onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value }))} required />
        </Field>
        <Field label="Country">
          <Input value={address.country} disabled={!canEdit} onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))} required />
        </Field>
      </div>
      {canEdit ? (
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
          <SavedCheck saved={saved} />
          <Button type="submit">Save Changes</Button>
        </div>
      ) : (
        <ViewOnlyNote />
      )}
    </form>
  );
}

function ContactTab({
  profile,
  canEdit,
  onSave,
  toast,
}: {
  profile: { contact: { name: string; phone: string; email: string } };
  canEdit: boolean;
  onSave: (patch: { contact: typeof profile.contact }) => void;
  toast: ToastApi;
}) {
  const [contact, setContact] = useState(profile.contact);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSave({ contact });
    setSaved(true);
    toast.success("Contact details saved.");
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6">
      <Field label="Contact Name">
        <Input value={contact.name} disabled={!canEdit} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} required />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Phone">
          <Input value={contact.phone} disabled={!canEdit} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} required />
        </Field>
        <Field label="Email">
          <Input type="email" value={contact.email} disabled={!canEdit} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} required />
        </Field>
      </div>
      {canEdit ? (
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
          <SavedCheck saved={saved} />
          <Button type="submit">Save Changes</Button>
        </div>
      ) : (
        <ViewOnlyNote />
      )}
    </form>
  );
}

function RolesTab({
  profile,
  roles,
  canEdit,
  onToggle,
}: {
  profile: { roleIds: string[] };
  roles: { id: string; name: string; description: string }[];
  canEdit: boolean;
  onToggle: (roleId: string, checked: boolean) => void;
}) {
  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Roles under this site</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Roles selected here are considered active/responsible for this cost or profit center — e.g. who approves spend
        routed through it.
      </p>
      <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {roles.map((role) => (
          <label key={role.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{role.name}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{role.description}</p>
            </div>
            <input
              type="checkbox"
              checked={profile.roleIds.includes(role.id)}
              disabled={!canEdit}
              onChange={(e) => onToggle(role.id, e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function LocationTab({
  profile,
  canEdit,
  onSaveNote,
  mappedEmployees,
  unmappedEmployees,
  onAddEmployee,
  onRemoveEmployee,
}: {
  profile: { physicalLocationNote: string };
  canEdit: boolean;
  onSaveNote: (note: string) => void;
  mappedEmployees: { employeeId: string; name: string; designation: string }[];
  unmappedEmployees: { employeeId: string; name: string; designation: string }[];
  onAddEmployee: (employeeId: string) => void;
  onRemoveEmployee: (employeeId: string) => void;
}) {
  const [note, setNote] = useState(profile.physicalLocationNote);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSaveNote(note);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Physical Location">
          <Textarea rows={3} value={note} disabled={!canEdit} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 3rd floor, Engineering wing, Tower B" />
        </Field>
        {canEdit && (
          <div className="flex items-center justify-end gap-3">
            <SavedCheck saved={saved} />
            <Button type="submit" size="sm">
              Save Location
            </Button>
          </div>
        )}
      </form>

      <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Employees mapped here ({mappedEmployees.length})
          </h3>
        </div>

        {canEdit && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-auto min-w-[220px]">
              <option value="">Select employee to map...</option>
              {unmappedEmployees.map((e) => (
                <option key={e.employeeId} value={e.employeeId}>
                  {e.name} — {e.designation}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selected}
              onClick={() => {
                onAddEmployee(selected);
                setSelected("");
              }}
            >
              <UserPlus className="h-3.5 w-3.5" /> Map Employee
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {mappedEmployees.map((e) => (
            <div key={e.employeeId} className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-2.5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Avatar name={e.name} size="sm" />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{e.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{e.designation}</p>
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => onRemoveEmployee(e.employeeId)}
                  className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {mappedEmployees.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500">No employees mapped to this site yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ShiftsTab({
  shifts,
  canEdit,
  onAdd,
  onRemove,
}: {
  shifts: { id: string; name: string; startTime: string; endTime: string }[];
  canEdit: boolean;
  onAdd: (shift: { name: string; startTime: string; endTime: string }) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:30");
  const [endTime, setEndTime] = useState("18:30");

  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Site Shifts</h3>
      <div className="mt-4 space-y-2">
        {shifts.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-2.5 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.name}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {s.startTime} – {s.endTime}
              </p>
            </div>
            {canEdit && (
              <button onClick={() => onRemove(s.id)} className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {shifts.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No shifts configured yet.</p>}
      </div>

      {canEdit && (
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4 dark:border-slate-800">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shift name" className="sm:col-span-2" />
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="sm:col-span-4"
            disabled={!name.trim()}
            onClick={() => {
              onAdd({ name: name.trim(), startTime, endTime });
              setName("");
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add Shift
          </Button>
        </div>
      )}
    </div>
  );
}

function HolidaysTab({
  holidays,
  canEdit,
  onAdd,
  onRemove,
}: {
  holidays: { id: string; name: string; date: string }[];
  canEdit: boolean;
  onAdd: (holiday: { name: string; date: string }) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Site Holiday Master</h3>
      <div className="mt-4 space-y-2">
        {sorted.map((h) => (
          <div key={h.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-2.5 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{h.name}</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 dark:text-slate-500">{new Date(h.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
              {canEdit && (
                <button onClick={() => onRemove(h.id)} className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No holidays added yet.</p>}
      </div>

      {canEdit && (
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3 dark:border-slate-800">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday name" className="sm:col-span-2" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="sm:col-span-3"
            disabled={!name.trim() || !date}
            onClick={() => {
              onAdd({ name: name.trim(), date });
              setName("");
              setDate("");
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add Holiday
          </Button>
        </div>
      )}
    </div>
  );
}
