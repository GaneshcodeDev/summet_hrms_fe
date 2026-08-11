"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  History,
  Plus,
  Search,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRow, TBody, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { Can } from "@/components/auth/permission-gate";
import { useMasters } from "@/lib/master-context";
import { useSite } from "@/lib/site-context";
import { masterTypeConfig, type MasterFieldDef } from "@/lib/master-data";
import { downloadCsv } from "@/lib/utils";
import type { MasterAttributes, MasterRecord, MasterType } from "@/lib/types";

const PAGE_SIZE = 8;
type SortField = "name" | "code" | "status";

const auditActionLabel: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  activated: "Activated",
  deactivated: "Deactivated",
  imported: "Imported",
};
const auditActionTone: Record<string, "emerald" | "indigo" | "rose" | "sky"> = {
  created: "emerald",
  updated: "indigo",
  activated: "emerald",
  deactivated: "rose",
  imported: "sky",
};

function SortIndicator({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-slate-300 dark:text-slate-600" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function coerceAttributeValue(field: MasterFieldDef, raw: string): string | number | boolean | undefined {
  if (raw === "") return undefined;
  if (field.type === "number") return Number(raw);
  if (field.type === "boolean") return raw === "true";
  return raw;
}

export function MasterManager({ type }: { type: MasterType }) {
  const config = masterTypeConfig[type];
  const { records, auditFor, dependentsCount, createRecord, updateRecord, setRecordStatus, bulkSetStatus, importRecords } =
    useMasters();
  const { sites, currentSiteId, isAllSites } = useSite();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<MasterRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<MasterRecord | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<MasterRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const scoped = useMemo(
    () => records.filter((r) => r.masterType === type && (config.scope === "global" || isAllSites || r.siteId === currentSiteId)),
    [records, type, config.scope, isAllSites, currentSiteId],
  );

  useEffect(() => {
    const focusId = searchParams.get("focus");
    if (!focusId) return;
    const found = records.find((r) => r.id === focusId && r.masterType === type);
    // One-time sync from a deep-link URL param into modal state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (found) setViewRecord(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, type]);

  const filterKey = `${search}|${statusFilter}|${currentSiteId}|${isAllSites}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    if (page !== 1) setPage(1);
    if (selected.size > 0) setSelected(new Set());
  }

  const filtered = useMemo(() => {
    let list = scoped;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
    }
    if (statusFilter !== "All Status") list = list.filter((r) => r.status === statusFilter);
    return [...list].sort((a, b) => {
      const cmp = String(a[sortField]).localeCompare(String(b[sortField]));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [scoped, search, statusFilter, sortField, sortDir]);

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

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function siteName(id?: string) {
    if (!id) return "Global";
    return sites.find((s) => s.id === id)?.name ?? "—";
  }

  function resolveRefLabel(field: MasterFieldDef, value: unknown): string {
    if (value === undefined || value === null || value === "") return "—";
    if (field.refMasterType) {
      return records.find((r) => r.id === value)?.name ?? String(value);
    }
    if (field.type === "boolean") return value ? "Yes" : "No";
    return String(value);
  }

  function exportRecords() {
    const headers = ["Name", "Code", "Description", "Status", ...(config.scope === "tenant" ? ["Site"] : []), ...config.fields.map((f) => f.label)];
    const rows = filtered.map((r) => [
      r.name,
      r.code,
      r.description ?? "",
      r.status,
      ...(config.scope === "tenant" ? [siteName(r.siteId)] : []),
      ...config.fields.map((f) => resolveRefLabel(f, r.attributes[f.key])),
    ]);
    downloadCsv(`${config.slug}.csv`, headers, rows);
  }

  function buildAttributesFromForm(form: FormData): MasterAttributes {
    const attrs: MasterAttributes = {};
    for (const field of config.fields) {
      if (field.type === "boolean") {
        attrs[field.key] = form.get(field.key) === "on";
      } else {
        const raw = String(form.get(field.key) ?? "");
        attrs[field.key] = coerceAttributeValue(field, raw);
      }
    }
    return attrs;
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const siteId = config.scope === "tenant" ? String(form.get("siteId") ?? (isAllSites ? sites[0]?.id : currentSiteId)) : undefined;
    createRecord({
      masterType: type,
      name: String(form.get("name") ?? "").trim(),
      code: String(form.get("code") ?? "").trim(),
      siteId,
      description: String(form.get("description") ?? "").trim() || undefined,
      attributes: buildAttributesFromForm(form),
    });
    setAddOpen(false);
  }

  function handleEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editRecord) return;
    const form = new FormData(e.currentTarget);
    const siteId = config.scope === "tenant" ? String(form.get("siteId") ?? editRecord.siteId) : undefined;
    updateRecord(editRecord.id, {
      name: String(form.get("name") ?? "").trim(),
      code: String(form.get("code") ?? "").trim(),
      siteId,
      description: String(form.get("description") ?? "").trim() || undefined,
      attributes: buildAttributesFromForm(form),
    });
    setEditRecord(null);
  }

  const allOnPageSelected = pageItems.length > 0 && pageItems.every((r) => selected.has(r.id));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {scoped.length} {config.pluralLabel.toLowerCase()}
          {config.scope === "tenant" ? (isAllSites ? " across all sites" : " at this site") : " (global reference data)"}
        </p>
        <div className="flex items-center gap-2">
          <Can feature="masters.records" action="import">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import
            </Button>
          </Can>
          <Can feature="masters.records" action="export">
            <Button variant="outline" onClick={exportRecords}>
              Export
            </Button>
          </Can>
          <Can feature="masters.records" action="create">
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
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </Select>
        </div>

        {selected.size > 0 && (
          <Can feature="masters.records" action="edit">
            <div className="flex items-center justify-between border-b border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-sm dark:border-indigo-500/20 dark:bg-indigo-500/10">
              <span className="font-medium text-indigo-700 dark:text-indigo-300">{selected.size} selected</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    bulkSetStatus(Array.from(selected), "Active");
                    setSelected(new Set());
                  }}
                  className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Activate
                </button>
                <button
                  onClick={() => {
                    bulkSetStatus(Array.from(selected), "Inactive");
                    setSelected(new Set());
                  }}
                  className="font-medium text-rose-600 hover:underline dark:text-rose-400"
                >
                  Deactivate
                </button>
                <button onClick={() => setSelected(new Set())} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  Clear
                </button>
              </div>
            </div>
          </Can>
        )}

        <Table>
          <THead>
            <Th className="w-8">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={(e) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    pageItems.forEach((r) => (e.target.checked ? next.add(r.id) : next.delete(r.id)));
                    return next;
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
              />
            </Th>
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
            {config.fields.slice(0, 2).map((f) => (
              <Th key={f.key}>{f.label}</Th>
            ))}
            {config.scope === "tenant" && isAllSites && <Th>Site</Th>}
            <Th>
              <button onClick={() => toggleSort("status")} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200">
                Status <SortIndicator active={sortField === "status"} dir={sortDir} />
              </button>
            </Th>
            <Th>Actions</Th>
          </THead>
          <TBody>
            {pageItems.map((rec) => (
              <Tr key={rec.id} hoverable>
                <Td>
                  <input
                    type="checkbox"
                    checked={selected.has(rec.id)}
                    onChange={() => toggleSelected(rec.id)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
                  />
                </Td>
                <Td className="font-medium text-slate-800 dark:text-slate-100">{rec.name}</Td>
                <Td>{rec.code}</Td>
                {config.fields.slice(0, 2).map((f) => (
                  <Td key={f.key}>{resolveRefLabel(f, rec.attributes[f.key])}</Td>
                ))}
                {config.scope === "tenant" && isAllSites && <Td>{siteName(rec.siteId)}</Td>}
                <Td>
                  <StatusBadge status={rec.status} />
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => setViewRecord(rec)} className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                      View
                    </button>
                    <Can feature="masters.records" action="edit">
                      <button onClick={() => setEditRecord(rec)} className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                        Edit
                      </button>
                      {rec.status === "Active" ? (
                        <button onClick={() => setDeactivateTarget(rec)} className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">
                          Deactivate
                        </button>
                      ) : (
                        <button onClick={() => setRecordStatus(rec.id, "Active")} className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                          Activate
                        </button>
                      )}
                    </Can>
                  </div>
                </Td>
              </Tr>
            ))}
            {pageItems.length === 0 && (
              <EmptyRow colSpan={6 + config.fields.slice(0, 2).length}>No {config.pluralLabel.toLowerCase()} match your filters.</EmptyRow>
            )}
          </TBody>
        </Table>

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} entries
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
        <RecordFormModal
          config={config}
          sites={sites}
          defaultSiteId={isAllSites ? sites[0]?.id ?? "" : currentSiteId}
          allRecords={records}
          onClose={() => setAddOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {editRecord && (
        <RecordFormModal
          config={config}
          sites={sites}
          initial={editRecord}
          defaultSiteId={editRecord.siteId ?? (isAllSites ? sites[0]?.id ?? "" : currentSiteId)}
          allRecords={records}
          onClose={() => setEditRecord(null)}
          onSubmit={handleEdit}
        />
      )}

      <Modal open={Boolean(viewRecord)} onClose={() => setViewRecord(null)} title={viewRecord?.name ?? ""}>
        {viewRecord && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Badge tone="indigo">{config.label}</Badge>
              <StatusBadge status={viewRecord.status} />
            </div>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Code</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{viewRecord.code}</dd>
              </div>
              {config.scope === "tenant" && (
                <div>
                  <dt className="text-slate-400 dark:text-slate-500">Site</dt>
                  <dd className="font-medium text-slate-700 dark:text-slate-200">{siteName(viewRecord.siteId)}</dd>
                </div>
              )}
              {config.fields.map((f) => (
                <div key={f.key}>
                  <dt className="text-slate-400 dark:text-slate-500">{f.label}</dt>
                  <dd className="font-medium text-slate-700 dark:text-slate-200">{resolveRefLabel(f, viewRecord.attributes[f.key])}</dd>
                </div>
              ))}
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Created</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{viewRecord.createdOn.slice(0, 10)}</dd>
              </div>
            </dl>
            {viewRecord.description && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Description</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{viewRecord.description}</p>
              </div>
            )}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <History className="h-3.5 w-3.5" /> Audit History
              </p>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {auditFor(viewRecord.id).map((entry) => (
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
                {auditFor(viewRecord.id).length === 0 && <p className="text-xs text-slate-400 dark:text-slate-500">No history recorded yet.</p>}
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
                {deactivateTarget.name} will no longer be selectable in other modules.
                {dependentsCount(deactivateTarget) > 0 ? (
                  <>
                    {" "}
                    It&apos;s currently referenced by <strong>{dependentsCount(deactivateTarget)}</strong> record(s) — they
                    won&apos;t be changed, but review them if this master is being retired.
                  </>
                ) : (
                  " No other records currently reference it."
                )}
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setRecordStatus(deactivateTarget.id, "Inactive");
                  setDeactivateTarget(null);
                }}
              >
                Deactivate
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {importOpen && (
        <ImportModal
          config={config}
          defaultSiteId={isAllSites ? sites[0]?.id ?? "" : currentSiteId}
          onClose={() => setImportOpen(false)}
          onImport={(rows) => importRecords(type, config.scope === "tenant" ? (isAllSites ? sites[0]?.id : currentSiteId) : undefined, rows)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add / Edit form                                                      */
/* ------------------------------------------------------------------ */

interface RecordFormModalProps {
  config: (typeof masterTypeConfig)[MasterType];
  sites: { id: string; name: string }[];
  defaultSiteId: string;
  initial?: MasterRecord;
  allRecords: MasterRecord[];
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

function RecordFormModal({ config, sites, defaultSiteId, initial, allRecords, onClose, onSubmit }: RecordFormModalProps) {
  const [siteId, setSiteId] = useState(initial?.siteId ?? defaultSiteId);

  function optionsForField(field: MasterFieldDef): { value: string; label: string }[] {
    if (field.options) return field.options.map((o) => ({ value: o, label: o }));
    if (field.refMasterType) {
      const refConfig = masterTypeConfig[field.refMasterType];
      return allRecords
        .filter(
          (r) =>
            r.masterType === field.refMasterType &&
            r.status === "Active" &&
            (refConfig.scope === "global" || !siteId || r.siteId === siteId),
        )
        .map((r) => ({ value: r.id, label: r.name }));
    }
    return [];
  }

  return (
    <Modal open onClose={onClose} title={initial ? `Edit ${config.label}` : `Add ${config.label}`}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label={`${config.label} Name`}>
          <Input name="name" required defaultValue={initial?.name} placeholder={`e.g. ${config.label} name`} />
        </Field>
        <Field label="Code">
          <Input name="code" required defaultValue={initial?.code} placeholder="e.g. CODE" />
        </Field>

        {config.scope === "tenant" && sites.length > 1 && (
          <Field label="Site">
            <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} name="siteId">
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {config.fields.map((field) => {
          const current = initial?.attributes[field.key];
          if (field.type === "boolean") {
            return (
              <label key={field.key} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  name={field.key}
                  defaultChecked={Boolean(current)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
                />
                {field.label}
              </label>
            );
          }
          if (field.type === "select" || field.refMasterType) {
            const options = optionsForField(field);
            return (
              <Field key={field.key} label={field.label}>
                <Select name={field.key} required={field.required} defaultValue={current !== undefined ? String(current) : ""}>
                  <option value="" disabled>
                    Select {field.label.toLowerCase()}
                  </option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          }
          return (
            <Field key={field.key} label={field.label}>
              <Input
                name={field.key}
                type={field.type === "number" ? "number" : field.type === "time" ? "time" : "text"}
                required={field.required}
                defaultValue={current !== undefined ? String(current) : ""}
                placeholder={field.placeholder}
              />
            </Field>
          );
        })}

        <Field label="Description (optional)">
          <Textarea name="description" rows={2} defaultValue={initial?.description} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{initial ? "Save Changes" : `Add ${config.label}`}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* CSV import                                                           */
/* ------------------------------------------------------------------ */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += char;
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim().length > 0)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim().length > 0)) rows.push(row);
  }
  return rows;
}

interface ParsedRow {
  name: string;
  code: string;
  description?: string;
  attributes: MasterAttributes;
  errors: string[];
}

function ImportModal({
  config,
  defaultSiteId,
  onClose,
  onImport,
}: {
  config: (typeof masterTypeConfig)[MasterType];
  defaultSiteId: string;
  onClose: () => void;
  onImport: (rows: { name: string; code: string; description?: string; attributes?: MasterAttributes }[]) => number;
}) {
  const { records } = useMasters();
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const templateHeaders = ["Name", "Code", "Description", ...config.fields.map((f) => f.label)];

  function downloadTemplate() {
    downloadCsv(`${config.slug}-import-template.csv`, templateHeaders, []);
  }

  function resolveRefValue(field: MasterFieldDef, raw: string): { value: string | number | boolean | undefined; error?: string } {
    if (!raw) return { value: undefined, error: field.required ? `${field.label} is required` : undefined };
    if (field.type === "boolean") return { value: /^(true|yes|1)$/i.test(raw) };
    if (field.type === "number") {
      const n = Number(raw);
      return Number.isNaN(n) ? { value: undefined, error: `${field.label} must be a number` } : { value: n };
    }
    if (field.refMasterType) {
      const match = records.find(
        (r) => r.masterType === field.refMasterType && r.status === "Active" && r.name.toLowerCase() === raw.toLowerCase(),
      );
      return match ? { value: match.id } : { value: undefined, error: `Unknown ${field.label}: "${raw}"` };
    }
    if (field.options) {
      const match = field.options.find((o) => o.toLowerCase() === raw.toLowerCase());
      return match ? { value: match } : { value: undefined, error: `${field.label} must be one of: ${field.options.join(", ")}` };
    }
    return { value: raw };
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportedCount(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setParsedRows([]);
        return;
      }
      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const dataRows = rows.slice(1);
      const idx = (label: string) => headers.indexOf(label.toLowerCase());

      const parsed: ParsedRow[] = dataRows.map((cells) => {
        const errors: string[] = [];
        const name = cells[idx("name")]?.trim() ?? "";
        const code = cells[idx("code")]?.trim() ?? "";
        const description = idx("description") >= 0 ? cells[idx("description")]?.trim() : undefined;
        if (!name) errors.push("Name is required");
        if (!code) errors.push("Code is required");

        const attributes: MasterAttributes = {};
        for (const field of config.fields) {
          const columnIndex = idx(field.label);
          const raw = columnIndex >= 0 ? (cells[columnIndex]?.trim() ?? "") : "";
          const { value, error } = resolveRefValue(field, raw);
          if (error) errors.push(error);
          if (value !== undefined) attributes[field.key] = value;
        }

        return { name, code, description: description || undefined, attributes, errors };
      });
      setParsedRows(parsed);
    };
    reader.readAsText(file);
  }

  const validRows = parsedRows?.filter((r) => r.errors.length === 0) ?? [];

  function handleConfirmImport() {
    const count = onImport(validRows.map(({ name, code, description, attributes }) => ({ name, code, description, attributes })));
    setImportedCount(count);
  }

  return (
    <Modal open onClose={onClose} title={`Import ${config.pluralLabel}`}>
      <div className="space-y-4">
        {importedCount !== null ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Check className="h-4 w-4 shrink-0" /> Imported {importedCount} {config.pluralLabel.toLowerCase()} successfully.
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Upload a CSV with columns: <span className="font-mono text-xs">{templateHeaders.join(", ")}</span>.
              {config.scope === "tenant" && ` Imported records are added to ${defaultSiteId ? "the current site" : "site 1"}.`}
            </p>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={downloadTemplate}>
                Download Template
              </Button>
              <input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm text-slate-500 dark:text-slate-400" />
            </div>

            {parsedRows && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {validRows.length} of {parsedRows.length} row(s) valid.
                </p>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-500">
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                          <td className="px-3 py-2">{row.name || "—"}</td>
                          <td className="px-3 py-2">{row.code || "—"}</td>
                          <td className="px-3 py-2">
                            {row.errors.length === 0 ? (
                              <Badge tone="emerald">Valid</Badge>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400" title={row.errors.join("; ")}>
                                {row.errors[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmImport} disabled={validRows.length === 0}>
                Import {validRows.length > 0 ? `${validRows.length} Record${validRows.length === 1 ? "" : "s"}` : ""}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
