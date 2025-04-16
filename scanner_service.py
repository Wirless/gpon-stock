from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
import cv2
import numpy as np
import pyzbar.pyzbar as pyzbar
import pytesseract
import os
import re
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure pytesseract path if needed (uncomment and modify if necessary)
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

@app.route('/scan', methods=['POST'])
def scan_image():
    """
    Endpoint to scan an image for barcodes, QR codes, and device information.
    
    The image should be sent as a base64 encoded string in the request body.
    """
    if 'image' not in request.json:
        return jsonify({'error': 'No image provided'}), 400
    
    try:
        # Decode the base64 image
        image_data = request.json['image']
        image_bytes = base64.b64decode(image_data)
        image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Could not decode image'}), 400
        
        # Log image size
        height, width = image.shape[:2]
        logger.info(f"Processing image of size {width}x{height}")
        
        # Scan for barcodes/QR codes
        barcodes = scan_barcodes(image)
        
        # Extract text from the image for device information
        text_lines = extract_text_from_image(image)
        
        # Parse device information from extracted text
        device_info = parse_device_info(text_lines)
        
        # Format the response to match what the JS client expects
        result = {
            "success": True,
            "barcodes": barcodes,
            "text_lines": text_lines,
            "device_info": device_info,
            "text": '\n'.join([f"{barcode['type']}: {barcode['data']}" for barcode in barcodes]) if barcodes else "No barcodes detected in image"
        }
        
        return jsonify(result), 200
    
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return jsonify({'success': False, 'error': f'Error processing image: {str(e)}'}), 500

def scan_barcodes(image):
    """
    Scan the image for barcodes and QR codes.
    
    Args:
        image: OpenCV image object
        
    Returns:
        List of dictionaries containing barcode data and type
    """
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Use pyzbar to detect barcodes
    detected_barcodes = pyzbar.decode(gray)
    
    results = []
    for barcode in detected_barcodes:
        barcode_data = barcode.data.decode('utf-8')
        barcode_type = barcode.type
        logger.info(f"Found barcode: {barcode_type} - {barcode_data}")
        results.append({
            "type": barcode_type,
            "data": barcode_data
        })
    
    return results

def extract_text_from_image(image):
    """
    Extract text from the image using OCR.
    
    Args:
        image: OpenCV image object
        
    Returns:
        List of text lines extracted from the image
    """
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply threshold to get a binary image
    _, binary = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV)
    
    # Apply some preprocessing to improve OCR
    # Noise removal
    kernel = np.ones((1, 1), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    
    # Extract text using pytesseract
    text = pytesseract.image_to_string(binary)
    
    # Split by newlines and filter empty lines
    text_lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    return text_lines

def parse_device_info(text_lines):
    """
    Parse device information from extracted text lines.
    
    Args:
        text_lines: List of text lines from OCR
        
    Returns:
        Dictionary containing extracted device information
    """
    device_info = {
        "model": None,
        "serialNumber": None,
        "manufacturer": None
    }
    
    # Regex patterns for device information
    model_patterns = [
        r'Model[:\s]+([A-Za-z0-9\-\.]+)',
        r'Device[:\s]+([A-Za-z0-9\-\.]+)'
    ]
    
    serial_patterns = [
        r'S/N[:\s]+([A-Za-z0-9\-\.]+)',
        r'Serial[:\s]+([A-Za-z0-9\-\.]+)',
        r'Serial Number[:\s]+([A-Za-z0-9\-\.]+)'
    ]
    
    manufacturer_patterns = [
        r'Mfg[:\s]+([A-Za-z0-9\-\.]+)',
        r'Manufacturer[:\s]+([A-Za-z0-9\-\.]+)'
    ]
    
    # Search for patterns in text lines
    for line in text_lines:
        for pattern in model_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match and not device_info["model"]:
                device_info["model"] = match.group(1).strip()
                
        for pattern in serial_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match and not device_info["serialNumber"]:
                device_info["serialNumber"] = match.group(1).strip()
                
        for pattern in manufacturer_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match and not device_info["manufacturer"]:
                device_info["manufacturer"] = match.group(1).strip()
    
    return device_info

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 