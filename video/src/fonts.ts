import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: antonFamily } = loadAnton();
const { fontFamily: interFamily } = loadInter();

export const antonFontFamily = antonFamily;
export const interFontFamily = interFamily;
