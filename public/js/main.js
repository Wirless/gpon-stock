/**
 * Main JavaScript for Stock Management System
 * Handles client-side functionality including barcode scanning, 
 * image handling, and form validation
 */

// Run when the document is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Automatically close alerts after 5 seconds
  setTimeout(function() {
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    });
  }, 5000);

  // Initialize scan image functionality
  initScanImage();
  
  // Initialize deposit form validation
  initDepositFormValidation();
  
  // Initialize image preview
  initImagePreview();
  
  // Initialize camera capture functionality
  initCameraCapture();
});

/**
 * Initialize scan image functionality
 * Handles the scanning of barcodes and text from images
 */
function initScanImage() {
  const scanButtons = document.querySelectorAll('.scan-button');
  
  scanButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      
      const depositId = this.dataset.depositId;
      const imageId = this.dataset.imageId;
      const resultContainer = document.getElementById('scan-result');
      
      if (!depositId || !imageId) {
        console.error('Missing deposit ID or image ID');
        return;
      }
      
      // Show loading state
      resultContainer.innerHTML = `
        <div class="spinner-container">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <span class="ms-2">Scanning image, please wait...</span>
        </div>
      `;
      
      // Call API to scan image
      fetch(`/deposits/${depositId}/images/${imageId}/scan`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => {
          if (data.success) {
            // Display scan results
            resultContainer.innerHTML = `
              <div class="card">
                <div class="card-header">
                  <h5>Scan Results</h5>
                </div>
                <div class="card-body">
                  <h6>Detected Information:</h6>
                  <table class="table table-sm">
                    <tbody>
                      ${Object.entries(data.deviceInfo).map(([key, value]) => 
                        value ? `<tr>
                          <th>${formatKey(key)}</th>
                          <td>${value}</td>
                          <td>
                            <button class="btn btn-sm btn-primary apply-value" 
                              data-field="${key}" data-value="${value}">
                              Apply
                            </button>
                          </td>
                        </tr>` : ''
                      ).join('')}
                    </tbody>
                  </table>
                  <div class="mt-3">
                    <h6>Raw Extracted Text:</h6>
                    <pre class="border p-2 bg-light">${data.text}</pre>
                  </div>
                </div>
              </div>
            `;
            
            // Initialize apply buttons
            initApplyButtons();
          } else {
            resultContainer.innerHTML = `
              <div class="alert alert-danger">
                Error: ${data.message}
              </div>
            `;
          }
        })
        .catch(error => {
          console.error('Error scanning image:', error);
          resultContainer.innerHTML = `
            <div class="alert alert-danger">
              Error scanning image: ${error.message}
            </div>
          `;
        });
    });
  });
}

/**
 * Initialize the apply buttons for scan results
 * Allows users to apply detected values to form fields
 */
function initApplyButtons() {
  const applyButtons = document.querySelectorAll('.apply-value');
  
  applyButtons.forEach(button => {
    button.addEventListener('click', function() {
      const field = this.dataset.field;
      const value = this.dataset.value;
      
      // Map field names to form input IDs
      const fieldMapping = {
        'productionSN': 'productionSN',
        'gponSN': 'gponSN',
        'gponSNHex': 'gponSNHex',
        'wanMAC': 'wanMAC',
        'voipMAC': 'voipMAC',
        'model': 'model',
        'partNo': 'partNumber',
        'date': 'manufactureDate'
      };
      
      // Find the corresponding form field
      const inputId = fieldMapping[field];
      
      if (inputId) {
        const input = document.getElementById(inputId);
        if (input) {
          input.value = value;
          input.classList.add('is-valid');
          
          // Flash effect
          input.style.backgroundColor = '#d4edda';
          setTimeout(() => {
            input.style.backgroundColor = '';
          }, 1000);
        }
      }
    });
  });
}

/**
 * Format object keys for display
 */
