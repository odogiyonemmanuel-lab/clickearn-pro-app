import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Briefcase, Plus, Pencil, Power, Eye } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn, formatCurrency, formatDate, truncate } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";

type JobType = "full_time" | "part_time" | "contract" | "remote" | "internship";

type JobRow = {
  _id: string;
  title: string;
  company: string;
  location: string;
  type: JobType;
  salary?: string;
  description: string;
  requirements: string;
  applyUrl?: string;
  readReward: number;
  requiredReadSeconds: number;
  isPublished: boolean;
  views: number;
  createdAt: number;
};

const PAGE_SIZE = 20;

const jobTypeLabels: Record<JobType, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
  remote: "Remote",
  internship: "Internship",
};

type FormState = {
  title: string;
  company: string;
  location: string;
  type: JobType;
  salary: string;
  description: string;
  requirements: string;
  applyUrl: string;
  readReward: string;
  requiredReadSeconds: string;
};

const emptyForm: FormState = {
  title: "",
  company: "",
  location: "",
  type: "full_time",
  salary: "",
  description: "",
  requirements: "",
  applyUrl: "",
  readReward: "20",
  requiredReadSeconds: "30",
};

function formFromJob(job: JobRow): FormState {
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    type: job.type,
    salary: job.salary ?? "",
    description: job.description,
    requirements: job.requirements,
    applyUrl: job.applyUrl ?? "",
    readReward: String(job.readReward),
    requiredReadSeconds: String(job.requiredReadSeconds),
  };
}

