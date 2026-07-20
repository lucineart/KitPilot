"use client";

import { useEffect, useMemo, useState } from "react";

import { CheckIcon, ChevronIcon, CopyIcon, DownloadIcon, SparkIcon } from "@/components/Icons";
import { MarkdownDocument } from "@/components/MarkdownDocument";
import type {
  FormInputs,
  GenerationEvent,
  StageKey,
  StageStatus,
} from "@/lib/types";

const tabs: Array<{ key: StageKey; label: string }> = [
  { key: "lessonPlan", label: "Lesson Plan" },
  { key: "differentiation", label: "3 Tiers" },
  { key: "parentLetter", label: "Parent Letter" },
];

const initialForm: FormInputs = {
  kit: "ball-shooter",
  grade: 4,
  classSize: 24,
  lessonLength: 45,
  sessions: 2,
  cuttingMethod: "cutter",
  specialNotes: "",
};

const initialStatuses: Record<StageKey, StageStatus> = {
  lessonPlan: "idle",
  differentiation: "idle",
  parentLetter: "idle",
};

const initialOutputs: Record<StageKey, string> = {
  lessonPlan: "",
  differentiation: "",
  parentLetter: "",
};

function SegmentControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          className="segmented-option"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FormSection({
  number,
  label,
  hint,
  children,
}: {
  number: number;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="form-section">
      <legend className="form-label">
        <span className="form-number">{number}</span>
        <span>{label}</span>
        {hint ? <span className="form-hint">{hint}</span> : null}
      </legend>
      {children}
    </fieldset>
  );
}

function LoadingDocument({ status, label }: { status: StageStatus; label: string }) {
  const message =
    status === "queued"
      ? `${label} is next in the generation queue.`
      : `KitPilot is writing your ${label.toLowerCase()}.`;

  return (
    <div className="loading-document" role="status" aria-live="polite">
      <div className="loading-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2>{status === "queued" ? "Queued" : "Building your classroom pack"}</h2>
      <p>{message}</p>
      <div className="skeleton-lines" aria-hidden="true">
        <span className="skeleton-title" />
        <span />
        <span />
        <span className="skeleton-short" />
      </div>
    </div>
  );
}

