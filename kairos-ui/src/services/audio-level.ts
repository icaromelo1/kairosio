// AudioContext ÚNICO compartilhado entre todos os medidores — Safari limita a
// ~4 contexts por página; um por peer matava o indicador de fala em sala cheia
let sharedCtx: AudioContext | null = null
function audioCtx(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext()
  if (sharedCtx.state === 'suspended') void sharedCtx.resume().catch(() => {})
  return sharedCtx
}

export function attachLevelMeter(stream: MediaStream, onLevel: (level: number) => void): () => void {
  const ctx = audioCtx()
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  analyser.smoothingTimeConstant = 0.4
  source.connect(analyser)
  const data = new Uint8Array(analyser.frequencyBinCount)
  const timer = setInterval(() => {
    analyser.getByteFrequencyData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    onLevel(sum / data.length)
  }, 150)
  return () => {
    clearInterval(timer)
    source.disconnect()
    analyser.disconnect()
  }
}
