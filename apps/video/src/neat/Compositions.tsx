import { Composition } from "remotion";
import { NeatHero } from "./Hero";

export const NeatCompositions = () => {
  return (
    <>
      <Composition
        id="NeatHero"
        component={NeatHero}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ portrait: false }}
      />
      <Composition
        id="NeatHeroPortrait"
        component={NeatHero}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ portrait: true }}
      />
    </>
  );
};
