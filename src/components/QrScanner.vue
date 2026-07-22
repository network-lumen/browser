<template>
  <UiModal :model-value="true" :title="title" panel-class="w-full max-w-500px max-h-90vh" @update:model-value="$emit('close')">
        <div class="qr-scanner-content">
          <!-- Camera View -->
          <div v-if="!scannedData && !error" class="qr-camera-container border-radius-12px relative overflow-hidden bg-black aspect-square max-h-400px">
            <video ref="videoElement" class="qr-camera-video w-full h-full object-fit-cover" autoplay playsinline></video>
            <canvas ref="canvasElement" class="qr-camera-canvas hidden absolute top-0 left-0"></canvas>
            <div class="qr-scan-frame border-radius-12px absolute top-half left-half translate-center border-2-white-a50 w-250px h-250px">
              <div class="qr-corner qr-corner-top-left absolute w-30px h-30px border-right-none border-bottom-none top-n3px left-n3px border-3-accent-primary rounded-tl-12px"></div>
              <div class="qr-corner qr-corner-top-right absolute w-30px h-30px border-left-none border-bottom-none top-n3px right-n3px border-3-accent-primary rounded-tr-12px"></div>
              <div class="qr-corner qr-corner-bottom-left absolute w-30px h-30px border-right-none border-top-none bottom-n3px left-n3px border-3-accent-primary rounded-bl-12px"></div>
              <div class="qr-corner qr-corner-bottom-right absolute w-30px h-30px border-left-none border-top-none bottom-n3px right-n3px border-3-accent-primary rounded-br-12px"></div>
            </div>
            <p class="qr-scan-instruction color-white m-0px border-radius-20px text-14px absolute py-8px px-16px bottom-20px left-half translate-x-center backdrop-blur-8 background-rgba-0-0-0-0-6">Position QR code within the frame</p>
          </div>

          <!-- Error State -->
          <div v-if="error" class="qr-error-state text-center py-40px px-20px">
            <AlertCircle :size="48" class="qr-error-icon color-error mb-16px" />
            <h4 class="color-text-primary qr-error-state-h4 text-20px txt-weight-light m-0px mb-8px">{{ error }}</h4>
            <p v-if="error.includes('permission')" class="color-text-secondary text-14px qr-error-state-p m-0px mb-24px">
              Please allow camera access in your browser settings
            </p>
            <UiButton variant="primary" @click="initializeScanner">
              <RefreshCw :size="16" />
              <span>Try Again</span>
            </UiButton>
          </div>

          <!-- Success State -->
          <div v-if="scannedData" class="qr-success-state text-center py-40px px-20px">
            <CheckCircle :size="48" class="qr-success-icon color-success mb-16px" />
            <h4 class="color-text-primary qr-success-state-h4 text-20px txt-weight-light m-0px mb-8px">QR Code Scanned</h4>

            <div class="qr-scanned-data text-left bg-secondary border-radius-8px p-16px m-0px mt-24px mb-24px">
              <div class="qr-data-type mb-12px">
                <span class="qr-label color-text-secondary block text-12px txt-weight-light text-uppercase mb-4px letter-spacing-05px">Type:</span>
                <span class="qr-value color-text-primary text-14px fw-500">{{ detectedType }}</span>
              </div>
              <div class="qr-data-content">
                <span class="qr-label color-text-secondary block text-12px txt-weight-light text-uppercase mb-4px letter-spacing-05px">Content:</span>
                <div class="qr-value-box bg-card color-text-primary text-13px border-1 border-radius-6px p-12px break-all overflow-y-auto mono max-h-120px">{{ scannedData }}</div>
              </div>
            </div>

            <div class="qr-action-buttons flex-justify-center gap-12px">
              <UiButton variant="secondary" @click="scanAgain" >
                <QrCode :size="16" />
                <span>Scan Again</span>
              </UiButton>
              <UiButton variant="primary" @click="handleUseScannedData" >
                <Check :size="16" />
                <span>Use This</span>
              </UiButton>
            </div>
          </div>
        </div>
  </UiModal>
</template>

<script setup lang="ts">
import UiButton from '../ui/UiButton.vue';
import UiModal from '../ui/UiModal.vue';
import { ref, onMounted, onUnmounted } from 'vue';
import { BrowserMultiFormatReader } from '@zxing/library';
import { AlertCircle, CheckCircle, RefreshCw, QrCode, Check } from 'lucide-vue-next';

interface Props {
  title?: string;
  acceptedTypes?: ('address' | 'payment' | 'walletconnect')[];
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Scan QR Code',
  acceptedTypes: () => ['address', 'payment', 'walletconnect']
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'scan', data: { type: string; content: string; raw: string }): void;
}>();

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
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      error.value = 'Camera permission denied';
    } else if (err.name === 'NotFoundError') {
      error.value = 'No camera found on this device';
    } else {
      error.value = 'Failed to access camera';
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
    return 'Payment Request';
  }
  
  // Address detection (simple heuristic - adjust based on your address format)
  if (/^[a-zA-Z0-9]{32,}$/.test(data) || data.startsWith('lumen1') || data.startsWith('cosmos1')) {
    return 'Wallet Address';
  }
  
  // URL detection
  if (data.startsWith('http://') || data.startsWith('https://')) {
    return 'URL';
  }
  
  return 'Unknown';
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
