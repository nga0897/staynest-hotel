const hotelForm = document.getElementById("hotelForm");
const roomForm = document.getElementById("roomForm");
const saveStatus = document.getElementById("saveStatus");
const languageKeys = ["vi", "zh", "ko"];
let hotelData;
let editingRoomId = null;

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function getTextByLang(value, lang) {
  if (!value) return "";
  if (typeof value === "object" && !Array.isArray(value)) {
    return value[lang] || value.vi || value.zh || value.ko || "";
  }
  return value;
}

function getListByLang(value, lang) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    return value[lang] || value.vi || value.zh || value.ko || [];
  }
  return [];
}

function buildMultilingualObject(prefix, form) {
  const output = {};
  languageKeys.forEach((lang) => {
    const value = (form.get(`${prefix}_${lang}`) || "").trim();
    if (value) output[lang] = value;
  });
  return Object.keys(output).length ? output : "";
}

function buildAmenityObject(form) {
  const output = {};
  languageKeys.forEach((lang) => {
    const value = (form.get(`amenities_${lang}`) || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (value.length) output[lang] = value;
  });
  return Object.keys(output).length ? output : [];
}

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

  if (!fileInput || !urlInput || !preview) return;

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
  ["name", "location", "address", "tagline", "description"].forEach((key) => {
    languageKeys.forEach((lang) => {
      const field = hotelForm.elements[`${key}_${lang}`];
      if (field) field.value = getTextByLang(hotelData[key], lang);
    });
  });

  languageKeys.forEach((lang) => {
    const field = hotelForm.elements[`amenities_${lang}`];
    if (field) {
      const list = getListByLang(hotelData.amenities, lang);
      field.value = list.join("\n");
    }
  });

  if (hotelForm.elements.contact)
    hotelForm.elements.contact.value = hotelData.contact || "";
  if (hotelForm.elements.phone)
    hotelForm.elements.phone.value = hotelData.phone || "";
  if (hotelForm.elements.facebook)
    hotelForm.elements.facebook.value = hotelData.facebook || "";
  if (hotelForm.elements.googleMap)
    hotelForm.elements.googleMap.value = hotelData.googleMap || "";

  if (hotelForm.elements.heroImage) {
    hotelForm.elements.heroImage.value = hotelData.heroImage || "";
    if (hotelData.heroImage) {
      document.getElementById("heroPreview").src = hotelData.heroImage;
      document.getElementById("heroPreview").classList.remove("hidden");
    }
  }

  if (hotelForm.elements.video) {
    hotelForm.elements.video.value = hotelData.video || "";
    if (hotelData.video) {
      const videoPreview = document.getElementById("videoPreview");
      if (videoPreview) {
        videoPreview.src = hotelData.video;
        videoPreview.classList.remove("hidden");
      }
    }
  }

  if (hotelForm.elements.webchatImage) {
    hotelForm.elements.webchatImage.value = hotelData.webchatImage || "";
    if (hotelData.webchatImage) {
      document.getElementById("webchatPreview").src = hotelData.webchatImage;
      document.getElementById("webchatPreview").classList.remove("hidden");
    }
  }
}

function resetRoomForm() {
  roomForm.reset();
  editingRoomId = null;
  document.getElementById("toggleRoomForm").textContent = "+ Thêm phòng";
  document.querySelector("#roomForm .save-button").textContent = "Thêm phòng ";
  const saveLabel = document.querySelector("#roomForm .save-button");
  if (saveLabel) saveLabel.innerHTML = "Thêm phòng <span>↗</span>";
}

function populateRoomForm(room) {
  roomForm.elements.name_vi.value = getTextByLang(room.name, "vi") || "";
  roomForm.elements.name_zh.value = getTextByLang(room.name, "zh") || "";
  roomForm.elements.name_ko.value = getTextByLang(room.name, "ko") || "";
  roomForm.elements.price.value = room.price || "";
  roomForm.elements.size.value = room.size || "";
  roomForm.elements.image.value = room.image || "";
  roomForm.elements.description_vi.value =
    getTextByLang(room.description, "vi") || "";
  roomForm.elements.description_zh.value =
    getTextByLang(room.description, "zh") || "";
  roomForm.elements.description_ko.value =
    getTextByLang(room.description, "ko") || "";

  if (room.image) {
    const roomPreview = document.getElementById("roomPreview");
    roomPreview.src = room.image;
    roomPreview.classList.remove("hidden");
  }
}

