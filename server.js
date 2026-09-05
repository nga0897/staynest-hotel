require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const basicAuth = require("express-basic-auth");

const app = express();
const DEFAULT_PORT = Number(process.env.PORT || 3001);
const dataPath = path.join(__dirname, "data", "hotel.json");
const uploadPath = path.join(__dirname, "public", "uploads");
fs.mkdirSync(uploadPath, { recursive: true });

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_USER || !ADMIN_PASSWORD) {
  console.error(
    "Thiếu biến môi trường ADMIN_USER / ADMIN_PASSWORD — cần set để bảo vệ trang quản trị trước khi chạy server.",
  );
  process.exit(1);
}

const adminAuth = basicAuth({
  users: { [ADMIN_USER]: ADMIN_PASSWORD },
  challenge: true,
  realm: "StayNest Admin",
});

const ALLOWED_MEDIA_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".mp4",
  ".webm",
  ".mov",
]);

function isValidMediaSignature(extension, filePath) {
  const fd = fs.openSync(filePath, "r");
  const header = Buffer.alloc(12);
  fs.readSync(fd, header, 0, 12, 0);
  fs.closeSync(fd);

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    case ".png":
      return (
        header[0] === 0x89 &&
        header[1] === 0x50 &&
        header[2] === 0x4e &&
        header[3] === 0x47
      );
    case ".gif":
      return header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46;
    case ".webp":
      return (
        header[0] === 0x52 &&
        header[1] === 0x49 &&
        header[2] === 0x46 &&
        header[3] === 0x46 &&
        header[8] === 0x57 &&
        header[9] === 0x45 &&
        header[10] === 0x42 &&
        header[11] === 0x50
      );
    case ".mp4":
    case ".mov":
      return (
        header[4] === 0x66 &&
        header[5] === 0x74 &&
        header[6] === 0x79 &&
        header[7] === 0x70
      );
    case ".webm":
      return (
        header[0] === 0x1a &&
        header[1] === 0x45 &&
        header[2] === 0xdf &&
        header[3] === 0xa3
      );
    default:
      return false;
  }
}

const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: uploadPath,
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(
        null,
        `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`,
      );
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const isAllowed =
      ALLOWED_MEDIA_EXTENSIONS.has(extension) &&
      (file.mimetype.startsWith("image/") ||
        file.mimetype.startsWith("video/"));
    callback(null, isAllowed);
  },
});

app.use(express.json());

app.get("/admin", adminAuth, (_req, res) =>
  res.sendFile(path.join(__dirname, "views", "admin.html")),
);

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/upload", adminAuth, mediaUpload.single("image"), (req, res) => {
  if (!req.file)
    return res.status(400).json({
      error: "Vui lòng chọn một file ảnh hoặc video hợp lệ dưới 20 MB",
    });

  const extension = path.extname(req.file.filename).toLowerCase();
  if (!isValidMediaSignature(extension, req.file.path)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({
      error: "File không đúng định dạng ảnh/video hợp lệ",
    });
  }

  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

function readHotel() {
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

function writeHotel(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

app.get("/api/hotel", (_req, res) => res.json(readHotel()));

app.put("/api/hotel", adminAuth, (req, res) => {
  const current = readHotel();
  const next = { ...current, ...req.body, rooms: current.rooms };
  writeHotel(next);
  res.json(next);
});

app.post("/api/rooms", adminAuth, (req, res) => {
  const hotel = readHotel();
  const room = { ...req.body, id: req.body.id || `room-${Date.now()}` };
  hotel.rooms.push(room);
  writeHotel(hotel);
  res.status(201).json(room);
});

app.put("/api/rooms/:id", adminAuth, (req, res) => {
  const hotel = readHotel();
  const index = hotel.rooms.findIndex((room) => room.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy phòng" });
  }

  hotel.rooms[index] = {
    ...hotel.rooms[index],
    ...req.body,
    id: req.params.id,
  };
  writeHotel(hotel);
  res.json(hotel.rooms[index]);
});

app.delete("/api/rooms/:id", adminAuth, (req, res) => {
  const hotel = readHotel();
  const rooms = hotel.rooms.filter((room) => room.id !== req.params.id);
  if (rooms.length === hotel.rooms.length)
    return res.status(404).json({ error: "Không tìm thấy phòng" });
  hotel.rooms = rooms;
  writeHotel(hotel);
  res.json({ success: true });
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`StayNest đang chạy tại http://localhost:${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      const nextPort = port + 1;
      console.log(`Port ${port} đang bận, thử chạy trên cổng ${nextPort}...`);
      startServer(nextPort);
      return;
    }

    throw error;
  });
}

startServer(DEFAULT_PORT);
