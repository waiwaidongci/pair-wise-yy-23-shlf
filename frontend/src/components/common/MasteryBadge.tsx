import { MasteryLevelText } from "../../constants/MasteryLevel";
import type { MasteryLevel } from "../../types/MasteryLevel";

// 掌握等级徽标：NEW / LEARNING / FAMILIAR / MASTERED
export function MasteryBadge({ level }: { level: MasteryLevel }) {
  return <span className={"badge mastery-" + level.toLowerCase()}>{MasteryLevelText[level]}</span>;
}
