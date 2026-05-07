# Admin API Documentation

## Authentication

All admin routes require JWT authentication with admin role.

**Headers Required:**
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 1. Admin Login

**Endpoint:** `POST /api/auth/admin-login`

**Description:** Authenticate admin user and get JWT token

**Request Body:**
```json
{
  "email": "admin@codingkeda.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Admin login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "name": "Admin Name",
    "email": "admin@codingkeda.com",
    "role": "admin"
  }
}
```

**Error Responses:**
- `400` - Missing or invalid fields
- `401` - Invalid credentials
- `403` - Not an admin user
- `500` - Server error

---

## 2. Upload Media (Video/PDF/Image)

**Endpoint:** `POST /api/admin/upload`

**Description:** Upload media files to S3 and store metadata in database

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```
file: <File>
type: "video" | "pdf" | "image"
title: "Video Title" (optional, defaults to filename)
description: "Description" (optional)
tags: "tag1,tag2,tag3" (optional, comma-separated)
```

**Success Response (200):**
```json
{
  "success": true,
  "media": {
    "id": "uuid",
    "title": "Video Title",
    "url": "https://bucket.s3.region.amazonaws.com/videos/...",
    "key": "videos/timestamp-filename.mp4",
    "type": "VIDEO",
    "tags": ["tag1", "tag2"],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - No file, invalid type, invalid file type, file too large
- `401` - Unauthorized
- `403` - Not admin
- `500` - Upload failed

**File Size Limits:**
- Video: 500 MB
- PDF: 50 MB
- Image: 5 MB

---

## 3. Update Lesson Video

**Endpoint:** `POST /api/admin/lessons/[id]/update-video`

**Description:** Link video to a lesson (either by URL or Media ID)

**Request Body:**
```json
{
  "videoUrl": "https://s3.amazonaws.com/video.mp4",
  "mediaId": "uuid-of-uploaded-media"
}
```

**Note:** Provide either `videoUrl` OR `mediaId` (not both)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Video URL updated successfully.",
  "lesson": {
    "id": "uuid",
    "title": "Lesson Title",
    "videoUrl": "https://...",
    "moduleId": "uuid",
    "moduleName": "Module 1",
    "courseId": "uuid"
  }
}
```

**Error Responses:**
- `400` - Missing videoUrl and mediaId
- `401` - Unauthorized
- `403` - Not admin
- `404` - Lesson not found or Media not found
- `500` - Server error

---

## 4. Update Lesson PDF

**Endpoint:** `POST /api/admin/lessons/[id]/update-pdf`

**Description:** Link PDF notes to a lesson (either by URL or Media ID)

**Request Body:**
```json
{
  "pdfUrl": "https://s3.amazonaws.com/notes.pdf",
  "mediaId": "uuid-of-uploaded-media",
  "notes": "Direct text notes or URL"
}
```

**Note:** Provide either `pdfUrl`, `mediaId`, OR `notes`

**Success Response (200):**
```json
{
  "success": true,
  "message": "PDF URL updated successfully.",
  "lesson": {
    "id": "uuid",
    "title": "Lesson Title",
    "notes": "https://...",
    "moduleId": "uuid",
    "moduleName": "Module 1",
    "courseId": "uuid"
  }
}
```

**Error Responses:**
- `400` - Missing all fields
- `401` - Unauthorized
- `403` - Not admin
- `404` - Lesson not found or Media not found
- `500` - Server error

---

## 5. Update Course

**Endpoint:** `POST /api/admin/courses/[id]/update`

**Description:** Update course details (partial update supported)

**Request Body (all fields optional):**
```json
{
  "title": "Updated Course Title",
  "subtitle": "Updated subtitle",
  "category": "Programming",
  "instructor": "Instructor Name",
  "institute": "Institute Name",
  "price": 999,
  "isFree": false,
  "totalHours": 40,
  "totalVideos": 120,
  "hasCert": true,
  "color": "from-purple-500 to-pink-500",
  "icon": "fa-code",
  "isActive": true,
  "rating": 4.5,
  "students": 1500
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Course updated successfully.",
  "course": {
    "id": "uuid",
    "title": "Updated Course Title",
    "subtitle": "Updated subtitle",
    "category": "Programming",
    "instructor": "Instructor Name",
    "institute": "Institute Name",
    "price": 999,
    "isFree": false,
    "totalHours": 40,
    "totalVideos": 120,
    "hasCert": true,
    "color": "from-purple-500 to-pink-500",
    "icon": "fa-code",
    "isActive": true,
    "rating": 4.5,
    "students": 1500,
    "enrollmentCount": 150,
    "modules": [
      {
        "id": "uuid",
        "title": "Module 1",
        "order": 1
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Invalid field values or no fields provided
- `401` - Unauthorized
- `403` - Not admin
- `404` - Course not found
- `500` - Server error

**Validation Rules:**
- `price`: Must be >= 0
- `totalHours`: Must be >= 0
- `totalVideos`: Must be >= 0
- `rating`: Must be between 0 and 5
- `students`: Must be >= 0

---

## Usage Examples

### Example 1: Complete Workflow - Upload Video and Link to Lesson

```javascript
// Step 1: Login as admin
const loginRes = await fetch('/api/auth/admin-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@codingkeda.com',
    password: 'password123'
  })
});
const { token } = await loginRes.json();

// Step 2: Upload video
const formData = new FormData();
formData.append('file', videoFile);
formData.append('type', 'video');
formData.append('title', 'Introduction to React');
formData.append('tags', 'react,javascript,frontend');

const uploadRes = await fetch('/api/admin/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
const { media } = await uploadRes.json();

// Step 3: Link video to lesson
const updateRes = await fetch('/api/admin/lessons/lesson-uuid/update-video', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ mediaId: media.id })
});
```

### Example 2: Update Course Details

```javascript
const response = await fetch('/api/admin/courses/course-uuid/update', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Advanced React Masterclass',
    price: 1999,
    rating: 4.8,
    isActive: true
  })
});
```

---

## Security Notes

1. All routes check for valid JWT token
2. All routes verify admin role
3. File uploads validate file type and size
4. SQL injection protected by Prisma ORM
5. Passwords hashed with bcryptjs
6. Token expires in 7 days

---

## Error Handling

All routes follow consistent error response format:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (no token or invalid token)
- `403` - Forbidden (not admin)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error
