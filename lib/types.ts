export type Grade = 3 | 4 | 5;
export type CuttingMethod = "manual" | "cutter";

export type FormInputs = {
  kit: "ball-shooter";
  grade: Grade;
  classSize: number;
  lessonLength: number;
  sessions: number;
  cuttingMethod: CuttingMethod;
  specialNotes: string;
};

export type StageKey = "lessonPlan" | "differentiation" | "parentLetter";
export type StageStatus = "idle" | "queued" | "generating" | "complete" | "error";

export type GenerationEvent =
  | { type: "status"; stage: StageKey; status: StageStatus }
  | { type: "result"; stage: StageKey; content: string }
  | { type: "error"; stage: StageKey; message: string }
  | { type: "done" };
