const hotelForm = document.getElementById("hotelForm");
const roomForm = document.getElementById("roomForm");
const saveStatus = document.getElementById("saveStatus");
const languageKeys = ["vi", "zh", "ko"];
let hotelData;

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
  ["name", "location", "tagline", "description"].forEach((key) => {
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
      return `<article class="admin-room"><img src="${room.image}" alt=""><div><h3>${roomName}</h3><p>${roomSize} · ${roomPriceText} / đêm</p></div><button class="delete-room" data-id="${room.id}" title="Xóa phòng">×</button></article>`;
    })
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

  const formData = new FormData(hotelForm);
  const body = {
    heroImage: formData.get("heroImage") || hotelData.heroImage,
    contact: formData.get("contact") || hotelData.contact,
    phone: formData.get("phone") || hotelData.phone,
    facebook: formData.get("facebook") || hotelData.facebook,
    video: formData.get("video") || hotelData.video,
    webchatImage: formData.get("webchatImage") || hotelData.webchatImage,
    name: buildMultilingualObject("name", formData),
    location: buildMultilingualObject("location", formData),
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

document
  .getElementById("toggleRoomForm")
  .addEventListener("click", () => roomForm.classList.toggle("hidden"));

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

  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const addedRoom = await response.json();
  hotelData.rooms.push(addedRoom);
  roomForm.reset();
  roomForm.classList.add("hidden");
  renderRooms();
  saveStatus.textContent = "Đã thêm phòng";
});

connectImagePicker("heroImageFile", "heroImage", "heroPreview");
connectImagePicker("videoFile", "video", "videoPreview");
connectImagePicker("webchatImageFile", "webchatImage", "webchatPreview");
connectImagePicker("roomImageFile", "image", "roomPreview");

load().catch(() => {
  saveStatus.textContent = "Không kết nối được server";
});
