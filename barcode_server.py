#!/usr/bin/env python3
"""
Barcode Scanner Service
Uses OpenCV and pyzbar for reliable barcode detection
Handles sideways barcodes and processes device information
"""
import os
import sys
import json
import base64
import tempfile
import logging
from datetime import datetime
from typing import Dict, List, Optional, Union

import cv2
import numpy as np
from pyzbar.pyzbar import decode as pyzbar_decode
from flask import Flask, request, jsonify

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('barcode_scanner')

app = Flask(__name__)

class BarcodeScanner:
    """Handles barcode scanning for GPON device labels"""
    
    def __init__(self):
        """Initialize the barcode scanner"""
        self.temp_dir = tempfile.gettempdir()
        logger.info(f"Using temp directory: {self.temp_dir}")
        
    def scan_image(self, image_path: str) -> Dict:
        """
        Scan an image for barcodes
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Dictionary with extracted barcode data
        """
        logger.info(f"Scanning image at: {image_path}")
        
        # Read the image
        image = cv2.imread(image_path)
        if image is None:
            logger.error(f"Failed to load image: {image_path}")
            return {"error": "Failed to load image"}
        
        # Get image dimensions for logging
        height, width = image.shape[:2]
        logger.info(f"Image dimensions: {width}x{height}")
        
        # Create rotated versions and scan each one
        rotations = [0, 90, 180, 270]
        all_barcodes = []
        
        for angle in rotations:
            logger.info(f"Scanning at {angle} degree rotation")
            rotated_image = self._rotate_image(image, angle)
            
            # Try different preprocessing methods for each rotation
            preprocessed_images = self._preprocess_image(rotated_image)
            
            # Scan each preprocessed version
            for preprocessed in preprocessed_images:
                barcodes = self._detect_barcodes(preprocessed)
                if barcodes:
                    logger.info(f"Found {len(barcodes)} barcodes at {angle} degrees")
                    all_barcodes.extend(barcodes)
        
        # Filter and classify barcodes
        unique_barcodes = self._filter_barcodes(all_barcodes)
        logger.info(f"Total unique barcodes found: {len(unique_barcodes)}")
        
        # Format results
        result = self._format_results(unique_barcodes)
        return result
    
    def _rotate_image(self, image, angle):
        """Rotate image by the given angle"""
        if angle == 0:
            return image
        
        height, width = image.shape[:2]
        center = (width // 2, height // 2)
        
        # Get rotation matrix
        rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        
        # Determine new dimensions
        abs_cos = abs(rotation_matrix[0, 0])
        abs_sin = abs(rotation_matrix[0, 1])
        new_width = int(height * abs_sin + width * abs_cos)
        new_height = int(height * abs_cos + width * abs_sin)
        
        # Adjust rotation matrix
        rotation_matrix[0, 2] += new_width / 2 - center[0]
        rotation_matrix[1, 2] += new_height / 2 - center[1]
        
        # Perform rotation
        rotated = cv2.warpAffine(image, rotation_matrix, (new_width, new_height))
        return rotated
    
    def _preprocess_image(self, image):
        """
        Create multiple preprocessed versions of the image
        to maximize barcode detection chances
        """
        preprocessed = []
        
        # Original image
        preprocessed.append(image)
        
        # Grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        preprocessed.append(gray)
        
        # Binary thresholded
        _, binary = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY)
        preprocessed.append(binary)
        
        # Adaptive thresholded
        adaptive = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
        preprocessed.append(adaptive)
        
        # Contrast enhanced
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        preprocessed.append(enhanced)
        
        return preprocessed
    
    def _detect_barcodes(self, image):
        """Detect barcodes in the image using pyzbar"""
        if len(image.shape) == 3:
            # Convert color image to grayscale for pyzbar
            image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        try:
            # Detect barcodes using pyzbar
            detected = pyzbar_decode(image)
            
            barcodes = []
            for barcode in detected:
                # Extract barcode data
                barcode_data = barcode.data.decode('utf-8')
                barcode_type = barcode.type
                
                # Classify the barcode
                barcode_info = self._classify_barcode(barcode_data, barcode_type)
                if barcode_info:
                    barcodes.append(barcode_info)
            
            return barcodes
        except Exception as e:
            logger.error(f"Error detecting barcodes: {str(e)}")
            return []
    
    def _classify_barcode(self, data, barcode_type):
        """Classify the barcode based on its content and format"""
        # Clean up the data
        data = data.strip()
        if not data:
            return None
        
        # Check for MAC address pattern
        if self._is_mac_address(data):
            # Format MAC with colons
            formatted_mac = self._format_mac(data)
            return {
                "data": formatted_mac,
                "type": "MAC",
                "format": barcode_type
            }
        
        # Check for GPON Serial Number pattern
        elif self._is_gpon_sn(data):
            return {
                "data": data,
                "type": "GPON S/N",
                "format": barcode_type
            }
        
        # Check for generic Serial Number pattern
        elif self._is_serial_number(data):
            return {
                "data": data,
                "type": "S/N",
                "format": barcode_type
            }
        
        # If we can't classify it, return as unknown
        else:
            return {
                "data": data,
                "type": "Unknown",
                "format": barcode_type
            }
    
    def _is_mac_address(self, data):
        """Check if the data looks like a MAC address"""
        # Remove any separators and check if it's 12 hex digits
        clean_data = ''.join(c for c in data if c.isalnum())
        if len(clean_data) == 12 and all(c.lower() in '0123456789abcdef' for c in clean_data):
            return True
        return False
    
    def _format_mac(self, data):
        """Format a MAC address with colons"""
        # Remove any non-hex characters
        clean_data = ''.join(c for c in data if c.lower() in '0123456789abcdef')
        # Group into pairs and join with colons
        if len(clean_data) >= 12:
            # Take just the first 12 characters
            clean_data = clean_data[:12]
            formatted = ':'.join(clean_data[i:i+2] for i in range(0, 12, 2))
            return formatted.upper()
        return data.upper()
    
    def _is_gpon_sn(self, data):
        """Check if the data matches GPON serial number pattern"""
        # GPON serials often start with manufacturer codes
        prefixes = ['ALCL', 'HWTC', 'DSNW', 'SCOM', 'ZTEG']
        if any(data.startswith(prefix) for prefix in prefixes):
            return True
        # Sometimes they start with 4 alphas followed by 8+ digits
        if len(data) >= 12 and data[:4].isalpha() and data[4:].isalnum():
            return True
        return False
    
    def _is_serial_number(self, data):
        """Check if the data looks like a serial number"""
        # Serial numbers are typically alphanumeric and reasonably long
        if len(data) >= 8 and data.isalnum():
            return True
        return False
    
    def _filter_barcodes(self, barcodes):
        """Remove duplicates and invalid barcodes"""
        if not barcodes:
            return []
            
        # Remove duplicates by data content
        unique = {}
        for barcode in barcodes:
            if barcode["data"] not in unique:
                unique[barcode["data"]] = barcode
        
        return list(unique.values())
    
    def _format_results(self, barcodes):
        """Format the results for the API response"""
        # Build the text output
        text_output = ""
        for barcode in barcodes:
            if barcode["type"] and barcode["data"]:
                text_output += f"{barcode['type']}: {barcode['data']}\n"
        
        if not text_output:
            text_output = "No barcodes detected in image"
        
        # Process for device info
        device_info = self._parse_device_info(barcodes)
        
        return {
            "text": text_output,
            "deviceInfo": device_info,
            "barcodes": barcodes
        }
    
    def _parse_device_info(self, barcodes):
        """Parse barcodes into device information"""
        device_info = {
            "productionSN": None,
            "gponSN": None,
            "gponSNHex": None,
            "wanMAC": None,
            "voipMAC": None,
            "model": None,
            "partNo": None,
            "date": None
        }
        
        # Process the barcodes in the expected order
        # Usually first two are production SN and GPON SN
        # Then GPON SN hex and WAN MAC, finally VOIP MAC if present
        
        # Track MAC address barcodes to assign to correct fields
        mac_barcodes = []
        gpon_barcodes = []
        sn_barcodes = []
        
        # First, categorize all barcodes
        for barcode in barcodes:
            if barcode["type"] == "MAC":
                mac_barcodes.append(barcode["data"])
            elif barcode["type"] == "GPON S/N":
                gpon_barcodes.append(barcode["data"])
            elif barcode["type"] == "S/N":
                sn_barcodes.append(barcode["data"])
        
        logger.info(f"Found {len(mac_barcodes)} MAC barcodes, {len(gpon_barcodes)} GPON barcodes, {len(sn_barcodes)} SN barcodes")
        
        # Now assign them in the expected order
        if sn_barcodes:
            device_info["productionSN"] = sn_barcodes[0]
        
        if len(gpon_barcodes) >= 1:
            device_info["gponSN"] = gpon_barcodes[0]
        
        if len(gpon_barcodes) >= 2:
            device_info["gponSNHex"] = gpon_barcodes[1]
        
        if len(mac_barcodes) >= 1:
            device_info["wanMAC"] = mac_barcodes[0]
        
        if len(mac_barcodes) >= 2:
            device_info["voipMAC"] = mac_barcodes[1]
            
        logger.info(f"Parsed device info: {device_info}")
        return device_info


