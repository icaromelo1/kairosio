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
        :class="{ 'vp-member-connected': micAvailable }"
        :title="micAvailable ? (micMuted ? 'Clique pra ligar seu microfone' : 'Clique pra desligar seu microfone') : 'Sem acesso ao microfone — só dá pra ouvir'"
        @click="micAvailable && $emit('toggleMic')"
      >
        <span class="vp-dot vp-dot-me"></span>
        <span class="col ellipsis vp-member-name">{{ selfName }} <span class="vp-you-tag">(você)</span></span>
        <span class="vp-member-ic">{{ !micAvailable ? '🚫' : micMuted ? '🔇' : '🎙' }}</span>
      </button>
      <button
        v-for="p in peers" :key="p.id" class="vp-member row items-center q-gutter-xs"
        :class="{ 'vp-member-connected': p.connected }"
        @click="p.connected && $emit('togglePeerMute', p.id)"
      >
        <span class="vp-dot" :class="p.connected ? 'vp-dot-on' : 'vp-dot-off'"></span>
        <span class="col ellipsis vp-member-name">{{ p.name }}</span>
        <span v-if="p.connected" class="vp-member-ic">{{ p.muted ? '🔇' : '🔊' }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  mode: 'proximity' | 'room'
  voiceOn: boolean
  micMuted: boolean
  micAvailable: boolean
  selfName: string
  peers: { id: string; name: string; connected: boolean; muted: boolean }[]
}>()
defineEmits<{
  toggleVoice: []
  toggleMic: []
  togglePeerMute: [id: string]
  setMode: [mode: 'proximity' | 'room']
}>()
</script>

<style scoped>
.vp-root { min-width: 0; }

.vp-mode-btn {
  appearance: none;
  background: rgba(124, 58, 237, 0.12);
  border: 1px solid rgba(124, 58, 237, 0.32);
  color: var(--text-2);
  font-size: 10px;
  padding: 3px 8px;
  cursor: pointer;
  white-space: nowrap;
}

.vp-toggle {
  appearance: none;
  width: 100%;
  text-align: left;
  background: var(--bg-1);
  border: 1px solid var(--border-strong);
  color: var(--text);
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.vp-toggle-on {
  border-color: var(--ok);
  background: rgba(52, 211, 153, 0.14);
}

.vp-member {
  appearance: none;
  width: 100%;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-2);
  padding: 6px 8px;
  font-size: 12px;
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
.vp-member-name { min-width: 0; }
.vp-you-tag { color: var(--text-4); font-size: 10px; }
.vp-member-ic { flex-shrink: 0; }

.vp-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}
.vp-dot-me { background: var(--primary-hi); }
.vp-dot-on { background: var(--ok); }
.vp-dot-off { background: var(--text-4); }
</style>
