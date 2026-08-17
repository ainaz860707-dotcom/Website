import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { cycle, rand, wave } from "../mebel/noise";

const MOTES = Array.from({ length: 22 }, (_, i) => ({
  x: 3 + rand(i + 401) * 94,
  y: 10 + rand(i + 457) * 82,
  size: 0.3 + rand(i + 503) * 0.9,
  phase: rand(i + 557),
}));

export const NeatHero: React.FC<{ portrait: boolean }> = ({ portrait }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const t = frame / durationInFrames;
  const push = 1.06 + 0.05 * (1 - Math.cos(Math.PI * 2 * t)) * 0.5;
  const panX = wave(frame, durationInFrames) * (portrait ? 0.8 : 1.6);
  const panY = wave(frame, durationInFrames, 0.25) * 0.7;
  const sweep = -30 + cycle(frame, durationInFrames) * 160;

  return (
    <AbsoluteFill style={{ backgroundColor: "#e9e7e3", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `scale(${push}) translate(${panX}%, ${panY}%)`,
        }}
      >
        <Img
          src={staticFile(portrait ? "neat-hero-portrait.jpg" : "neat-hero.jpg")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(100deg, rgba(252,252,252,0.92) 0%, rgba(252,252,252,0.62) 28%, rgba(252,252,252,0.18) 52%, rgba(252,252,252,0.34) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: `${sweep}%`,
          width: portrait ? "60%" : "30%",
          height: "140%",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
          filter: "blur(40px)",
        }}
      />

      {MOTES.map((mote, index) => {
        const life = cycle(frame, durationInFrames, mote.phase);
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: `${mote.x}%`,
              top: `${mote.y - life * 8}%`,
              width: `${mote.size * (portrait ? 1.6 : 1)}%`,
              aspectRatio: "1",
              borderRadius: "50%",
              background:
                "radial-gradient(38% 34% at 34% 28%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0.05) 100%)",
              opacity: 0.75 * Math.sin(Math.PI * life),
              filter: "blur(0.6px)",
            }}
          />
        );
      })}

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(82% 74% at 50% 44%, rgba(0,0,0,0) 46%, rgba(17,17,17,0.16) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
