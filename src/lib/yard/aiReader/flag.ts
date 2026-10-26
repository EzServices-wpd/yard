/** The AI reader's browser flag, fixed at build time (vite define): exactly "on" from YARD_AI_READER=on, else "". Turning it on needs a redeploy. */
export const readerBuildFlag = (v: string | undefined) => (v === "on" ? "on" : "");
