const hotelForm = document.getElementById("hotelForm");
const roomForm = document.getElementById("roomForm");
const saveStatus = document.getElementById("saveStatus");
let hotelData;

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Upload ảnh thất bại");
  return result.url;
}

function connectImagePicker(fileId, urlName, previewId) {
  const fileInput = document.getElementById(fileId);
  const urlInput = hotelForm.elements[urlName] || roomForm.elements[urlName];
  const preview = document.getElementById(previewId);
  fileInput.addEventListener("change", async () => {
    if (!fileInput.files[0]) return;
    try {
      saveStatus.textContent = "Đang tải ảnh...";
      urlInput.value = await uploadImage(fileInput.files[0]);
      preview.src = urlInput.value;
      preview.classList.remove("hidden");
      saveStatus.textContent = "Ảnh đã tải lên, hãy lưu thay đổi";
    } catch (error) {
      saveStatus.textContent = error.message;
      fileInput.value = "";
    }
  });
  urlInput.addEventListener("input", () => {
    if (urlInput.value) {
      preview.src = urlInput.value;
      preview.classList.remove("hidden");
    }
  });
}

function fillForm() {
  Object.entries(hotelData).forEach(([key, value]) => {
    const field = hotelForm.elements[key];
    if (field) field.value = Array.isArray(value) ? value.join("\n") : value;
  });
}
function renderRooms() {
  document.getElementById("adminRooms").innerHTML = hotelData.rooms
    .map(
      (room) =>
        `<article class="admin-room"><img src="${room.image}" alt=""><div><h3>${room.name}</h3><p>${room.size} · ${room.price}đ / đêm</p></div><button class="delete-room" data-id="${room.id}" title="Xóa phòng">×</button></article>`,
    )
    .join("");
  document.querySelectorAll(".delete-room").forEach((button) =>
    button.addEventListener("click", async () => {
      if (!confirm("Xóa phòng này?")) return;
      await fetch(`/api/rooms/${button.dataset.id}`, { method: "DELETE" });
      hotelData.rooms = hotelData.rooms.filter(
        (room) => room.id !== button.dataset.id,
      );
      renderRooms();
    }),
  );
}
async function load() {
  const response = await fetch("/api/hotel");
  hotelData = await response.json();
  fillForm();
  renderRooms();
  saveStatus.textContent = "Đã kết nối";
}
hotelForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(hotelForm));
  body.amenities = body.amenities
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const response = await fetch("/api/hotel", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  hotelData = await response.json();
  saveStatus.textContent =
    "Đã lưu lúc " + new Date().toLocaleTimeString("vi-VN");
});
document
  .getElementById("toggleRoomForm")
  .addEventListener("click", () => roomForm.classList.toggle("hidden"));
roomForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(roomForm));
  if (!body.image)
    return (saveStatus.textContent = "Hãy chọn ảnh hoặc nhập URL ảnh phòng");
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  hotelData.rooms.push(await response.json());
  roomForm.reset();
  roomForm.classList.add("hidden");
  renderRooms();
});
connectImagePicker("heroImageFile", "heroImage", "heroPreview");
connectImagePicker("roomImageFile", "image", "roomPreview");
load().catch(() => {
  saveStatus.textContent = "Không kết nối được server";
});
