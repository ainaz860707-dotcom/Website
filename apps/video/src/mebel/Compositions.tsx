import { Composition } from "remotion";
import { Foam } from "./Foam";
import { Velvet } from "./Velvet";

export const MebelCompositions = () => {
  return (
    <>
      <Composition
        id="MebelVelvet"
        component={Velvet}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="MebelFoam"
        component={Foam}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
