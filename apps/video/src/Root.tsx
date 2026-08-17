import "./index.css";
import { MyComposition } from "./Composition";
import { MebelCompositions } from "./mebel/Compositions";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <MebelCompositions />
    </>
  );
};
