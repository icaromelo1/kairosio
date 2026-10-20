<template>
  <PanelShell title="áudio e vídeo" icon="headphone" @close="emit('close')">
    <div class="dp-root">
      <p v-if="carregando" class="k-hint-text">Procurando aparelhos…</p>
      <p v-else-if="erro" class="dp-erro">{{ erro }}</p>
      <template v-else>
        <label v-for="campo in CAMPOS" :key="campo.tipo" class="dp-campo">
          <span class="k-label">{{ campo.nome }}</span>
          <select
            class="k-input k-input-sm"
            :value="media.dispositivos[campo.tipo]"
            :disabled="!lista[campo.tipo].length"
            @change="trocar(campo.tipo, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">padrão do sistema</option>
            <option v-for="d in lista[campo.tipo]" :key="d.deviceId" :value="d.deviceId">{{ d.label || 'aparelho sem nome' }}</option>
          </select>
          <span v-if="!lista[campo.tipo].length" class="k-hint-text">{{ campo.vazio }}</span>
        </label>
        <button class="k-btn k-btn-ghost k-btn-sm dp-teste" :disabled="tocando" @click="testarSom">
          <PixelIcon name="volume-2" size="0.75rem" />{{ tocando ? 'tocando…' : 'testar alto-falante' }}
        </button>
        <p class="k-hint-text">A escolha fica salva neste navegador e vale na hora, mesmo com a voz ligada.</p>
      </template>
    </div>
  </PanelShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PanelShell from '@/components/PanelShell.vue'
import PixelIcon from '@/components/PixelIcon.vue'
import { media } from '@/services/media'
import type { TipoDeDispositivo } from '@/services/media.state'

const emit = defineEmits<{ close: [] }>()

const CAMPOS: { tipo: TipoDeDispositivo; nome: string; vazio: string }[] = [
  { tipo: 'audioinput', nome: 'microfone', vazio: 'Nenhum microfone encontrado.' },
  { tipo: 'videoinput', nome: 'câmera', vazio: 'Nenhuma câmera encontrada.' },
  { tipo: 'audiooutput', nome: 'alto-falante', vazio: 'Este navegador não deixa escolher a saída de som.' },
]

const lista = ref<Record<TipoDeDispositivo, MediaDeviceInfo[]>>({ audioinput: [], videoinput: [], audiooutput: [] })
const carregando = ref(true)
const erro = ref('')
const tocando = ref(false)

async function trocar(tipo: TipoDeDispositivo, id: string) {
  erro.value = ''
  try {
    await media.definirDispositivo(tipo, id)
  } catch {
    erro.value = 'Não deu para usar esse aparelho. Ele pode estar em uso por outro programa.'
  }
}

async function testarSom() {
  tocando.value = true
  const contexto = new AudioContext()
  const destino = contexto.createMediaStreamDestination()
  const oscilador = contexto.createOscillator()
  const volume = contexto.createGain()
  oscilador.frequency.value = 660
  volume.gain.setValueAtTime(0.0001, contexto.currentTime)
  volume.gain.exponentialRampToValueAtTime(0.25, contexto.currentTime + 0.05)
  volume.gain.exponentialRampToValueAtTime(0.0001, contexto.currentTime + 0.9)
  oscilador.connect(volume).connect(destino)
  const elemento = new Audio()
  elemento.srcObject = destino.stream
  const saida = media.dispositivos.audiooutput
  const comSaida = elemento as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
  if (saida && comSaida.setSinkId) await comSaida.setSinkId(saida).catch(() => undefined)
  oscilador.start()
  await elemento.play().catch(() => undefined)
  window.setTimeout(() => {
    oscilador.stop()
    elemento.pause()
    void contexto.close()
    tocando.value = false
  }, 1000)
}

onMounted(async () => {
  try {
    lista.value = await media.listarDispositivos()
  } catch {
    erro.value = 'O navegador não liberou o acesso aos aparelhos. Permita o microfone na barra de endereço e abra de novo.'
  } finally {
    carregando.value = false
  }
})
</script>

<style scoped>
.dp-root { display: flex; flex-direction: column; gap: 0.875rem; }
.dp-campo { display: flex; flex-direction: column; gap: 0.25rem; }
.dp-teste { align-self: flex-start; }
.dp-erro { margin: 0; color: var(--danger, #a83232); font-size: 0.8125rem; }
</style>
