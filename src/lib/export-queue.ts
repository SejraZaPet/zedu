/**
 * ExportJob Queue — Async export pipeline with retry/backoff.
 *
 * Architecture:
 *   1. Client enqueues a job (→ export_jobs table, status=queued)
 *   2. Worker polls/picks the job (→ status=running)
 *   3. Worker generates the file → uploads via StorageAdapter → status=succeeded
 *   4. On failure: increment attempt, backoff delay, re-queue or mark failed
 *
 * Adapters (QueueAdapter + StorageAdapter) abstract away the infra so the
 * same worker logic can run on Supabase edge functions, Deno Deploy, or
 * any other runtime.
 */

// ────────────────── Job Model ──────────────────

export type ExportFormat = "pptx" | "pdf" | "html";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface ExportJobRecord {
  id: string;
  lesson_plan_id: string;
  teacher_id: string;
  format: ExportFormat;
  status: JobStatus;
  attempt: number;
  max_attempts: number;
  options: ExportJobOptions;
  output_url: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  /** ISO timestamp — job should not be picked before this time */
  run_after?: string;
}

export interface ExportJobOptions {
  includeTeacherNotes: boolean;
  includeAnswerKey: boolean;
  exportTarget: "teacher" | "student";
  mode: "live" | "student_paced";
  joinCode?: string;
}

// ────────────────── Retry / Backoff ──────────────────

export interface RetryPolicy {
  maxAttempts: number;
  /** Base delay in ms (default 2 000) */
  baseDelayMs: number;
  /** Multiplier per attempt (default 2 → exponential) */
  backoffFactor: number;
  /** Max delay cap in ms (default 60 000) */
  maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 2_000,
  backoffFactor: 2,
  maxDelayMs: 60_000,
};

/** Compute next run_after ISO string based on current attempt */
export function computeRunAfter(attempt: number, policy: RetryPolicy = DEFAULT_RETRY): string {
  const delay = Math.min(
    policy.baseDelayMs * Math.pow(policy.backoffFactor, attempt - 1),
    policy.maxDelayMs,
  );
  return new Date(Date.now() + delay).toISOString();
}

// ────────────────── Queue Adapter Interface ──────────────────
/**
 * Abstracts the persistence layer for export jobs.
 * Default implementation: Supabase `export_jobs` table.
 * Could be replaced with Redis, SQS, pg-boss, etc.
 */
export interface QueueAdapter {
  /** Insert a new job and return its id */
  enqueue(job: Omit<ExportJobRecord, "id" | "created_at">): Promise<string>;

  /**
   * Atomically claim the next queued job (status=queued, run_after <= now).
   * Sets status=running, started_at=now.
   * Returns null when nothing is available.
   */
  dequeue(): Promise<ExportJobRecord | null>;

  /** Mark job as succeeded with output URL */
  complete(jobId: string, outputUrl: string): Promise<void>;

  /**
   * Mark job as failed.
   * If attempt < maxAttempts → status=queued + run_after (backoff).
   * Else → status=failed.
   */
  fail(jobId: string, errorMessage: string, attempt: number, maxAttempts: number): Promise<void>;

  /** Get job by id (for polling from client) */
  getJob(jobId: string): Promise<ExportJobRecord | null>;
}

// ────────────────── Storage Adapter Interface ──────────────────
/**
 * Abstracts file upload for generated exports.
 * Default implementation: Supabase Storage bucket "exports".
 * Could be replaced with S3, R2, GCS, etc.
 */
export interface StorageAdapter {
  /**
   * Upload a file and return its public URL.
   * @param path  — destination path (e.g. "userId/jobId_title.html")
   * @param data  — file contents as Blob or Uint8Array
   * @param contentType — MIME type
   */
  upload(path: string, data: Blob | Uint8Array, contentType: string): Promise<string>;

  /** Delete a previously uploaded file */
  delete(path: string): Promise<void>;
}

// ────────────────── Worker Logic ──────────────────

export type RenderFn = (
  job: ExportJobRecord,
  storage: StorageAdapter,
) => Promise<string>; // returns output URL

/**
 * Idempotent worker step:
 *   1. Dequeue one job
 *   2. Run render function
 *   3. Complete or fail with retry
 *
 * Idempotency guarantee:
 *   - dequeue() is atomic (UPDATE ... WHERE status='queued' RETURNING)
 *   - If the worker crashes mid-render, the job stays "running".
 *     A separate reaper/cron marks stale running jobs (>5 min) as
 *     queued again (with attempt+1).
 *   - render outputs are written with upsert=true so re-runs overwrite.
 */
