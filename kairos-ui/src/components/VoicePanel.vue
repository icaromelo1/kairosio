<template>
  <div class="column q-gutter-xs vp-root">
    <div class="row items-center justify-between">
      <div class="gp-section-label">Voz</div>
      <button
        class="vp-mode-btn"
        :title="mode === 'room' ? 'Voz de toda a sala — clique pra voltar à proximidade' : 'Voz por proximidade — clique pra falar com a sala toda'"
        @click="$emit('setMode', mode === 'room' ? 'proximity' : 'room')"
      >{{ mode === 'room' ? '📢 sala' : '📍 perto' }}</button>
    </div>

    <button
      class="vp-toggle"
      :class="{ 'vp-toggle-on': voiceOn }"
      @click="$emit('toggleVoice')"
    >{{ voiceOn ? '🔊 Ouvindo a sala' : '🔈 Entrar na voz' }}</button>

    <template v-if="voiceOn">
      <button
        class="vp-member row items-center q-gutter-xs"
        :class="{ 'vp-member-connected': micAvailable, 'vp-member-speaking': selfSpeaking }"
        :title="micAvailable ? (micMuted ? 'Clique pra ligar seu microfone' : 'Clique pra desligar seu microfone') : 'Sem acesso ao microfone — só dá pra ouvir'"
        @click="micAvailable && $emit('toggleMic')"
      >
        <span class="vp-dot vp-dot-me"></span>
        <span class="col ellipsis vp-member-name">{{ selfName }} <span class="vp-you-tag">(você)</span></span>
        <span class="vp-member-ic">{{ !micAvailable ? '🚫' : micMuted ? '🔇' : '🎙' }}</span>
      </button>
      <button
        class="vp-cam-btn"
        :class="{ 'vp-cam-btn-on': cameraOn }"
        :disabled="!cameraAvailable"
        :title="cameraOn ? 'Clique pra desligar sua câmera' : 'Clique pra ligar sua câmera'"
        @click="$emit('toggleCamera')"
      >{{ cameraOn ? '📹 câmera ligada' : '📷 ligar câmera' }}</button>
      <button
        v-for="p in peers" :key="p.id" class="vp-member row items-center q-gutter-xs"
        :class="{ 'vp-member-connected': p.connected, 'vp-member-speaking': speakingPeerIds.includes(p.id) }"
        @click="p.connected && $emit('togglePeerMute', p.id)"
      >
        <span class="vp-dot" :class="p.connected ? 'vp-dot-on' : 'vp-dot-off'"></span>
        <span class="col ellipsis vp-member-name">{{ p.name }}</span>
        <span v-if="p.connected && videoPeerIds.includes(p.id)" class="vp-member-ic">📹</span>
        <span v-if="p.connected" class="vp-member-ic">{{ p.muted ? '🔇' : '🔊' }}</span>
      </button>
      <VideoGrid v-if="videoPeerIds.length" :video-elements="videoElements" :peer-ids="videoPeerIds" />
    </template>
  </div>
</template>

<script setup lang="ts">
import VideoGrid from './VideoGrid.vue'

withDefaults(defineProps<{
  mode: 'proximity' | 'room'
  voiceOn: boolean
  micMuted: boolean
  micAvailable: boolean
  selfName: string
  peers: { id: string; name: string; connected: boolean; muted: boolean }[]
  selfSpeaking?: boolean
  speakingPeerIds?: string[]
  cameraOn?: boolean
  cameraAvailable?: boolean
  videoPeerIds?: string[]
  videoElements?: Map<string, HTMLVideoElement>
}>(), {
  selfSpeaking: false,
  speakingPeerIds: () => [],
  cameraOn: false,
  cameraAvailable: true,
  videoPeerIds: () => [],
  videoElements: () => new Map(),
})
defineEmits<{
  toggleVoice: []
  toggleMic: []
  togglePeerMute: [id: string]
  setMode: [mode: 'proximity' | 'room']
  toggleCamera: []
}>()
</script>

<style scoped>
.vp-root { min-width: 0; }

.vp-mode-btn {
  appearance: none;
  background: rgba(124, 58, 237, 0.12);
  border: 0.0625rem solid rgba(124, 58, 237, 0.32);
  color: var(--text-2);
  font-size: 0.625rem;
  padding: 0.1875rem 0.5rem;
  cursor: pointer;
  white-space: nowrap;
}

.vp-toggle {
  appearance: none;
  width: 100%;
  text-align: left;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border-strong);
  color: var(--text);
  padding: 0.5rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}
.vp-toggle-on {
  border-color: var(--ok);
  background: rgba(52, 211, 153, 0.14);
}

.vp-cam-btn {
  appearance: none;
  width: 100%;
  text-align: left;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border-strong);
  color: var(--text);
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}
.vp-cam-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.vp-cam-btn-on {
  border-color: var(--ok);
  background: rgba(52, 211, 153, 0.14);
}

.vp-member {
  appearance: none;
  width: 100%;
  background: transparent;
  border: 0.0625rem solid transparent;
  color: var(--text-2);
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  cursor: default;
  min-width: 0;
  font-family: inherit;
}
.vp-member-connected {
  cursor: pointer;
}
.vp-member-connected:hover {
  background: var(--bg-3);
  border-color: var(--border);
}
.vp-member-speaking {
  border-color: var(--primary-hi);
  box-shadow: 0 0 0 0.0625rem var(--primary-hi);
}
.vp-member-name { min-width: 0; }
.vp-you-tag { color: var(--text-4); font-size: 0.625rem; }
.vp-member-ic { flex-shrink: 0; }

.vp-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
}
.vp-dot-me { background: var(--primary-hi); }
.vp-dot-on { background: var(--ok); }
.vp-dot-off { background: var(--text-4); }
</style>