function EmptyDocument() {
  return (
    <div className="empty-document">
      <div className="empty-grid" aria-hidden="true">
        {Array.from({ length: 16 }, (_, index) => <span key={index} />)}
      </div>
      <div className="empty-corner empty-corner-top" aria-hidden="true" />
      <div className="empty-corner empty-corner-bottom" aria-hidden="true" />
      <h2>Your classroom pack starts here.</h2>
      <p>
        Add your class details, then KitPilot will build all three documents in order—grounded in the official Ball Shooter Kit.
      </p>
      <ol className="empty-steps">
        <li><span>1</span>Localized lesson plan</li>
        <li><span>2</span>Three task-structure tiers</li>
        <li><span>3</span>Family-ready parent letter</li>
      </ol>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function ProgressRail({
  statuses,
  elapsedSeconds,
  showElapsed,
}: {
  statuses: Record<StageKey, StageStatus>;
  elapsedSeconds: number;
  showElapsed: boolean;
}) {
  return (
    <div className="progress-region">
      {showElapsed ? (
        <div className="elapsed-time" aria-live="polite">
          <span>Elapsed time</span>
          <strong>{formatElapsed(elapsedSeconds)}</strong>
        </div>
      ) : null}
      <div className="progress-rail" aria-label="Generation progress">
        {tabs.map((tab, index) => {
          const status = statuses[tab.key];
          const complete = status === "complete";
          const active = status === "generating";
          return (
            <div className="progress-step" key={tab.key} data-state={status}>
              <span className="progress-dot">
                {complete ? <CheckIcon className="size-4" /> : index + 1}
              </span>
              <span>{tab.label}</span>
              {active ? <span className="sr-only">generating</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KitPilotApp() {
  const [form, setForm] = useState<FormInputs>(initialForm);
  const [activeTab, setActiveTab] = useState<StageKey>("lessonPlan");
  const [statuses, setStatuses] = useState(initialStatuses);
  const [outputs, setOutputs] = useState(initialOutputs);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const activeDefinition = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const activeContent = outputs[activeTab];
  const activeStatus = statuses[activeTab];
  const isGenerating = useMemo(
    () => Object.values(statuses).some((status) => status === "generating" || status === "queued"),
    [statuses],
  );

  useEffect(() => {
    if (!isGenerating || generationStartedAt === null) return;
    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - generationStartedAt) / 1000)));
    };
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [generationStartedAt, isGenerating]);

  const updateForm = <K extends keyof FormInputs>(key: K, value: FormInputs[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const applyEvent = (event: GenerationEvent) => {
    if (event.type === "status") {
      setStatuses((current) => ({ ...current, [event.stage]: event.status }));
      return;
    }

    if (event.type === "result") {
      setOutputs((current) => ({ ...current, [event.stage]: event.content }));
      setStatuses((current) => ({ ...current, [event.stage]: "complete" }));
      return;
    }

    if (event.type === "error") {
      setStatuses((current) => {
        const next = { ...current };
        (Object.keys(next) as StageKey[]).forEach((key) => {
          if (next[key] !== "complete") next[key] = "error";
        });
        return next;
      });
      setError(event.message);
    }
  };

  const generatePack = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setCopied(false);
    setActiveTab("lessonPlan");
    setOutputs(initialOutputs);
    setStatuses({ lessonPlan: "generating", differentiation: "queued", parentLetter: "queued" });
    setGenerationStartedAt(Date.now());
    setElapsedSeconds(0);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "KitPilot could not start generation.");
      }

      if (!response.body) throw new Error("The generation stream was unavailable.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          applyEvent(JSON.parse(line) as GenerationEvent);
        }

        if (done) break;
      }

      if (buffer.trim()) applyEvent(JSON.parse(buffer) as GenerationEvent);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "KitPilot could not finish generation.";
      setError(message);
      setStatuses((current) => {
        const next = { ...current };
        (Object.keys(next) as StageKey[]).forEach((key) => {
          if (next[key] !== "complete") next[key] = "error";
        });
        return next;
      });
    }
  };

  const copyActive = async () => {
    if (!activeContent) return;
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy was blocked by the browser. Use Download .pdf instead.");
    }
  };

  const downloadActive = () => {
    if (!activeContent) return;
    const downloadForm = document.createElement("form");
    downloadForm.method = "POST";
    downloadForm.action = "/api/download";
    downloadForm.hidden = true;

    const documentKey = document.createElement("input");
    documentKey.type = "hidden";
    documentKey.name = "documentKey";
    documentKey.value = activeDefinition.key;

    const kit = document.createElement("input");
    kit.type = "hidden";
    kit.name = "kit";
    kit.value = form.kit;

    const grade = document.createElement("input");
    grade.type = "hidden";
    grade.name = "grade";
    grade.value = String(form.grade);

    const content = document.createElement("textarea");
    content.name = "content";
    content.value = activeContent;

    downloadForm.append(documentKey, kit, grade, content);
    document.body.appendChild(downloadForm);
    downloadForm.submit();
    downloadForm.remove();
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-grid" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => <span key={index} />)}
          </span>
          <span className="brand-name">KitPilot</span>
        </div>
        <p className="brand-tagline">From kit to classroom in 5 minutes</p>
      </header>

      <div className="workspace">
        <aside className="form-rail">
          <form onSubmit={generatePack}>
            <FormSection number={1} label="Kit selection">
              <div className="kit-selector-field">
                <div className="select-wrap">
                  <select
                    value={form.kit}
                    onChange={(event) => updateForm("kit", event.target.value as FormInputs["kit"])}
                    aria-label="Kit selection"
                  >
                    <option value="ball-shooter">Ball Shooter Kit (Grades 3–5)</option>
                    <option disabled>Hydraulic Device — Lift Castle — coming soon</option>
                    <option disabled>Light &amp; Shadow Projector — coming soon</option>
                    <option disabled>Spinning Garden — coming soon</option>
                    <option disabled>Air Action Box — coming soon</option>
                  </select>
                  <ChevronIcon className="select-icon" />
                </div>
                <span className="kit-ready-chip">Ready</span>
              </div>
            </FormSection>

            <FormSection number={2} label="Grade">
              <SegmentControl
                label="Grade"
                value={form.grade}
                options={[3, 4, 5].map((value) => ({ value: value as FormInputs["grade"], label: String(value) }))}
                onChange={(value) => updateForm("grade", value)}
              />
            </FormSection>

            <FormSection number={3} label="Class size">
              <input
                className="text-input"
                type="number"
                aria-label="Class size"
                min={1}
                max={80}
                step={1}
                required
                value={form.classSize}
                onChange={(event) => updateForm("classSize", Number(event.target.value))}
              />
            </FormSection>

            <FormSection number={4} label="Lesson length" hint="minutes">
              <input
                className="text-input"
                type="number"
                aria-label="Lesson length in minutes"
                min={20}
                max={120}
                step={5}
                required
                value={form.lessonLength}
                onChange={(event) => updateForm("lessonLength", Number(event.target.value))}
              />
            </FormSection>

            <FormSection number={5} label="Number of sessions">
              <input
                className="text-input"
                type="number"
                aria-label="Number of sessions"
                min={1}
                max={4}
                step={1}
                required
                value={form.sessions}
                onChange={(event) => updateForm("sessions", Number(event.target.value))}
              />
            </FormSection>

            <FormSection number={6} label="Cutting method">
              <SegmentControl
                label="Cutting method"
                value={form.cuttingMethod}
                options={[
                  { value: "manual", label: "Manual" },
                  { value: "cutter", label: "BeaverBot cutting machine" },
                ]}
                onChange={(value) => updateForm("cuttingMethod", value)}
              />
            </FormSection>

            <FormSection number={7} label="Special notes" hint="optional">
              <textarea
                className="text-input notes-input"
                value={form.specialNotes}
                maxLength={1200}
                placeholder="Support needs, classroom setup, or pacing notes…"
                onChange={(event) => updateForm("specialNotes", event.target.value)}
              />
            </FormSection>

            <button className="generate-button" type="submit" disabled={isGenerating}>
              <SparkIcon className="size-6" />
              <span>{isGenerating ? "Building your classroom pack…" : "Generate my classroom pack"}</span>
            </button>

            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <ProgressRail
              statuses={statuses}
              elapsedSeconds={elapsedSeconds}
              showElapsed={isGenerating}
            />
          </form>
        </aside>

        <section className="output-workspace" aria-label="Generated classroom pack">
          <div className="output-toolbar">
            <div className="tabs" role="tablist" aria-label="Classroom pack documents">
              {tabs.map((tab) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className="tab-button"
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setCopied(false);
                  }}
                >
                  {tab.label}
                  {statuses[tab.key] === "generating" ? <span className="tab-spinner" aria-label="generating" /> : null}
                  {statuses[tab.key] === "complete" ? <span className="tab-ready" aria-label="ready"><CheckIcon /></span> : null}
                </button>
              ))}
            </div>

            <div className="document-actions">
              <button type="button" onClick={copyActive} disabled={!activeContent}>
                <CopyIcon />
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <button type="button" onClick={downloadActive} disabled={!activeContent}>
                <DownloadIcon />
                <span>Download .pdf</span>
              </button>
            </div>
          </div>

          <div className="document-scroll" role="tabpanel">
            <div className="document-sheet">
              <div className="paper-corner paper-corner-left" aria-hidden="true" />
              <div className="paper-corner paper-corner-right" aria-hidden="true" />
              {activeContent ? (
                <MarkdownDocument content={activeContent} />
              ) : activeStatus === "generating" || activeStatus === "queued" ? (
                <LoadingDocument status={activeStatus} label={activeDefinition.label} />
              ) : activeStatus === "error" ? (
                <div className="empty-document error-document">
                  <h2>This document wasn’t generated.</h2>
                  <p>{error || "Check your connection and try generating the pack again."}</p>
                </div>
              ) : (
                <EmptyDocument />
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
