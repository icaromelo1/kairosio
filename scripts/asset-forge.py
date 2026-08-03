#!/usr/bin/env python3
"""Forja de assets SVG via agy, com contrato estrutural e repeticao automatica.

A paleta e a contagem de formas deixam de ser texto do prompt e passam a ser
schema JSON — o modelo nao consegue devolver cor fora da lista. O que sobra
(geometria, ancoragem na base, cobertura) e validado localmente, sem gastar
token. So a geracao custa.

Uso:
  ./asset-forge.py <kind> "<descricao>" <vbW> <vbH> [--fonte agy|mine] [--ref <kind>]
  ./asset-forge.py --lote lote.json
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "kairos-ui/src/game/furniture"
MODELO = "gemini-3.6-flash-high"
TENTATIVAS = 3

PALETA = {
    "sombra": ["#141024", "#1d1833", "#2a2438"],
    "madeira": ["#4a3520", "#6b4f2a", "#8a6a3a"],
    "metal": ["#3d4654", "#6e7a8f", "#9aa8bd"],
    "tecido": ["#4a5d8f", "#6b7fb5", "#7d4a52"],
    "vegetacao": ["#3f6b3a", "#5c9152"],
    "luz": ["#8c7ae6", "#d9c47a"],
}
CORES = [c for grupo in PALETA.values() for c in grupo]
MAX_FORMAS = 24
MIN_FORMAS = 5


def schema(vbw: int, vbh: int) -> dict:
    num = {"type": "number"}
    return {
        "type": "object",
        "required": ["shapes"],
        "properties": {
            "shapes": {
                "type": "array",
                "minItems": MIN_FORMAS,
                "maxItems": MAX_FORMAS,
                "items": {
                    "type": "object",
                    "required": ["type", "fill"],
                    "properties": {
                        "type": {"enum": ["rect", "ellipse", "circle", "polygon", "path"]},
                        "fill": {"enum": CORES},
                        "opacity": {"type": "number", "minimum": 0.1, "maximum": 1},
                        "x": num, "y": num, "w": num, "h": num,
                        "cx": num, "cy": num, "rx": num, "ry": num, "r": num,
                        "points": {"type": "string"},
                        "d": {"type": "string"},
                    },
                },
            }
        },
    }


def prompt(desc: str, vbw: int, vbh: int, ref: str | None, erros: list[str]) -> str:
    paleta_txt = "\n".join(f"   {nome}: {' '.join(cores)}" for nome, cores in PALETA.items())
    p = f"""Descreva as formas de um SVG de: {desc}.

Destino: jogo 2.5D com billboards ancorados na base (tipo Stardew Valley). O objeto
renderiza entre 32 e 96 pixels na tela — a SILHUETA e o que se enxerga.

Sistema de coordenadas: 0..{vbw} na horizontal, 0..{vbh} na vertical.

