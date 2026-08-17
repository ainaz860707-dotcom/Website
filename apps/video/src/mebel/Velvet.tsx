import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { rand, wave } from "./noise";

const NAP =
  "repeating-linear-gradient(97deg, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 5px)";
const WEFT =
  "repeating-linear-gradient(6deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 9px)";
const FOLDS =
  "radial-gradient(120% 70% at 18% 22%, rgba(96,124,168,0.30) 0%, rgba(0,0,0,0) 55%), radial-gradient(90% 60% at 78% 82%, rgba(30,46,74,0.55) 0%, rgba(0,0,0,0) 60%)";

const DROPS = Array.from({ length: 26 }, (_, i) => ({
  x: 6 + rand(i + 1) * 88,
  y: 12 + rand(i + 41) * 74,
  size: 3 + rand(i + 91) * 7,
  phase: rand(i + 131),
  drift: 6 + rand(i + 171) * 16,
}));

export const Velvet: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const sweep = -45 + (frame / durationInFrames) * 190;

  return (
    <AbsoluteFill style={{ backgroundColor: "#04060a", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `${NAP}, ${WEFT}, ${FOLDS}`,
          scale: 1 + 0.03 * (0.5 + 0.5 * wave(frame, durationInFrames)),
        }}
      />

      <AbsoluteFill
        style={{
          backgroundImage: `${NAP}, ${WEFT}`,
          filter: "blur(7px)",
          opacity: 0.9,
          maskImage:
            "radial-gradient(78% 62% at 44% 48%, rgba(0,0,0,0) 45%, rgba(0,0,0,1) 100%)",
          WebkitMaskImage:
            "radial-gradient(78% 62% at 44% 48%, rgba(0,0,0,0) 45%, rgba(0,0,0,1) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "-60%",
          left: `${sweep}%`,
          width: "42%",
          height: "220%",
          rotate: "16deg",
          filter: "blur(34px)",
          mixBlendMode: "screen",
          backgroundImage:
            "linear-gradient(90deg, rgba(255,214,170,0) 0%, rgba(255,214,170,0.20) 38%, rgba(255,246,232,0.42) 52%, rgba(255,214,170,0.16) 66%, rgba(255,214,170,0) 100%)",
        }}
      />

      {DROPS.map((drop, index) => {
        const glow = Math.exp(-Math.pow((drop.x - (sweep + 21)) / 26, 2));
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: `${drop.x}%`,
              top: `${drop.y + drop.drift * 0.06 * wave(frame, durationInFrames, drop.phase)}%`,
              width: drop.size,
              height: drop.size,
              borderRadius: "50%",
              mixBlendMode: "screen",
              filter: `blur(${0.6 + rand(index + 7) * 1.6}px)`,
              opacity: 0.14 + 0.7 * glow,
              backgroundImage:
                "radial-gradient(circle at 34% 30%, rgba(255,255,255,0.95) 0%, rgba(255,226,190,0.55) 45%, rgba(255,214,170,0) 100%)",
              boxShadow: `0 0 ${drop.size * 2.4}px rgba(255,232,205,${0.10 + 0.4 * glow})`,
            }}
          />
        );
      })}

      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(115% 88% at 42% 46%, rgba(0,0,0,0) 26%, rgba(0,0,0,0.62) 72%, rgba(0,0,0,0.92) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
