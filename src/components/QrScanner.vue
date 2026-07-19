<template>
  <div class="qr-scanner-wrapper">
    <div class="qr-scanner-overlay" @click="$emit('close')">
      <div class="qr-scanner-modal bg-card" @click.stop>
        <div class="qr-scanner-header">
          <h3 class="color-text-primary">{{ title }}</h3>
          <button class="qr-close-btn border-none cursor-pointer color-text-secondary" @click="$emit('close')" aria-label="Close">
            <X :size="24" />
          </button>
        </div>

        <div class="qr-scanner-content">
          <!-- Camera View -->
          <div v-if="!scannedData && !error" class="qr-camera-container">
            <video ref="videoElement" class="qr-camera-video" autoplay playsinline></video>
            <canvas ref="canvasElement" class="qr-camera-canvas hidden"></canvas>
            <div class="qr-scan-frame">
              <div class="qr-corner qr-corner-top-left"></div>
              <div class="qr-corner qr-corner-top-right"></div>
              <div class="qr-corner qr-corner-bottom-left"></div>
              <div class="qr-corner qr-corner-bottom-right"></div>
            </div>
            <p class="qr-scan-instruction color-white">Position QR code within the frame</p>
          </div>

          <!-- Error State -->
          <div v-if="error" class="qr-error-state">
            <AlertCircle :size="48" class="qr-error-icon" />
            <h4 class="color-text-primary">{{ error }}</h4>
            <p v-if="error.includes('permission')" class="color-text-secondary">
              Please allow camera access in your browser settings
            </p>
            <button class="qr-retry-btn color-white border-none cursor-pointer" @click="initializeScanner">
              <RefreshCw :size="16" />
              <span>Try Again</span>
            </button>
          </div>

          <!-- Success State -->
          <div v-if="scannedData" class="qr-success-state">
            <CheckCircle :size="48" class="qr-success-icon" />
            <h4 class="color-text-primary">QR Code Scanned</h4>

            <div class="qr-scanned-data">
              <div class="qr-data-type">
                <span class="qr-label color-text-secondary">Type:</span>
                <span class="qr-value color-text-primary">{{ detectedType }}</span>
              </div>
              <div class="qr-data-content">
                <span class="qr-label color-text-secondary">Content:</span>
                <div class="qr-value-box bg-card color-text-primary">{{ scannedData }}</div>
              </div>
            </div>

            <div class="qr-action-buttons">
              <button class="qr-btn qr-btn-secondary color-text-primary bg-fill-tertiary border-default" @click="scanAgain">
                <QrCode :size="16" />
                <span>Scan Again</span>
              </button>
              <button class="qr-btn qr-btn-primary color-white" @click="handleUseScannedData">
                <Check :size="16" />
                <span>Use This</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { BrowserMultiFormatReader } from '@zxing/library';
import { X, AlertCircle, CheckCircle, RefreshCw, QrCode, Check } from 'lucide-vue-next';

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
