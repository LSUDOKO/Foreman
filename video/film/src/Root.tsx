import React from "react";
import { Composition } from "remotion";
import { Film } from "./Film";
import { TOTAL } from "./kit";

export const Root = () => <Composition id="Foreman" component={Film} durationInFrames={Math.round(TOTAL * 60)} fps={60} width={1920} height={1080} />;
