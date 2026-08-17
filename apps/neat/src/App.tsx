import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, usePresence } from 'motion/react'
import {
  Armchair,
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  Car,
  Droplets,
  Plus,
  Sofa,
  Sparkles,
  Wind,
} from 'lucide-react'

const stagesData = [
  { name: 'Осмотр и тест ткани', image: '/media/stage-01.jpg' },
  { name: 'Сухая чистка и пылеудаление', image: '/media/stage-02.jpg' },
  { name: 'Аквачистка пеной', image: '/media/stage-03.jpg' },
  { name: 'Экстракция и нейтрализация запаха', image: '/media/stage-04.jpg' },
  { name: 'Сушка и защитная пропитка', image: '/media/stage-05.jpg' },
]

const navLinks = ['Услуги', 'Цены', 'Процесс', 'Отзывы', 'Контакты']

const actionPills = [
  { icon: Sofa, label: 'Диваны' },
  { icon: Armchair, label: 'Кресла и стулья' },
  { icon: BedDouble, label: 'Матрасы' },
  { icon: Car, label: 'Салон авто' },
  { icon: Sparkles, label: 'Все услуги' },
]

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

const letterBlock = {
  initial: { y: 120, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] as const },
  },
}

const logoLetters = [
  {
    translate: 'translate(0,0)',
    points: [
      '0,0 14,0 14,100 0,100',
      '200,0 214,0 214,100 200,100',
      '0,0 33,0 214,100 181,100',
    ],
  },
  {
    translate: 'translate(280,0)',
    points: [
      '0,0 14,0 14,100 0,100',
      '0,0 214,0 214,14 0,14',
      '0,43 200,43 200,57 0,57',
      '0,86 214,86 214,100 0,100',
    ],
  },
  {
    translate: 'translate(560,0)',
    points: ['0,100 30,100 121,0 91,0', '184,100 214,100 123,0 93,0', '44,57 170,57 170,71 44,71'],
  },
  {
    translate: 'translate(840,0)',
    points: ['0,0 214,0 214,14 0,14', '100,14 114,14 114,100 100,100'],
  },
]

const DURATION = 900

function FoamTransitionImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  const [isPresent, safeToRemove] = usePresence()
  const filterId = useRef(`foam-${Math.round(Math.random() * 1e9).toString(36)}`).current
  const [progress, setProgress] = useState(0)
  const finish = useRef(safeToRemove)
  finish.current = safeToRemove

  useEffect(() => {
    let raf = 0
    let start = 0

    const step = (now: number) => {
      if (!start) start = now
      const t = Math.min((now - start) / DURATION, 1)
      setProgress(isPresent ? 1 - Math.pow(1 - t, 4) : Math.pow(t, 3))
      if (t < 1) {
        raf = requestAnimationFrame(step)
      } else if (!isPresent) {
        finish.current?.()
      }
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [isPresent])

  const dissolve = isPresent ? 1 - progress : progress
  const alpha = Math.max(0, 1 - dissolve * 1.2)
  const dy = isPresent ? dissolve * 90 : dissolve * -70
  const dx = isPresent ? dissolve * -30 : dissolve * 30

  return (
    <>
      <svg aria-hidden className="absolute h-0 w-0" focusable="false">
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} result="foam" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="foam"
            scale={dissolve * 150}
            xChannelSelector="R"
            yChannelSelector="G"
            result="scattered"
          />
          <feOffset in="scattered" dx={dx} dy={dy} result="drift" />
          <feGaussianBlur in="drift" stdDeviation={dissolve * 8} result="soft" />
          <feColorMatrix
            in="soft"
            type="matrix"
            values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${alpha} 0`}
          />
        </filter>
      </svg>
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ filter: `url(#${filterId})` }}
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />
    </>
  )
}

function DropletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3.2c3.1 3.6 5.2 6.4 5.2 9.1A5.2 5.2 0 0 1 12 17.5a5.2 5.2 0 0 1-5.2-5.2c0-2.7 2.1-5.5 5.2-9.1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M9.6 12.6c0-1.2.7-2.4 1.7-3.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M18.4 4.4v3M16.9 5.9h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M5 15.6v2M4 16.6h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export default function App() {
  const [showVideo, setShowVideo] = useState(false)
  const [activeStage, setActiveStage] = useState(2)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowVideo(true), 2800)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const interval = setInterval(
      () => setActiveStage((prev) => (prev + 1) % stagesData.length),
      3500,
    )
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="font-sans">
      <section className="relative flex min-h-screen w-full flex-col overflow-hidden">
        <motion.header
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
          className="relative z-20 px-6 pt-6 md:px-16"
        >
          <motion.h1
            variants={{
              initial: { scale: 1.03 },
              animate: {
                scale: 1,
                transition: { staggerChildren: 0.06, delayChildren: 0.1, duration: 1.2 },
              },
            }}
            className="w-full"
          >
            <span className="sr-only">NEAT — химчистка мебели на дому</span>
            <svg
              viewBox="0 0 1060 100"
              className="w-full fill-[#111]"
              aria-hidden
              preserveAspectRatio="xMidYMid meet"
            >
              {logoLetters.map((letter, letterIndex) => (
                <g key={letterIndex} transform={letter.translate}>
                  {letter.points.map((points, pointIndex) => (
                    <motion.polygon
                      key={pointIndex}
                      points={points}
                      variants={letterBlock}
                      style={{ transformBox: 'fill-box' }}
                    />
                  ))}
                </g>
              ))}
            </svg>
          </motion.h1>

          <motion.div
            variants={{
              initial: fadeUp.initial,
              animate: { ...fadeUp.animate, transition: { duration: 0.8, ease: 'easeOut' } },
            }}
            className="mt-8 flex items-start justify-between gap-5 font-mono text-[10px] tracking-[0.2em] uppercase md:gap-0 md:text-[11px]"
          >
            <div className="shrink-0 space-y-1 text-gray-800 md:w-[15%]">
              <p>Химчистка</p>
              <p>Мебели</p>
              <p>На дому</p>
            </div>

            <div className="hidden w-[5%] justify-center pt-1 md:flex">
              <ArrowRight size={14} strokeWidth={1} className="text-gray-400" />
            </div>

            <p className="flex-1 font-mono leading-relaxed text-gray-800 normal-case md:w-[30%] md:flex-none">
              <span className="md:hidden">
                Возвращаем мебели
                <br />
                свежесть и чистоту —
                <br />
                бережно, глубоко,
                <br />с выездом к вам.
              </span>
              <span className="hidden md:inline">
                Возвращаем мебели свежесть
                <br />
                и чистоту — бережно, глубоко,
                <br />с выездом к вам.
              </span>
            </p>

            <div className="hidden w-[5%] justify-center pt-1 md:flex">
              <ArrowRight size={14} strokeWidth={1} className="text-gray-400" />
            </div>

            <nav className="hidden w-[15%] flex-col items-start gap-1 text-gray-800 md:flex">
              {navLinks.map((link) => (
                <a key={link} href="#" className="hover:text-black hover:underline">
                  {link}
                </a>
              ))}
            </nav>

            <button
              type="button"
              aria-label={isMobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="group z-60 ml-6 flex shrink-0 flex-col gap-[6px] pt-1"
            >
              <span
                className={`h-[1.5px] bg-black transition-all duration-300 ${
                  isMobileMenuOpen
                    ? 'w-8 translate-y-[3.75px] rotate-45'
                    : 'w-8 group-hover:w-6'
                }`}
              />
              <span
                className={`h-[1.5px] bg-black transition-all duration-300 ${
                  isMobileMenuOpen
                    ? 'w-8 -translate-y-[3.75px] -rotate-45'
                    : 'w-8 group-hover:w-10'
                }`}
              />
            </button>
          </motion.div>
        </motion.header>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="relative z-30 border-b border-gray-200 bg-[#fcfcfc] px-6 py-8 shadow-xl md:hidden"
            >
              <nav className="flex flex-col space-y-6 font-mono text-sm tracking-[0.2em] uppercase">
                {navLinks.map((link) => (
                  <a key={link} href="#" onClick={() => setIsMobileMenuOpen(false)}>
                    {link}
                  </a>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        {showVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            className="pointer-events-none absolute top-0 left-0 z-0 h-full w-full"
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              preload="none"
              poster="/media/hero-poster.jpg"
              aria-hidden
              className="h-full w-full object-cover opacity-90"
            >
              <source
                src="/media/hero-portrait.webm"
                media="(max-aspect-ratio: 1/1)"
                type="video/webm"
              />
              <source
                src="/media/hero-portrait.mp4"
                media="(max-aspect-ratio: 1/1)"
                type="video/mp4"
              />
              <source src="/media/hero.webm" type="video/webm" />
              <source src="/media/hero.mp4" type="video/mp4" />
            </video>
          </motion.div>
        )}

        <div className="relative z-10 flex flex-1 justify-between px-10 md:px-16">
          <motion.div
            initial="initial"
            animate="animate"
            variants={{ animate: { transition: { staggerChildren: 0.15, delayChildren: 0.6 } } }}
            className="mt-20 w-[320px] sm:mt-28 md:mt-32"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-4 font-mono text-xs">
              <span className="text-gray-500">01</span>
              <span className="h-[1.5px] w-16 bg-black/20" />
            </motion.div>

            <motion.h2
              variants={fadeUp}
              className="mt-6 text-[3.5rem] leading-[1] font-normal tracking-tight md:text-[5rem]"
            >
              ГЛУБОКАЯ
              <br />
              ЧИСТОТА
            </motion.h2>

            <motion.p
              variants={fadeUp}
              className="mt-6 w-[240px] text-[13px] leading-[1.6] text-gray-700 md:text-[14px]"
            >
              Аквачистка диванов, кресел
              <br />
              и матрасов с выездом на дом —
              <br />
              за 2–3 часа.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-10">
              <a
                href="#"
                className="group relative inline-flex items-center gap-3 overflow-hidden rounded-md border border-[#1a1a1a] bg-[#1a1a1a] px-6 py-3.5 shadow-sm transition-all duration-300 hover:-translate-y-[0.5px] hover:shadow-[3px_3px_0px_rgba(17,17,17,0.5)] active:translate-y-0 active:shadow-none"
              >
                <span className="absolute inset-0 -translate-x-[101%] bg-[#fcfcfc] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0" />
                <DropletIcon className="relative h-5 w-5 shrink-0 text-white transition-all duration-300 group-hover:-translate-y-1 group-hover:-rotate-12 group-hover:scale-110 group-hover:text-[#111]" />
                <span className="relative text-[15px] font-medium whitespace-nowrap text-white transition-colors duration-300 group-hover:text-[#111]">
                  Рассчитать цену
                </span>
              </a>
            </motion.div>
          </motion.div>

          <motion.div
            initial="initial"
            animate="animate"
            variants={{ animate: { transition: { staggerChildren: 0.15, delayChildren: 0.9 } } }}
            className="mt-12 hidden w-[200px] shrink-0 flex-col gap-10 md:mt-20 md:flex"
          >
            <motion.div variants={fadeUp}>
              <p className="font-mono text-[10px] font-bold tracking-widest uppercase">
                Угловой диван, велюр
              </p>
              <p className="mt-3 text-[12px] leading-[1.6] text-gray-600">
                Эксплуатация 6 лет
                <br />
                пятна кофе и лоск на подлокотниках
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="space-y-5">
              <div>
                <p className="font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                  Чистка
                </p>
                <p className="mt-1 text-[13px] font-medium">2.5 ч</p>
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                  Полное высыхание
                </p>
                <p className="mt-1 text-[13px] font-medium">4 ч</p>
              </div>
            </motion.div>

            <motion.a variants={fadeUp} href="#" className="group flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-400 transition-colors duration-300 group-hover:border-black group-hover:bg-[#111]">
                <Plus
                  size={16}
                  strokeWidth={1.5}
                  className="transition-colors duration-300 group-hover:text-white"
                />
              </span>
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase">
                Смотреть кейс
              </span>
            </motion.a>
          </motion.div>
        </div>

        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 1.2 }}
          className="absolute bottom-10 left-[2.5rem] z-10 hidden items-center gap-4 md:left-[4rem] md:flex"
        >
          <span className="flex h-12 w-12 items-center justify-center gap-[4px] rounded-full border border-gray-300">
            <span className="h-[12px] w-[1px] bg-gray-600" />
            <span className="h-[12px] w-[1px] bg-gray-600" />
          </span>
          <span className="font-mono text-[10px] font-semibold tracking-widest text-gray-500 uppercase">
            Листайте вниз
          </span>
        </motion.div>
      </section>

      <section className="relative z-20 flex min-h-[75vh] w-full flex-col items-center bg-[#fcfcfc] pt-24 pb-0 md:min-h-screen md:pt-32">
        <p className="mb-12 font-mono text-[10px] tracking-[0.2em] md:text-[11px]">
          <span className="text-gray-500">[ 02 ]</span>{' '}
          <span className="font-bold text-gray-900 uppercase">Что мы чистим</span>
        </p>

        <motion.h2
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[1000px] px-6 text-center text-[2.2rem] leading-[1.1] font-medium tracking-tight text-[#111] md:text-[3.5rem] lg:text-[4.2rem]"
        >
          Убираем пятна, запахи и пыль из мебели, ковров и матрасов —{' '}
          <br className="hidden md:block" />
          без разводов и на несколько лет.
        </motion.h2>

        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-100px' }}
          variants={{ animate: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } } }}
          className="mt-12 mb-10 flex flex-wrap justify-center gap-3 px-6 md:mb-24 md:gap-4"
        >
          {actionPills.map(({ icon: Icon, label }) => (
            <motion.button
              key={label}
              type="button"
              variants={fadeUp}
              className="flex items-center gap-2 rounded-full border border-gray-300 bg-white/50 px-5 py-2.5 text-[11px] font-medium tracking-wider text-gray-800 uppercase backdrop-blur-sm transition-colors duration-300 hover:border-black hover:bg-black hover:text-white"
            >
              <Icon size={14} strokeWidth={2} />
              {label}
            </motion.button>
          ))}
        </motion.div>

        <div className="min-h-[220px] w-full md:min-h-[450px]" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden justify-between px-8 pb-8 md:flex md:px-16 md:pb-12">
          <span className="font-mono text-[10px] font-medium tracking-widest text-gray-500 uppercase">
            Мы не просто пылесосим.
          </span>
          <span className="font-mono text-[10px] font-medium tracking-widest text-gray-500 uppercase">
            NEAT Cleaning © 2026
          </span>
        </div>
      </section>

      <section className="relative z-30 flex w-full flex-col bg-[#0a0a0a] text-white">
        <motion.div
          initial={{ y: '-65%', opacity: 0 }}
          whileInView={{ y: '-78%', opacity: 1 }}
          viewport={{ once: true, margin: '100px' }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          style={{
            maskImage:
              'radial-gradient(56% 48% at 50% 46%, rgba(0,0,0,1) 26%, rgba(0,0,0,0.45) 66%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage:
              'radial-gradient(56% 48% at 50% 46%, rgba(0,0,0,1) 26%, rgba(0,0,0,0.45) 66%, rgba(0,0,0,0) 100%)',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
          }}
          className="pointer-events-none absolute top-0 left-1/2 z-0 w-[160vw] -translate-x-1/2 md:w-[1100px]"
        >
          <img
            src="/media/overlap-sofa.jpg"
            alt="Угловой диван после аквачистки"
            className="w-full grayscale"
          />
        </motion.div>

        <div className="relative z-10 mb-16 flex flex-col justify-between px-8 pt-32 md:px-16 md:pt-48 xl:flex-row">
          <h2 className="max-w-[900px] text-[1.8rem] leading-[1.15] font-medium tracking-tight text-white md:text-[3rem] lg:text-[3.8rem] xl:text-[4rem]">
            Отработано на тысячах диванов
            <span className="mx-2 inline-flex translate-y-[-4px] gap-2 align-middle md:mx-4 md:gap-3">
              {[Droplets, Wind, Sparkles].map((Icon, index) => (
                <span
                  key={index}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-600 bg-black text-gray-400 transition-colors duration-300 hover:border-white hover:bg-white hover:text-black md:h-14 md:w-14"
                >
                  <Icon size={22} strokeWidth={1.5} />
                </span>
              ))}
            </span>
            и матрасов.
          </h2>

          <div className="mt-12 shrink-0 xl:mt-2 xl:pl-12">
            <p className="mb-6 font-mono text-[9px] leading-relaxed tracking-widest text-gray-400 uppercase md:text-[10px]">
              Мы не маскируем пятна
              <br />
              мы их удаляем
            </p>
            <div className="flex flex-wrap gap-3">
              {['Гипоаллергенно', 'Без разводов', 'Сохнет 4 часа'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-gray-600 px-5 py-2 font-mono text-[9px] tracking-widest text-gray-300 uppercase transition-colors duration-300 hover:border-white hover:bg-white hover:text-black"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 h-[1px] w-full bg-gray-800" />

        <div className="relative z-10 flex flex-col md:flex-row">
          <div className="flex min-h-[400px] w-full flex-col justify-between border-b border-gray-800 p-8 md:min-h-[500px] md:w-[35%] md:border-r md:border-b-0">
            <p className="text-xl tracking-[0.3em] text-gray-500">***</p>

            <div className="relative flex-1">
              <AnimatePresence mode="wait">
                <FoamTransitionImage
                  key={activeStage}
                  src={stagesData[activeStage].image}
                  alt={stagesData[activeStage].name}
                  className="absolute inset-0 m-auto h-[86%] w-[86%] object-cover grayscale brightness-[0.92] contrast-[1.06]"
                />
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-1 font-mono text-[10px] tracking-widest text-[#888] uppercase">
              <span className="relative block h-[14px] w-[18px] overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={activeStage}
                    initial={{ y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -14, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 block"
                  >
                    {String(activeStage + 1).padStart(2, '0')}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="text-[#333]">/</span>
              <span>{String(stagesData.length).padStart(2, '0')}</span>
            </div>
          </div>

          <div className="w-full md:w-[65%]">
            <div className="flex items-center justify-between border-b border-gray-800 p-8 font-mono text-[10px] tracking-widest text-gray-400 uppercase">
              <span>Чисто внутри. Свежо снаружи.</span>
              <span className="relative block h-[14px] w-[70px] overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={activeStage}
                    initial={{ y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -14, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 block text-right"
                  >
                    Этап {String(activeStage + 1).padStart(2, '0')}
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>

            <ul>
              {stagesData.map((stage, index) => (
                <li key={stage.name} className="border-b border-gray-800/80">
                  <button
                    type="button"
                    onClick={() => setActiveStage(index)}
                    aria-current={index === activeStage}
                    className={`flex w-full items-center justify-between px-8 py-8 text-left transition-colors duration-500 ${
                      index === activeStage ? 'text-white' : 'text-[#444] hover:text-[#999]'
                    }`}
                  >
                    <span className="text-2xl font-medium tracking-tight md:text-[2rem]">
                      {stage.name}
                    </span>
                    <AnimatePresence>
                      {index === activeStage && (
                        <motion.span
                          initial={{ opacity: 0, x: -8, y: 8 }}
                          animate={{ opacity: 1, x: 0, y: 0 }}
                          exit={{ opacity: 0, x: 8, y: -8 }}
                          transition={{ duration: 0.4, ease: 'easeOut' }}
                          className="shrink-0 pl-6"
                        >
                          <ArrowUpRight size={22} strokeWidth={1} className="text-gray-400" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative z-10 h-[1px] w-full bg-gray-800" />

        <p className="relative z-10 bg-[#0a0a0a] px-8 py-8 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
          Глубокая чистка с 2016 года
        </p>
      </section>
    </div>
  )
}
