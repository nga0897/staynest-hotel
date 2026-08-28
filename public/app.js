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
