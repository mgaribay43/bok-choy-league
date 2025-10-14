import yahooDefImagesJson from "../../data/yahooDefImages.json";

const yahooDefImages: Record<string, { hash: string; img: string; folder?: string; pxFolder?: string }> = yahooDefImagesJson;

export function getHighResPlayerImage(
  player: { position: string; team: string; headshotUrl: string },
  fallbackUrl = "https://s.yimg.com/dh/ap/default/140828/silhouette@2x.png"
) {
  if (player.position === "DEF") {
    let rawAbbr = player.team?.toUpperCase() || "FA";
    if (rawAbbr === "WAS") rawAbbr = "WSH";
    const defInfo = yahooDefImages[rawAbbr];
    if (defInfo) {
      if (defInfo.pxFolder) {
        return `https://s.yimg.com/iu/api/res/1.2/${defInfo.hash}/YXBwaWQ9eXNwb3J0cztmaT1maWxsO2g9NDMwO3E9ODA7dz02NTA-/https://s.yimg.com/cv/apiv2/default/${defInfo.folder}/${defInfo.pxFolder}/${defInfo.img}`;
      }
      const folder = defInfo.folder || "20190724";
      return `https://s.yimg.com/iu/api/res/1.2/${defInfo.hash}/YXBwaWQ9eXNwb3J0cztmaT1maWxsO2g9NDMwO3E9ODA7dz02NTA-/https://s.yimg.com/cv/apiv2/default/nfl/${folder}/500x500/${defInfo.img}`;
    }
    return fallbackUrl;
  }
  if (
    !player.headshotUrl ||
    player.headshotUrl === "/fallback-avatar.png" ||
    player.headshotUrl.includes("dh/ap/default/140828/silhouette@2x.png")
  ) {
    return fallbackUrl;
  }
  const match = typeof player.headshotUrl === "string" &&
    player.headshotUrl.match(/(https:\/\/s\.yimg\.com\/xe\/i\/us\/sp\/v\/nfl_cutout\/players_l\/[^?]+\.png)/);
  if (match) return match[1];
  return player.headshotUrl.replace(/(\.png).*$/, '$1');
}