function formatKey(key) {
  // Convert camelCase to Title Case with spaces
  return key
    // Insert space before uppercase letters
    .replace(/([A-Z])/g, ' $1')
    // Capitalize first letter
    .replace(/^./, str => str.toUpperCase());
}

/**
 * Initialize deposit form validation
 */
function initDepositFormValidation() {
  const depositForm = document.getElementById('deposit-form');
  
  if (depositForm) {
    depositForm.addEventListener('submit', function(e) {
      // Form validation can be added here if needed
      return true;
    });
  }
}

/**
 * Initialize image preview for upload forms
 */
function initImagePreview() {
  const imageInput = document.getElementById('images');
  const previewContainer = document.getElementById('image-preview');
  
  if (imageInput && previewContainer) {
    imageInput.addEventListener('change', function() {
      previewContainer.innerHTML = '';
      
      if (this.files) {
        const filesCount = this.files.length;
        if (filesCount > 10) {
          alert('You can upload a maximum of 10 images');
          this.value = '';
          return;
        }
        
        for (let i = 0; i < filesCount; i++) {
          const file = this.files[i];
          const reader = new FileReader();
          
          reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.classList.add('barcode-preview', 'mb-2', 'me-2');
            previewContainer.appendChild(img);
          };
          
          reader.readAsDataURL(file);
        }
      }
    });
  }
}

/**
 * Handle delete confirmations
 */
function confirmDelete(url, item) {
  if (confirm(`Are you sure you want to delete this ${item}? This action cannot be undone.`)) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.style.display = 'none';
    
    const methodInput = document.createElement('input');
    methodInput.type = 'hidden';
    methodInput.name = '_method';
    methodInput.value = 'DELETE';
    
    form.appendChild(methodInput);
    document.body.appendChild(form);
    form.submit();
  }
  return false;
}

/**
 * Initialize camera capture functionality
 * Handles camera access, image capture, and OCR processing directly in the create form
 */
