# Stock Management System

A Node.js web application for managing device deposits and barcode scanning. This system allows installers to create deposit tickets by taking pictures of devices, scanning barcodes, and automatically extracting device information.

## Features

- User authentication and role-based access control
- Admin panel for user management
- Deposit ticket creation and management
- Image upload and storage
- Barcode and text scanning using OCR (Tesseract.js)
- Automatic extraction of device information including serial numbers and MAC addresses
- RESTful API for mobile integration

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB, Mongoose
- **Authentication**: Passport.js, JWT
- **Frontend**: EJS templates, Bootstrap 5, jQuery
- **Image Processing**: Multer, Tesseract.js
- **Security**: bcrypt.js
- **ImageScan**: python 

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB

### Installation

1. Clone the repository
   ```
   git clone [repository-url]
   cd stock-management
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/stock-management
   SESSION_SECRET=your-session-secret
   JWT_SECRET=your-jwt-secret
   JWT_EXPIRE=1d
   ```

4. Seed the database with initial admin user
   ```
   npm run seed
   ```
   This will create an admin user with:
   - Email: admin@example.com
   - Password: admin123

### Running the Application

Development mode (with nodemon):
```
npm run dev
```

Production mode:
```
npm start
```

The application will be available at `http://localhost:3000`

## User Roles

### Admin
- Manage users (create, edit, delete)
- View all deposits
- Update deposit status
- Access system statistics

### Installator
- Create deposit tickets
- Upload device images
- Scan barcodes and text from images
- View own deposits

## API Endpoints

The system provides a RESTful API for mobile app integration:

- `/api/auth/login` - Authenticate user and get JWT token
- `/api/users/profile` - Get user profile
- `/api/deposits` - Get all deposits (filtered by user role)
- `/api/deposits/:id` - Get a specific deposit
- `/api/deposits` (POST) - Create a new deposit
- `/api/deposits/:id` (PUT) - Update a deposit
- `/api/deposits/:id` (DELETE) - Delete a deposit (admin only)
- `/api/deposits/:depositId/images/:imageId/scan` - Scan an image for barcodes and text

## License

ISC 