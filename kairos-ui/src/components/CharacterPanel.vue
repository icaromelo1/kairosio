<template>
  <PanelShell title="personagem" icon="user" size="lg" @close="emit('close')">
    <div class="cp-grid">
      <div class="cp-stage">
        <span class="cp-eyebrow">seu avatar</span>
        <div class="cp-preview">
          <PixiAvatarPreview
            :hairStyle="characterStore.hairStyle"
            :hairColor="characterStore.hairColor"
            :skin="characterStore.skin"
            :topColor="characterStore.topColor"
            :pantsColor="characterStore.pantsColor"
            :accessory="characterStore.accessory"
          />
        </div>
        <div class="cp-handle">
          <span class="cp-eyebrow">seu @nome</span>
          <p class="cp-handle-hint">
            É como você aparece no mundo, sobre o avatar e na lista de amigos.
          </p>

          <div class="cp-handle-row">
            <span class="cp-at">@</span>
            <input
              v-model.trim="handle"
              class="k-input cp-handle-input"
              type="text"
              maxlength="20"
              autocapitalize="off"
              autocomplete="off"
              spellcheck="false"
              placeholder="seu.nome"
              @keyup.enter="salvarHandle"
            />
            <button
              class="k-btn k-btn-ghost k-btn-sm"
              :disabled="!podeSalvarHandle"
              @click="salvarHandle"
            >{{ salvandoHandle ? 'Salvando…' : (handleAtual ? 'Trocar' : 'Definir') }}</button>
          </div>

          <p v-if="handleErro" class="cp-error">{{ handleErro }}</p>
          <p v-else-if="handleOk" class="cp-handle-ok">{{ handleOk }}</p>
          <p v-else-if="handleAviso" class="cp-handle-aviso">{{ handleAviso }}</p>
          <p v-else-if="!handleAtual" class="cp-handle-aviso">
            Você ainda não tem um @nome — sem ele ninguém consegue te adicionar.
          </p>
          <p v-else-if="bloqueadoAte" class="cp-handle-hint">
            Próxima troca liberada em {{ bloqueadoAte }}.
          </p>
        </div>
      </div>

      <div class="cp-controls">
        <div class="cp-tabs">
          <button
            v-for="tab in TABS" :key="tab.id"
            class="cp-tab" :class="{ 'k-active': activeTab === tab.id }"
            @click="activeTab = tab.id"
          >{{ tab.label }}</button>
        </div>

        <div v-if="activeTab === 'hair'" class="cp-tab-content">
          <div class="cp-label">Estilo</div>
          <div class="cp-hair-grid">
            <button
              v-for="style in HAIR_STYLES" :key="style.id"
              class="cp-hair" :class="{ 'k-active': characterStore.hairStyle === style.id }"
              @click="characterStore.hairStyle = style.id"
            >
              <PixelAvatar
                :scale="2"
                :bobbing="false"
                :shadow="false"
                :hairStyle="style.id"
                :hairColor="characterStore.hairColor"
                :skin="characterStore.skin"
                :topColor="characterStore.topColor"
                :pantsColor="characterStore.pantsColor"
              />
              <span class="cp-hair-label">{{ style.label }}</span>
            </button>
          </div>

          <div class="cp-label">Cor do cabelo</div>
          <div class="cp-swatches">
            <button
              v-for="color in HAIR_COLORS" :key="color"
              class="k-swatch" :class="{ 'k-active': characterStore.hairColor === color }"
              :style="{ background: color }"
              :aria-label="`cor de cabelo ${color}`"
              @click="characterStore.hairColor = color"
            />
          </div>
        </div>

        <div v-if="activeTab === 'skin'" class="cp-tab-content">
          <div class="cp-label">Tom de pele</div>
          <div class="cp-swatches">
            <button
              v-for="color in SKIN_TONES" :key="color"
              class="k-swatch k-swatch-lg" :class="{ 'k-active': characterStore.skin === color }"
              :style="{ background: color }"
              :aria-label="`tom de pele ${color}`"
              @click="characterStore.skin = color"
            />
          </div>
        </div>

        <div v-if="activeTab === 'outfit'" class="cp-tab-content">
          <div class="cp-label">Cor da camisa</div>
          <div class="cp-swatches">
            <button
              v-for="color in TOP_COLORS" :key="color"
              class="k-swatch k-swatch-lg" :class="{ 'k-active': characterStore.topColor === color }"
              :style="{ background: color }"
              :aria-label="`cor da camisa ${color}`"
              @click="characterStore.topColor = color"
            />
          </div>

          <div class="cp-label">Cor da calça</div>
          <div class="cp-swatches">
            <button
              v-for="color in PANTS_COLORS" :key="color"
              class="k-swatch k-swatch-lg" :class="{ 'k-active': characterStore.pantsColor === color }"
              :style="{ background: color }"
              :aria-label="`cor da calça ${color}`"
              @click="characterStore.pantsColor = color"
            />
          </div>

          <div class="cp-label">Acessório</div>
          <div class="cp-swatches">
            <button
              v-for="a in ACCESSORIES" :key="a.id"
              class="k-btn k-btn-ghost k-btn-xs"
              :class="{ 'k-active': characterStore.accessory === a.id }"
              @click="characterStore.accessory = a.id"
            >{{ a.label }}</button>
          </div>
        </div>

        <div v-if="activeTab === 'photo'" class="cp-tab-content">
          <div class="cp-label">Foto de perfil</div>
          <p class="k-hint-text cp-hint">
            Se você configurar uma foto, ela substitui o avatar pixel no jogo (todo mundo passa a te
            ver por ela). Sem foto, continua o sprite normal.
          </p>
          <div class="cp-photo-row">
            <div class="cp-photo">
              <img v-if="characterStore.photoFile" :src="photoUrl(characterStore.photoFile)" alt="Sua foto de perfil" />
              <span v-else class="cp-photo-empty">sem foto</span>
            </div>
            <div class="cp-photo-actions">
              <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="cp-file" @change="onPhotoPicked" />
              <button class="k-btn k-btn-ghost k-btn-sm" :disabled="uploadingPhoto" @click="fileInput?.click()">
                {{ uploadingPhoto ? 'Enviando…' : (characterStore.photoFile ? 'Trocar foto' : 'Enviar foto') }}
              </button>
              <button v-if="characterStore.photoFile" class="k-btn k-btn-ghost k-btn-sm" @click="onRemovePhoto">Remover foto</button>
            </div>
          </div>
          <p v-if="photoError" class="cp-error">{{ photoError }}</p>
        </div>

        <button class="k-btn k-btn-accent cp-save" :disabled="saving" @click="save">
          {{ saving ? 'Salvando…' : 'Salvar e voltar ao jogo' }}
        </button>
      </div>
    </div>
  </PanelShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PanelShell from '@/components/PanelShell.vue'
