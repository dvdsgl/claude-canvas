// Edit Scenario - Interactive calendar with full CRUD operations

import type { ScenarioDefinition } from "../types";
import type { EditCalendarConfig } from "../../canvases/calendar/types";
import { getDefaultStoragePath } from "../../canvases/calendar/utils/event-storage";

export interface EditCalendarResult {
  action: "created" | "updated" | "deleted";
  eventId: string;
}

export const editScenario: ScenarioDefinition<EditCalendarConfig, EditCalendarResult> = {
  name: "edit",
  description: "Interactive calendar with full CRUD operations",
  canvasKind: "calendar",
  interactionMode: "selection",
  closeOn: "escape",
  defaultConfig: {
    startHour: 6,
    endHour: 22,
    storageFile: getDefaultStoragePath(),
  },
};