@app.route('/scan', methods=['POST'])
def scan():
    """API endpoint to scan an image for barcodes"""
    try:
        # Parse request
        data = request.json
        if not data or 'image' not in data:
            return jsonify({"success": False, "message": "No image data provided"}), 400
        
        image_data = data['image']
        
        # Check if it's base64 encoded
        if image_data.startswith('data:image'):
            # Extract the base64 part
            image_data = image_data.split(',')[1]
        
        # Decode base64 and save to temp file
        image_bytes = base64.b64decode(image_data)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        temp_path = os.path.join(tempfile.gettempdir(), f"barcode_scan_{timestamp}.jpg")
        
        with open(temp_path, 'wb') as f:
            f.write(image_bytes)
        
        logger.info(f"Saved temp image to: {temp_path}")
        
        # Process the image
        scanner = BarcodeScanner()
        result = scanner.scan_image(temp_path)
        
        # Clean up temp file
        try:
            os.remove(temp_path)
        except Exception as e:
            logger.warning(f"Failed to remove temp file: {str(e)}")
        
        # Return results with structure expected by JavaScript client
        return jsonify({
            "success": True,
            "text": result.get("text", ""),
            "device_info": result.get("deviceInfo", {}),
            "barcodes": result.get("barcodes", []),
            "text_lines": []  # Add this for compatibility
        })
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500


if __name__ == '__main__':
    # Set port from command line or use default
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    logger.info(f"Starting barcode scanner service on port {port}")
    app.run(host='0.0.0.0', port=port) 