REGRAS:
1. O objeto APOIA em y={vbh}. Pes, base ou rodas tocam essa linha.
2. Ocupa de x=0 a x={vbw}, sem sobra lateral.
3. Vista FRONTAL levemente elevada. NUNCA top-down puro, NUNCA isometrico.
4. Luz do TOPO-ESQUERDA: face esquerda mais clara, direita mais escura.
5. NAO desenhe sombra de chao — o motor desenha separadamente.
6. Use a cor do MATERIAL real. Roxo (#8c7ae6) e so para tela e luz, nunca movel.
{paleta_txt}
7. Ordem importa: primeira forma fica atras, ultima na frente.
8. Prefira forma preenchida a contorno fino. Sem detalhe abaixo de 2 unidades.

Campos por tipo: rect usa x,y,w,h · ellipse usa cx,cy,rx,ry · circle usa cx,cy,r ·
polygon usa points ("x1,y1 x2,y2 ...") · path usa d.
"""
    if ref:
        p += f"\nUse este asset aprovado como REFERENCIA DE ESTILO (mesmo nivel de detalhe e tratamento de luz):\n{ref}\n"
    if erros:
        p += "\nA tentativa anterior foi REPROVADA por:\n" + "\n".join(f"- {e}" for e in erros) + "\nCorrija exatamente esses pontos.\n"
    return p


def chamar_agy(p: str, sch: dict) -> dict | None:
    arq = RAIZ / ".asset-forge-schema.json"
    arq.write_text(json.dumps(sch))
    try:
        r = subprocess.run(
            ["agy", "-p", p, "--model", MODELO, "--json-schema", str(arq), "--output-format", "json"],
            capture_output=True, text=True, timeout=300,
        )
        dados = json.loads(r.stdout)
        return dados.get("structured_output")
    except Exception as e:
        print(f"    falha na chamada: {e}", file=sys.stderr)
        return None
    finally:
        arq.unlink(missing_ok=True)


def montar_svg(shapes: list[dict], vbw: int, vbh: int) -> str:
    out = []
    for s in shapes:
        t = s.get("type")
        cor = s.get("fill")
        op = f' opacity="{s["opacity"]}"' if s.get("opacity", 1) < 1 else ""
        if t == "rect":
            out.append(f'<rect x="{s.get("x",0)}" y="{s.get("y",0)}" width="{s.get("w",0)}" height="{s.get("h",0)}" fill="{cor}"{op}/>')
        elif t == "ellipse":
            out.append(f'<ellipse cx="{s.get("cx",0)}" cy="{s.get("cy",0)}" rx="{s.get("rx",0)}" ry="{s.get("ry",0)}" fill="{cor}"{op}/>')
        elif t == "circle":
            out.append(f'<circle cx="{s.get("cx",0)}" cy="{s.get("cy",0)}" r="{s.get("r",0)}" fill="{cor}"{op}/>')
        elif t == "polygon":
            out.append(f'<polygon points="{s.get("points","")}" fill="{cor}"{op}/>')
        elif t == "path":
            out.append(f'<path d="{s.get("d","")}" fill="{cor}"{op}/>')
    corpo = "\n".join(out)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vbw} {vbh}">\n{corpo}\n</svg>\n'


def extremos(s: dict) -> tuple[float, float, float, float] | None:
    """Caixa aproximada da forma, para checar ancoragem e cobertura."""
    t = s.get("type")
    if t == "rect":
        x, y = s.get("x", 0), s.get("y", 0)
        return x, y, x + s.get("w", 0), y + s.get("h", 0)
    if t == "ellipse":
        return s.get("cx", 0) - s.get("rx", 0), s.get("cy", 0) - s.get("ry", 0), s.get("cx", 0) + s.get("rx", 0), s.get("cy", 0) + s.get("ry", 0)
    if t == "circle":
        return s.get("cx", 0) - s.get("r", 0), s.get("cy", 0) - s.get("r", 0), s.get("cx", 0) + s.get("r", 0), s.get("cy", 0) + s.get("r", 0)
    nums = [float(n) for n in re.findall(r"-?\d+\.?\d*", s.get("points", "") or s.get("d", ""))]
    if len(nums) < 4:
        return None
    xs, ys = nums[0::2], nums[1::2]
    return min(xs), min(ys), max(xs), max(ys)


def validar(shapes: list[dict], vbw: int, vbh: int) -> list[str]:
    """Tudo local — nao gasta token."""
    erros = []
    caixas = [c for c in (extremos(s) for s in shapes) if c]
    if not caixas:
        return ["nenhuma forma com geometria legivel"]

    x0 = min(c[0] for c in caixas)
    y1 = max(c[3] for c in caixas)
    x1 = max(c[2] for c in caixas)

    if y1 < vbh * 0.9:
        erros.append(f"nada toca a base: forma mais baixa termina em y={y1:.0f}, deveria chegar perto de {vbh}")
    largura = (x1 - x0) / vbw
    if largura < 0.75:
        erros.append(f"objeto ocupa so {largura:.0%} da largura; deve preencher de x=0 a x={vbw}")

    fora = [s.get("fill") for s in shapes if s.get("fill") not in CORES]
    if fora:
        erros.append(f"cor fora da paleta: {sorted(set(fora))}")

    if any(c[0] < -vbw * 0.1 or c[2] > vbw * 1.1 or c[1] < -vbh * 0.1 or c[3] > vbh * 1.1 for c in caixas):
        erros.append("alguma forma escapa muito do viewBox")

    if len(shapes) > MAX_FORMAS:
        erros.append(f"{len(shapes)} formas, maximo {MAX_FORMAS}")

    return erros


def forjar(kind: str, desc: str, vbw: int, vbh: int, fonte: str, ref_kind: str | None) -> bool:
    ref = None
    if ref_kind:
        cam = SAIDA / f"svg-{fonte}" / f"{ref_kind}.svg"
        if cam.exists():
            ref = cam.read_text()

    sch = schema(vbw, vbh)
    erros: list[str] = []

    for t in range(1, TENTATIVAS + 1):
        saida = chamar_agy(prompt(desc, vbw, vbh, ref, erros), sch)
        if not saida or "shapes" not in saida:
            erros = ["resposta sem o campo shapes"]
            print(f"  tentativa {t}: sem resposta valida")
            continue

        shapes = saida["shapes"]
        erros = validar(shapes, vbw, vbh)
        if not erros:
            dest = SAIDA / f"svg-{fonte}"
            dest.mkdir(parents=True, exist_ok=True)
            (dest / f"{kind}.svg").write_text(montar_svg(shapes, vbw, vbh))
            print(f"  OK em {t} tentativa(s) — {len(shapes)} formas")
            return True
        print(f"  tentativa {t} reprovada: {'; '.join(erros)}")

    print(f"  FALHOU apos {TENTATIVAS} tentativas")
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("kind", nargs="?")
    ap.add_argument("desc", nargs="?")
    ap.add_argument("vbw", nargs="?", type=int)
    ap.add_argument("vbh", nargs="?", type=int)
    ap.add_argument("--fonte", default="agy")
    ap.add_argument("--ref")
    ap.add_argument("--lote")
    a = ap.parse_args()

    if a.lote:
        itens = json.loads(pathlib.Path(a.lote).read_text())
        ok = 0
        for it in itens:
            print(f"[{it['kind']}]")
            if forjar(it["kind"], it["desc"], it["vbw"], it["vbh"], a.fonte, it.get("ref") or a.ref):
                ok += 1
        print(f"\n{ok}/{len(itens)} aprovados")
        return 0 if ok == len(itens) else 1

    if not all([a.kind, a.desc, a.vbw, a.vbh]):
        ap.error("informe kind, desc, vbW e vbH — ou use --lote")
    print(f"[{a.kind}]")
    return 0 if forjar(a.kind, a.desc, a.vbw, a.vbh, a.fonte, a.ref) else 1


if __name__ == "__main__":
    sys.exit(main())