function renderRooms() {
  document.getElementById("adminRooms").innerHTML = (hotelData.rooms || [])
    .map((room) => {
      const roomName = getTextByLang(room.name, "vi") || "Phòng";
      const roomSize = room.size || "";
      const roomPrice = room.price || "";
      const roomPriceText =
        roomPrice.includes("đ") ||
        roomPrice.includes("₫") ||
        roomPrice.includes("$")
          ? roomPrice
          : `${roomPrice}đ`;
      return `<article class="admin-room"><img src="${escapeHtml(room.image)}" alt=""><div><h3>${escapeHtml(roomName)}</h3><p>${escapeHtml(roomSize)} · ${escapeHtml(roomPriceText)} / đêm</p></div><div class="admin-room-actions"><button class="edit-room" data-id="${escapeHtml(room.id)}" title="Sửa phòng">Sửa</button><button class="delete-room" data-id="${escapeHtml(room.id)}" title="Xóa phòng">×</button></div></article>`;
    })
    .join("");

  document.querySelectorAll(".edit-room").forEach((button) =>
    button.addEventListener("click", () => {
      const room = hotelData.rooms.find(
        (item) => item.id === button.dataset.id,
      );
      if (!room) return;
      editingRoomId = room.id;
      populateRoomForm(room);
      document.getElementById("toggleRoomForm").textContent = "× Hủy";
      const saveButton = document.querySelector("#roomForm .save-button");
      if (saveButton) saveButton.innerHTML = "Cập nhật phòng <span>↗</span>";
      roomForm.classList.remove("hidden");
    }),
  );

  document.querySelectorAll(".delete-room").forEach((button) =>
    button.addEventListener("click", async () => {
      if (!confirm("Xóa phòng này?")) return;
      await fetch(`/api/rooms/${button.dataset.id}`, { method: "DELETE" });
      hotelData.rooms = hotelData.rooms.filter(
        (room) => room.id !== button.dataset.id,
      );
      renderRooms();
      if (editingRoomId === button.dataset.id) resetRoomForm();
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

  const formData = new FormData(hotelForm);
  const body = {
    heroImage: formData.get("heroImage") || hotelData.heroImage,
    contact: formData.get("contact") || hotelData.contact,
    phone: formData.get("phone") || hotelData.phone,
    facebook: formData.get("facebook") || hotelData.facebook,
    googleMap: formData.get("googleMap") || hotelData.googleMap,
    video: formData.get("video") || hotelData.video,
    webchatImage: formData.get("webchatImage") || hotelData.webchatImage,
    name: buildMultilingualObject("name", formData),
    location: buildMultilingualObject("location", formData),
    address: buildMultilingualObject("address", formData),
    tagline: buildMultilingualObject("tagline", formData),
    description: buildMultilingualObject("description", formData),
    amenities: buildAmenityObject(formData),
  };

  const response = await fetch("/api/hotel", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  hotelData = await response.json();
  saveStatus.textContent =
    "Đã lưu lúc " + new Date().toLocaleTimeString("vi-VN");
  fillForm();
});

document.getElementById("toggleRoomForm").addEventListener("click", () => {
  if (roomForm.classList.contains("hidden")) {
    roomForm.classList.remove("hidden");
    document.getElementById("toggleRoomForm").textContent = "× Hủy";
  } else {
    resetRoomForm();
    roomForm.classList.add("hidden");
  }
});

roomForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(roomForm);
  const body = {
    price: formData.get("price"),
    size: formData.get("size"),
    image: formData.get("image"),
    name: buildMultilingualObject("name", formData),
    description: buildMultilingualObject("description", formData),
  };

  if (!body.image) {
    saveStatus.textContent = "Hãy chọn ảnh hoặc nhập URL ảnh phòng";
    return;
  }

  if (editingRoomId) {
    const response = await fetch(`/api/rooms/${editingRoomId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const updatedRoom = await response.json();
    hotelData.rooms = hotelData.rooms.map((room) =>
      room.id === editingRoomId ? { ...room, ...updatedRoom } : room,
    );
    saveStatus.textContent = "Đã cập nhật phòng";
  } else {
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const addedRoom = await response.json();
    hotelData.rooms.push(addedRoom);
    saveStatus.textContent = "Đã thêm phòng";
  }

  resetRoomForm();
  roomForm.classList.add("hidden");
  renderRooms();
});

connectImagePicker("heroImageFile", "heroImage", "heroPreview");
connectImagePicker("videoFile", "video", "videoPreview");
connectImagePicker("webchatImageFile", "webchatImage", "webchatPreview");
connectImagePicker("roomImageFile", "image", "roomPreview");

load().catch(() => {
  saveStatus.textContent = "Không kết nối được server";
});
