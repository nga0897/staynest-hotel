async function loadHotel() {
  const response = await fetch("/api/hotel");
  const hotel = await response.json();

  document.title = `${hotel.name} Hotel`;
  document.getElementById("brandName").textContent = hotel.name;
  document.getElementById("location").textContent =
    hotel.location.toUpperCase();
  document.getElementById("tagline").textContent = hotel.tagline;
  document.getElementById("description").textContent = hotel.description;
  document.getElementById("heroImage").style.backgroundImage =
    `url(${hotel.heroImage})`;
  document.getElementById("email").textContent = hotel.contact;
  document.getElementById("email").href = `mailto:${hotel.contact}`;
  document.getElementById("phone").textContent = hotel.phone;
  document.getElementById("phone").href =
    `tel:${hotel.phone.replace(/\s/g, "")}`;

  const facebookUrl = hotel.facebook || "https://facebook.com";
  const facebookLink = document.getElementById("facebookLink");
  facebookLink.href = facebookUrl;
  facebookLink.textContent =
    facebookUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") ||
    "facebook.com";

  const webchatImage = document.getElementById("webchatImage");
  if (hotel.webchatImage) {
    webchatImage.src = hotel.webchatImage;
  } else {
    webchatImage.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400'%3E%3Crect width='600' height='400' fill='%23f3f0e8'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23183d35' font-family='Arial' font-size='24'%3EWebchat%3C/text%3E%3C/svg%3E";
  }

  const address =
    hotel.address ||
    "Huỳnh Văn Nghệ, Hiệp Phước, Nhơn Trạch, Đồng Nai, Việt Nam";
  const encodedAddress = encodeURIComponent(address);
  document.getElementById("address").textContent = address;
  document.getElementById("hotelMap").src =
    `https://www.google.com/maps?q=${encodedAddress}&output=embed`;
  document.getElementById("mapLink").href =
    `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

  document.getElementById("roomGrid").innerHTML = hotel.rooms
    .map(
      (room, index) => `
    <article class="room-card">
      <div class="room-image" style="background-image:url('${room.image}')"><span class="room-number">0${index + 1}</span></div>
      <div class="room-content"><div><h3>${room.name}</h3><p>${room.description}</p></div><div class="room-foot"><span>${room.size} · từ ${room.price}đ / đêm</span><a href="#contact" aria-label="Đặt ${room.name}">↗</a></div></div>
    </article>`,
    )
    .join("");

  document.getElementById("amenities").innerHTML = hotel.amenities
    .map(
      (item, index) =>
        `<div class="amenity"><span>0${index + 1}</span><strong>${item}</strong><span>↗</span></div>`,
    )
    .join("");
}

loadHotel().catch(() => {
  document.getElementById("description").textContent =
    "Không thể tải dữ liệu khách sạn.";
});
