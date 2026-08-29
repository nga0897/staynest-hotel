const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const DEFAULT_PORT = Number(process.env.PORT || 3001);
const dataPath = path.join(__dirname, "data", "hotel.json");
const uploadPath = path.join(__dirname, "public", "uploads");
fs.mkdirSync(uploadPath, { recursive: true });

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
    const isAllowed =
      file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
    callback(null, isAllowed);
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/upload", mediaUpload.single("image"), (req, res) => {
  if (!req.file)
    return res
      .status(400)
      .json({
        error: "Vui lòng chọn một file ảnh hoặc video hợp lệ dưới 20 MB",
      });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

function readHotel() {
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

function writeHotel(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

app.get("/api/hotel", (_req, res) => res.json(readHotel()));

app.put("/api/hotel", (req, res) => {
  const current = readHotel();
  const next = { ...current, ...req.body, rooms: current.rooms };
  writeHotel(next);
  res.json(next);
});

app.post("/api/rooms", (req, res) => {
  const hotel = readHotel();
  const room = { ...req.body, id: req.body.id || `room-${Date.now()}` };
  hotel.rooms.push(room);
  writeHotel(hotel);
  res.status(201).json(room);
});

app.delete("/api/rooms/:id", (req, res) => {
  const hotel = readHotel();
  const rooms = hotel.rooms.filter((room) => room.id !== req.params.id);
  if (rooms.length === hotel.rooms.length)
    return res.status(404).json({ error: "Không tìm thấy phòng" });
  hotel.rooms = rooms;
  writeHotel(hotel);
  res.json({ success: true });
});

app.get("/admin", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html")),
);

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