function initCameraCapture() {
  // Get reference to UI elements
  const cameraBtn = document.getElementById('camera-btn');
  const cameraContainer = document.getElementById('camera-container');
  const cameraPreview = document.getElementById('camera-preview');
  const captureBtn = document.getElementById('capture-btn');
  const cameraCloseBtn = document.getElementById('camera-close-btn');
  const capturedImage = document.getElementById('captured-image');
  const processImageBtn = document.getElementById('process-image-btn');
  const scanStatus = document.getElementById('scan-status');
  const scanResult = document.getElementById('scan-result');
  
  // Exit if not on the right page
  if (!cameraBtn) return;
  
  // Store video stream reference for cleanup
  let videoStream = null;

  // Check if MediaDevices API is supported
  const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  
  // If MediaDevices is not supported, show file upload option
  if (!hasMediaDevices) {
    // Replace camera button with file upload option
    const cameraButtonParent = cameraBtn.parentElement;
    cameraButtonParent.innerHTML = `
      <p>Camera access not available on this device. Please select an image from your device.</p>
      <label for="file-upload" class="btn btn-primary">
        <i class="fas fa-upload me-2"></i> Select Device Image
      </label>
      <input type="file" id="file-upload" class="d-none" accept="image/*">
    `;
    
    // Add event listener to file upload
    const fileUpload = document.getElementById('file-upload');
    fileUpload.addEventListener('change', handleFileSelect);
  } else {
    // Add file upload option alongside camera button
    const cameraButtonParent = cameraBtn.parentElement;
    cameraButtonParent.insertAdjacentHTML('beforeend', `
      <div class="mt-3">
        <p>Or select an existing image:</p>
        <label for="file-upload" class="btn btn-outline-primary">
          <i class="fas fa-upload me-2"></i> Upload Image
        </label>
        <input type="file" id="file-upload" class="d-none" accept="image/*">
      </div>
    `);
    
    // Add event listener to file upload
    const fileUpload = document.getElementById('file-upload');
    fileUpload.addEventListener('change', handleFileSelect);
  }
  
  // Function to handle file selection
  function handleFileSelect(e) {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      
      reader.onload = function(e) {
        // Create an image to get dimensions
        const img = new Image();
        img.onload = function() {
          // Set canvas dimensions
          capturedImage.width = img.width;
          capturedImage.height = img.height;
          
          // Draw image on canvas
          const context = capturedImage.getContext('2d');
          context.drawImage(img, 0, 0, img.width, img.height);
          
          // Show canvas and process button
          capturedImage.classList.remove('d-none');
          processImageBtn.classList.remove('d-none');
        };
        img.src = e.target.result;
      };
      
      reader.readAsDataURL(e.target.files[0]);
    }
  }
  
  // Handle camera open button click
  if (hasMediaDevices) {
    cameraBtn.addEventListener('click', async function() {
      try {
        // Request camera access
        videoStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment', // Prefer back camera if available
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        
        // Display video stream
        cameraPreview.srcObject = videoStream;
        cameraContainer.classList.remove('d-none');
        cameraBtn.classList.add('d-none');
        
      } catch (error) {
        console.error('Error accessing camera:', error);
        scanStatus.innerHTML = `
          <div class="alert alert-danger">
            Error accessing camera: ${error.message || 'Please check camera permissions'}
          </div>
        `;
      }
    });
    
    // Handle camera close button click
    cameraCloseBtn.addEventListener('click', function() {
      // Stop video stream
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
      }
      
      // Hide camera container and show camera button
      cameraContainer.classList.add('d-none');
      cameraBtn.classList.remove('d-none');
    });
    
    // Handle capture button click
    captureBtn.addEventListener('click', function() {
      // Create canvas context and draw video frame
      capturedImage.width = cameraPreview.videoWidth;
      capturedImage.height = cameraPreview.videoHeight;
      const context = capturedImage.getContext('2d');
      context.drawImage(cameraPreview, 0, 0, capturedImage.width, capturedImage.height);
      
      // Display captured image and process button
      capturedImage.classList.remove('d-none');
      processImageBtn.classList.remove('d-none');
      
      // Stop video stream
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
      }
      
      // Hide camera container and show camera button
      cameraContainer.classList.add('d-none');
      cameraBtn.classList.remove('d-none');
    });
  }
  
  // Handle process image button click
  processImageBtn.addEventListener('click', async function() {
    try {
      // Show loading state
      scanStatus.innerHTML = `
        <div class="spinner-container">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <span class="ms-2">Processing image, please wait...</span>
        </div>
      `;
      
      // Resize the image to reduce payload size
      const resizedCanvas = document.createElement('canvas');
      const MAX_WIDTH = 2280; // Maximum width to limit file size
      const MAX_HEIGHT = 2220; // Maximum height to limit file size
      
      let width = capturedImage.width;
      let height = capturedImage.height;
      
      // Resize image if it's too large
      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round(height * (MAX_WIDTH / width));
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round(width * (MAX_HEIGHT / height));
          height = MAX_HEIGHT;
        }
      }
      
      // Set resized canvas dimensions
      resizedCanvas.width = width;
      resizedCanvas.height = height;
      
      // Get the context and draw the resized image
      const ctx = resizedCanvas.getContext('2d');
      ctx.drawImage(capturedImage, 0, 0, width, height);
      
      // Get base64 data from resized canvas with reduced quality
      const imageData = resizedCanvas.toDataURL('image/jpeg', 0.7); // 0.7 quality to reduce size
      
      console.log('Sending image data, length:', imageData.length);
      
      try {
        // Send image data to the server for OCR processing
        const response = await fetch('/api/direct-scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'same-origin', // Include cookies for authentication
          body: JSON.stringify({ imageData })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Server response not OK:', response.status, errorText);
          throw new Error(`Server returned ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          // Clear loading state
          scanStatus.innerHTML = `
            <div class="alert alert-success">
              <i class="fas fa-check-circle me-2"></i> Image processed successfully!
            </div>
          `;
          
          // Display scan results
          scanResult.innerHTML = `
            <div class="card">
              <div class="card-header bg-${data.fallback ? 'warning' : 'success'}">
                <h5>Scan Results ${data.fallback ? '(Fallback Data)' : '(OCR Successful)'}</h5>
              </div>
              <div class="card-body">
                <div class="row">
                  <div class="col-md-7">
                    <h6>Detected Information:</h6>
                    <table class="table table-sm">
                      <tbody>
                        ${Object.entries(data.deviceInfo).map(([key, value]) => 
                          value ? `<tr>
                            <th>${formatKey(key)}</th>
                            <td>${value}</td>
                            <td>
                              <button class="btn btn-sm btn-primary apply-value" 
                                data-field="${key}" data-value="${value}">
                                Apply
                              </button>
                            </td>
                          </tr>` : ''
                        ).join('')}
                      </tbody>
                    </table>
                    <div class="mt-3">
                      <button id="apply-all-btn" class="btn btn-success">
                        <i class="fas fa-magic me-2"></i> Apply All Fields
                      </button>
                      <div class="form-text">Click to fill all form fields with detected values</div>
                    </div>
                  </div>
                  <div class="col-md-5">
                    ${data.imageUrl ? `
                      <div class="text-center mb-3">
                        <h6>Saved Image:</h6>
                        <img src="${data.imageUrl}" class="img-fluid border rounded" alt="Processed GPON Device" />
                      </div>
                    ` : ''}
                  </div>
                </div>
                <div class="mt-3">
                  <h6>Raw Extracted Text:</h6>
                  <pre class="border p-2 bg-light" style="max-height: 150px; overflow-y: auto;">${data.text}</pre>
                  ${data.fallback ? '<div class="alert alert-warning mt-2"><i class="fas fa-exclamation-triangle me-2"></i> Note: OCR processing failed, using fallback data.</div>' : ''}
                </div>
              </div>
            </div>
          `;
          
          // Initialize apply buttons
          initApplyButtons();
          
          // Initialize apply all button
          const applyAllBtn = document.getElementById('apply-all-btn');
          if (applyAllBtn) {
            applyAllBtn.addEventListener('click', function() {
              // Apply all detected values to form fields
              Object.entries(data.deviceInfo).forEach(([key, value]) => {
                if (value) {
                  // Map field names to form input IDs
                  const fieldMapping = {
                    'productionSN': 'productionSN',
                    'gponSN': 'gponSN',
                    'gponSNHex': 'gponSNHex',
                    'wanMAC': 'wanMAC',
                    'voipMAC': 'voipMAC',
                    'model': 'model',
                    'partNo': 'partNumber',
                    'date': 'manufactureDate'
                  };
                  
                  // Find the corresponding form field
                  const inputId = fieldMapping[key];
                  
                  if (inputId) {
                    const input = document.getElementById(inputId);
                    if (input) {
                      input.value = value;
                      input.classList.add('is-valid');
                      
                      // Flash effect
                      input.style.backgroundColor = '#d4edda';
                      setTimeout(() => {
                        input.style.backgroundColor = '';
                      }, 500);
                    }
                  }
                }
              });
              
              // Show success message
              scanStatus.innerHTML = `
                <div class="alert alert-success">
                  <i class="fas fa-check-circle me-2"></i> All fields have been filled automatically!
                </div>
              `;
            });
          }
        } else {
          console.error('Server returned error:', data.message);
          scanStatus.innerHTML = `
            <div class="alert alert-danger">
              <i class="fas fa-exclamation-circle me-2"></i> Error: ${data.message}
            </div>
          `;
        }
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        scanStatus.innerHTML = `
          <div class="alert alert-danger">
            <i class="fas fa-exclamation-circle me-2"></i> Network error: ${fetchError.message}
          </div>
        `;
      }
    } catch (error) {
      console.error('General error:', error);
      scanStatus.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-circle me-2"></i> Error: ${error.message}
        </div>
      `;
    }
  });
} 