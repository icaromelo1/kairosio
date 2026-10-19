const MOVIMENTO = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']

function capturado(alvo: EventTarget | null): boolean {
  if (alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement || alvo instanceof HTMLSelectElement) return true
  return alvo instanceof HTMLElement && (alvo.isContentEditable || !!alvo.closest('[data-captura-teclado]'))
}

export class Entrada {
  private readonly teclas = new Set<string>()
  private readonly ouvintes = new Map<string, () => void>()
  pausada = false

  constructor() {
    window.addEventListener('keydown', this.aoApertar)
    window.addEventListener('keyup', this.aoSoltar)
    window.addEventListener('blur', this.limpar)
  }

  aoTeclar(tecla: string, acao: () => void) {
    this.ouvintes.set(tecla, acao)
  }

  apertar(tecla: string) {
    this.teclas.add(tecla)
  }

  soltar(tecla: string) {
    this.teclas.delete(tecla)
  }

  direcao(): { x: number; y: number; correndo: boolean } {
    if (this.pausada) return { x: 0, y: 0, correndo: false }
    const t = this.teclas
    const x = (t.has('d') || t.has('arrowright') ? 1 : 0) - (t.has('a') || t.has('arrowleft') ? 1 : 0)
    const y = (t.has('s') || t.has('arrowdown') ? 1 : 0) - (t.has('w') || t.has('arrowup') ? 1 : 0)
    return { x, y, correndo: t.has('shift') }
  }

  destruir() {
    window.removeEventListener('keydown', this.aoApertar)
    window.removeEventListener('keyup', this.aoSoltar)
    window.removeEventListener('blur', this.limpar)
    this.teclas.clear()
    this.ouvintes.clear()
  }

  private readonly aoApertar = (e: KeyboardEvent) => {
    if (capturado(e.target)) return
    const tecla = e.key.toLowerCase()
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (MOVIMENTO.includes(tecla) || tecla === ' ') e.preventDefault()
    if (tecla === 'shift' || MOVIMENTO.includes(tecla)) {
      this.teclas.add(tecla)
      return
    }
    if (e.repeat) return
    const acao = this.ouvintes.get(tecla)
    if (acao && !this.pausada) {
      e.preventDefault()
      acao()
    }
  }

  private readonly aoSoltar = (e: KeyboardEvent) => {
    this.teclas.delete(e.key.toLowerCase())
  }

  private readonly limpar = () => {
    this.teclas.clear()
  }
}
