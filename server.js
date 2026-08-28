const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3001;
const dataPath = path.join(__dirname, "data", "hotel.json");
const uploadPath = path.join(__dirname, "public", "uploads");
fs.mkdirSync(uploadPath, { recursive: true });

const imageUpload = multer({
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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith("image/"));
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/upload", imageUpload.single("image"), (req, res) => {
  if (!req.file)
    return res
      .status(400)
      .json({ error: "Vui lòng chọn một file ảnh hợp lệ dưới 5 MB" });
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
app.listen(PORT, () =>
  console.log(`StayNest đang chạy tại http://localhost:${PORT}`),
);
