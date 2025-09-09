export function getDisplayManagerName(name: string) {
  if (name === "Jacob") return "Harris";
  if (name === "jake.hughes275") return "Hughes";
  if (name === "johnny5david") return "Johnny";
  if (name === "Zachary") return "Zach";
  if (name === "Michael") return "Mike";
  if (name === "tanner") return "Tanner";
  return name;
}

export function getInternalManagerName(displayName: string) {
  if (displayName === "Harris") return "Jacob";
  if (displayName === "Hughes") return "jake.hughes275";
  if (displayName === "Johnny") return "johnny5david";
  if (displayName === "Zach") return "Zachary";
  if (displayName === "Mike") return "Michael";
  if (displayName === "Tanner") return "tanner";
  return displayName;
}