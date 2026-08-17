import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { cycle, rand, wave } from "./noise";

const PILE =
  "repeating-linear-gradient(84deg, rgba(197,222,255,0.07) 0px, rgba(197,222,255,0.07) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 4px)";
const CROSS =
  "repeating-linear-gradient(172deg, rgba(160,196,245,0.045) 0px, rgba(160,196,245,0.045) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 8px)";
const RAKE =
  "linear-gradient(102deg, rgba(122,166,224,0.34) 0%, rgba(40,70,116,0.16) 34%, rgba(0,0,0,0) 62%)";

const BLOB_COUNT = 11;

const BLOBS = Array.from({ length: BLOB_COUNT }, (_, i) => ({
  x: 6 + ((i + rand(i + 3)) / BLOB_COUNT) * 88,
  y: 14 + rand(i + 53) * 70,
  size: 260 + rand(i + 103) * 460,
  squash: 0.5 + rand(i + 143) * 0.4,
  tilt: -40 + rand(i + 183) * 80,
  phase: (i * 0.618) % 1,
}));

const BUBBLES = Array.from({ length: 34 }, (_, i) => ({
  x: 4 + rand(i + 11) * 92,
  y: 8 + rand(i + 61) * 84,
  size: 2 + rand(i + 111) * 5,
  phase: rand(i + 161),
}));

export const Foam: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#03060b", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `${PILE}, ${CROSS}, ${RAKE}`,
          scale: 1.02 + 0.035 * (0.5 + 0.5 * wave(frame, durationInFrames)),
        }}
      />

      <AbsoluteFill
        style={{
          backgroundImage: `${PILE}, ${CROSS}`,
          filter: "blur(6px)",
          opacity: 0.85,
          maskImage:
            "radial-gradient(72% 58% at 52% 52%, rgba(0,0,0,0) 40%, rgba(0,0,0,1) 100%)",
          WebkitMaskImage:
            "radial-gradient(72% 58% at 52% 52%, rgba(0,0,0,0) 40%, rgba(0,0,0,1) 100%)",
        }}
      />

      {BLOBS.map((blob, index) => {
        const life = cycle(frame, durationInFrames, blob.phase);
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: `${blob.x}%`,
              top: `${blob.y + 4 * life}%`,
              width: blob.size,
              height: blob.size * blob.squash,
              marginLeft: -blob.size / 2,
              marginTop: (-blob.size * blob.squash) / 2,
              borderRadius: "50%",
              rotate: `${blob.tilt}deg`,
              mixBlendMode: "screen",
              filter: `blur(${24 + rand(index + 5) * 26}px)`,
              scale: 0.5 + life * 0.95,
              opacity: 0.46 * Math.sin(Math.PI * life) ** 1.5,
              backgroundImage:
                "radial-gradient(circle at 46% 40%, rgba(255,255,255,0.92) 0%, rgba(214,236,255,0.44) 42%, rgba(150,196,246,0.12) 68%, rgba(0,0,0,0) 100%)",
            }}
          />
        );
      })}

      {BUBBLES.map((bubble, index) => {
        const life = cycle(frame, durationInFrames, bubble.phase);
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: `${bubble.x}%`,
              top: `${bubble.y - 3 * life}%`,
              width: bubble.size,
              height: bubble.size,
              borderRadius: "50%",
              mixBlendMode: "screen",
              filter: "blur(0.7px)",
              opacity: 0.5 * Math.sin(Math.PI * life),
              backgroundColor: "rgba(236,247,255,0.9)",
              boxShadow: `0 0 ${bubble.size * 3}px rgba(196,226,255,0.45)`,
            }}
          />
        );
      })}

      <AbsoluteFill
        style={{
          backgroundImage: `${PILE}, ${CROSS}`,
          mixBlendMode: "overlay",
          opacity: 0.7,
        }}
      />

      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(118% 90% at 50% 48%, rgba(0,0,0,0) 24%, rgba(0,0,0,0.58) 70%, rgba(0,0,0,0.94) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