import PixelAvatar from '@/components/pixel/PixelAvatar.vue'
import PixiAvatarPreview from '@/components/PixiAvatarPreview.vue'
import { useCharacterStore, type HairStyle } from '@/stores/useCharacterStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { emitNomeAtualizado } from '@/services/presence'
import { getCharacter, saveCharacter, uploadPhoto, removePhoto, photoUrl } from '@/services/character.api'
import { changeUsername, me, UsernameError } from '@/services/auth.api'

const emit = defineEmits<{ close: [] }>()

const characterStore = useCharacterStore()
const auth = useAuthStore()

const activeTab = ref<'hair' | 'skin' | 'outfit' | 'photo'>('hair')
const saving = ref(false)

const handle = ref('')
const handleAtual = ref('')
const handleErro = ref('')
const handleOk = ref('')
const handleAviso = ref('')
const salvandoHandle = ref(false)
const proximaTrocaEm = ref<string | null>(null)

const bloqueadoAte = computed(() => {
  if (!proximaTrocaEm.value) return ''
  const data = new Date(proximaTrocaEm.value)
  if (Number.isNaN(data.getTime()) || data.getTime() <= Date.now()) return ''
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
})

const podeSalvarHandle = computed(
  () => !salvandoHandle.value && !!handle.value && handle.value.toLowerCase() !== handleAtual.value.toLowerCase(),
)

onMounted(async () => {
  if (!auth.isAuthenticated) return
  const saved = await getCharacter()
  if (saved && saved.hairStyle) characterStore.$patch(saved)
  try {
    const perfil = await me()
    handleAtual.value = perfil.username ?? ''
    handle.value = perfil.username ?? ''
  } catch {
    handleAviso.value = 'Não deu pra ler seu @nome agora.'
  }
})

async function salvarHandle() {
  if (!podeSalvarHandle.value) return
  salvandoHandle.value = true
  handleErro.value = ''
  handleOk.value = ''
  handleAviso.value = ''
  try {
    const view = await changeUsername(handle.value)
    handleAtual.value = view.username ?? ''
    handle.value = view.username ?? ''
    proximaTrocaEm.value = view.proximaTrocaEm
    handleOk.value = `Pronto: agora você é @${view.username}.`
    emitNomeAtualizado()
  } catch (e) {
    if (e instanceof UsernameError) {
      handleErro.value = e.message
      if (e.proximaTrocaEm) proximaTrocaEm.value = e.proximaTrocaEm
    } else {
      handleErro.value = 'Não deu pra trocar o nome de usuário.'
    }
  } finally {
    salvandoHandle.value = false
  }
}

async function save() {
  if (auth.isAuthenticated) {
    saving.value = true
    await saveCharacter({
        hairStyle: characterStore.hairStyle,
      hairColor: characterStore.hairColor,
      skin: characterStore.skin,
      topColor: characterStore.topColor,
      pantsColor: characterStore.pantsColor,
      accessory: characterStore.accessory,
    })
    saving.value = false
  }
  emit('close')
}

const fileInput = ref<HTMLInputElement | null>(null)
const uploadingPhoto = ref(false)
const photoError = ref('')

