import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'

const VIDEOS = [
  {
    label: 'Лавандовый вечер',
    src: 'https://jovxgdctpqexoiwfspue.supabase.co/storage/v1/object/sign/asset-media/e5203bb9-b667-4917-a990-55fe7c79cebe/25f8d1c02b4e-hf_20260702_081127_0992a171-d3c6-4978-8213-0ec5df8b6d63.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iMjk0Y2Y1ZS01ODRhLTQ5ODItOGY3MS04NGQzZDAwMzJiNzgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldC1tZWRpYS9lNTIwM2JiOS1iNjY3LTQ5MTctYTk5MC01NWZlN2M3OWNlYmUvMjVmOGQxYzAyYjRlLWhmXzIwMjYwNzAyXzA4MTEyN18wOTkyYTE3MS1kM2M2LTQ5NzgtODIxMy0wZWM1ZGY4YjZkNjMubXA0Iiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4NjA5NTU3MCwiZXhwIjoyMTAxNDU1NTcwfQ.dSDgVD9AG4-9J68zQ6w3pB8es4-L-Q1QDrN_zuzU3Zo',
  },
  {
    label: 'Осеннее озеро',
    src: 'https://jovxgdctpqexoiwfspue.supabase.co/storage/v1/object/sign/asset-media/e5203bb9-b667-4917-a990-55fe7c79cebe/0fc5e45d6f32-hf_20260702_092026_dd05b805-ea0f-40b2-8c52-332b88502592.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iMjk0Y2Y1ZS01ODRhLTQ5ODItOGY3MS04NGQzZDAwMzJiNzgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldC1tZWRpYS9lNTIwM2JiOS1iNjY3LTQ5MTctYTk5MC01NWZlN2M3OWNlYmUvMGZjNWU0NWQ2ZjMyLWhmXzIwMjYwNzAyXzA5MjAyNl9kZDA1YjgwNS1lYTBmLTQwYjItOGM1Mi0zMzJiODg1MDI1OTIubXA0Iiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4NjA5NTU3NCwiZXhwIjoyMTAxNDU1NTc0fQ.vjP-TrsLHq7PT1s9wq1M0FZnKbXBjt1Lkr2ZvMYDkTQ',
  },
  {
    label: 'Зимняя тишина',
    src: 'https://jovxgdctpqexoiwfspue.supabase.co/storage/v1/object/sign/asset-media/e5203bb9-b667-4917-a990-55fe7c79cebe/3c382bfa55ac-hf_20260702_081042_df7202bf-bd80-4b2b-bbc6-1f09ba2870e9.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iMjk0Y2Y1ZS01ODRhLTQ5ODItOGY3MS04NGQzZDAwMzJiNzgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldC1tZWRpYS9lNTIwM2JiOS1iNjY3LTQ5MTctYTk5MC01NWZlN2M3OWNlYmUvM2MzODJiZmE1NWFjLWhmXzIwMjYwNzAyXzA4MTA0Ml9kZjcyMDJiZi1iZDgwLTRiMmItYmJjNi0xZjA5YmEyODcwZTkubXA0Iiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4NjA5NTU3NywiZXhwIjoyMTAxNDU1NTc3fQ.IBKcOeH-BZpKMipU8o7VjUxP0ieO2F9g4-87Ey6rFvw',
  },
  {
    label: 'Утро у реки',
    src: 'https://jovxgdctpqexoiwfspue.supabase.co/storage/v1/object/sign/asset-media/e5203bb9-b667-4917-a990-55fe7c79cebe/eaeb0307fb96-hf_20260702_080959_4cac5234-3573-464e-a5b7-76b94b8a7d61.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iMjk0Y2Y1ZS01ODRhLTQ5ODItOGY3MS04NGQzZDAwMzJiNzgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldC1tZWRpYS9lNTIwM2JiOS1iNjY3LTQ5MTctYTk5MC01NWZlN2M3OWNlYmUvZWFlYjAzMDdmYjk2LWhmXzIwMjYwNzAyXzA4MDk1OV80Y2FjNTIzNC0zNTczLTQ2NGUtYTViNy03NmI5NGI4YTdkNjEubXA0Iiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4NjA5NTU4NCwiZXhwIjoyMTAxNDU1NTg0fQ.HmPMf-LlpeZe89hlSEHlYyStI8d3FrNJgGBlvTHD22Y',
  },
]

