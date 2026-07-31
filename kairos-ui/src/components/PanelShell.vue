<template>
  <!-- keydown no overlay: com o foco num campo do painel o Esc não chega ao
       GamePage (o listener global ignora input/textarea), e o painel ficaria preso -->
  <div class="ps-overlay" @click="emit('close')" @keydown.esc="emit('close')">
    <div class="k-card ps-card" :class="`ps-card-${size}`" @click.stop>
      <header class="ps-head">
        <span class="k-chip"><PixelIcon :name="icon" size="0.6875rem" />{{ title }}</span>
        <button class="k-btn k-btn-ghost k-btn-sm" @click="emit('close')">
          esc<PixelIcon name="close" size="0.75rem" />
        </button>
      </header>

      <div class="ps-body">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PixelIcon from '@/components/PixelIcon.vue'

withDefaults(defineProps<{ title: string; icon: string; size?: 'md' | 'lg' }>(), { size: 'md' })

const emit = defineEmits<{ close: [] }>()
</script>

<style scoped>
.ps-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(0.375rem);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 1.5rem;
}

.ps-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  max-height: 86vh;
  min-height: 0;
  width: 100%;
}

.ps-card-md { max-width: 30rem; }
.ps-card-lg { max-width: 54rem; }

.ps-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex: none;
}

.ps-body {
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  padding-right: 0.25rem;
}

@media (max-width: 26.25rem) {
  .ps-overlay { padding: 0.625rem; }
  .ps-card { padding: 0.875rem; }
}
</style>
