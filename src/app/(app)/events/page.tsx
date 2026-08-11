"use client";

import { FormEvent, useMemo, useState } from "react";
import { Calendar, Clock, MapPin, Plus, Trash2, Users, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { eventTypes } from "@/lib/event-data";
import { useEvents } from "@/lib/event-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useToast } from "@/lib/toast-context";
import type { CompanyEvent, EventType } from "@/lib/types";

const eventTypeTone: Record<EventType, "indigo" | "sky" | "amber" | "emerald" | "rose"> = {
  Meeting: "sky",
  Training: "indigo",
  Holiday: "emerald",
  "Company Event": "amber",
  Festival: "rose",
  Announcement: "sky",
};

export default function EventsPage() {
  const { roles } = useAccessControl();
  const { currentSite, isAllSites, sites, currentSiteId } = useSite();
  const toast = useToast();
  const { visibleEvents, canManageEvents, createEvent, cancelEvent, deleteEvent } = useEvents();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompanyEvent | null>(null);

  const scoped = useSiteFilter(visibleEvents());
  const upcoming = useMemo(
    () => [...scoped].filter((e) => e.status !== "Cancelled").sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [scoped],
  );
  const cancelled = scoped.filter((e) => e.status === "Cancelled");

  function roleNames(ids: string[]) {
    if (ids.length === 0) return "Everyone";
    return ids.map((id) => roles.find((r) => r.id === id)?.name ?? id).join(", ");
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const roleIds = form.getAll("roleIds").map(String);
    const result = createEvent({
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      type: String(form.get("type")) as EventType,
      startDate: String(form.get("startDate")),
      endDate: String(form.get("endDate") || form.get("startDate")),
      startTime: String(form.get("startTime") ?? "") || undefined,
      endTime: String(form.get("endTime") ?? "") || undefined,
      location: String(form.get("location") ?? ""),
      siteId: String(form.get("siteId") ?? "") || undefined,
      roleIds,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setModalOpen(false);
      e.currentTarget.reset();
    }
  }

  function handleCancel(event: CompanyEvent) {
    const result = cancelEvent(event.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const result = deleteEvent(deleteTarget.id);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description={
          isAllSites
            ? "Company meetings, training, holidays and announcements across all sites"
            : `Events at ${currentSite?.name}`
        }
        action={
          canManageEvents ? (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Create Event
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {upcoming.map((event) => (
          <Card key={event.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <Badge tone={eventTypeTone[event.type]}>{event.type}</Badge>
              <StatusBadge status={event.status} />
            </div>
            <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{event.title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{event.description}</p>

            <div className="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                {event.startDate === event.endDate
                  ? new Date(event.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : `${event.startDate} to ${event.endDate}`}
              </div>
              {event.startTime && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {event.startTime}
                  {event.endTime ? ` – ${event.endTime}` : ""}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {event.location}
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 shrink-0" />
                Visible to: {roleNames(event.roleIds)}
              </div>
            </div>

            {canManageEvents && (
              <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  onClick={() => handleCancel(event)}
                  className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </button>
                <button
                  onClick={() => setDeleteTarget(event)}
                  className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            )}
          </Card>
        ))}
        {upcoming.length === 0 && (
          <Card className="col-span-full p-10 text-center text-sm text-slate-400 dark:text-slate-500">
            No upcoming events{isAllSites ? "" : ` at ${currentSite?.name}`}.
          </Card>
        )}
      </div>

      {cancelled.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Cancelled
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cancelled.map((event) => (
              <Card key={event.id} className="p-5 opacity-60">
                <div className="flex items-start justify-between gap-2">
                  <Badge tone={eventTypeTone[event.type]}>{event.type}</Badge>
                  <StatusBadge status={event.status} />
                </div>
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{event.title}</h3>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{event.startDate}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Event">
        <form className="space-y-4" onSubmit={handleCreate}>
          <Field label="Title">
            <Input name="title" required placeholder="e.g. All Hands — Q3 Review" />
          </Field>
          <Field label="Description">
            <Textarea name="description" rows={2} required placeholder="What is this event about?" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select name="type" required defaultValue={eventTypes[0]}>
                {eventTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Location">
              <Input name="location" required placeholder="e.g. Noida HQ — Conference Room 2" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date">
              <Input name="startDate" type="date" required />
            </Field>
            <Field label="End Date">
              <Input name="endDate" type="date" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Time (optional)">
              <Input name="startTime" type="time" />
            </Field>
            <Field label="End Time (optional)">
              <Input name="endTime" type="time" />
            </Field>
          </div>
          <Field label="Site (optional — leave blank for all sites)">
            <Select name="siteId" defaultValue={isAllSites ? "" : currentSiteId}>
              <option value="">All Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Visible to (leave all unchecked for everyone)
            </span>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    name="roleIds"
                    value={role.id}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Event</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete Event">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Delete <span className="font-medium text-slate-700 dark:text-slate-200">{deleteTarget.title}</span>{" "}
              permanently? This can&apos;t be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Delete Event
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
