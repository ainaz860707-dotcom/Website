import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { cycle, rand, wave } from "../mebel/noise";

const WEAVE =
  "repeating-linear-gradient(96deg, rgba(17,17,17,0.10) 0px, rgba(17,17,17,0) 7px, rgba(17,17,17,0.10) 15px)";
const WEFT =
  "repeating-linear-gradient(5deg, rgba(17,17,17,0.05) 0px, rgba(17,17,17,0) 11px, rgba(17,17,17,0.05) 23px)";
const FOLDS =
  "radial-gradient(110% 68% at 18% 14%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 54%), radial-gradient(92% 60% at 78% 88%, rgba(17,17,17,0.22) 0%, rgba(0,0,0,0) 60%), radial-gradient(70% 50% at 62% 30%, rgba(17,17,17,0.10) 0%, rgba(0,0,0,0) 70%)";

const BUBBLES = Array.from({ length: 40 }, (_, i) => ({
  spread: -16 + rand(i + 3) * 32,
  base: 6 + rand(i + 53) * 26,
  size: 0.7 + rand(i + 97) * 2.6,
  phase: rand(i + 151),
  rise: 10 + rand(i + 199) * 22,
  drift: -7 + rand(i + 251) * 14,
}));

const MOTES = Array.from({ length: 16 }, (_, i) => ({
  x: 3 + rand(i + 401) * 94,
  y: 8 + rand(i + 457) * 84,
  size: 0.4 + rand(i + 503) * 1.1,
  phase: rand(i + 557),
}));

export const NeatHero: React.FC<{ portrait: boolean }> = ({ portrait }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const swing = wave(frame, durationInFrames);
  const headX = 56 + swing * (portrait ? 18 : 26);
  const headY = portrait ? 44 : 40;
  const headW = portrait ? 30 : 15;
  const headH = portrait ? 22 : 30;
  const breathe = 1.03 + 0.025 * wave(frame, durationInFrames, 0.25);
  const tilt = swing * 4;

  return (
    <AbsoluteFill style={{ backgroundColor: "#eceae6", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `${WEAVE}, ${WEFT}, ${FOLDS}`,
          filter: "blur(1.4px)",
          transform: `scale(${breathe}) translateX(${swing * 1.1}%)`,
        }}
      />

      <AbsoluteFill
        style={{
          backgroundImage: `${WEAVE}, ${WEFT}`,
          filter: "blur(7px)",
          opacity: 0.9,
          maskImage:
            "radial-gradient(70% 56% at 52% 44%, rgba(0,0,0,0) 38%, rgba(0,0,0,1) 100%)",
          WebkitMaskImage:
            "radial-gradient(70% 56% at 52% 44%, rgba(0,0,0,0) 38%, rgba(0,0,0,1) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: `${headX - (portrait ? 26 : 22)}%`,
          width: portrait ? "34%" : "22%",
          height: "120%",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 55%, rgba(255,255,255,0.85) 100%)",
          filter: "blur(30px)",
        }}
      />

      {MOTES.map((mote, index) => {
        const t = cycle(frame, durationInFrames, mote.phase);
        return (
          <div
            key={`mote-${index}`}
            style={{
              position: "absolute",
              left: `${mote.x}%`,
              top: `${mote.y - t * 6}%`,
              width: `${mote.size}%`,
              aspectRatio: "1",
              borderRadius: "50%",
              background: "rgba(17,17,17,0.20)",
              opacity: 0.5 * Math.sin(Math.PI * t),
              filter: "blur(2px)",
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          left: `${headX}%`,
          top: `${headY + headH - 4}%`,
          width: `${headW * 1.7}%`,
          height: portrait ? "10%" : "13%",
          transform: "translateX(-50%)",
          borderRadius: "50%",
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(17,17,17,0.26) 0%, rgba(17,17,17,0) 70%)",
          filter: "blur(14px)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: `${headX + swing * 1.5}%`,
          top: "-30%",
          width: portrait ? "9%" : "4.4%",
          height: `${headY + 34}%`,
          transform: `translateX(-50%) rotate(${tilt * 0.6}deg)`,
          transformOrigin: "50% 100%",
          borderRadius: "999px",
          background:
            "linear-gradient(90deg, rgba(17,17,17,0.40) 0%, rgba(17,17,17,0.16) 34%, rgba(255,255,255,0.35) 52%, rgba(17,17,17,0.22) 78%, rgba(17,17,17,0.44) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: `${headX}%`,
          top: `${headY}%`,
          width: `${headW}%`,
          height: `${headH}%`,
          transform: `translateX(-50%) rotate(${tilt}deg)`,
          transformOrigin: "50% 20%",
          clipPath: "polygon(22% 0%, 78% 0%, 100% 82%, 100% 100%, 0% 100%, 0% 82%)",
          background:
            "linear-gradient(104deg, rgba(17,17,17,0.52) 0%, rgba(17,17,17,0.30) 30%, rgba(255,255,255,0.42) 50%, rgba(17,17,17,0.26) 70%, rgba(17,17,17,0.50) 100%)",
          boxShadow: "0 30px 60px rgba(17,17,17,0.18)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "26% 16% 22% 16%",
            borderRadius: "8px",
            background:
              "linear-gradient(120deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.18) 46%, rgba(255,255,255,0.50) 100%)",
            border: "1px solid rgba(255,255,255,0.45)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "8%",
            right: "8%",
            bottom: "6%",
            height: "9%",
            borderRadius: "999px",
            background: "rgba(17,17,17,0.62)",
          }}
        />
      </div>

      {BUBBLES.map((bubble, index) => {
        const t = cycle(frame, durationInFrames, bubble.phase);
        const envelope = Math.sin(Math.PI * t);
        const size = bubble.size * (portrait ? 1.6 : 1);
        return (
          <div
            key={`bubble-${index}`}
            style={{
              position: "absolute",
              left: `${headX + bubble.spread + bubble.drift * t}%`,
              top: `${headY + headH + bubble.base - bubble.rise * t}%`,
              width: `${size}%`,
              aspectRatio: "1",
              borderRadius: "50%",
              opacity: 0.2 + envelope * 0.7,
              background:
                "radial-gradient(38% 34% at 34% 28%, rgba(255,255,255,1) 0%, rgba(255,255,255,0.62) 46%, rgba(255,255,255,0.10) 100%)",
              boxShadow:
                "inset 0 0 0 1px rgba(255,255,255,0.75), 0 2px 6px rgba(17,17,17,0.10)",
              filter: `blur(${0.3 + (1 - envelope) * 1.5}px)`,
            }}
          />
        );
      })}

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(78% 70% at 48% 42%, rgba(0,0,0,0) 44%, rgba(17,17,17,0.20) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