export default function AdminJobsPage() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JobRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [previewJob, setPreviewJob] = useState<JobRow | null>(null);

  const result = useQuery(api.jobs.adminGetJobs, {
    paginationOpts: { numItems: PAGE_SIZE, cursor },
  }) as { page: JobRow[]; isDone: boolean; continueCursor: string } | undefined;

  const createJob = useMutation(api.jobs.adminCreateJob);
  const updateJob = useMutation(api.jobs.adminUpdateJob);
  const togglePublish = useMutation(api.jobs.adminTogglePublish);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (job: JobRow) => {
    setEditing(job);
    setForm(formFromJob(job));
    setModalOpen(true);
  };

  const handleToggle = async (job: JobRow) => {
    try {
      await togglePublish({ jobId: job._id as any });
      toast.success(`Job ${job.isPublished ? "unpublished" : "published"}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to toggle publish");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.company.trim() || !form.description.trim()) {
      toast.error("Title, company, and description are required");
      return;
    }
    const reward = Number(form.readReward);
    const seconds = Number(form.requiredReadSeconds);
    setSaving(true);
    try {
      if (editing) {
        await updateJob({
          jobId: editing._id as any,
          title: form.title.trim(),
          company: form.company.trim(),
          location: form.location.trim(),
          type: form.type,
          salary: form.salary.trim() || undefined,
          description: form.description.trim(),
          requirements: form.requirements.trim(),
          applyUrl: form.applyUrl.trim() || undefined,
          readReward: reward,
          requiredReadSeconds: seconds,
        } as any);
        toast.success("Job updated");
      } else {
        await createJob({
          title: form.title.trim(),
          company: form.company.trim(),
          location: form.location.trim(),
          type: form.type,
          salary: form.salary.trim() || undefined,
          description: form.description.trim(),
          requirements: form.requirements.trim(),
          applyUrl: form.applyUrl.trim() || undefined,
          readReward: reward,
          requiredReadSeconds: seconds,
          isPublished: false,
        } as any);
        toast.success("Job created");
      }
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save job");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* ============ Header ============ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Job Listings</h2>
          <p className="text-sm text-dark-400">Manage job postings that users can read for rewards.</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">
          <Plus className="h-4 w-4" /> Add Job
        </button>
      </div>

      {/* ============ Table ============ */}
      <div className="card overflow-hidden">
        {result === undefined ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        ) : result.page.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No job listings"
            description="Create your first job posting to reward users for reading."
            action={{ label: "Add Job", onClick: openCreate }}
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800 bg-dark-900/50">
                  <th className="table-header">Title</th>
                  <th className="table-header">Company</th>
                  <th className="table-header">Location</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Salary</th>
                  <th className="table-header">Views</th>
                  <th className="table-header">Published</th>
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800">
                {result.page.map((job) => (
                  <tr key={job._id} className="hover:bg-dark-800/30">
                    <td className="table-cell">
                      <p className="max-w-[180px] truncate font-medium text-white">{job.title}</p>
                      <p className="text-xs text-dark-500">{formatCurrency(job.readReward)} reward</p>
                    </td>
                    <td className="table-cell text-dark-200">{job.company}</td>
                    <td className="table-cell text-dark-300">{job.location}</td>
                    <td className="table-cell">
                      <Badge variant="neutral">{jobTypeLabels[job.type]}</Badge>
                    </td>
                    <td className="table-cell text-dark-300">{job.salary || "—"}</td>
                    <td className="table-cell text-dark-300">{job.views}</td>
                    <td className="table-cell">
                      {job.isPublished ? (
                        <Badge variant="success">Published</Badge>
                      ) : (
                        <Badge variant="neutral">Draft</Badge>
                      )}
                    </td>
                    <td className="table-cell text-dark-400">{formatDate(job.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewJob(job)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-800 hover:text-white"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(job)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-800 hover:text-white"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(job)}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg hover:bg-dark-800",
                            job.isPublished ? "text-error-400 hover:text-error-300" : "text-secondary-400 hover:text-secondary-300"
                          )}
                          title={job.isPublished ? "Unpublish" : "Publish"}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && !result.isDone && result.page.length > 0 && (
          <div className="border-t border-dark-800 p-4 text-center">
            <button onClick={() => setCursor(result.continueCursor || null)} className="btn btn-secondary btn-sm">
              Load More
            </button>
          </div>
        )}
      </div>

      {/* ============ Preview Modal ============ */}
      <Modal
        isOpen={!!previewJob}
        onClose={() => setPreviewJob(null)}
        title="Job Preview"
        maxWidth="2xl"
      >
        {previewJob && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{previewJob.title}</h2>
                <p className="text-sm text-dark-400">{previewJob.company} · {previewJob.location}</p>
              </div>
              <Badge variant="neutral">{jobTypeLabels[previewJob.type]}</Badge>
            </div>
            {previewJob.salary && (
              <p className="text-sm font-medium text-primary-400">{previewJob.salary}</p>
            )}
            <div>
              <h3 className="mb-1 text-sm font-semibold text-white">Description</h3>
              <p className="whitespace-pre-wrap text-sm text-dark-200">{previewJob.description}</p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-white">Requirements</h3>
              <p className="whitespace-pre-wrap text-sm text-dark-200">{previewJob.requirements}</p>
            </div>
            {previewJob.applyUrl && (
              <a href={previewJob.applyUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                Apply URL
              </a>
            )}
            <p className="text-xs text-dark-500">{previewJob.views} views · {previewJob.requiredReadSeconds}s required</p>
          </div>
        )}
      </Modal>

      {/* ============ Create / Edit Modal ============ */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Job" : "Add Job"}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
                placeholder="e.g. Senior Frontend Developer"
              />
            </div>
            <div>
              <label className="label">Company</label>
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="input"
                placeholder="e.g. Acme Inc."
              />
            </div>
            <div>
              <label className="label">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="input"
                placeholder="e.g. Lagos, Nigeria"
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as JobType })}
                className="input"
              >
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="remote">Remote</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div>
              <label className="label">Salary</label>
              <input
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                className="input"
                placeholder="e.g. ₦200,000 - ₦350,000"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input resize-none"
                rows={3}
                placeholder="Job description…"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Requirements</label>
              <textarea
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                className="input resize-none"
                rows={3}
                placeholder="Job requirements…"
              />
            </div>
            <div>
              <label className="label">Apply URL</label>
              <input
                value={form.applyUrl}
                onChange={(e) => setForm({ ...form, applyUrl: e.target.value })}
                className="input"
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="label">Read Reward (₦)</label>
              <input
                type="number"
                step="0.01"
                value={form.readReward}
                onChange={(e) => setForm({ ...form, readReward: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Required Read Seconds</label>
              <input
                type="number"
                value={form.requiredReadSeconds}
                onChange={(e) => setForm({ ...form, requiredReadSeconds: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-dark-800 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Saving…" : editing ? "Update Job" : "Create Job"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