async function onPhotoPicked(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  photoError.value = ''
  uploadingPhoto.value = true
  const res = await uploadPhoto(file)
  uploadingPhoto.value = false
  if (fileInput.value) fileInput.value.value = ''
  if (!res.ok) { photoError.value = res.error || 'Falha ao enviar a foto'; return }
  characterStore.photoFile = res.photoFile || null
}

async function onRemovePhoto() {
  photoError.value = ''
  const ok = await removePhoto()
  if (ok) characterStore.photoFile = null
  else photoError.value = 'Falha ao remover a foto'
}

const TABS = [
  { id: 'hair', label: 'Cabelo' },
  { id: 'skin', label: 'Pele' },
  { id: 'outfit', label: 'Roupa' },
  { id: 'photo', label: 'Foto' },
] as const

const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'short', label: 'short' },
  { id: 'curly', label: 'curly' },
  { id: 'ponytail', label: 'ponytail' },
  { id: 'mohawk', label: 'mohawk' },
  { id: 'helmet', label: 'helmet' },
  { id: 'buzz', label: 'buzz' },
  { id: 'long', label: 'long' },
]

const HAIR_COLORS = [
  '#1a1a1a', '#3d2817', '#6b3410', '#a0522d', '#d4a259',
  '#f4d35e', '#c2185b', '#7b1fa2', '#1565c0', '#cfd8dc',
  '#e84393', '#00b894', '#fd79a8', '#6c5ce7', '#b2bec3',
]

const SKIN_TONES = [
  '#ffe0bd', '#f4d4ba', '#e8b894', '#d9a066', '#c98c68',
  '#9c6b3f', '#7a5230', '#6b4226', '#4e3320', '#3e2718',
]

const TOP_COLORS = [
  '#7c3aed', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#e8e8f0',
  '#ec4899', '#f97316', '#84cc16', '#0ea5e9', '#1e293b', '#a855f7',
]

const PANTS_COLORS = [
  '#1f2937', '#3b3b4a', '#4c1d95', '#0f766e', '#7f1d1d', '#92400e',
  '#0c4a6e', '#365314', '#831843', '#111827', '#5b21b6', '#78350f',
]

const ACCESSORIES = [
  { id: 'none' as const, label: 'Nenhum' },
  { id: 'glasses' as const, label: 'Óculos' },
  { id: 'hat' as const, label: 'Chapéu' },
]
</script>

<style scoped>
.cp-grid {
  display: grid;
  grid-template-columns: 15rem 1fr;
  gap: 1.25rem;
  align-items: start;
}

.cp-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  padding: 1rem 0.75rem;
}

.cp-eyebrow {
  font-family: var(--f-pixel);
  font-size: 0.5625rem;
  color: var(--text-3);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.cp-preview {
  width: 100%;
  height: 11rem;
  background: radial-gradient(ellipse at center, var(--primary-glow) 0%, transparent 70%);
}


.cp-handle {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.375rem;
  width: 100%;
  border-top: 0.0625rem solid var(--border);
  padding-top: 0.75rem;
}

.cp-handle .cp-eyebrow { text-align: center; }

.cp-handle-hint {
  margin: 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--text-3);
  text-align: center;
}

.cp-handle-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.cp-at {
  font-family: var(--f-mono);
  font-size: 0.875rem;
  color: var(--text-3);
}

.cp-handle-input {
  flex: 1;
  min-width: 0;
  font-family: var(--f-mono);
}

.cp-handle-ok { color: var(--ok); font-size: 0.75rem; margin: 0; text-align: center; }
.cp-handle-aviso { color: var(--warn); font-size: 0.75rem; margin: 0; text-align: center; }

.cp-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.cp-tabs {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  border: 0.1875rem solid var(--border-strong);
}

.cp-tab {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--text-3);
  font-family: var(--f-pixel);
  font-size: 0.5625rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.625rem 0.375rem;
  cursor: pointer;
}
.cp-tab:not(:last-child) { border-right: 0.125rem solid var(--border-strong); }

.cp-tab-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cp-label {
  font-family: var(--f-pixel);
  font-size: 0.5625rem;
  color: var(--text-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.cp-hair-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(3.75rem, 1fr));
  gap: 0.375rem;
}

.cp-hair {
  appearance: none;
  background: var(--bg-3);
  border: 0.125rem solid transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.25rem;
}
.cp-hair:hover:not(.k-active) { border-color: var(--border-strong); }

.cp-hair-label {
  font-family: var(--f-pixel);
  font-size: 0.4375rem;
  color: var(--text-3);
  text-transform: lowercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.cp-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.cp-hint { margin: 0; }

.cp-photo-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.cp-photo {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-1);
  border: 0.125rem solid var(--border-strong);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.cp-photo img { width: 100%; height: 100%; object-fit: cover; }

.cp-photo-empty {
  font-size: 0.5625rem;
  color: var(--text-4);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cp-photo-actions {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  align-items: flex-start;
}

.cp-file { display: none; }

.cp-error { color: var(--err); font-size: 0.75rem; margin: 0; }

.cp-save { width: 100%; margin-top: 0.25rem; }

@media (max-width: 44rem) {
  .cp-grid { grid-template-columns: 1fr; }
  .cp-preview { height: 9rem; }
}
</style>
