import "./index.css";
import { MyComposition } from "./Composition";
import { MebelCompositions } from "./mebel/Compositions";
import { NeatCompositions } from "./neat/Compositions";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <MebelCompositions />
      <NeatCompositions />
    </>
  );
};
