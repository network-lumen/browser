<template>
  <div class="qr-scanner-wrapper">
    <div class="qr-scanner-overlay" @click="$emit('close')">
      <div class="qr-scanner-modal" @click.stop>
        <div class="qr-scanner-header">
          <h3>{{ title }}</h3>
          <button class="close-btn" @click="$emit('close')" aria-label="Close">
            <X :size="24" />
          </button>
        </div>

        <div class="qr-scanner-content">
          <!-- Camera View -->
          <div v-if="!scannedData && !error" class="camera-container">
            <video ref="videoElement" class="camera-video" autoplay playsinline></video>
            <canvas ref="canvasElement" class="camera-canvas" style="display: none;"></canvas>
            <div class="scan-frame">
              <div class="corner top-left"></div>
              <div class="corner top-right"></div>
              <div class="corner bottom-left"></div>
              <div class="corner bottom-right"></div>
            </div>
            <p class="scan-instruction">Position QR code within the frame</p>
          </div>

          <!-- Error State -->
          <div v-if="error" class="error-state">
            <AlertCircle :size="48" class="error-icon" />
            <h4>{{ error }}</h4>
            <p v-if="error.includes('permission')">
              Please allow camera access in your browser settings
            </p>
            <button class="retry-btn" @click="initializeScanner">
              <RefreshCw :size="16" />
              <span>Try Again</span>
            </button>
          </div>

          <!-- Success State -->
          <div v-if="scannedData" class="success-state">
            <CheckCircle :size="48" class="success-icon" />
            <h4>QR Code Scanned</h4>
            
            <div class="scanned-data">
              <div class="data-type">
                <span class="label">Type:</span>
                <span class="value">{{ detectedType }}</span>
              </div>
              <div class="data-content">
                <span class="label">Content:</span>
                <div class="value-box">{{ scannedData }}</div>
              </div>
            </div>

            <div class="action-buttons">
              <button class="btn secondary" @click="scanAgain">
                <QrCode :size="16" />
                <span>Scan Again</span>
              </button>
              <button class="btn primary" @click="handleUseScannedData">
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

<style scoped>
.qr-scanner-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
}

.qr-scanner-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  backdrop-filter: blur(4px);
}

.qr-scanner-modal {
  background: var(--bg-primary);
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.qr-scanner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.qr-scanner-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.qr-scanner-content {
  padding: 24px;
}

.camera-container {
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 1;
  max-height: 400px;
}

.camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-canvas {
  position: absolute;
  top: 0;
  left: 0;
}

.scan-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 250px;
  height: 250px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 12px;
}

.corner {
  position: absolute;
  width: 30px;
  height: 30px;
  border: 3px solid var(--accent-primary);
}

.corner.top-left {
  top: -3px;
  left: -3px;
  border-right: none;
  border-bottom: none;
  border-top-left-radius: 12px;
}

.corner.top-right {
  top: -3px;
  right: -3px;
  border-left: none;
  border-bottom: none;
  border-top-right-radius: 12px;
}

.corner.bottom-left {
  bottom: -3px;
  left: -3px;
  border-right: none;
  border-top: none;
  border-bottom-left-radius: 12px;
}

.corner.bottom-right {
  bottom: -3px;
  right: -3px;
  border-left: none;
  border-top: none;
  border-bottom-right-radius: 12px;
}

.scan-instruction {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  font-size: 14px;
  margin: 0;
  background: rgba(0, 0, 0, 0.6);
  padding: 8px 16px;
  border-radius: 20px;
  backdrop-filter: blur(8px);
}

.error-state,
.success-state {
  text-align: center;
  padding: 40px 20px;
}

.error-icon {
  color: #ef4444;
  margin-bottom: 16px;
}

.success-icon {
  color: #10b981;
  margin-bottom: 16px;
}

.error-state h4,
.success-state h4 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.error-state p {
  color: #6b7280;
  margin: 0 0 24px 0;
  font-size: 14px;
}

.retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--accent-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: var(--accent-secondary);
}

.scanned-data {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  margin: 24px 0;
  text-align: left;
}

.data-type,
.data-content {
  margin-bottom: 12px;
}

.data-content:last-child {
  margin-bottom: 0;
}

.scanned-data .label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  margin-bottom: 4px;
  letter-spacing: 0.5px;
}

.scanned-data .value {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.value-box {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 12px;
  font-size: 13px;
  font-family: 'Monaco', 'Courier New', monospace;
  color: var(--text-primary);
  word-break: break-all;
  max-height: 120px;
  overflow-y: auto;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn.primary {
  background: var(--accent-primary);
  color: white;
}

.btn.primary:hover {
  background: var(--accent-secondary);
}

.btn.secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #e5e7eb;
}

.btn.secondary:hover {
  background: #e5e7eb;
}

@media (max-width: 640px) {
  .qr-scanner-modal {
    max-width: 100%;
    border-radius: 16px 16px 0 0;
  }
  
  .scan-frame {
    width: 200px;
    height: 200px;
  }
}
</style>
