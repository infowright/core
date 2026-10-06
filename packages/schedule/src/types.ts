/** A project programme, reduced to what information delivery needs. */
export interface Schedule {
  activities: Activity[];
}

export interface Activity {
  /** Activity ID as used in the programme, e.g. a Primavera P6 Activity ID. */
  id: string;
  name: string;
  /** YYYY-MM-DD */
  start?: string;
  /** YYYY-MM-DD */
  finish?: string;
  /** True when the start date is an actual, not a forecast. */
  startActual: boolean;
  /** True when the finish date is an actual, not a forecast. */
  finishActual: boolean;
}
