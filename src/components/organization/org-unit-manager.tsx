"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, History, Plus, Search, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRow, TBody, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { Can } from "@/components/auth/permission-gate";
import { useOrg } from "@/lib/org-context";
import { useSite } from "@/lib/site-context";
import { useToast } from "@/lib/toast-context";
import { useEmployees } from "@/lib/employee-context";
import { orgUnitTypeConfig } from "@/lib/org-data";
import { downloadCsv } from "@/lib/utils";
import { locationKinds } from "@/lib/types";
import type { OrgUnit, OrgUnitType } from "@/lib/types";

const PAGE_SIZE = 8;
type SortField = "name" | "code" | "status";

const auditActionLabel: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  activated: "Activated",
  deactivated: "Deactivated",
};
const auditActionTone: Record<string, "emerald" | "indigo" | "rose"> = {
  created: "emerald",
  updated: "indigo",
  activated: "emerald",
  deactivated: "rose",
};

function SortIndicator({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-slate-300 dark:text-slate-600" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export function OrgUnitManager({ type }: { type: OrgUnitType }) {
  const config = orgUnitTypeConfig[type];
  const { orgUnits, ancestorsOf, descendantIdsOf, auditFor, createOrgUnit, updateOrgUnit, setOrgUnitStatus } = useOrg();
  const { sites, currentSiteId, isAllSites } = useSite();
  const toast = useToast();
  const { employees } = useEmployees();
  const searchParams = useSearchParams();

  function headName(id?: string) {
    if (!id) return "—";
    return employees.find((e) => e.employeeId === id)?.name ?? "—";
  }

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [parentFilter, setParentFilter] = useState("All Parents");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<OrgUnit | null>(null);
  const [viewUnit, setViewUnit] = useState<OrgUnit | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<OrgUnit | null>(null);

  const siteScoped = useMemo(
    () => orgUnits.filter((u) => u.type === type && (isAllSites || u.siteId === currentSiteId)),
    [orgUnits, type, isAllSites, currentSiteId],
  );

  const parentCandidates = useMemo(
    () => orgUnits.filter((u) => config.allowedParentTypes.includes(u.type)),
    [orgUnits, config],
  );

  const availableParentFilters = useMemo(
    () => parentCandidates.filter((p) => isAllSites || p.siteId === currentSiteId),
    [parentCandidates, isAllSites, currentSiteId],
  );

  useEffect(() => {
    const focusId = searchParams.get("focus");
    if (!focusId) return;
    const unit = orgUnits.find((u) => u.id === focusId && u.type === type);
    // One-time sync from the URL (a "focus" deep link from the Hierarchy page) into
    // local modal state, not a derived-state loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (unit) setViewUnit(unit);
    // Only react to the URL param changing, not to every orgUnits update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, type]);

  // Reset to page 1 whenever the active filters change, using React's
  // render-time state-adjustment pattern (state, not a ref — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // instead of an effect.
  const filterKey = `${search}|${statusFilter}|${parentFilter}|${currentSiteId}|${isAllSites}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    if (page !== 1) setPage(1);
  }

  const filtered = useMemo(() => {
    let list = siteScoped;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.code.toLowerCase().includes(q));
    }
    if (statusFilter !== "All Status") list = list.filter((u) => u.status === statusFilter);
    if (parentFilter !== "All Parents") {
      list = parentFilter === "__root__" ? list.filter((u) => u.parentId === null) : list.filter((u) => u.parentId === parentFilter);
    }
    return [...list].sort((a, b) => {
      const cmp = String(a[sortField]).localeCompare(String(b[sortField]));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [siteScoped, search, statusFilter, parentFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function parentName(id: string | null) {
    if (!id) return "—";
    return orgUnits.find((u) => u.id === id)?.name ?? "—";
  }

  function siteName(id: string) {
    return sites.find((s) => s.id === id)?.name ?? "—";
  }

  function exportUnits() {
    downloadCsv(
      `${config.slug}.csv`,
      ["Name", "Code", "Parent", "Site", "Head", "Status"],
      filtered.map((u) => [u.name, u.code, parentName(u.parentId), siteName(u.siteId), headName(u.headEmployeeId), u.status]),
    );
  }

  async function handleCreate(input: {
    name: string;
    code: string;
    siteId: string;
    parentId: string | null;
    headEmployeeId?: string;
    description?: string;
    locationKind?: OrgUnit["locationKind"];
  }) {
    try {
      await createOrgUnit({ type, ...input });
      setAddOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create the organization unit.");
    }
  }

  async function handleEdit(input: {
    name: string;
    code: string;
    siteId: string;
    parentId: string | null;
    headEmployeeId?: string;
    description?: string;
    locationKind?: OrgUnit["locationKind"];
  }) {
    if (!editUnit) return;
    try {
      await updateOrgUnit(editUnit.id, input);
      setEditUnit(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update the organization unit.");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {siteScoped.length} {config.pluralLabel.toLowerCase()} {isAllSites ? "across all sites" : "at this site"}
        </p>
        <div className="flex items-center gap-2">
          <Can module="Organization" action="export">
            <Button variant="outline" onClick={exportUnits}>
              Export
            </Button>
          </Can>
          <Can module="Organization" action="create">
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add {config.label}
            </Button>
          </Can>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${config.pluralLabel.toLowerCase()}...`}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          {config.allowedParentTypes.length > 0 && (
            <Select value={parentFilter} onChange={(e) => setParentFilter(e.target.value)} className="w-auto">
              <option value="All Parents">All Parents</option>
              <option value="__root__">No Parent</option>
              {availableParentFilters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </Select>
        </div>

        <Table>
          <THead>
            <Th>
              <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200">
                {config.label} <SortIndicator active={sortField === "name"} dir={sortDir} />
              </button>
            </Th>
            <Th>
              <button onClick={() => toggleSort("code")} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200">
                Code <SortIndicator active={sortField === "code"} dir={sortDir} />
              </button>
            </Th>
            {config.allowedParentTypes.length > 0 && <Th>Parent</Th>}
            {type === "Location" && <Th>Kind</Th>}
            {isAllSites && <Th>Site</Th>}
            <Th>Head</Th>
            <Th>
              <button onClick={() => toggleSort("status")} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200">
                Status <SortIndicator active={sortField === "status"} dir={sortDir} />
              </button>
            </Th>
            <Th>Actions</Th>
          </THead>
          <TBody>
            {pageItems.map((unit) => (
              <Tr key={unit.id} hoverable>
                <Td className="font-medium text-slate-800 dark:text-slate-100">{unit.name}</Td>
                <Td>{unit.code}</Td>
                {config.allowedParentTypes.length > 0 && <Td>{parentName(unit.parentId)}</Td>}
                {type === "Location" && <Td>{unit.locationKind ?? "—"}</Td>}
                {isAllSites && <Td>{siteName(unit.siteId)}</Td>}
                <Td>{headName(unit.headEmployeeId)}</Td>
                <Td>
                  <StatusBadge status={unit.status} />
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-3">
                    {type === "CostCenter" || type === "ProfitCenter" ? (
                      <Link
                        href={`/organization/units/${config.slug}/${unit.id}`}
                        className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        View
                      </Link>
                    ) : (
                      <button onClick={() => setViewUnit(unit)} className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        View
                      </button>
                    )}
                    <Can module="Organization" action="edit">
                      <button onClick={() => setEditUnit(unit)} className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                        Edit
                      </button>
                      {unit.status === "Active" ? (
                        <button onClick={() => setDeactivateTarget(unit)} className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setOrgUnitStatus(unit.id, "Active").catch((error: unknown) =>
                              toast.error(error instanceof Error ? error.message : "Failed to activate the unit."),
                            );
                          }}
                          className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                        >
                          Activate
                        </button>
                      )}
                    </Can>
                  </div>
                </Td>
              </Tr>
            ))}
            {pageItems.length === 0 && (
              <EmptyRow colSpan={8}>No {config.pluralLabel.toLowerCase()} match your filters.</EmptyRow>
            )}
          </TBody>
        </Table>

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}{" "}
              entries
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Previous
              </button>
              <span className="px-2 text-xs text-slate-400 dark:text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {addOpen && (
        <UnitFormModal
          type={type}
          config={config}
          sites={sites}
          defaultSiteId={isAllSites ? sites[0]?.id ?? "" : currentSiteId}
          parentCandidates={parentCandidates}
          excludeParentIds={new Set<string>()}
          onClose={() => setAddOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {editUnit && (
        <UnitFormModal
          type={type}
          config={config}
          sites={sites}
          initial={editUnit}
          defaultSiteId={editUnit.siteId}
          parentCandidates={parentCandidates}
          excludeParentIds={new Set([editUnit.id, ...descendantIdsOf(editUnit.id)])}
          onClose={() => setEditUnit(null)}
          onSubmit={handleEdit}
        />
      )}

      <Modal open={Boolean(viewUnit)} onClose={() => setViewUnit(null)} title={viewUnit ? `${viewUnit.name}` : ""}>
        {viewUnit && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Badge tone="indigo">{config.label}</Badge>
              <StatusBadge status={viewUnit.status} />
            </div>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Code</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{viewUnit.code}</dd>
              </div>
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Site</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{siteName(viewUnit.siteId)}</dd>
              </div>
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Parent</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{parentName(viewUnit.parentId)}</dd>
              </div>
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Head</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{headName(viewUnit.headEmployeeId)}</dd>
              </div>
              {viewUnit.locationKind && (
                <div>
                  <dt className="text-slate-400 dark:text-slate-500">Kind</dt>
                  <dd className="font-medium text-slate-700 dark:text-slate-200">{viewUnit.locationKind}</dd>
                </div>
              )}
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Created</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{viewUnit.createdOn}</dd>
              </div>
            </dl>
            {viewUnit.description && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Description</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{viewUnit.description}</p>
              </div>
            )}
            {ancestorsOf(viewUnit.id).length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Path</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {ancestorsOf(viewUnit.id).map((a) => a.name).join(" › ")} › <span className="font-medium">{viewUnit.name}</span>
                </p>
              </div>
            )}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <History className="h-3.5 w-3.5" /> Audit History
              </p>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {auditFor(viewUnit.id).map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-xs dark:border-slate-800">
                    <div className="min-w-0">
                      <p className="text-slate-600 dark:text-slate-300">{entry.detail}</p>
                      <p className="mt-0.5 text-slate-400 dark:text-slate-500">
                        {entry.actorName} &middot; {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Badge tone={auditActionTone[entry.action]} className="shrink-0">
                      {auditActionLabel[entry.action]}
                    </Badge>
                  </div>
                ))}
                {auditFor(viewUnit.id).length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">No history recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(deactivateTarget)} onClose={() => setDeactivateTarget(null)} title={`Deactivate ${config.label}`}>
        {deactivateTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {deactivateTarget.name} will be marked inactive. Its child units and any employees still mapped to it
                are not affected automatically — review them separately. You can reactivate at any time.
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setOrgUnitStatus(deactivateTarget.id, "Inactive")
                    .then(() => setDeactivateTarget(null))
                    .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to deactivate the unit."));
                }}
              >
                Deactivate
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

interface UnitFormModalProps {
  type: OrgUnitType;
  config: (typeof orgUnitTypeConfig)[OrgUnitType];
  sites: { id: string; name: string }[];
  defaultSiteId: string;
  initial?: OrgUnit;
  parentCandidates: OrgUnit[];
  excludeParentIds: Set<string>;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    code: string;
    siteId: string;
    parentId: string | null;
    headEmployeeId?: string;
    description?: string;
    locationKind?: OrgUnit["locationKind"];
  }) => void;
}

