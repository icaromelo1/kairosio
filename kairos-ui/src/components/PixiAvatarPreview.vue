<template>
  <div ref="host" style="width:100%;height:100%"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Application } from 'pixi.js'
import { AvatarPuppet, type AvatarLook } from '@/game/pixi/avatar'

const props = defineProps<{
  hairStyle: AvatarLook['hairStyle']
  hairColor: string
  skin: string
  topColor: string
  pantsColor: string
  accessory?: AvatarLook['accessory']
}>()

const host = ref<HTMLElement | null>(null)
let app: Application | null = null
let puppet: AvatarPuppet | null = null

function look(): AvatarLook {
  return {
    hairStyle: props.hairStyle,
    hairColor: props.hairColor,
    skin: props.skin,
    topColor: props.topColor,
    pantsColor: props.pantsColor,
    accessory: props.accessory,
  }
}

function place() {
  if (!app || !puppet) return
  puppet.root.position.set(app.renderer.width / 2, app.renderer.height * 0.82)
}

function rebuild() {
  if (!app) return
  if (puppet) puppet.destroy()
  puppet = new AvatarPuppet(look())
  app.stage.addChild(puppet.root)
  place()
}

// vive dentro de um painel que fecha na tecla Esc: fechar antes do init assíncrono
// terminar deixaria um ticker e um contexto de WebGL vivos pra sempre
let gone = false

onMounted(async () => {
  const created = new Application()
  await created.init({ backgroundAlpha: 0, resizeTo: host.value!, antialias: false })
  if (gone || !host.value) { created.destroy(true); return }
  app = created
  host.value.appendChild(app.canvas)
  puppet = new AvatarPuppet(look())
  app.stage.addChild(puppet.root)
  place()
  app.ticker.add((ticker) => {
    puppet?.setPose('idle')
    puppet?.update(ticker.deltaMS / 1000)
    place()
  })
})

// rebuild ao mudar qualquer parte da customização
watch(() => [props.hairStyle, props.hairColor, props.skin, props.topColor, props.pantsColor, props.accessory], rebuild)

onUnmounted(() => {
  gone = true
  app?.destroy(true)
  app = null
})
</script>
