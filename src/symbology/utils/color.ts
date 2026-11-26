const hexToRgb = (hex: string): [number, number, number] => {
  const colorNumber = parseInt(hex.slice(1), 16);
  return [(colorNumber >> 16) & 255, (colorNumber >> 8) & 255, colorNumber & 255];
};

const rgbToHex = (rgb: number[]) =>
  "#" + rgb.map((channelValue) => Math.round(channelValue).toString(16).padStart(2, "0")).join("");

/** The color halfway between two `#rrggbb` colors. */
export const midColor = (firstHex: string, secondHex: string) => {
  const [firstRgb, secondRgb] = [hexToRgb(firstHex), hexToRgb(secondHex)];
  return rgbToHex(firstRgb.map((channelValue, index) => (channelValue + secondRgb[index]) / 2));
};
