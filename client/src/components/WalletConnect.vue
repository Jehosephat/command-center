<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useWallet } from '@/composables/useWallet'

const {
  connected,
  isConnecting,
  error,
  address,
  alias,
  truncatedAddress,
  connect,
  disconnect,
  checkConnection,
  clearError,
} = useWallet()

// Copy state
const copied = ref(false)
const aliasCopied = ref(false)

async function copyAddress() {
  if (!address.value) return
  try {
    await navigator.clipboard.writeText(address.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy address:', err)
  }
}

async function copyAlias() {
  if (!alias.value) return
  try {
    await navigator.clipboard.writeText(alias.value)
    aliasCopied.value = true
    setTimeout(() => {
      aliasCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy alias:', err)
  }
}

// Dropdown state
const showDropdown = ref(false)
const dropdownRef = ref<HTMLDivElement | null>(null)

// Auto-reconnect on mount
onMounted(async () => {
  await checkConnection()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Close dropdown when clicking outside
function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    showDropdown.value = false
  }
}

function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

async function handleConnect() {
  clearError()
  await connect()
}

function handleDisconnect() {
  showDropdown.value = false
  disconnect()
}
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <!-- Connect Button (disconnected state) -->
    <button
      v-if="!connected"
      @click="handleConnect"
      :disabled="isConnecting"
      class="btn-primary flex items-center gap-2"
      :class="{ 'opacity-70 cursor-not-allowed': isConnecting }"
    >
      <svg
        v-if="isConnecting"
        class="animate-spin h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span>{{ isConnecting ? 'Connecting...' : 'Connect Wallet' }}</span>
    </button>

    <!-- Connected Button with Dropdown -->
    <button
      v-else
      @click="toggleDropdown"
      class="btn-secondary flex items-center gap-2"
    >
      <span class="w-2 h-2 bg-green-500 rounded-full"></span>
      <span>{{ truncatedAddress }}</span>
      <svg
        class="h-4 w-4 transition-transform"
        :class="{ 'rotate-180': showDropdown }"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>

    <!-- Dropdown Menu -->
    <div
      v-if="connected && showDropdown"
      class="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
    >
      <!-- Alias Row (only shown when resolved) -->
      <div
        v-if="alias"
        class="px-4 py-2 border-b border-gray-200 dark:border-gray-700"
      >
        <div class="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
          Alias
        </div>
        <button
          @click="copyAlias"
          class="w-full text-left flex items-center gap-2 group"
          :title="alias"
        >
          <span class="text-sm font-mono text-gray-700 dark:text-gray-200 truncate flex-1">
            {{ alias }}
          </span>
          <svg
            v-if="!aliasCopied"
            class="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <svg
            v-else
            class="h-3.5 w-3.5 text-green-500 flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </button>
      </div>

      <!-- Copy Address Button -->
      <button
        @click="copyAddress"
        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      >
        <!-- Copy Icon -->
        <svg
          v-if="!copied"
          class="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <!-- Checkmark Icon (shown after copy) -->
        <svg
          v-else
          class="h-4 w-4 text-green-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        {{ copied ? 'Copied!' : 'Copy Address' }}
      </button>

      <!-- Disconnect Button -->
      <button
        @click="handleDisconnect"
        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      >
        <svg
          class="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        Disconnect
      </button>
    </div>

    <!-- Error Message -->
    <div
      v-if="error && !connected"
      class="absolute right-0 mt-2 w-72 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 z-50"
    >
      <div class="flex items-start gap-2">
        <svg
          class="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div class="flex-1">
          <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
          <button
            @click="clearError"
            class="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
