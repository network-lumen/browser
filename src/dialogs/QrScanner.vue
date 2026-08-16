<template>
  <UiModal :model-value="true" :title="title" panel-class="w-full max-w-500px max-h-90vh" @update:model-value="$emit('close')">
        <div>
          <!-- Camera View -->
          <div v-if="!scannedData && !error" class="border-radius-12px relative overflow-hidden bg-black aspect-square max-h-400px">
            <video ref="videoElement" class="w-full h-full object-fit-cover" autoplay playsinline></video>
            <canvas ref="canvasElement" class="hidden absolute top-0 left-0"></canvas>
            <div class="border-radius-12px absolute top-half left-half translate-center border-2-white-a50 w-250px h-250px">
              <div v-for="corner in QR_CORNERS" :key="corner.key" class="absolute w-32px h-32px border-3-primary" :class="corner.class"></div>
            </div>
            <p class="color-white m-0px border-radius-20px text-14px absolute py-8px px-16px bottom-20px left-half translate-x-center backdrop-blur-8 bg-black-a60">{{ t('Position QR code within the frame') }}</p>
          </div>

          <div v-if="error" class="text-center py-40px px-20px">
            <AlertCircle :size="48" class="color-error mb-16px" />
            <h4 class="color-text-primary text-20px txt-weight-light m-0px mb-8px">{{ error }}</h4>
            <p v-if="error.includes('permission')" class="color-text-secondary text-14px m-0px mb-24px">
              {{ t('Please allow camera access in your browser settings') }}
            </p>
            <UiButton variant="primary" @click="initializeScanner">
              <RefreshCw :size="16" />
              <span>{{ t('Try again') }}</span>
            </UiButton>
          </div>

          <div v-if="scannedData" class="text-center py-40px px-20px">
            <CheckCircle :size="48" class="color-success mb-16px" />
            <h4 class="color-text-primary text-20px txt-weight-light m-0px mb-8px">{{ t('QR code scanned') }}</h4>

            <div class="text-left bg-secondary border-radius-8px p-16px m-0px mt-24px mb-24px">
              <div class="mb-12px">
                <span class="color-text-secondary block text-12px txt-weight-light text-uppercase mb-4px letter-spacing-005em">{{ t('Type') }}</span>
                <span class="color-text-primary text-14px fw-500">{{ detectedType }}</span>
              </div>
              <div>
                <span class="color-text-secondary block text-12px txt-weight-light text-uppercase mb-4px letter-spacing-005em">{{ t('Content') }}</span>
                <div class="bg-card color-text-primary text-13px border-1 border-radius-6px p-12px break-all overflow-y-auto mono max-h-120px">{{ scannedData }}</div>
              </div>
            </div>

            <div class="flex-justify-center gap-12px">
              <UiButton variant="secondary" @click="scanAgain" >
                <QrCode :size="16" />
                <span>{{ t('Scan again') }}</span>
              </UiButton>
              <UiButton variant="primary" @click="handleUseScannedData" >
                <Check :size="16" />
                <span>{{ t('Use this') }}</span>
              </UiButton>
            </div>
          </div>
        </div>
  </UiModal>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiButton from '../ui/UiButton.vue';
import UiModal from '../ui/UiModal.vue';
import { ref, onMounted, onUnmounted } from 'vue';
import { BrowserMultiFormatReader } from '@zxing/library';
import { AlertCircle, CheckCircle, RefreshCw, QrCode, Check } from 'lucide-vue-next';
import type { QrScannerProps } from '../types/qrScanner';

withDefaults(defineProps<QrScannerProps>(), {
  title: t('Scan QR code'),
  acceptedTypes: () => ['address', 'payment', 'walletconnect']
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'scan', data: { type: string; content: string; raw: string }): void;
}>();

const QR_CORNERS = [
  { key: 'top-left', class: 'top-n3px left-n3px border-right-none border-bottom-none rounded-tl-12px' },
  { key: 'top-right', class: 'top-n3px right-n3px border-left-none border-bottom-none rounded-tr-12px' },
  { key: 'bottom-left', class: 'bottom-n3px left-n3px border-right-none border-top-none rounded-bl-12px' },
  { key: 'bottom-right', class: 'bottom-n3px right-n3px border-left-none border-top-none rounded-br-12px' },
];

const videoElement = ref<HTMLVideoElement | null>(null);
const canvasElement = ref<HTMLCanvasElement | null>(null);
const scannedData = ref<string>('');
const detectedType = ref<string>('Unknown');
const error = ref<string>('');

let codeReader: BrowserMultiFormatReader | null = null;
let stream: MediaStream | null = null;

onMounted(() => {
  initializeScanner();
});

onUnmounted(() => {
  cleanup();
});

async function initializeScanner() {
  error.value = '';
  scannedData.value = '';
  
  try {
    // Request camera permission
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' } // Use back camera on mobile
    });

    if (videoElement.value) {
      videoElement.value.srcObject = stream;
    }

    // Initialize ZXing scanner
    codeReader = new BrowserMultiFormatReader();
    
    // Start scanning
    if (videoElement.value) {
      codeReader.decodeFromVideoElement(videoElement.value).then((result) => {
        const text = result.getText();
        handleScan(text);
      }).catch((err) => {
        // Ignore NotFoundException as it's thrown continuously while scanning
        if (err.name !== 'NotFoundException') {
          console.error('Decode error:', err);
        }
      });
    }
  } catch (err) {
    // getUserMedia reports which permission or device problem occurred through
    // the error's name, so it is read here rather than the message.
    const name = err instanceof Error ? err.name : '';
    if (name === 'NotAllowedError') {
      error.value = t('Camera permission denied');
    } else if (name === 'NotFoundError') {
      error.value = t('No camera found on this device');
    } else {
      error.value = t('Failed to access camera');
    }
    console.error('Scanner initialization error:', err);
  }
}

function handleScan(data: string) {
  scannedData.value = data;
  detectedType.value = detectQRType(data);
  
  // Stop scanning
  if (codeReader) {
    codeReader.reset();
  }
}

function detectQRType(data: string): string {
  // WalletConnect detection
  if (data.startsWith('wc:')) {
    return 'WalletConnect';
  }
  
  // Payment request detection (common formats)
  if (data.includes('amount=') || data.includes('payment') || data.startsWith('lumen:')) {
    return t('Payment request');
  }
  
  // Address detection (simple heuristic - adjust based on your address format)
  if (/^[a-zA-Z0-9]{32,}$/.test(data) || data.startsWith('lmn1') || data.startsWith('cosmos1')) {
    return t('Wallet address');
  }
  
  // URL detection
  if (data.startsWith('http://') || data.startsWith('https://')) {
    return 'URL';
  }
  
  return t('Unknown');
}

function scanAgain() {
  scannedData.value = '';
  detectedType.value = 'Unknown';
  initializeScanner();
}

function handleUseScannedData() {
  const type = detectedType.value.toLowerCase().replace(' ', '');
  emit('scan', {
    type,
    content: scannedData.value,
    raw: scannedData.value
  });
  emit('close');
}

function cleanup() {
  // Stop scanner
  if (codeReader) {
    codeReader.reset();
    codeReader = null;
  }
  
  // Stop camera stream
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  
  // Clear video
  if (videoElement.value) {
    videoElement.value.srcObject = null;
  }
}
</script>