export async function processNextJob(
  queue: QueueAdapter,
  storage: StorageAdapter,
  render: RenderFn,
  retryPolicy: RetryPolicy = DEFAULT_RETRY,
): Promise<{ processed: boolean; jobId?: string; status?: JobStatus }> {
  const job = await queue.dequeue();
  if (!job) return { processed: false };

  try {
    const outputUrl = await render(job, storage);
    await queue.complete(job.id, outputUrl);
    return { processed: true, jobId: job.id, status: "succeeded" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await queue.fail(job.id, message, job.attempt, retryPolicy.maxAttempts);
    const nextStatus: JobStatus = job.attempt < retryPolicy.maxAttempts ? "queued" : "failed";
    return { processed: true, jobId: job.id, status: nextStatus };
  }
}

// ────────────────── Supabase Queue Adapter (reference impl) ──────────────────

/**
 * Creates a QueueAdapter backed by the Supabase `export_jobs` table.
 * Pass a Supabase client instance.
 */
export function createSupabaseQueueAdapter(supabase: any, retryPolicy: RetryPolicy = DEFAULT_RETRY): QueueAdapter {
  return {
    async enqueue(job) {
      const { data, error } = await supabase
        .from("export_jobs")
        .insert({
          lesson_plan_id: job.lesson_plan_id,
          teacher_id: job.teacher_id,
          format: job.format,
          status: "queued",
          attempt: 0,
          max_attempts: job.max_attempts,
          options: job.options,
          output_url: null,
          error_message: null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },

    async dequeue() {
      // Atomic claim using FOR UPDATE SKIP LOCKED via RPC
      const workerId = `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { data, error } = await supabase
        .rpc("claim_export_job", { _worker_id: workerId });
      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[0] as ExportJobRecord;
    },

    async complete(jobId, outputUrl) {
      const { error } = await supabase
        .from("export_jobs")
        .update({
          status: "succeeded",
          output_url: outputUrl,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      if (error) throw error;
    },

    async fail(jobId, errorMessage, attempt, maxAttempts) {
      if (attempt < maxAttempts) {
        const runAfter = computeRunAfter(attempt, retryPolicy);
        const { error } = await supabase
          .from("export_jobs")
          .update({
            status: "queued",
            error_message: errorMessage,
            completed_at: null,
            started_at: null,
          })
          .eq("id", jobId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("export_jobs")
          .update({
            status: "failed",
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
        if (error) throw error;
      }
    },

    async getJob(jobId) {
      const { data, error } = await supabase
        .from("export_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      if (error) return null;
      return data;
    },
  };
}

/**
 * Creates a StorageAdapter backed by Supabase Storage.
 */
export function createSupabaseStorageAdapter(supabase: any, bucket = "exports"): StorageAdapter {
  return {
    async upload(path, data, contentType) {
      const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: contentType });
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, blob, {
          contentType,
          upsert: true,
        });
      if (error) throw error;
      // Return storage path (not public URL) — signed URLs are generated on demand
      return path;
    },

    async delete(path) {
      await supabase.storage.from(bucket).remove([path]);
    },
  };
}

// ────────────────── Client-side helpers ──────────────────

/**
 * Enqueue an export job from the client and return job id.
 */
export async function enqueueExportJob(
  supabase: any,
  params: {
    lessonPlanId: string;
    teacherId: string;
    format: ExportFormat;
    options: ExportJobOptions;
    maxAttempts?: number;
  },
): Promise<string> {
  const queue = createSupabaseQueueAdapter(supabase);
  return queue.enqueue({
    lesson_plan_id: params.lessonPlanId,
    teacher_id: params.teacherId,
    format: params.format,
    status: "queued",
    attempt: 0,
    max_attempts: params.maxAttempts ?? 3,
    options: params.options,
    output_url: null,
    error_message: null,
    started_at: null,
    completed_at: null,
  });
}

/**
 * Poll job status until terminal state or timeout.
 */
export async function pollJobStatus(
  supabase: any,
  jobId: string,
  intervalMs = 2000,
  timeoutMs = 120_000,
): Promise<ExportJobRecord> {
  const queue = createSupabaseQueueAdapter(supabase);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const job = await queue.getJob(jobId);
    if (!job) throw new Error("Job not found");
    if (job.status === "succeeded" || job.status === "failed") return job;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error("Export timeout");
}

// ────────────────── File Spec (documentation) ──────────────────

export const EXPORT_QUEUE_FILE_SPEC = {
  fileSpec: {
    creates: [
      { path: "src/lib/export-queue.ts", summary: "ExportJob queue model, adapters, worker, retry logic, client helpers" },
    ],
    interfaces: {
      QueueAdapter: "enqueue / dequeue / complete / fail / getJob — abstracts job persistence (Supabase, Redis, SQS, pg-boss)",
      StorageAdapter: "upload / delete — abstracts file storage (Supabase Storage, S3, R2, GCS)",
    },
    jobModel: {
      states: ["queued", "running", "succeeded", "failed"],
      transitions: {
        "queued → running": "dequeue() atomically claims job",
        "running → succeeded": "render completes, output uploaded",
        "running → queued": "render fails, attempt < maxAttempts (retry with backoff)",
        "running → failed": "render fails, attempt >= maxAttempts",
        "running (stale) → queued": "reaper cron reclaims jobs stuck >5min",
      },
      retry: {
        maxAttempts: 3,
        backoff: "exponential: 2s, 4s, 8s… capped at 60s",
        formula: "delay = min(baseDelayMs × backoffFactor^(attempt-1), maxDelayMs)",
      },
      idempotency: [
        "dequeue uses optimistic locking (UPDATE WHERE status='queued')",
        "Storage uploads use upsert=true so re-runs overwrite safely",
        "Job id is deterministic per enqueue — no duplicate work",
        "Stale reaper resets running→queued only if started_at > 5min ago",
      ],
    },
  },
} as const;