function UnitFormModal({
  type,
  config,
  sites,
  defaultSiteId,
  initial,
  parentCandidates,
  excludeParentIds,
  onClose,
  onSubmit,
}: UnitFormModalProps) {
  const [siteId, setSiteId] = useState(initial?.siteId ?? defaultSiteId);
  const [parentId, setParentId] = useState(initial?.parentId ?? "");
  const { employees } = useEmployees();

  const eligibleParents = parentCandidates.filter((p) => p.siteId === siteId && !excludeParentIds.has(p.id));
  const parentRequired = config.allowedParentTypes.length > 0;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSubmit({
      name: String(form.get("name") ?? "").trim(),
      code: String(form.get("code") ?? "").trim(),
      siteId,
      parentId: parentRequired ? parentId || null : null,
      headEmployeeId: String(form.get("headEmployeeId") ?? "") || undefined,
      description: String(form.get("description") ?? "").trim() || undefined,
      locationKind: type === "Location" ? (String(form.get("locationKind") ?? "Location") as OrgUnit["locationKind"]) : undefined,
    });
  }

  return (
    <Modal open onClose={onClose} title={initial ? `Edit ${config.label}` : `Add ${config.label}`}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label={`${config.label} Name`}>
          <Input name="name" required defaultValue={initial?.name} placeholder={`e.g. ${config.label} name`} />
        </Field>
        <Field label="Code">
          <Input name="code" required defaultValue={initial?.code} placeholder="e.g. ENG" />
        </Field>

        {sites.length > 1 && (
          <Field label="Site">
            <Select
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value);
                setParentId("");
              }}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {parentRequired && (
          <Field label="Parent Unit">
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)} required>
              <option value="" disabled>
                Select parent
              </option>
              {eligibleParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({orgUnitTypeConfig[p.type].label})
                </option>
              ))}
            </Select>
            {eligibleParents.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                No eligible parent ({config.allowedParentTypes.map((t) => orgUnitTypeConfig[t].label).join(" / ")}) exists at
                this site yet — create one first.
              </p>
            )}
          </Field>
        )}

        {type === "Location" && (
          <Field label="Location Kind">
            <Select name="locationKind" defaultValue={initial?.locationKind ?? "Location"}>
              {locationKinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Head / Owner (optional)">
          <Select name="headEmployeeId" defaultValue={initial?.headEmployeeId ?? ""}>
            <option value="">Unassigned</option>
            {employees.map((e) => (
              <option key={e.employeeId} value={e.employeeId}>
                {e.name} — {e.designation}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Description (optional)">
          <Textarea name="description" rows={2} defaultValue={initial?.description} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={parentRequired && eligibleParents.length === 0}>
            {initial ? "Save Changes" : `Add ${config.label}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