const OVERLAY_PNG =
  'https://jovxgdctpqexoiwfspue.supabase.co/storage/v1/object/sign/asset-media/e5203bb9-b667-4917-a990-55fe7c79cebe/1646c5d57c33-0b4a435b2df2747593c43d7a1c9b4578f7d8d90c.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iMjk0Y2Y1ZS01ODRhLTQ5ODItOGY3MS04NGQzZDAwMzJiNzgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldC1tZWRpYS9lNTIwM2JiOS1iNjY3LTQ5MTctYTk5MC01NWZlN2M3OWNlYmUvMTY0NmM1ZDU3YzMzLTBiNGE0MzViMmRmMjc0NzU5M2M0M2Q3YTFjOWI0NTc4ZjdkOGQ5MGMucG5nIiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4NjA5NTU4NiwiZXhwIjoyMTAxNDU1NTg2fQ.bZy-i673k3w3zL-PbCzftgIrWt5vgTrEB-eHBUQ9TQc'

const NAV_LINKS = ['Что чистим', 'Как проходит выезд', 'Цены', 'Вопросы']

const STATS = [
  'от [цена] ₽ за посадочное место',
  'сушка — [N] часов',
  'выезд — [город] и [зона]',
  'работаем [часы работы]',
]

const DARK_VIDEO_INDEX = 2
const DARK_INK = '#182C41'
const SANS = 'system-ui, sans-serif'

