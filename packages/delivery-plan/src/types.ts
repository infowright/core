/**
 * Information delivery plan, as described in ISO 19650-2.
 * A TIDP is one task team's plan. A MIDP is the combination of all TIDPs on a project.
 * Both use the same structure.
 */
export interface DeliveryPlan {
  milestones: Milestone[];
  deliverables: Deliverable[];
}

/** A point in the project when information must be delivered, e.g. a stage gate. */
export interface Milestone {
  id: string;
  name: string;
  /** Planned date, YYYY-MM-DD. */
  date: string;
}

/** One planned information container. */
export interface Deliverable {
  id: string;
  title: string;
  /** Code of the task team (organisation) delivering it. */
  taskTeam: string;
  /** Planned container name. Can be empty until a number is allocated. */
  containerName?: string;
  /** Person or role responsible for producing it. */
  author?: string;
  /** Ids of deliverables that must be available first. */
  predecessors?: string[];
  /** What must be delivered at each milestone. At least one. */
  issues: PlannedIssue[];
}

/** What a deliverable must look like at a given milestone. */
export interface PlannedIssue {
  milestoneId: string;
  /** Target status code, e.g. S2 or A1. */
  status: string;
  /** Level of information need, as text or a reference to a LOIN specification. */
  loin?: string;
  /** Specific due date, YYYY-MM-DD. When empty, the milestone date applies. */
  due?: string;
  /** Linked programme activity, e.g. a Primavera P6 activity ID. */
  activityId?: string;
}
