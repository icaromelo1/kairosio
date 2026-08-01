// Harness de auditoria de UI renderizada.
// Injetar na página e chamar __audit(). Contrato de saída:
// { url, viewport, fonts, targets, contrast, overflow, tabOrder, canvasBacked }

(function () {
  const MIN_FONT_PX = 10
  const MIN_TARGET = 24
  const REC_TARGET = 44

  function parseColor(c) {
    const m = String(c).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(',').map((v) => parseFloat(v.trim()))
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }

  function over(fg, bg) {
    const a = fg.a
    return {
      r: fg.r * a + bg.r * (1 - a),
      g: fg.g * a + bg.g * (1 - a),
      b: fg.b * a + bg.b * (1 - a),
      a: 1,
    }
  }

  function lum(c) {
    const f = [c.r, c.g, c.b].map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]
  }

  function ratio(a, b) {
    const l1 = lum(a)
    const l2 = lum(b)
    const hi = Math.max(l1, l2)
    const lo = Math.min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)
  }

  // Sobe o DOM compondo fundos ate achar um opaco. Retorna null se o elemento
  // esta sobre um <canvas> — nesse caso a cor de fundo nao existe no DOM e a
  // medicao estatica mentiria (ver checagem de canvas na auditoria).
  function effectiveBg(el) {
    let node = el
    let acc = null
    while (node && node !== document.documentElement.parentNode) {
      const cs = getComputedStyle(node)
      const c = parseColor(cs.backgroundColor)
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c
        if (acc.a >= 0.999) return acc
      }
      const prev = node.previousElementSibling
      if (prev && prev.tagName === 'CANVAS') return null
      if (node.querySelector && node.querySelector(':scope > canvas')) return null
      node = node.parentElement
    }
    return acc && acc.a >= 0.999 ? acc : null
  }

  function visible(el) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }

  function label(el) {
    const id = el.id ? `#${el.id}` : ''
    const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : ''
    return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 120)
  }

  function ownText(el) {
    let t = ''
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue
    return t.trim()
  }

  window.__audit = function () {
    const fonts = []
    const contrast = []
    const canvasBacked = []
    const targets = []
    const seenFont = new Set()

    document.querySelectorAll('*').forEach((el) => {
      if (!visible(el)) return
      const text = ownText(el)
      if (!text) return

      const cs = getComputedStyle(el)
      const px = parseFloat(cs.fontSize)
      const key = `${label(el)}|${px}`

      if (px < MIN_FONT_PX && !seenFont.has(key)) {
        seenFont.add(key)
        fonts.push({ el: label(el), px: +px.toFixed(2), family: cs.fontFamily.split(',')[0], sample: text.slice(0, 40) })
      }

      const fg = parseColor(cs.color)
      const bg = effectiveBg(el)
      if (!fg) return
      if (!bg) {
        canvasBacked.push({ el: label(el), color: cs.color, px: +px.toFixed(2), sample: text.slice(0, 40) })
        return
      }
      const solidFg = fg.a < 1 ? over(fg, bg) : fg
      const r = ratio(solidFg, bg)
      // limiar WCAG AA: 3.0 pra texto grande (>=18.66px, ou >=14px bold), 4.5 pro resto
      const bold = parseInt(cs.fontWeight, 10) >= 700
      const large = px >= 18.66 || (bold && px >= 14)
      const need = large ? 3.0 : 4.5
      if (r < need) {
        contrast.push({ el: label(el), ratio: +r.toFixed(2), need, px: +px.toFixed(2), sample: text.slice(0, 40) })
      }
    })

    const SEL = 'a[href],button,input,select,textarea,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])'
    document.querySelectorAll(SEL).forEach((el) => {
      if (!visible(el)) return
      const r = el.getBoundingClientRect()
      const w = Math.round(r.width)
      const h = Math.round(r.height)
      if (w < MIN_TARGET || h < MIN_TARGET) {
        targets.push({ el: label(el), w, h, severity: 'abaixo do minimo 24', name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40) })
      } else if (w < REC_TARGET || h < REC_TARGET) {
        targets.push({ el: label(el), w, h, severity: 'abaixo do recomendado 44', name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40) })
      }
    })

    const de = document.documentElement
    const overflow = {
      horizontal: de.scrollWidth > de.clientWidth,
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      offenders: [],
    }
    if (overflow.horizontal) {
      document.querySelectorAll('*').forEach((el) => {
        if (!visible(el)) return
        const r = el.getBoundingClientRect()
        if (r.right > de.clientWidth + 1) overflow.offenders.push({ el: label(el), right: Math.round(r.right) })
      })
      overflow.offenders = overflow.offenders.slice(0, 10)
    }

    const tabOrder = []
    document.querySelectorAll(SEL).forEach((el) => {
      if (!visible(el)) return
      const cs = getComputedStyle(el, ':focus-visible')
      tabOrder.push({
        el: label(el),
        tabindex: el.getAttribute('tabindex'),
        name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
        outlineWidth: cs.outlineWidth,
      })
    })

    return {
      url: location.href,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      fonts,
      targets,
      contrast,
      overflow,
      canvasBacked,
      tabOrder: tabOrder.slice(0, 60),
      counts: {
        fontsBelowMin: fonts.length,
        targetsBelowMin: targets.filter((t) => t.severity.includes('minimo')).length,
        targetsBelowRec: targets.filter((t) => t.severity.includes('recomendado')).length,
        contrastFails: contrast.length,
        canvasBacked: canvasBacked.length,
        focusables: tabOrder.length,
      },
    }
  }
  return 'harness pronto'
})()
