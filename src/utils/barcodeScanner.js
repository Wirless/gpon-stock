/**
 * Barcode Scanner Utility
 * Acts as a client for the Python-based barcode scanner service
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Set the URL for the Python barcode scanner service
const SCANNER_SERVICE_URL = 'http://localhost:5000/scan';

class BarcodeScanner {
  constructor() {
    console.log('Initializing barcode scanner client');
  }

  /**
   * Scan image for barcodes and extract device information
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<Object>} - Object containing barcodes, textLines and deviceInfo
   */
  async scanImage(imagePath) {
    try {
      console.log(`Scanning barcodes in image: ${imagePath}`);
      
      // Validate image file exists
      if (!fs.existsSync(imagePath)) {
        const error = `Image file not found: ${imagePath}`;
        console.error(error);
        return this.createErrorResponse(error);
      }
      
      // Get file stats to check size
      const stats = fs.statSync(imagePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      console.log(`Image size: ${fileSizeMB.toFixed(2)} MB`);
      
      // Check if file size is too large (limit to 10MB for example)
      if (fileSizeMB > 10) {
        const error = `Image file too large (${fileSizeMB.toFixed(2)} MB). Maximum size is 10 MB.`;
        console.error(error);
        return this.createErrorResponse(error);
      }
      
      // Read the image file as base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // Send to Python service
      console.log('Sending image to Python barcode scanner service...');
      
      const response = await axios.post(SCANNER_SERVICE_URL, {
        image: base64Image // Matching parameter name expected by Python service
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
      
      // Process response
      if (response.data) {
        console.log('Received response from barcode service');
        
        // Return the complete data with consistent field naming
        return {
          barcodes: response.data.barcodes || [],
          textLines: response.data.text_lines || [], // Convert snake_case to camelCase
          deviceInfo: this.normalizeDeviceInfo(response.data.device_info)
        };
      } else {
        const error = 'Empty response from barcode service';
        console.error(error);
        return this.createErrorResponse(error);
      }
    } catch (error) {
      let errorMessage = 'Unknown error scanning barcodes';
      
      // Handle specific error types
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused - Is the Python barcode service running?';
      } else if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage = `Server error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`;
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response received from barcode service. Check if the service is running.';
      } else if (error.message) {
        // Something else happened in making the request
        errorMessage = `Error scanning barcodes: ${error.message}`;
      }
      
      console.error(errorMessage);
      return this.createErrorResponse(errorMessage);
    }
  }
  
  /**
   * Create a standardized error response object
   * @param {string} errorMessage - Error message text
   * @returns {Object} - Error response with empty result fields
   */
  createErrorResponse(errorMessage) {
    return {
      error: errorMessage,
      barcodes: [],
      textLines: [],
      deviceInfo: this.getEmptyDeviceInfo()
    };
  }
  
  /**
   * Normalize device info from Python service to match expected format in JavaScript client
   * @param {Object} deviceInfo - Device info from Python service
   * @returns {Object} - Normalized device information object
   */
  normalizeDeviceInfo(deviceInfo = {}) {
    // Return a normalized device info object that matches our expected format
    // Map Python snake_case field names to our camelCase names
    return {
      productionSN: deviceInfo.serialNumber || null,
      model: deviceInfo.model || null,
      manufacturer: deviceInfo.manufacturer || null,
      // Keep other fields for backward compatibility
      gponSN: null,
      gponSNHex: null,
      wanMAC: null,
      voipMAC: null,
      partNo: null,
      date: null
    };
  }
  
  /**
   * Get empty device info object with all fields set to null
   * @returns {Object} - Empty device information object
   */
  getEmptyDeviceInfo() {
    return {
      productionSN: null,
      gponSN: null,
      gponSNHex: null,
      wanMAC: null,
      voipMAC: null,
      model: null,
      manufacturer: null,
      partNo: null,
      date: null
    };
  }
  
  /**
   * Parse device information from extracted barcode text or scan result object
   * @deprecated This method is kept for backward compatibility but now uses the Python service
   * @param {string|Object} input - The extracted barcode text or direct scan result object
   * @returns {Object} - Parsed device information object
   */
  parseDeviceInfo(input) {
    console.warn("DEPRECATED: parseDeviceInfo is deprecated. Use scanImage instead which integrates with Python service.");
    console.log("Parsing device information input type:", typeof input);
    
    const deviceInfo = this.getEmptyDeviceInfo();
    
    // Handle case where input is already a scan result object with barcodes array
    if (input && typeof input === 'object') {
      console.log("Processing object input with barcodes");
      
      // If we have a barcodes array in the object
      if (Array.isArray(input.barcodes)) {
        let macCount = 0;
        
        // Process each barcode based on its type
        for (const barcode of input.barcodes) {
          if (!barcode || !barcode.type || !barcode.data) continue;
          
          switch (barcode.type) {
            case 'S/N':
              deviceInfo.productionSN = barcode.data;
              console.log("Found production S/N:", deviceInfo.productionSN);
              break;
            
            case 'GPON S/N':
              // First GPON S/N found
              if (!deviceInfo.gponSN) {
                deviceInfo.gponSN = barcode.data;
                console.log("Found GPON S/N:", deviceInfo.gponSN);
              }
              // If we find another GPON S/N, it might be the hex format
              else if (!deviceInfo.gponSNHex) {
                deviceInfo.gponSNHex = barcode.data;
                console.log("Found GPON S/N Hex:", deviceInfo.gponSNHex);
              }
              break;
            
            case 'MAC':
              // First MAC is usually WAN, second is VOIP
              if (macCount === 0) {
                deviceInfo.wanMAC = barcode.data;
                console.log("Found WAN MAC:", deviceInfo.wanMAC);
              } else {
                deviceInfo.voipMAC = barcode.data;
                console.log("Found VOIP MAC:", deviceInfo.voipMAC);
              }
              macCount++;
              break;
            
            default:
              console.log(`Unhandled barcode type: ${barcode.type} with data: ${barcode.data}`);
          }
        }
      } 
      // If we have deviceInfo directly in the input
      else if (input.deviceInfo) {
        // Just return the deviceInfo from the scan result
        return this.normalizeDeviceInfo(input.deviceInfo);
      }
    }
    // Legacy text parsing logic for backward compatibility
    else if (typeof input === 'string') {
      console.log("Processing legacy string input");
      
      try {
        // Parse barcode text line by line
        const lines = input.split('\n');
        let macCount = 0;
        
        for (const line of lines) {
          // Match "Type: Data" format
          const match = line.match(/^([^:]+):\s*(.+)$/);
          if (!match) continue;
          
          const [_, type, value] = match;
          
          if (type === 'S/N') {
            deviceInfo.productionSN = value.trim();
            console.log("Found production S/N:", deviceInfo.productionSN);
          } 
          else if (type === 'GPON S/N') {
            deviceInfo.gponSN = value.trim();
            console.log("Found GPON S/N:", deviceInfo.gponSN);
          }
          else if (type === 'MAC') {
            // First MAC is usually WAN, second is VOIP
            if (macCount === 0) {
              deviceInfo.wanMAC = value.trim();
              console.log("Found WAN MAC:", deviceInfo.wanMAC);
            } else {
              deviceInfo.voipMAC = value.trim();
              console.log("Found VOIP MAC:", deviceInfo.voipMAC);
            }
            macCount++;
          }
        }
      } catch (error) {
        console.error("Error parsing device info from string:", error);
      }
    } else {
      console.error("Invalid input type for parseDeviceInfo:", typeof input);
    }
    
    console.log("Final parsed device info:", deviceInfo);
    return deviceInfo;
  }
}

module.exports = new BarcodeScanner(); 