export default function App() {
  const [activeVideo, setActiveVideo] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const cooldown = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(cooldown.current), [])

  const switchVideo = (index: number) => {
    if (index === activeVideo || isTransitioning) return
    setActiveVideo(index)
    setIsTransitioning(true)
    cooldown.current = window.setTimeout(() => setIsTransitioning(false), 1000)
  }

  const isDark = activeVideo === DARK_VIDEO_INDEX
  const ink = isDark ? DARK_INK : '#ffffff'
  const inkSoft = isDark ? 'rgba(24, 44, 65, 0.75)' : 'rgba(255, 255, 255, 0.75)'

  return (
    <section className="relative w-full h-screen overflow-hidden bg-black">
      {VIDEOS.map((video, index) => (
        <video
          key={video.src}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
            index === activeVideo ? 'opacity-100' : 'opacity-0'
          }`}
          src={video.src}
          autoPlay
          muted
          loop
          playsInline
        />
      ))}

      <img
        src={OVERLAY_PNG}
        alt=""
        aria-hidden="true"
        className="train-bob absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ zIndex: 1 }}
      />

      <div className="relative z-[2] flex flex-col h-full">
        <header className="flex items-center justify-between px-5 sm:px-8 py-5 sm:py-6">
          <span
            className="text-white italic text-xl sm:text-2xl"
            style={{ textShadow: '0 1px 14px rgba(0, 0, 0, 0.45)' }}
          >
            [Название]
          </span>

          <nav className="liquid-glass hidden md:flex items-center gap-1 rounded-full pl-5 pr-1.5 py-1.5">
            {NAV_LINKS.map((link) => (
              <a
                key={link}
                href="#"
                className="px-3 py-2 text-sm text-white/90 hover:text-white transition-colors"
                style={{ fontFamily: SANS }}
              >
                {link}
              </a>
            ))}
            <button
              className="ml-2 bg-white text-black text-sm px-5 py-2.5 rounded-full hover:bg-white/90 transition-colors"
              style={{ fontFamily: SANS }}
            >
              Вызвать мастера
            </button>
          </nav>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="liquid-glass md:hidden relative w-11 h-11 rounded-full flex items-center justify-center text-white"
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
          >
            <Menu
              size={20}
              className={`absolute transition-all duration-300 ${
                menuOpen ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0 scale-100'
              }`}
            />
            <X
              size={20}
              className={`absolute transition-all duration-300 ${
                menuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75'
              }`}
            />
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-8 pb-6 sm:pb-12 text-center">
          <div
            className="liquid-glass rounded-full px-4 py-2 text-xs sm:text-sm transition-colors duration-700"
            style={{ fontFamily: SANS, color: ink }}
          >
            Химчистка мягкой мебели на дому — [город]
          </div>

          <h1
            className="mt-6 sm:mt-7 text-4xl sm:text-5xl md:text-7xl lg:text-[5.5rem] leading-[1.1] max-w-4xl transition-colors duration-700"
            style={{ color: ink }}
          >
            Чистим мягкую мебель
            <br />
            прямо у вас дома
          </h1>

          <p
            className="mt-5 sm:mt-6 max-w-xl text-sm sm:text-base leading-relaxed transition-colors duration-700"
            style={{ fontFamily: SANS, color: inkSoft }}
          >
            Диван, кресло, матрас и ковёр чистим на месте — мастер приезжает со своим
            оборудованием. Средство подбираем под обивку: [список тканей]. Сушка — [N] часов,
            зона выезда — [зона], цена — от [цена] ₽ за посадочное место.
          </p>

          <div className="liquid-glass mt-7 sm:mt-8 w-full max-w-[320px] sm:max-w-sm rounded-full flex items-center gap-2 p-1.5">
            <input
              type="tel"
              placeholder="Ваш телефон"
              className={`flex-1 min-w-0 bg-transparent outline-none text-sm px-3 sm:px-4 py-2 transition-colors duration-700 ${
                isDark ? 'field-dark' : 'field-light'
              }`}
              style={{ fontFamily: SANS, color: ink }}
            />
            <button
              className="shrink-0 whitespace-nowrap bg-white text-black text-sm px-4 sm:px-5 py-2.5 rounded-full hover:bg-white/90 transition-colors"
              style={{ fontFamily: SANS }}
            >
              Вызвать мастера
            </button>
          </div>

          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {VIDEOS.map((video, index) => (
              <button
                key={video.label}
                onClick={() => switchVideo(index)}
                className={`text-xs sm:text-sm pb-1 border-b transition-all duration-700 ${
                  index === activeVideo
                    ? 'opacity-100'
                    : 'opacity-50 hover:opacity-80 border-transparent'
                }`}
                style={{
                  fontFamily: SANS,
                  color: '#ffffff',
                  borderColor: index === activeVideo ? '#ffffff' : 'transparent',
                  textShadow: '0 1px 12px rgba(0, 0, 0, 0.55)',
                }}
              >
                {video.label}
              </button>
            ))}
          </div>
        </div>

        <footer className="px-5 sm:px-8 pb-6 sm:pb-8">
          <div
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-white/70 text-xs sm:text-sm text-center"
            style={{ fontFamily: SANS, textShadow: '0 1px 12px rgba(0, 0, 0, 0.5)' }}
          >
            {STATS.map((stat, index) => (
              <span key={stat} className="flex items-center gap-3">
                {index > 0 && <span className="hidden sm:inline text-white/30">|</span>}
                {stat}
              </span>
            ))}
          </div>
        </footer>
      </div>

      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-500 ${
          menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)' }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />

        <div className="relative h-full flex flex-col items-center justify-center gap-7">
          {NAV_LINKS.map((link, index) => (
            <a
              key={link}
              href="#"
              onClick={() => setMenuOpen(false)}
              className={`text-white text-3xl transition-all duration-500 ${
                menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{
                transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
                transitionDelay: `${100 + index * 50}ms`,
              }}
            >
              {link}
            </a>
          ))}
          <button
            onClick={() => setMenuOpen(false)}
            className={`bg-white text-black text-base px-7 py-3 rounded-full transition-all duration-500 ${
              menuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
            style={{
              fontFamily: SANS,
              transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
              transitionDelay: '300ms',
            }}
          >
            Вызвать мастера
          </button>
        </div>
      </div>
    </section>
  )
}
