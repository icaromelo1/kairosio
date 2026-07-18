export function attachLevelMeter(stream: MediaStream, onLevel: (level: number) => void): () => void {
  const ctx = new AudioContext()
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
    void ctx.close().catch(() => {})
  }
}
